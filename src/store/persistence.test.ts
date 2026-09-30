import { describe, expect, it } from 'vitest'
import { createIndexedDbAdapter, createMemoryAdapter } from '../lib/storage/storage'
import { addParticipants } from '../lib/event/operations'
import { configureStorage, useApp } from './appStore'

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
})
