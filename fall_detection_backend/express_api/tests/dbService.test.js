function loadService(env = {}) {
  jest.resetModules()
  for (const key of ['SUPABASE_URL', 'SUPABASE_KEY']) {
    delete process.env[key]
  }
  Object.assign(process.env, env)
  return require('../src/services/dbService')
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  // ensure unique mock-${Date.now()} ids — saveEvent calls happen sub-ms apart
  let counter = 1
  jest.spyOn(Date, 'now').mockImplementation(() => 1700000000000 + counter++)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('dbService — mock store fallback (no SUPABASE config)', () => {
  test('saveEvent stores record and returns id + created_at', async () => {
    const db = loadService()
    const ev = await db.saveEvent({
      device_id: 'D', is_fall: true, confidence: 0.9, timestamp: 1
    })
    expect(ev.id).toMatch(/^mock-/)
    expect(ev.device_id).toBe('D')
    expect(ev.is_fall).toBe(true)
    expect(ev.created_at).toBeDefined()
  })

  test('getEvent returns null for unknown id', async () => {
    const db = loadService()
    expect(await db.getEvent('nope')).toBeNull()
  })

  test('saveEvent → acknowledgeEvent updates the same record', async () => {
    const db = loadService()
    const ev = await db.saveEvent({ device_id: 'D', is_fall: true, timestamp: 1 })
    const acked = await db.acknowledgeEvent(ev.id, 'caregiver-1')

    expect(acked.acknowledged).toBe(true)
    expect(acked.acknowledged_by).toBe('caregiver-1')
    expect(acked.acknowledged_at).toBeDefined()
  })

  test('acknowledgeEvent returns null for unknown id', async () => {
    const db = loadService()
    expect(await db.acknowledgeEvent('nope', 'who')).toBeNull()
  })

  test('markEscalated patches escalated + sms_sent + call_made', async () => {
    const db = loadService()
    const ev = await db.saveEvent({ device_id: 'D', is_fall: true, timestamp: 1 })

    const out = await db.markEscalated(ev.id, { sms_sent: true, call_made: false })

    expect(out.escalated).toBe(true)
    expect(out.sms_sent).toBe(true)
    expect(out.call_made).toBe(false)
    expect(out.escalated_at).toBeDefined()
  })

  test('getEvents sorts by timestamp desc and respects limit', async () => {
    const db = loadService()
    await db.saveEvent({ device_id: 'D', is_fall: false, timestamp: 1 })
    await db.saveEvent({ device_id: 'D', is_fall: true,  timestamp: 5 })
    await db.saveEvent({ device_id: 'D', is_fall: true,  timestamp: 3 })

    const all = await db.getEvents({ limit: 2 })
    expect(all).toHaveLength(2)
    expect(all[0].timestamp).toBe(5)
    expect(all[1].timestamp).toBe(3)
  })

  test('getFallEvents filters out non-fall', async () => {
    const db = loadService()
    await db.saveEvent({ device_id: 'D', is_fall: false, timestamp: 1 })
    await db.saveEvent({ device_id: 'D', is_fall: true,  timestamp: 2 })

    const falls = await db.getFallEvents({})
    expect(falls).toHaveLength(1)
    expect(falls[0].is_fall).toBe(true)
  })
})
