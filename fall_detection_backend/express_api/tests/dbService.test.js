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

// ── Supabase จริง (จำลอง client) — บัญชีผู้ใช้ + push token ──────────────
function fakeSupabase(h) {
  const calls = { upserts: [], selects: [] }
  const client = {
    from(table) {
      return {
        upsert(rows) {
          calls.upserts.push(rows[0])
          const res = h.upsert ? h.upsert(rows[0], calls.upserts.length) : { data: rows[0], error: null }
          return { select: () => ({ single: async () => res }) }
        },
        select() {
          calls.selects.push(table)
          const res = h.select ? h.select(table) : { data: [], error: null }
          return { limit: async () => res }
        },
      }
    },
    auth: { getUser: async (jwt) => h.getUser(jwt) },
  }
  return { client, calls }
}

function loadWithSupabase(h) {
  const fake = fakeSupabase(h)
  jest.resetModules()
  jest.doMock('@supabase/supabase-js', () => ({ createClient: () => fake.client }))
  process.env.SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_KEY = 'service-role'
  const db = require('../src/services/dbService')
  return { db, calls: fake.calls }
}

describe('dbService — บัญชีผู้ใช้ (Supabase)', () => {
  afterEach(() => {
    jest.dontMock('@supabase/supabase-js')
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_KEY
  })

  test('registerPushToken ผูก user_id กับเครื่อง', async () => {
    const { db, calls } = loadWithSupabase({})
    await db.registerPushToken({ token: 't1', device_id: null, platform: 'android', user_id: 'u-1' })
    expect(calls.upserts).toHaveLength(1)
    expect(calls.upserts[0].user_id).toBe('u-1')
  })

  test('registerPushToken: ยังไม่มีคอลัมน์ user_id (ยังไม่รัน accounts.sql) → ลงทะเบียนแบบเดิมแทนที่จะพัง', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { db, calls } = loadWithSupabase({
      upsert: (row, n) => n === 1
        ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'user_id' column" } }
        : { data: row, error: null },
    })
    const saved = await db.registerPushToken({ token: 't1', device_id: null, platform: 'android', user_id: 'u-1' })
    expect(calls.upserts).toHaveLength(2)
    expect('user_id' in calls.upserts[1]).toBe(false)
    expect(saved.token).toBe('t1')
  })

  test('registerPushToken ไม่ส่ง user_id มา → ไม่แตะคอลัมน์นั้น', async () => {
    const { db, calls } = loadWithSupabase({})
    await db.registerPushToken({ token: 't1', device_id: null, platform: 'ios' })
    expect('user_id' in calls.upserts[0]).toBe(false)
  })

  test('accountsEnabled: ไม่มีตาราง house_members → false · มี → true และจำผลไว้', async () => {
    let missing = true
    const { db, calls } = loadWithSupabase({
      select: () => (missing ? { data: null, error: { code: 'PGRST205', message: 'not found' } } : { data: [], error: null }),
    })
    expect(await db.accountsEnabled()).toBe(false)

    const again = loadWithSupabase({ select: () => ({ data: [], error: null }) })
    expect(await again.db.accountsEnabled()).toBe(true)
    expect(await again.db.accountsEnabled()).toBe(true)
    expect(again.calls.selects).toHaveLength(1)   // ครั้งที่สองใช้ผลที่จำไว้
    missing = false
    expect(calls.selects).toHaveLength(1)
  })

  test('accountsEnabled: ถามไม่สำเร็จด้วยเหตุอื่น → false และไม่จำผล', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const { db, calls } = loadWithSupabase({ select: () => ({ data: null, error: { code: 'XX000', message: 'network' } }) })
    expect(await db.accountsEnabled()).toBe(false)
    expect(await db.accountsEnabled()).toBe(false)
    expect(calls.selects).toHaveLength(2)
  })

  test('getUserFromToken: token เสีย → null · ใช้ได้ → user', async () => {
    const { db } = loadWithSupabase({
      getUser: async (jwt) => (jwt === 'good'
        ? { data: { user: { id: 'u-1' } }, error: null }
        : { data: { user: null }, error: { message: 'invalid JWT' } }),
    })
    expect(await db.getUserFromToken('bad')).toBeNull()
    expect(await db.getUserFromToken('good')).toEqual({ id: 'u-1' })
  })

  test('getUserFromToken ตอนไม่มีฐานข้อมูล → undefined (ตรวจไม่ได้ ≠ token เสีย)', async () => {
    const db = loadService()
    expect(await db.getUserFromToken('anything')).toBeUndefined()
    expect(await db.accountsEnabled()).toBe(false)
  })
})
