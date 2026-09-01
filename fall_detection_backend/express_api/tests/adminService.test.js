jest.mock('../src/services/dbService', () => ({
  queryEvents:  jest.fn(),
  listDevices:  jest.fn(),
  getEvent:     jest.fn()
}))

// resetModules สร้าง instance ใหม่ของ mock ทุกครั้ง — ต้อง require ใหม่หลัง reset
// ไม่งั้น mockResolvedValue จะไปตั้งกับ instance เก่าที่ service ไม่ได้ใช้
let db

function loadService(env = {}) {
  jest.resetModules()
  for (const key of [
    'DEVICE_OFFLINE_AFTER_MINUTES', 'ADMIN_TZ_OFFSET_HOURS', 'ADMIN_MAX_SCAN'
  ]) {
    delete process.env[key]
  }
  Object.assign(process.env, env)

  db = require('../src/services/dbService')
  db.queryEvents.mockResolvedValue({ events: [], total: 0 })
  db.listDevices.mockResolvedValue([])
  db.getEvent.mockResolvedValue(null)

  return require('../src/services/adminService')
}

const MINUTE = 60 * 1000
const HOUR   = 60 * MINUTE
const DAY    = 24 * HOUR

function event(overrides = {}) {
  return {
    id:           'e1',
    device_id:    'esp32-01',
    timestamp:    Date.now(),
    location:     'ห้องนอน',
    is_fall:      true,
    confidence:   0.97,
    acknowledged: false,
    escalated:    false,
    created_at:   new Date().toISOString(),
    ...overrides
  }
}

function device(overrides = {}) {
  return {
    device_id:    'esp32-01',
    label:        'บ้านคุณสมชาย ห้องนอน',
    owner_name:   'สมชาย',
    location:     'ห้องนอน',
    last_seen_at: new Date().toISOString(),
    is_active:    true,
    installed_at: new Date(Date.now() - 30 * DAY).toISOString(),
    ...overrides
  }
}

describe('eventStatus — BR-03 / BR-04', () => {
  test('an event has exactly one status, escalated winning over acknowledged', () => {
    const svc = loadService()
    expect(svc.eventStatus(event())).toBe('pending')
    expect(svc.eventStatus(event({ acknowledged: true }))).toBe('acknowledged')
    expect(svc.eventStatus(event({ escalated: true }))).toBe('escalated')
    expect(svc.eventStatus(event({ acknowledged: true, escalated: true }))).toBe('escalated')
  })
})

describe('thaiMidnight — NFR-08', () => {
  test('resolves to 17:00 UTC of the previous day (= 00:00 UTC+7)', () => {
    const svc = loadService()
    // 2026-09-01 03:00 UTC = 10:00 ตามเวลาไทย → เที่ยงคืนไทยคือ 2026-08-31 17:00 UTC
    const midnight = svc.thaiMidnight(new Date('2026-09-01T03:00:00.000Z'))
    expect(midnight.toISOString()).toBe('2026-08-31T17:00:00.000Z')
  })

  test('an event just after Thai midnight counts as today, one just before does not', () => {
    const svc = loadService()
    const now      = new Date('2026-09-01T03:00:00.000Z')
    const midnight = svc.thaiMidnight(now)

    expect(new Date('2026-08-31T17:30:00.000Z') >= midnight).toBe(true)   // 00:30 ไทย
    expect(new Date('2026-08-31T16:30:00.000Z') >= midnight).toBe(false)  // 23:30 ไทย ของเมื่อวาน
  })
})

describe('getSummary — devices', () => {
  test('online + offline always equals total (AC-01)', async () => {
    const svc = loadService({ DEVICE_OFFLINE_AFTER_MINUTES: '15' })
    db.listDevices.mockResolvedValue([
      device({ device_id: 'a', last_seen_at: new Date(Date.now() - 2 * MINUTE).toISOString() }),
      device({ device_id: 'b', last_seen_at: new Date(Date.now() - 60 * MINUTE).toISOString() }),
      device({ device_id: 'c', last_seen_at: null })
    ])

    const { devices } = await svc.getSummary()
    expect(devices).toMatchObject({ total: 3, online: 1, offline: 2 })
    expect(devices.online + devices.offline).toBe(devices.total)
  })

  test('a device that never reported is offline, not online', async () => {
    const svc = loadService()
    db.listDevices.mockResolvedValue([device({ last_seen_at: null })])

    const { devices } = await svc.getSummary()
    expect(devices.offline).toBe(1)
  })
})

