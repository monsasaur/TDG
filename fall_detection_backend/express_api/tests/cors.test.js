const cors = require('../src/middleware/cors')

function run(origin, method = 'OPTIONS') {
  const headers = {}
  const res = { setHeader: (k, v) => { headers[k] = v }, sendStatus: jest.fn() }
  const next = jest.fn()
  cors({ method, headers: origin ? { origin } : {} }, res, next)
  return { headers, res, next }
}

describe('cors', () => {
  const saved = { ...process.env }
  afterEach(() => { process.env = { ...saved } })

  test('ปกติ: admin origin ได้แค่ Authorization ไม่มี x-api-key', () => {
    delete process.env.DEV_WEB_ORIGINS
    const { headers } = run('http://localhost:5173')
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type,Authorization')
  })

  test('ไม่ตั้ง DEV_WEB_ORIGINS: เว็บ Expo ไม่ได้ header CORS เลย', () => {
    delete process.env.DEV_WEB_ORIGINS
    const { headers } = run('http://localhost:8081')
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
  })

  test('ตั้ง DEV_WEB_ORIGINS: เว็บ Expo ส่ง x-api-key ได้', () => {
    process.env.DEV_WEB_ORIGINS = 'http://localhost:8081'
    const { headers } = run('http://localhost:8081')
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:8081')
    expect(headers['Access-Control-Allow-Headers']).toContain('x-api-key')
  })

  test('DEV_WEB_ORIGINS รับเฉพาะ localhost — โดเมนจริงถูกทิ้ง', () => {
    process.env.DEV_WEB_ORIGINS = 'https://evil.example.com,http://localhost:8081'
    const { headers } = run('https://evil.example.com')
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined()
  })
})
