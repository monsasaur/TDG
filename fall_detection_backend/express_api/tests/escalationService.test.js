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
