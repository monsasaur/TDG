const auth = require('../src/middleware/auth')

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this }
  }
}

beforeEach(() => {
  process.env.API_KEY = 'secret-key'
})

describe('auth middleware', () => {
  test('bypasses auth for /health', () => {
    const req = { path: '/health', headers: {} }
    const res = mockRes()
    const next = jest.fn()

    auth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.statusCode).toBeNull()
  })

  test('rejects request without x-api-key', () => {
    const req = { path: '/api/v1/predict', headers: {} }
    const res = mockRes()
    const next = jest.fn()

    auth(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
    expect(next).not.toHaveBeenCalled()
  })

  test('rejects request with wrong api key', () => {
    const req = { path: '/api/v1/predict', headers: { 'x-api-key': 'wrong' } }
    const res = mockRes()
    const next = jest.fn()

    auth(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('passes through with correct api key', () => {
    const req = { path: '/api/v1/predict', headers: { 'x-api-key': 'secret-key' } }
    const res = mockRes()
    const next = jest.fn()

    auth(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.statusCode).toBeNull()
  })
})

// ---------- แยกคีย์ตาม scope ----------

function mockReq(url, key) {
  return { path: url.split('?')[0], originalUrl: url, headers: key ? { 'x-api-key': key } : {} }
}

function callAuth(url, key) {
  const res = mockRes()
  let passed = false
  auth(mockReq(url, key), res, () => { passed = true })
  return { passed, status: res.statusCode }
}

describe('auth — แยกคีย์ตาม scope', () => {
  beforeEach(() => {
    for (const k of ['DEVICE_API_KEY', 'APP_API_KEY', 'DEMO_API_KEY']) delete process.env[k]
    process.env.API_KEY = 'shared-key'
  })

  test('เส้นทางถูกจับ scope ถูกต้อง', () => {
    expect(auth.scopeFor('/api/v1/predict')).toBe('device')
    expect(auth.scopeFor('/api/v1/events/falls')).toBe('app')
    expect(auth.scopeFor('/api/v1/alert/ack/e1')).toBe('app')
    expect(auth.scopeFor('/api/v1/push/register')).toBe('app')
    expect(auth.scopeFor('/api/v1/demo/fire')).toBe('demo')
    // /alert/test ต้องชนะกฎ /alert ที่กว้างกว่า ไม่งั้นคีย์แอปจะสั่งโทรทดสอบได้
    expect(auth.scopeFor('/api/v1/alert/test')).toBe('demo')
  })

  test('ยังไม่ตั้งคีย์แยก → API_KEY เดิมใช้ได้ทุกเส้นเหมือนก่อน', () => {
    for (const url of ['/api/v1/predict', '/api/v1/events', '/api/v1/demo/fire']) {
      expect(callAuth(url, 'shared-key').passed).toBe(true)
    }
  })

  test('ตั้งคีย์แอปแล้ว คีย์นั้นสั่ง demo/fire ไม่ได้', () => {
    process.env.APP_API_KEY  = 'app-key'
    process.env.DEMO_API_KEY = 'demo-key'

    expect(callAuth('/api/v1/events/falls', 'app-key').passed).toBe(true)

    // นี่คือช่องโหว่ที่งานนี้ปิด — คีย์ที่ฝังใน APK ต้องสั่งให้ระบบโทรออกไม่ได้
    const blocked = callAuth('/api/v1/demo/fire', 'app-key')
    expect(blocked.passed).toBe(false)
    expect(blocked.status).toBe(401)

    expect(callAuth('/api/v1/alert/test', 'app-key').passed).toBe(false)
    expect(callAuth('/api/v1/demo/fire', 'demo-key').passed).toBe(true)
  })

  test('คีย์ ESP32 ที่หลุด อ่าน event ไม่ได้', () => {
    process.env.DEVICE_API_KEY = 'device-key'
    process.env.APP_API_KEY    = 'app-key'

    expect(callAuth('/api/v1/predict', 'device-key').passed).toBe(true)
    expect(callAuth('/api/v1/events/falls', 'device-key').passed).toBe(false)
    // และคีย์แอปก็ยัดข้อมูลปลอมเข้า /predict ไม่ได้
    expect(callAuth('/api/v1/predict', 'app-key').passed).toBe(false)
  })

  test('ตั้งคีย์แยกบาง scope — scope ที่เหลือยังใช้ API_KEY เดิมได้', () => {
    process.env.DEMO_API_KEY = 'demo-key'
    expect(callAuth('/api/v1/events/falls', 'shared-key').passed).toBe(true)
    // แต่ scope ที่ตั้งคีย์เฉพาะแล้ว จะไม่รับ API_KEY เดิมอีก
    expect(callAuth('/api/v1/demo/fire', 'shared-key').passed).toBe(false)
  })

  test('ไม่ได้ตั้งคีย์อะไรเลย → 503 ไม่ใช่ปล่อยผ่าน', () => {
    delete process.env.API_KEY
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = callAuth('/api/v1/events', 'anything')
    expect(res.passed).toBe(false)
    expect(res.status).toBe(503)
    console.error.mockRestore()
  })

  test('/health ยังเข้าได้โดยไม่ต้องมีคีย์', () => {
    expect(callAuth('/health').passed).toBe(true)
  })
})
