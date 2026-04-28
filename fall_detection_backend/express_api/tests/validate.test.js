const { predictBody } = require('../src/middleware/validate')

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this }
  }
}

const run = (body) => {
  const res = mockRes()
  const next = jest.fn()
  predictBody({ body }, res, next)
  return { res, next }
}

describe('validate.predictBody', () => {
  test('rejects when device_id is missing', () => {
    const { res, next } = run({ features: [[0]] })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/device_id/)
    expect(next).not.toHaveBeenCalled()
  })

  test('rejects when features is missing', () => {
    const { res, next } = run({ device_id: 'D' })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/features/)
    expect(next).not.toHaveBeenCalled()
  })

  test('rejects when features is empty array', () => {
    const { res, next } = run({ device_id: 'D', features: [] })
    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })

  test('rejects when features is not 2D', () => {
    const { res, next } = run({ device_id: 'D', features: [1, 2, 3] })
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/array of arrays/)
    expect(next).not.toHaveBeenCalled()
  })

  test('passes for valid 2D features', () => {
    const { res, next } = run({ device_id: 'D', features: [[0, 1], [2, 3]] })
    expect(res.statusCode).toBeNull()
    expect(next).toHaveBeenCalled()
  })
})