describe('getSummary — falls and escalation rate', () => {
  test('escalation rate matches a hand calculation (AC-03, BR-05)', async () => {
    const svc = loadService()
    db.queryEvents.mockResolvedValue({
      events: [
        event({ id: '1', escalated: true }),
        event({ id: '2', escalated: true }),
        event({ id: '3', acknowledged: true }),
        event({ id: '4' })
      ],
      total: 4
    })

    const { falls, escalation } = await svc.getSummary()
    expect(falls.week).toBe(4)
    expect(escalation.escalated_week).toBe(2)
    expect(escalation.rate).toBe(0.5)   // 2 / 4
  })

  test('non-fall rows are excluded from the rate denominator', async () => {
    const svc = loadService()
    db.queryEvents.mockResolvedValue({
      events: [
        event({ id: '1', is_fall: true,  escalated: true }),
        event({ id: '2', is_fall: false })
      ],
      total: 2
    })

    const { falls, escalation } = await svc.getSummary()
    expect(falls.week).toBe(1)
    expect(escalation.rate).toBe(1)
  })

  test('rate is null rather than 0 when there is nothing to divide (REP-08)', async () => {
    const svc = loadService()
    const { falls, escalation } = await svc.getSummary()

    expect(falls.week).toBe(0)
    expect(falls.has_data).toBe(false)
    expect(escalation.rate).toBeNull()
    expect(escalation.has_data).toBe(false)
  })

  test('counts today separately from the rolling week (REP-04, REP-05)', async () => {
    const svc = loadService()
    const now = Date.now()
    db.queryEvents.mockResolvedValue({
      events: [
        event({ id: 'today', created_at: new Date(now).toISOString() }),
        event({ id: 'old',   created_at: new Date(now - 3 * DAY).toISOString() })
      ],
      total: 2
    })

    const { falls } = await svc.getSummary()
    expect(falls.week).toBe(2)
    expect(falls.today).toBe(1)
  })

  test('asks the database for a rolling 7-day window (REP-10)', async () => {
    const svc = loadService()
    await svc.getSummary()

    const { from } = db.queryEvents.mock.calls[0][0]
    const days = (Date.now() - new Date(from).getTime()) / DAY
    expect(days).toBeCloseTo(7, 2)
  })

  test('reports the window and calculation time (REP-07, REP-09)', async () => {
    const svc = loadService()
    const summary = await svc.getSummary()

    expect(summary.window.week_definition).toBe('rolling_7_days')
    expect(summary.window.timezone).toBe('UTC+7')
    expect(Number.isNaN(Date.parse(summary.calculated_at))).toBe(false)
  })
})

describe('getEvents — FR-08 ถึง FR-13', () => {
  test('passes every filter through together (FR-12)', async () => {
    const svc = loadService()
    await svc.getEvents({
      from: '2026-08-01T00:00:00.000Z',
      to:   '2026-08-31T00:00:00.000Z',
      device_id: 'esp32-01',
      status: 'escalated',
      limit: 25,
      offset: 50
    })

    expect(db.queryEvents).toHaveBeenCalledWith({
      from: '2026-08-01T00:00:00.000Z',
      to:   '2026-08-31T00:00:00.000Z',
      device_id: 'esp32-01',
      status: 'escalated',
      limit: 25,
      offset: 50
    })
  })

  test('every returned row carries a derived status (AC-07)', async () => {
    const svc = loadService()
    db.queryEvents.mockResolvedValue({
      events: [event({ escalated: true }), event({ acknowledged: true }), event()],
      total: 3
    })

    const { events } = await svc.getEvents({})
    expect(events.map(e => e.status)).toEqual(['escalated', 'acknowledged', 'pending'])
  })

  test('an event still inside the ack window reads as pending, not escalated (AC-08)', async () => {
    const svc = loadService()
    db.queryEvents.mockResolvedValue({
      events: [event({ acknowledged: false, escalated: false })],
      total: 1
    })

    const { events } = await svc.getEvents({})
    expect(events[0].status).toBe('pending')
  })

  test('reports has_more so the client can page (FR-13)', async () => {
    const svc = loadService()
    db.queryEvents.mockResolvedValue({ events: [event(), event()], total: 10 })

    const { pagination } = await svc.getEvents({ limit: 2, offset: 0 })
    expect(pagination).toMatchObject({ total: 10, limit: 2, offset: 0, has_more: true })
  })

  test('has_more is false on the last page', async () => {
    const svc = loadService()
    db.queryEvents.mockResolvedValue({ events: [event()], total: 3 })

    const { pagination } = await svc.getEvents({ limit: 2, offset: 2 })
    expect(pagination.has_more).toBe(false)
  })

  test('clamps limit so one request cannot pull the whole table (NFR-03)', async () => {
    const svc = loadService()
    await svc.getEvents({ limit: 100000 })
    expect(db.queryEvents.mock.calls[0][0].limit).toBe(200)

    db.queryEvents.mockClear()
    await svc.getEvents({ limit: -5, offset: -10 })
    expect(db.queryEvents.mock.calls[0][0]).toMatchObject({ limit: 50, offset: 0 })
  })

  test('computes how long the caregiver took to acknowledge', async () => {
    const svc = loadService()
    const created = '2026-09-01T10:00:00.000Z'
    db.queryEvents.mockResolvedValue({
      events: [event({
        acknowledged: true,
        created_at: created,
        acknowledged_at: '2026-09-01T10:00:42.000Z'
      })],
      total: 1
    })

    const { events } = await svc.getEvents({})
    expect(events[0].ack_latency_seconds).toBe(42)
  })
})

