import { describe, expect, it } from 'vitest'
import { createDemoEvent } from '../event/demo'
import { recordWinner } from '../event/operations'
import { sanitizeEvent } from '../event/sanitize'
import { eventFromJson, eventToJson, winnersToCsv } from './exporters'

describe('import / export', () => {
  it('round-trips a full event (participants, prizes, winners, branding, settings, metadata)', () => {
    let e = createDemoEvent()
    e = recordWinner(e, { participant: e.participants[3], prize: e.prizes[0], mode: 'grand', removeFromPool: true }).event
    e = { ...e, branding: { ...e.branding, companyName: 'ACME', primaryColor: '#112233' }, participants: e.participants.map((p, i) => (i === 0 ? { ...p, metadata: { Team: 'Red' } } : p)) }
    const back = eventFromJson(eventToJson(e))
    expect(back).toEqual(e)
  })

  it('accepts a bare event object too', () => {
    const e = createDemoEvent()
    expect(eventFromJson(JSON.stringify(e)).id).toBe(e.id)
  })

  it('rejects invalid JSON and non-event data with friendly messages', () => {
    expect(() => eventFromJson('{not json')).toThrow(/valid event file/)
    expect(() => eventFromJson('42')).toThrow(/couldn’t read/)
    expect(() => eventFromJson('{"foo":1}')).toThrow()
  })

  it('repairs corrupt fields instead of crashing', () => {
    const e = sanitizeEvent({
      eventName: 'Broken',
      participants: [{ name: 'Ok' }, { name: '' }, null, 5, { name: 'Dup', id: 'x' }, { name: 'Dup2', id: 'x' }],
      prizes: [{ name: 'P', quantity: 'lots' }, { nope: true }],
      winnerHistory: [{ participantName: 'Ok', drawNumber: 'x' }, 'bad'],
      branding: { primaryColor: 'red', logo: 'javascript:alert(1)' },
      wheelSettings: { winnersPerDraw: 7 },
      animationSettings: { mode: 'crazy', spinDuration: 9999 },
    })!
    expect(e.participants.map((p) => p.name)).toEqual(['Ok', 'Dup', 'Dup2'])
    expect(new Set(e.participants.map((p) => p.id)).size).toBe(3)
    expect(e.prizes).toHaveLength(1)
    expect(e.prizes[0].quantity).toBe(1)
    expect(e.winnerHistory).toHaveLength(1)
    expect(e.branding.primaryColor).toBe('#D0453A')
    expect(e.branding.logo).toBe('/brand/rri-logo.jpeg')
    expect(e.wheelSettings.winnersPerDraw).toBe(1)
    expect(e.animationSettings).toMatchObject({ mode: 'dramatic', spinDuration: null })
  })

  it('exports winner history as CSV', () => {
    let e = createDemoEvent()
    e = recordWinner(e, { participant: e.participants[0], prize: e.prizes[0], mode: 'dramatic', removeFromPool: true }).event
    const csv = winnersToCsv(e.winnerHistory)
    expect(csv).toContain('Draw #,Winner,Prize')
    expect(csv).toContain(e.participants[0].name)
    expect(csv).toContain(e.prizes[0].name)
  })
})
