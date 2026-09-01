jest.mock('../src/services/alertService')
jest.mock('../src/services/dbService')

let alertService
let dbService
let escalation

function loadService({ ackTimeout = 60, cooldown = 300 } = {}) {
  jest.resetModules()
  process.env.ACK_TIMEOUT_SECONDS = String(ackTimeout)
  process.env.COOLDOWN_SECONDS    = String(cooldown)

  alertService = require('../src/services/alertService')
  dbService    = require('../src/services/dbService')

  alertService.sendSms    = jest.fn().mockResolvedValue({ sent: 1, failed: 0 })
  alertService.makeCall   = jest.fn().mockResolvedValue({ made: 1, failed: 0 })
  dbService.markEscalated = jest.fn().mockResolvedValue({})

  return require('../src/services/escalationService')
}

beforeEach(() => {
  jest.useFakeTimers()
  escalation = loadService()
})

afterEach(() => {
  jest.useRealTimers()
})

const makeEvent = (overrides = {}) => ({
  id: 'evt-1',
  device_id: 'DEV01',
  location: 'ห้องนอน',
  confidence: 0.9,
  ...overrides
})

describe('escalationService.schedule', () => {
  test('registers a pending timer', () => {
    escalation.schedule(makeEvent())
    expect(escalation.isPending('evt-1')).toBe(true)
    expect(escalation.pendingCount()).toBe(1)
  })

  test('does not double-schedule the same event_id', () => {
    escalation.schedule(makeEvent())
    escalation.schedule(makeEvent())
    expect(escalation.pendingCount()).toBe(1)
  })

  test('escalates after ACK_TIMEOUT_SECONDS — fires SMS + call + DB mark', async () => {
    escalation = loadService({ ackTimeout: 1 })
    escalation.schedule(makeEvent())

    await jest.runAllTimersAsync()

    expect(alertService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ device_id: 'DEV01', event_id: 'evt-1' })
    )
    expect(alertService.makeCall).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: 'evt-1' })
    )
    expect(dbService.markEscalated).toHaveBeenCalledWith(
      'evt-1',
      { sms_sent: true, call_made: true }
    )
  })

  test('marks sms_sent=false when alert returns skipped', async () => {
    escalation = loadService({ ackTimeout: 1 })
    alertService.sendSms.mockResolvedValueOnce({ skipped: true })

    escalation.schedule(makeEvent())
    await jest.runAllTimersAsync()

    expect(dbService.markEscalated).toHaveBeenCalledWith(
      'evt-1',
      { sms_sent: false, call_made: true }
    )
  })

  test('removes timer after escalation completes', async () => {
    escalation = loadService({ ackTimeout: 1 })
    escalation.schedule(makeEvent())

    await jest.runAllTimersAsync()

    expect(escalation.isPending('evt-1')).toBe(false)
  })
})

describe('escalationService.cancel', () => {
  test('returns true and clears timer for known event', () => {
    escalation.schedule(makeEvent())
    expect(escalation.cancel('evt-1')).toBe(true)
    expect(escalation.isPending('evt-1')).toBe(false)
  })

  test('returns false for unknown event', () => {
    expect(escalation.cancel('nope')).toBe(false)
  })

  test('cancelled event never escalates', async () => {
    escalation = loadService({ ackTimeout: 1 })
    escalation.schedule(makeEvent())
    escalation.cancel('evt-1')

    await jest.runAllTimersAsync()

    expect(alertService.sendSms).not.toHaveBeenCalled()
    expect(alertService.makeCall).not.toHaveBeenCalled()
  })
})

