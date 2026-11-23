const mockMessagesCreate = jest.fn()
const mockCallsCreate    = jest.fn()

jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: { create: mockMessagesCreate },
    calls:    { create: mockCallsCreate }
  }))
})

function loadService(env = {}) {
  jest.resetModules()
  for (const key of [
    'ALERT_PHONES', 'TWILIO_MODE', 'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE'
  ]) {
    delete process.env[key]
  }
  Object.assign(process.env, env)
  return require('../src/services/alertService')
}

beforeEach(() => {
  mockMessagesCreate.mockReset()
  mockCallsCreate.mockReset()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('alertService.sendSms', () => {
  test('skips when ALERT_PHONES is empty', async () => {
    const svc = loadService({})
    const res = await svc.sendSms({
      device_id: 'D', location: 'L', confidence: 0.9, event_id: 'e1'
    })
    expect(res).toEqual({ skipped: true })
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  test('fake mode logs and returns mode=fake without calling twilio', async () => {
    const svc = loadService({
      ALERT_PHONES: '+6611111,+6622222',
      TWILIO_MODE:  'fake'
    })
    const res = await svc.sendSms({
      device_id: 'D', location: 'L', confidence: 0.5, event_id: 'e1'
    })
    expect(res).toEqual({ sent: 2, failed: 0, mode: 'fake' })
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  test('skips when twilio is not configured (real mode, no SID)', async () => {
    const svc = loadService({
      ALERT_PHONES: '+6611111',
      TWILIO_MODE:  'real'
    })
    const res = await svc.sendSms({
      device_id: 'D', location: 'L', confidence: 0.5, event_id: 'e1'
    })
    expect(res).toEqual({ skipped: true })
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  test('real mode: calls twilio for each recipient and returns sent/failed counts', async () => {
    const svc = loadService({
      ALERT_PHONES:       '+6611111,+6622222',
      TWILIO_MODE:        'real',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN:  'token',
      TWILIO_PHONE:       '+1999'
    })

    mockMessagesCreate
      .mockResolvedValueOnce({ sid: 'SM1' })
      .mockRejectedValueOnce(new Error('boom'))

    const res = await svc.sendSms({
      device_id: 'D', location: 'L', confidence: 0.5, event_id: 'e1'
    })

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)
    expect(res).toEqual({ sent: 1, failed: 1 })
  })
})

describe('alertService.makeCall', () => {
  test('skips when ALERT_PHONES is empty', async () => {
    const svc = loadService({})
    const res = await svc.makeCall({ location: 'L', event_id: 'e1' })
    expect(res).toEqual({ skipped: true })
    expect(mockCallsCreate).not.toHaveBeenCalled()
  })

  test('fake mode does not invoke twilio', async () => {
    const svc = loadService({
      ALERT_PHONES: '+6611111',
      TWILIO_MODE:  'fake'
    })
    const res = await svc.makeCall({ location: 'L', event_id: 'e1' })
    expect(res).toEqual({ made: 1, failed: 0, mode: 'fake', method: 'fallback' })
    expect(mockCallsCreate).not.toHaveBeenCalled()
  })

  test('real mode invokes twilio with twiml payload', async () => {
    const svc = loadService({
      ALERT_PHONES:       '+6611111',
      TWILIO_MODE:        'real',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN:  'token',
      TWILIO_PHONE:       '+1999'
    })
    mockCallsCreate.mockResolvedValueOnce({ sid: 'CA1' })

    const res = await svc.makeCall({ location: 'L', event_id: 'e1' })

    expect(mockCallsCreate).toHaveBeenCalledTimes(1)
    const arg = mockCallsCreate.mock.calls[0][0]
    expect(arg.from).toBe('+1999')
    expect(arg.to).toBe('+6611111')
    expect(arg.twiml).toMatch(/<Response>/)
    expect(res).toEqual({ made: 1, failed: 0, method: 'fallback' })
  })

  // BUG-013: ชื่อบริเวณ / บทพูดที่มี & หรือ < ทำให้ TwiML เสีย Twilio ปฏิเสธทั้งสาย
  const realEnv = {
    ALERT_PHONES:       '+6611111',
    TWILIO_MODE:        'real',
    TWILIO_ACCOUNT_SID: 'AC123',
    TWILIO_AUTH_TOKEN:  'token',
    TWILIO_PHONE:       '+1999'
  }

  // เหลือแต่ tag ของเราเท่านั้น และ & ทุกตัวเป็น entity
  const sayTexts = (twiml) => [...twiml.matchAll(/<Say[^>]*>([\s\S]*?)<\/Say>/g)].map((m) => m[1])
  const expectSafeXml = (twiml) => {
    const tags = twiml.match(/<\/?[A-Za-z][^>]*>/g)
    expect(tags.map((t) => t.match(/^<\/?(\w+)/)[1])).toEqual(['Response', 'Say', 'Say', 'Pause', 'Say', 'Say', 'Response'])
    expect(twiml).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/)
  }

  test('ชื่อบริเวณที่มี & < > ถูก escape ใน TwiML', async () => {
    const svc = loadService(realEnv)
    mockCallsCreate.mockResolvedValueOnce({ sid: 'CA1' })

    await svc.makeCall({ location: 'ห้องนอน & ห้องน้ำ <ชั้น 2>', event_id: 'e1' })

    const { twiml } = mockCallsCreate.mock.calls[0][0]
    expectSafeXml(twiml)
    expect(sayTexts(twiml)[0]).toContain('ห้องนอน &amp; ห้องน้ำ &lt;ชั้น 2&gt;')
  })

  test('บทพูดจาก AI ที่มี tag แปลก ๆ ก็ถูก escape — แทรกคำสั่ง TwiML ไม่ได้', async () => {
    const svc = loadService(realEnv)
    const ai = require('../src/services/aiVoiceAgentService')
    jest.spyOn(ai, 'generateCallMessage').mockResolvedValueOnce('คุณยาย "ล้ม" </Say><Hangup/><Say>')
    mockCallsCreate.mockResolvedValueOnce({ sid: 'CA1' })

    const res = await svc.makeCall({ location: 'L', event_id: 'e1', event: { id: 'e1' } })

    const { twiml } = mockCallsCreate.mock.calls[0][0]
    expectSafeXml(twiml)
    expect(twiml).not.toContain('<Hangup/>')
    expect(res.method).toBe('ai')
  })

  test('escapeXml แปลงครบ 5 ตัว', () => {
    const svc = loadService({})
    expect(svc.escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })
})
