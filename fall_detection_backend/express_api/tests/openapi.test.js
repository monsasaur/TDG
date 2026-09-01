/**
 * กันสเปคกับโค้ดหลุดจากกัน — เพิ่ม route ใหม่แล้วลืมเขียนเอกสาร เทสต์นี้จะฟ้อง
 */
// route module ดึง service ที่พึ่ง native/ESM มาด้วย — mock ไว้ให้ require ผ่าน
// เทสต์นี้สนใจแค่รายการ route ไม่ได้เรียกใช้ service จริง
jest.mock('expo-server-sdk', () => ({
  Expo: class { static isExpoPushToken() { return true } },
}))
jest.mock('twilio', () => jest.fn(() => ({ messages: {}, calls: {} })))

const spec = require('../src/docs/openapi')

// อ่าน route จริงจาก router ของแต่ละไฟล์ แทนที่จะไล่เดาเอง
function routesOf(modulePath, prefix) {
  const router = require(modulePath)
  return router.stack
    .filter((l) => l.route)
    .flatMap((l) =>
      Object.keys(l.route.methods).map((m) => ({
        method: m.toUpperCase(),
        // express ใช้ :param ส่วน OpenAPI ใช้ {param}
        path: (prefix + l.route.path).replace(/:(\w+)/g, '{$1}').replace(/\/$/, '') || prefix,
      }))
    )
}

const ACTUAL = [
  ...routesOf('../src/routes/predict', '/api/v1/predict'),
  ...routesOf('../src/routes/alert',   '/api/v1/alert'),
  ...routesOf('../src/routes/events',  '/api/v1/events'),
  ...routesOf('../src/routes/push',    '/api/v1/push'),
  ...routesOf('../src/routes/demo',    '/api/v1/demo'),
  ...routesOf('../src/routes/admin',   '/api/v1/admin'),
  { method: 'GET', path: '/health' },
]

const documented = new Set(
  Object.entries(spec.paths).flatMap(([p, ops]) =>
    Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`)
  )
)

describe('OpenAPI spec ตรงกับ route จริง', () => {
  test('ทุก route ที่มีอยู่ ถูกเขียนไว้ในสเปค', () => {
    const missing = ACTUAL
      .map((r) => `${r.method} ${r.path}`)
      .filter((key) => !documented.has(key))

    expect(missing).toEqual([])
  })

  test('ไม่มีสเปคของ route ที่ไม่มีอยู่จริง', () => {
    const actual = new Set(ACTUAL.map((r) => `${r.method} ${r.path}`))
    const ghosts = [...documented].filter((key) => !actual.has(key))

    expect(ghosts).toEqual([])
  })
})

describe('OpenAPI spec ถูกโครงสร้าง', () => {
  test('มี field ที่จำเป็นครบ', () => {
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.info.title).toBeTruthy()
    expect(spec.info.version).toBeTruthy()
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0)
  })

  test('ทุก security ที่อ้างถึง มี securityScheme จริง', () => {
    const schemes = new Set(Object.keys(spec.components.securitySchemes))
    const used = new Set()

    for (const entry of spec.security || []) Object.keys(entry).forEach((k) => used.add(k))
    for (const ops of Object.values(spec.paths)) {
      for (const op of Object.values(ops)) {
        for (const entry of op.security || []) Object.keys(entry).forEach((k) => used.add(k))
      }
    }

    for (const name of used) expect(schemes.has(name)).toBe(true)
  })

  test('ทุก operation มี summary, tag และ response 200', () => {
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const where = `${method.toUpperCase()} ${path}`
        expect(`${where}: ${op.summary || ''}`).not.toBe(`${where}: `)
        expect(op.tags?.length ?? 0).toBeGreaterThan(0)
        expect(Object.keys(op.responses)).toContain('200')
      }
    }
  })

  test('ทุก tag ที่ operation ใช้ ถูกประกาศไว้ใน tags', () => {
    const declared = new Set(spec.tags.map((t) => t.name))
    for (const ops of Object.values(spec.paths)) {
      for (const op of Object.values(ops)) {
        for (const t of op.tags) expect(declared.has(t)).toBe(true)
      }
    }
  })

  test('เส้นที่เปิดสาธารณะมีแค่ /health กับ /admin/login', () => {
    const open = []
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        if (Array.isArray(op.security) && op.security.length === 0) {
          open.push(`${method.toUpperCase()} ${path}`)
        }
      }
    }
    expect(open.sort()).toEqual(['GET /health', 'POST /api/v1/admin/login'])
  })
})

describe('คู่มือ API ตรงกับ spec', () => {
  // ป้องกันเคสที่แก้ spec แล้วลืมรัน npm run docs — คู่มือจะล้าสมัยเงียบ ๆ
  test('docs/API_REFERENCE.md ถูก generate ล่าสุดแล้ว', () => {
    const { execFileSync } = require('child_process')
    const path = require('path')

    expect(() =>
      execFileSync(
        process.execPath,
        [path.join(__dirname, '..', 'scripts', 'generate_api_docs.js'), '--check'],
        { stdio: 'pipe' }
      )
    ).not.toThrow()
  })
})