describe('escalationService.inCooldown', () => {
  test('false before any schedule', () => {
    expect(escalation.inCooldown('DEV01')).toBe(false)
  })

  test('true right after scheduling', () => {
    escalation.schedule(makeEvent())
    expect(escalation.inCooldown('DEV01')).toBe(true)
  })

  test('false after COOLDOWN_SECONDS elapses', () => {
    escalation = loadService({ cooldown: 1 })
    escalation.schedule(makeEvent())
    jest.advanceTimersByTime(1100)
    expect(escalation.inCooldown('DEV01')).toBe(false)
  })

  test('cooldown is per-device', () => {
    escalation.schedule(makeEvent({ id: 'evt-1', device_id: 'DEV01' }))
    expect(escalation.inCooldown('DEV01')).toBe(true)
    expect(escalation.inCooldown('DEV02')).toBe(false)
  })
})

describe('escalationService.recoverPending — กู้คืนหลัง restart', () => {
  const HOUR = 60 * 60 * 1000

  // event ที่ค้างอยู่ใน DB โดยยังไม่มีใคร ack และยังไม่ escalate
  const pendingEvent = (ageMs, overrides = {}) => ({
    id:         'evt-stuck',
    device_id:  'DEV01',
    location:   'ห้องนอน',
    confidence: 0.9,
    is_fall:    true,
    acknowledged: false,
    escalated:    false,
    created_at: new Date(Date.now() - ageMs).toISOString(),
    ...overrides
  })

  function withEvents(events, opts = {}) {
    const svc = loadService(opts)
    dbService.queryEvents = jest.fn().mockResolvedValue({ events, total: events.length })
    dbService.getEvent    = jest.fn().mockResolvedValue(null)
    return svc
  }

  test('reschedules an event that has not hit its deadline yet, using the time left', async () => {
    // ack timeout 60 วิ เหตุการณ์เกิดมาแล้ว 20 วิ → ควรเหลืออีกราว 40 วิ ไม่ใช่เริ่มนับ 60 ใหม่
    escalation = withEvents([pendingEvent(20_000)], { ackTimeout: 60 })

    const summary = await escalation.recoverPending()

    expect(summary).toMatchObject({ rescheduled: 1, escalated: 0, dropped: 0 })
    expect(escalation.isPending('evt-stuck')).toBe(true)

    // ยังไม่ยิงตอน 30 วิ แต่ยิงเมื่อครบ 60 วิ นับจากเวลาที่เหตุการณ์เกิด
    await jest.advanceTimersByTimeAsync(30_000)
    expect(alertService.makeCall).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(15_000)
    expect(alertService.makeCall).toHaveBeenCalledTimes(1)
  })

  test('escalates immediately when the deadline passed while the server was down', async () => {
    escalation = withEvents([pendingEvent(5 * 60_000)], { ackTimeout: 60 })

    const summary = await escalation.recoverPending()

    expect(summary).toMatchObject({ rescheduled: 0, escalated: 1, dropped: 0 })
    expect(alertService.sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: 'evt-stuck' })
    )
    expect(dbService.markEscalated).toHaveBeenCalledWith(
      'evt-stuck', { sms_sent: true, call_made: true }
    )
  })

  test('does not call about a fall from hours ago, but closes it out (ไม่ค้าง pending)', async () => {
    escalation = withEvents([pendingEvent(5 * HOUR)], { ackTimeout: 60 })

    const summary = await escalation.recoverPending()

    expect(summary).toMatchObject({ escalated: 0, dropped: 1 })
    expect(alertService.makeCall).not.toHaveBeenCalled()
    expect(alertService.sendSms).not.toHaveBeenCalled()
    // ปิดสถานะไว้ ไม่ปล่อยค้าง pending — และเห็นชัดว่าไม่ได้ส่งอะไรออกไป
    expect(dbService.markEscalated).toHaveBeenCalledWith(
      'evt-stuck', { sms_sent: false, call_made: false }
    )
  })

  test('ignores non-fall rows', async () => {
    escalation = withEvents([pendingEvent(5 * 60_000, { is_fall: false })])

    const summary = await escalation.recoverPending()

    expect(summary.scanned).toBe(0)
    expect(alertService.makeCall).not.toHaveBeenCalled()
  })

  test('does not touch an event that already has a live timer', async () => {
    escalation = withEvents([pendingEvent(0)], { ackTimeout: 60 })
    escalation.schedule({ id: 'evt-stuck', device_id: 'DEV01' })

    const summary = await escalation.recoverPending()

    expect(summary.scanned).toBe(0)
    expect(escalation.pendingCount()).toBe(1)
  })

  test('asks the database only for pending events inside the lookback window', async () => {
    escalation = withEvents([])
    await escalation.recoverPending()

    const args = dbService.queryEvents.mock.calls[0][0]
    expect(args.status).toBe('pending')
    const hoursBack = (Date.now() - new Date(args.from).getTime()) / HOUR
    expect(hoursBack).toBeCloseTo(24, 1)
  })

  test('survives a database failure without crashing the server', async () => {
    escalation = loadService()
    dbService.queryEvents = jest.fn().mockRejectedValue(new Error('supabase down'))

    await expect(escalation.recoverPending()).resolves.toMatchObject({ scanned: 0 })
  })

  test('recovering twice does not escalate the same event twice', async () => {
    escalation = withEvents([pendingEvent(5 * 60_000)], { ackTimeout: 60 })

    await escalation.recoverPending()
    // รอบสองเห็นว่าเหตุการณ์ถูก escalate ไปแล้วใน DB
    dbService.getEvent = jest.fn().mockResolvedValue(
      pendingEvent(5 * 60_000, { escalated: true })
    )
    await escalation.recoverPending()

    expect(alertService.makeCall).toHaveBeenCalledTimes(1)
  })

  test('a fall acknowledged while the server was down is never escalated', async () => {
    escalation = withEvents([pendingEvent(5 * 60_000)], { ackTimeout: 60 })
    dbService.getEvent = jest.fn().mockResolvedValue(
      pendingEvent(5 * 60_000, { acknowledged: true })
    )

    await escalation.recoverPending()

    expect(alertService.makeCall).not.toHaveBeenCalled()
    expect(dbService.markEscalated).not.toHaveBeenCalled()
  })

  test('still escalates when the state check itself fails (fail open)', async () => {
    escalation = withEvents([pendingEvent(5 * 60_000)], { ackTimeout: 60 })
    dbService.getEvent = jest.fn().mockRejectedValue(new Error('read timeout'))

    await escalation.recoverPending()

    // path ฉุกเฉิน — อ่านสถานะไม่ได้ต้องโทร ไม่ใช่เงียบ
    expect(alertService.makeCall).toHaveBeenCalledTimes(1)
  })

  test('recovered cooldown counts from when the fall happened, not from recovery time', async () => {
    // เหตุการณ์เกิดมาแล้ว 4 นาที cooldown 5 นาที → เหลืออีก 1 นาที ไม่ใช่เริ่มนับ 5 ใหม่
    escalation = withEvents([pendingEvent(4 * 60_000)], { ackTimeout: 60, cooldown: 300 })

    await escalation.recoverPending()
    expect(escalation.inCooldown('DEV01')).toBe(true)

    await jest.advanceTimersByTimeAsync(61_000 + 1000)
    expect(escalation.inCooldown('DEV01')).toBe(false)
  })
})

describe('escalationService sweeper', () => {
  test('start is idempotent and stop clears it', () => {
    escalation = loadService()
    const first = escalation.startSweeper()
    expect(escalation.startSweeper()).toBe(first)
    expect(escalation.stopSweeper()).toBe(true)
    expect(escalation.stopSweeper()).toBe(false)
  })

  test('keeps re-checking on an interval', async () => {
    escalation = loadService()
    dbService.queryEvents = jest.fn().mockResolvedValue({ events: [], total: 0 })

    escalation.startSweeper()
    await jest.advanceTimersByTimeAsync(3 * escalation.SWEEP_SECONDS * 1000)
    escalation.stopSweeper()

    expect(dbService.queryEvents.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})