describe('getEventDetail — FR-14', () => {
  test('returns null for an unknown id', async () => {
    const svc = loadService()
    expect(await svc.getEventDetail('nope')).toBeNull()
  })

  test('builds a detection-only timeline for a pending event', async () => {
    const svc = loadService()
    db.getEvent.mockResolvedValue(event())

    const detail = await svc.getEventDetail('e1')
    expect(detail.status).toBe('pending')
    expect(detail.timeline.map(t => t.step)).toEqual(['detected'])
  })

  test('includes the escalation step with what was actually sent', async () => {
    const svc = loadService()
    db.getEvent.mockResolvedValue(event({
      escalated: true,
      escalated_at: '2026-09-01T10:01:00.000Z',
      sms_sent: true,
      call_made: false
    }))

    const detail = await svc.getEventDetail('e1')
    expect(detail.timeline.map(t => t.step)).toEqual(['detected', 'escalated'])
    expect(detail.timeline[1].detail).toEqual({ sms_sent: true, call_made: false })
  })
})

describe('getDevices — FR-16 ถึง FR-21', () => {
  test('a registered device that never sent data still appears (AC-12, FR-21)', async () => {
    const svc = loadService()
    db.listDevices.mockResolvedValue([device({ device_id: 'never-reported', last_seen_at: null })])
    db.queryEvents.mockResolvedValue({ events: [], total: 0 })

    const { devices } = await svc.getDevices({})
    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({ device_id: 'never-reported', status: 'offline' })
    expect(devices[0].events.total).toBe(0)
  })

  test('a device reporting normally with no falls is online (AC-13)', async () => {
    const svc = loadService({ DEVICE_OFFLINE_AFTER_MINUTES: '15' })
    db.listDevices.mockResolvedValue([
      device({ device_id: 'healthy', last_seen_at: new Date(Date.now() - MINUTE).toISOString() })
    ])
    db.queryEvents.mockResolvedValue({ events: [], total: 0 })

    const { devices } = await svc.getDevices({})
    expect(devices[0].status).toBe('online')
    expect(devices[0].events.falls).toBe(0)
  })

  test('aggregates event counts per device', async () => {
    const svc = loadService()
    db.listDevices.mockResolvedValue([
      device({ device_id: 'a' }),
      device({ device_id: 'b' })
    ])
    db.queryEvents.mockResolvedValue({
      events: [
        event({ device_id: 'a', is_fall: true, escalated: true, created_at: '2026-09-01T01:00:00.000Z' }),
        event({ device_id: 'a', is_fall: true, created_at: '2026-09-02T01:00:00.000Z' }),
        event({ device_id: 'b', is_fall: false })
      ],
      total: 3
    })

    const { devices } = await svc.getDevices({})
    const a = devices.find(d => d.device_id === 'a')
    const b = devices.find(d => d.device_id === 'b')

    expect(a.events).toMatchObject({ total: 2, falls: 2, escalated: 1 })
    expect(a.events.last_fall_at).toBe('2026-09-02T01:00:00.000Z')
    expect(b.events).toMatchObject({ total: 1, falls: 0, escalated: 0, last_fall_at: null })
  })

  test('filters by status without mixing in the other state (FR-20)', async () => {
    const svc = loadService({ DEVICE_OFFLINE_AFTER_MINUTES: '15' })
    db.listDevices.mockResolvedValue([
      device({ device_id: 'on',  last_seen_at: new Date(Date.now() - MINUTE).toISOString() }),
      device({ device_id: 'off', last_seen_at: new Date(Date.now() - 3 * HOUR).toISOString() })
    ])

    const online = await svc.getDevices({ status: 'online' })
    expect(online.devices.map(d => d.device_id)).toEqual(['on'])

    const offline = await svc.getDevices({ status: 'offline' })
    expect(offline.devices.map(d => d.device_id)).toEqual(['off'])
  })

  test('excludes decommissioned devices unless asked for them (BR-08, AC-14)', async () => {
    const svc = loadService()
    await svc.getDevices({})
    expect(db.listDevices).toHaveBeenCalledWith({ include_inactive: false })

    db.listDevices.mockClear()
    await svc.getDevices({ include_inactive: true })
    expect(db.listDevices).toHaveBeenCalledWith({ include_inactive: true })
  })
})
