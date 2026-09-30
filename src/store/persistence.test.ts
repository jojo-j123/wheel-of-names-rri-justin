import { describe, expect, it, vi } from 'vitest'
import { createIndexedDbAdapter, createMemoryAdapter } from '../lib/storage/storage'
import { addParticipants } from '../lib/event/operations'
import { configureStorage, hasPendingWrites, useApp } from './appStore'

describe('persistence', () => {
  it('first launch creates the demo event; changes survive a "reload"', async () => {
    const adapter = createIndexedDbAdapter()
    configureStorage(adapter)
    await useApp.getState().init()
    const s = useApp.getState()
    expect(s.status).toBe('ready')
    const id = s.activeEventId!
    expect(s.events[id].isDemo).toBe(true)

    s.mutateEvent(id, (e) => addParticipants(e, [{ name: 'Persisted Person' }], { preventDuplicates: false }).event)
    await useApp.getState().flush()

    // Simulate a browser refresh: fresh store state, same IndexedDB.
    useApp.setState({ status: 'loading', events: {}, activeEventId: null })
    configureStorage(createIndexedDbAdapter())
    await useApp.getState().init()
    const reloaded = useApp.getState().events[id]
    expect(reloaded.participants.some((p) => p.name === 'Persisted Person')).toBe(true)
    expect(useApp.getState().activeEventId).toBe(id)
  })

  it('skips corrupt stored events without crashing', async () => {
    const mem = createMemoryAdapter()
    await mem.saveEvent({ nonsense: true } as never)
    configureStorage(mem)
    useApp.setState({ status: 'loading', events: {}, activeEventId: null })
    await useApp.getState().init()
    const events = Object.values(useApp.getState().events)
    expect(events).toHaveLength(1)
    expect(events[0].isDemo).toBe(true)
  })

  it('deleting the last event recreates a demo so the app is always usable', async () => {
    configureStorage(createMemoryAdapter())
    useApp.setState({ status: 'loading', events: {}, activeEventId: null })
    await useApp.getState().init()
    const id = useApp.getState().activeEventId!
    useApp.getState().deleteEvent(id)
    const s = useApp.getState()
    expect(s.events[id]).toBeUndefined()
    expect(Object.keys(s.events)).toHaveLength(1)
    expect(s.activeEventId).not.toBe(id)
  })

  it('retries a failed save until it succeeds — a change is never silently dropped', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const mem = createMemoryAdapter()
    let failures = 2
    const flaky = { ...mem, persistent: true, saveEvent: async (e: Parameters<typeof mem.saveEvent>[0]) => {
      if (failures-- > 0) throw new Error('disk busy')
      return mem.saveEvent(e)
    } }
    configureStorage({ ...mem, persistent: true })
    useApp.setState({ status: 'loading', events: {}, activeEventId: null, saveStatus: 'saved' })
    await useApp.getState().init()
    configureStorage(flaky)
    const id = useApp.getState().activeEventId!
    useApp.getState().mutateEvent(id, (e) => addParticipants(e, [{ name: 'Must Survive' }], { preventDuplicates: false }).event)
    await vi.advanceTimersByTimeAsync(0)
    expect(useApp.getState().saveStatus).toBe('error')
    expect(hasPendingWrites()).toBe(true) // refresh would be warned
    await vi.advanceTimersByTimeAsync(5000)
    expect(useApp.getState().saveStatus).toBe('saved')
    const stored = (await mem.loadEvents()) as { id: string; participants: { name: string }[] }[]
    expect(stored.find((e) => e.id === id)!.participants.some((p) => p.name === 'Must Survive')).toBe(true)
    vi.useRealTimers()
  })
})
