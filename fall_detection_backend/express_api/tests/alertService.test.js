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

describe('alertService.buildFallbackMessage', () => {
  const svc = require('../src/services/alertService')

  test('บอกบ้าน ห้อง เวลาไทย และสิ่งที่ต้องทำ', () => {
    const msg = svc.buildFallbackMessage({
      location: 'ห้องนอน',
      houseName: 'บ้านแม่',
      at: '2026-11-25T15:50:00Z', // 22:50 เวลาไทย
      ackSeconds: 60,
    })
    expect(msg).toContain('ล้มที่บ้านแม่ บริเวณห้องนอน')
    expect(msg).toContain('22 นาฬิกา 50 นาที')
    expect(msg).toContain('ภายใน 60 วินาที')
    expect(msg).toContain('หนึ่ง หก หก เก้า')
  })

  test('ไม่รู้บ้านและห้อง ยังพูดได้ครบประโยค', () => {
    const msg = svc.buildFallbackMessage({ at: '2026-11-25T01:00:00Z' })
    expect(msg).toContain('ล้มในบ้าน')
    expect(msg).toContain('8 นาฬิกา')
    expect(msg).not.toContain('undefined')
  })
})

describe('ผู้รับสาย/SMS มาจากผู้ติดต่อฉุกเฉินของบ้าน', () => {
  const realEnv = {
    ALERT_PHONES:       '+66900000000',
    TWILIO_MODE:        'real',
    TWILIO_ACCOUNT_SID: 'AC123',
    TWILIO_AUTH_TOKEN:  'token',
    TWILIO_PHONE:       '+1999'
  }

  function withContacts(svcEnv, { ctx, contacts }) {
    const svc = loadService(svcEnv)
    const db = require('../src/services/dbService')
    jest.spyOn(db, 'getDeviceContext').mockResolvedValue(ctx)
    jest.spyOn(db, 'getHouseContactPhones').mockResolvedValue(contacts)
    return svc
  }

  test('toE164TH แปลงเบอร์ไทยทุกแบบ และทิ้งเบอร์ที่อ่านไม่ออก', () => {
    const svc = loadService({})
    expect(svc.toE164TH('081-234-5678')).toBe('+66812345678')
    expect(svc.toE164TH('0812345678')).toBe('+66812345678')
    expect(svc.toE164TH('66812345678')).toBe('+66812345678')
    expect(svc.toE164TH('+66 81 234 5678')).toBe('+66812345678')
    expect(svc.toE164TH('021234567')).toBe('+6621234567')
    expect(svc.toE164TH('1')).toBeNull()
    expect(svc.toE164TH('')).toBeNull()
  })

  test('โทรหาเบอร์ผู้ติดต่อของบ้าน ไม่ใช่ ALERT_PHONES · เบอร์ซ้ำโทรครั้งเดียว · เบอร์เสียข้าม', async () => {
    const svc = withContacts(realEnv, {
      ctx: { house_id: 'h1', house_name: 'บ้านแม่' },
      contacts: [
        { name: 'ตังเม', phone: '0953445665' },
        { name: 'พี่สาว', phone: '095-344-5665' },
        { name: 'เสีย', phone: '1' },
        { name: 'สมหญิง', phone: '0934565555' },
      ],
    })
    mockCallsCreate.mockResolvedValue({ sid: 'CA1' })

    const res = await svc.makeCall({ location: 'ห้องนอน', event_id: 'e1', event: { id: 'e1', device_id: 'ESP-1' } })

    const to = mockCallsCreate.mock.calls.map((c) => c[0].to)
    expect(to).toEqual(['+66953445665', '+66934565555'])
    expect(res.made).toBe(2)
    expect(mockCallsCreate.mock.calls[0][0].twiml).toContain('บ้านแม่ บริเวณห้องนอน')
  })

  test('SMS ใช้ผู้รับชุดเดียวกัน', async () => {
    const svc = withContacts(realEnv, {
      ctx: { house_id: 'h1', house_name: 'บ้านแม่' },
      contacts: [{ name: 'ตังเม', phone: '0953445665' }],
    })
    mockMessagesCreate.mockResolvedValue({ sid: 'SM1' })

    await svc.sendSms({ device_id: 'ESP-1', location: 'ห้องนอน', confidence: 0.9, event_id: 'e1' })

    expect(mockMessagesCreate.mock.calls.map((c) => c[0].to)).toEqual(['+66953445665'])
  })

  test('บ้านยังไม่มีผู้ติดต่อ → ถอยไปใช้ ALERT_PHONES (เหตุฉุกเฉินไม่เงียบ)', async () => {
    const svc = withContacts(realEnv, { ctx: { house_id: 'h9', house_name: 'บ้านใหม่' }, contacts: [] })
    mockCallsCreate.mockResolvedValue({ sid: 'CA1' })

    await svc.makeCall({ location: 'L', event_id: 'e1', event: { id: 'e1', device_id: 'ESP-9' } })

    expect(mockCallsCreate.mock.calls.map((c) => c[0].to)).toEqual(['+66900000000'])
  })

  test('อ่านฐานข้อมูลพัง → ถอยไปใช้ ALERT_PHONES', async () => {
    const svc = loadService(realEnv)
    const db = require('../src/services/dbService')
    jest.spyOn(db, 'getDeviceContext').mockRejectedValue(new Error('db down'))
    mockCallsCreate.mockResolvedValue({ sid: 'CA1' })

    await svc.makeCall({ location: 'L', event_id: 'e1', event: { id: 'e1', device_id: 'ESP-1' } })

    expect(mockCallsCreate.mock.calls.map((c) => c[0].to)).toEqual(['+66900000000'])
  })
})
