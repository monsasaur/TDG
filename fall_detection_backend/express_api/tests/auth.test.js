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
