/**
 * aiVoiceAgentService — AI เรียบเรียงข้อความตอนโทรแจ้ง
 *
 * กติกาที่ต้องไม่พัง: ทุกกรณีที่ไม่แน่ใจต้องคืน null ให้ alertService ถอยไปใช้ข้อความมาตรฐาน
 * ระบบจึงยังโทรออกเสมอ · ไม่ยิง API จริง — mock global.fetch ทุกเคส
 */

const VALID = 'ระบบตรวจพบว่าอาจมีการล้มที่ห้องน้ำชั้นหนึ่งในบ้านคุณยาย โปรดเข้าไปตรวจสอบโดยเร็ว'

const EVENT = {
  location: 'Esp32 - ห้องน้ำชั้นหนึ่ง',
  house_name: 'บ้านคุณยาย',
  device_id: 'ESP-0001A',
  caregiver_phone: '+66800000000',
}

const AI_KEYS = ['AI_VOICE_ENABLED', 'TYPHOON_API_KEY', 'AI_VOICE_TIMEOUT_MS', 'AI_VOICE_MAX_CHARS']
const realFetch = global.fetch

function loadService(env = { AI_VOICE_ENABLED: 'true', TYPHOON_API_KEY: 'test-key' }) {
  jest.resetModules()
  for (const key of AI_KEYS) delete process.env[key]
  Object.assign(process.env, env)
  return require('../src/services/aiVoiceAgentService')
}

function replyWith(content, { ok = true } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => ({ choices: [{ message: { content } }] }),
  })
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  global.fetch = realFetch
  for (const key of AI_KEYS) delete process.env[key]
  jest.restoreAllMocks()
})

describe('validateMessage', () => {
  test('ข้อความภาษาไทยปกติผ่าน', () => {
    expect(loadService().validateMessage(VALID)).toBe(true)
  })

  test.each([
    ['ว่าง', ''],
    ['ยาวเกิน 320 ตัว', 'ก'.repeat(321)],
    ['มี < > & ซึ่งทำให้ TwiML พัง', 'ตรวจพบการล้มที่ <ห้องน้ำ>'],
    ['ไม่มีภาษาไทยเลย', 'Fall detected in the bathroom'],
    ['วงเล็บเหลี่ยม = ช่องที่ AI ลืมเติม', 'ตรวจพบการล้มที่ [ชื่อห้อง] โปรดตรวจสอบ'],
    ['วงเล็บปีกกา', 'ตรวจพบการล้มที่ {location} โปรดตรวจสอบ'],
    ['อักษรโรมันปน', 'ตรวจพบการล้มที่ห้อง Bathroom โปรดตรวจสอบ'],
  ])('%s → ไม่ผ่าน', (_, msg) => {
    expect(loadService().validateMessage(msg)).toBe(false)
  })
})

describe('isEnabled', () => {
  test('ไม่ได้ตั้งค่า = ปิด', () => {
    expect(loadService({}).isEnabled()).toBe(false)
  })

  test('เปิดเฉพาะเมื่อตั้งเป็น "true" เป๊ะ', () => {
    expect(loadService({ AI_VOICE_ENABLED: 'false' }).isEnabled()).toBe(false)
    expect(loadService({ AI_VOICE_ENABLED: '1' }).isEnabled()).toBe(false)
    expect(loadService({ AI_VOICE_ENABLED: 'true' }).isEnabled()).toBe(true)
  })
})

describe('generateCallMessage', () => {
  test('ปิดอยู่ → null และไม่ยิง API', async () => {
    const ai = loadService({ TYPHOON_API_KEY: 'test-key' })
    global.fetch = jest.fn()
    expect(await ai.generateCallMessage(EVENT)).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('ไม่มี TYPHOON_API_KEY → null และไม่ยิง API', async () => {
    const ai = loadService({ AI_VOICE_ENABLED: 'true' })
    global.fetch = jest.fn()
    expect(await ai.generateCallMessage(EVENT)).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('AI ตอบข้อความที่ผ่านการตรวจ → ได้ข้อความนั้น', async () => {
    const ai = loadService()
    replyWith(VALID)
    expect(await ai.generateCallMessage(EVENT)).toBe(VALID)
  })

  test('ส่งให้ AI แค่ชื่อห้องกับชื่อบ้าน — ไม่มีรหัสอุปกรณ์ ไม่มีเบอร์โทร', async () => {
    const ai = loadService()
    replyWith(VALID)
    await ai.generateCallMessage(EVENT)

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    const userText = body.messages.find((m) => m.role === 'user').content
    expect(userText).toContain('ห้องน้ำชั้นหนึ่ง')
    expect(userText).toContain('บ้านคุณยาย')
    expect(userText).not.toMatch(/Esp32|ESP-0001A|\+66/)
  })

  test.each([
    ['API ตอบไม่สำเร็จ', () => replyWith(VALID, { ok: false })],
    ['AI ตอบว่าง', () => replyWith('')],
    ['AI ตอบปนอักษรโรมัน', () => replyWith('ตรวจพบการล้มที่ Bathroom โปรดตรวจสอบ')],
    ['AI ลืมเติมช่อง', () => replyWith('ตรวจพบการล้มที่ [ชื่อห้อง] โปรดตรวจสอบ')],
    ['เครือข่ายพัง', () => { global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) }],
  ])('%s → null (ใช้ข้อความมาตรฐาน)', async (_, setup) => {
    const ai = loadService()
    setup()
    expect(await ai.generateCallMessage(EVENT)).toBeNull()
  })

  test('AI ช้าเกินเพดาน → ตัดทิ้งแล้วคืน null', async () => {
    const ai = loadService({ AI_VOICE_ENABLED: 'true', TYPHOON_API_KEY: 'test-key', AI_VOICE_TIMEOUT_MS: '50' })
    // fetch ที่ไม่ตอบจนกว่าจะถูก abort — เหมือน API ค้าง
    global.fetch = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('This operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    }))

    const t0 = Date.now()
    expect(await ai.generateCallMessage(EVENT)).toBeNull()
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})
