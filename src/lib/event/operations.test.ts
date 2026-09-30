import { describe, expect, it, vi } from 'vitest'
import { planDraw } from '../draw/selectWinner'
import { createEmptyEvent } from './defaults'
import { BUILT_IN_TEMPLATES, createDemoEvent } from './demo'
import {
  addParticipants, addPrize, clearParticipants, clearWinnerHistory, deleteWinnerRecord, duplicateEvent, duplicateKey, ensureActivePrize,
  eventFromTemplate, eventToTemplate, findDuplicateIds, getActivePrize, getEligibleParticipants, prizeRemaining, recordWinner, removeDuplicates,
  removeParticipants, removePrize, resetEvent, setActivePrize, setPrizeEnabled, shuffleParticipants, undoLastDraw, updateParticipant, FriendlyError,
} from './operations'

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Person ${i + 1}` }))
const withPeople = (n: number) => addParticipants(createEmptyEvent('T'), names(n), { preventDuplicates: false }).event

describe('participants', () => {
  it('adds, trims and skips empty names', () => {
    const r = addParticipants(createEmptyEvent(), [{ name: '  John   Doe ' }, { name: '' }, { name: '   ' }, { name: 'Jane', email: 'j@x.com', phone: '0100' }], { preventDuplicates: false })
    expect(r.added).toBe(2)
    expect(r.skippedInvalid).toBe(2)
    expect(r.event.participants[0].name).toBe('John Doe')
    expect(r.event.participants[1]).toMatchObject({ email: 'j@x.com', phone: '0100' })
  })

  it('handles 1,000 participants quickly', () => {
    const t0 = performance.now()
    const e = withPeople(1000)
    expect(e.participants).toHaveLength(1000)
    expect(getEligibleParticipants(e)).toHaveLength(1000)
    expect(performance.now() - t0).toBeLessThan(500)
  })

  it('detects duplicates case-, space- and accent-insensitively', () => {
    expect(duplicateKey('  José  Pérez ')).toBe(duplicateKey('jose perez'))
    const e = addParticipants(createEmptyEvent(), [{ name: 'Ann' }, { name: 'ann ' }, { name: 'Bob' }], { preventDuplicates: false }).event
    expect(findDuplicateIds(e.participants).size).toBe(2)
    const r = removeDuplicates(e)
    expect(r.removed).toBe(1)
    expect(r.event.participants.map((p) => p.name)).toEqual(['Ann', 'Bob'])
  })

  it('optionally prevents duplicates (within the batch and against the list)', () => {
    const e = addParticipants(createEmptyEvent(), [{ name: 'Ann' }], { preventDuplicates: true }).event
    const r = addParticipants(e, [{ name: 'ANN' }, { name: 'Bob' }, { name: 'bob' }], { preventDuplicates: true })
    expect(r.added).toBe(1)
    expect(r.skippedDuplicates).toBe(2)
  })

  it('edits, rejects empty/duplicate edits, deletes, clears, shuffles', () => {
    let e = withPeople(5)
    const id = e.participants[0].id
    e = updateParticipant(e, id, { name: 'New Name', email: 'a@b.c' }, { preventDuplicates: false })
    expect(e.participants[0]).toMatchObject({ name: 'New Name', email: 'a@b.c' })
    expect(() => updateParticipant(e, id, { name: '  ' }, { preventDuplicates: false })).toThrow(FriendlyError)
    expect(() => updateParticipant(e, id, { name: 'person 2' }, { preventDuplicates: true })).toThrow(FriendlyError)
    e = removeParticipants(e, [e.participants[1].id, e.participants[2].id])
    expect(e.participants).toHaveLength(3)
    const shuffled = shuffleParticipants(withPeople(50))
    expect(new Set(shuffled.participants.map((p) => p.name)).size).toBe(50)
    expect(clearParticipants(e).participants).toHaveLength(0)
  })
})

describe('draws, winner removal and undo', () => {
  it('winner is removed from future draws when removeFromPool is on', () => {
    let e = withPeople(3)
    const winner = e.participants[1]
    e = recordWinner(e, { participant: winner, prize: null, mode: 'dramatic', removeFromPool: true }).event
    const eligible = getEligibleParticipants(e)
    expect(eligible).toHaveLength(2)
    expect(eligible.find((p) => p.id === winner.id)).toBeUndefined()
  })

  it('winner stays eligible when removeFromPool is off', () => {
    let e = withPeople(3)
    e = recordWinner(e, { participant: e.participants[0], prize: null, mode: 'standard', removeFromPool: false }).event
    expect(getEligibleParticipants(e)).toHaveLength(3)
  })

  it('undo last draw restores the removed winner and prize stock', () => {
    let e = withPeople(4)
    const { event: withPrize, prize } = addPrize(e, { name: 'Phone', quantity: 2 })
    e = withPrize
    e = recordWinner(e, { participant: e.participants[0], prize, mode: 'dramatic', removeFromPool: true }).event
    e = recordWinner(e, { participant: e.participants[1], prize, mode: 'dramatic', removeFromPool: true }).event
    expect(prizeRemaining(e, prize)).toBe(0)
    expect(getEligibleParticipants(e)).toHaveLength(2)
    const r = undoLastDraw(e)
    expect(r.undone?.participantId).toBe(e.participants[1].id)
    expect(r.undone?.drawNumber).toBe(2)
    expect(getEligibleParticipants(r.event)).toHaveLength(3)
    expect(prizeRemaining(r.event, prize)).toBe(1)
    expect(r.event.auditLog.at(-1)?.message).toMatch(/undone/)
    expect(undoLastDraw(createEmptyEvent()).undone).toBeNull()
  })

  it('draw numbers increase; delete record / clear history / reset restore eligibility', () => {
    let e = withPeople(5)
    for (let i = 0; i < 3; i++) e = recordWinner(e, { participant: e.participants[i], prize: null, mode: 'standard', removeFromPool: true }).event
    expect(e.winnerHistory.map((w) => w.drawNumber)).toEqual([1, 2, 3])
    e = deleteWinnerRecord(e, e.winnerHistory[0].id)
    expect(getEligibleParticipants(e)).toHaveLength(3)
    expect(recordWinner(e, { participant: e.participants[4], prize: null, mode: 'standard', removeFromPool: true }).record.drawNumber).toBe(4)
    expect(getEligibleParticipants(clearWinnerHistory(e))).toHaveLength(5)
    const reset = resetEvent(e)
    expect(reset.winnerHistory).toHaveLength(0)
    expect(reset.participants).toHaveLength(5)
  })

  it('planDraw picks with crypto, never Math.random, and validates', () => {
    const mathSpy = vi.spyOn(Math, 'random')
    const e = withPeople(10)
    const p = planDraw(e)
    expect(p.ok).toBe(true)
    if (p.ok) {
      expect(p.eligible[p.index]).toBe(p.winner)
      expect(p.eligible).toHaveLength(10)
    }
    expect(mathSpy).not.toHaveBeenCalled()
    mathSpy.mockRestore()
    expect(planDraw(createEmptyEvent()).ok).toBe(false)
  })

  it('planDraw with a single participant always picks them', () => {
    const e = withPeople(1)
    for (let i = 0; i < 20; i++) {
      const p = planDraw(e)
      expect(p.ok && p.index).toBe(0)
    }
  })

  it('planDraw refuses when everyone has won or the prize is out of stock', () => {
    let e = withPeople(1)
    e = recordWinner(e, { participant: e.participants[0], prize: null, mode: 'standard', removeFromPool: true }).event
    const r = planDraw(e)
    expect(r.ok).toBe(false)
    let f = withPeople(3)
    const { event, prize } = addPrize(f, { name: 'Cap', quantity: 1 })
    f = recordWinner(event, { participant: event.participants[0], prize, mode: 'standard', removeFromPool: true }).event
    const r2 = planDraw(f)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toMatch(/given away/)
  })

  it('multiple winners: sequential draws with exclusion produce distinct winners', () => {
    const e = withPeople(12)
    const exclude = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const p = planDraw(e, exclude)
      expect(p.ok).toBe(true)
      if (p.ok) {
        expect(exclude.has(p.winner.id)).toBe(false)
        exclude.add(p.winner.id)
      }
    }
    expect(exclude.size).toBe(10)
  })

  it('selection is fair across participants (every one of 10 wins in 5,000 draws, chi-square)', () => {
    const e = withPeople(10)
    const counts = new Map<string, number>()
    for (let i = 0; i < 5000; i++) {
      const p = planDraw(e)
      if (p.ok) counts.set(p.winner.id, (counts.get(p.winner.id) ?? 0) + 1)
    }
    expect(counts.size).toBe(10)
    const chi = [...counts.values()].reduce((s, o) => s + (o - 500) ** 2 / 500, 0)
    expect(chi).toBeLessThan(33.7)
  })
})

describe('prizes', () => {
  it('adds, tracks remaining quantity, selects, disables, deletes with fallback', () => {
    let e = createEmptyEvent()
    const a = addPrize(e, { name: 'A', quantity: 3 })
    e = a.event
    expect(e.activePrizeId).toBe(a.prize.id) // first prize becomes active
    const b = addPrize(e, { name: 'B', quantity: 1, image: 'data:image/png;base64,xx' })
    e = setActivePrize(b.event, b.prize.id)
    expect(getActivePrize(e)?.name).toBe('B')
    e = setPrizeEnabled(e, b.prize.id, false)
    expect(getActivePrize(e)?.name).toBe('A')
    e = removePrize(e, a.prize.id)
    expect(e.activePrizeId).toBeNull()
    expect(() => addPrize(e, { name: ' ', quantity: 1 })).toThrow(FriendlyError)
    expect(addPrize(e, { name: 'Q', quantity: -4 }).prize.quantity).toBe(1)
    expect(ensureActivePrize(e)).toBe(e)
  })
})

describe('events & templates', () => {
  it('demo event has ~30 names, prizes, and is labelled demo', () => {
    const d = createDemoEvent()
    expect(d.isDemo).toBe(true)
    expect(d.participants.length).toBeGreaterThanOrEqual(25)
    expect(d.prizes.length).toBeGreaterThanOrEqual(4)
    expect(getActivePrize(d)).not.toBeNull()
  })

  it('duplicate keeps participants/prizes, resets winners, gets new ids', () => {
    let e = withPeople(4)
    e = addPrize(e, { name: 'X', quantity: 1 }).event
    e = recordWinner(e, { participant: e.participants[0], prize: null, mode: 'standard', removeFromPool: true }).event
    const d = duplicateEvent(e)
    expect(d.id).not.toBe(e.id)
    expect(d.participants).toHaveLength(4)
    expect(d.participants[0].id).not.toBe(e.participants[0].id)
    expect(d.winnerHistory).toHaveLength(0)
    expect(d.activePrizeId).toBe(d.prizes[0].id)
  })

  it('templates keep branding/settings/prizes but not participants or winners', () => {
    let e = withPeople(5)
    e = addPrize(e, { name: 'Trip', quantity: 2 }).event
    e = { ...e, branding: { ...e.branding, primaryColor: '#123456' }, animationSettings: { ...e.animationSettings, mode: 'grand' } }
    e = recordWinner(e, { participant: e.participants[0], prize: null, mode: 'grand', removeFromPool: true }).event
    const t = eventToTemplate(e, 'My template')
    const fresh = eventFromTemplate(t, 'Next year')
    expect(fresh.eventName).toBe('Next year')
    expect(fresh.participants).toHaveLength(0)
    expect(fresh.winnerHistory).toHaveLength(0)
    expect(fresh.prizes.map((p) => p.name)).toEqual(['Trip'])
    expect(fresh.branding.primaryColor).toBe('#123456')
    expect(fresh.animationSettings.mode).toBe('grand')
    expect(BUILT_IN_TEMPLATES.length).toBe(5)
  })
})
