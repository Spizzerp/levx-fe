import { describe, it } from 'vitest'

describe('usePythFeed', () => {
  it.todo('opens HermesClient stream on mount')
  it.todo('closes EventSource on unmount')
  it.todo('schedules reconnect on onerror with exponential backoff')
  it.todo('sets status to "reconnecting" during backoff window')
  it.todo('does not reconnect after cancelled flag is set by cleanup')
})
