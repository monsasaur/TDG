jest.mock('axios')

let axios

function loadService(env = {}) {
  jest.resetModules()
  for (const key of ['USE_MOCK_ML', 'MOCK_IS_FALL', 'ML_SERVICE_URL']) {
    delete process.env[key]
  }
  Object.assign(process.env, env)
  axios = require('axios')
  return require('../src/services/mlService')
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('mlService.predict — mock branch', () => {
  test('returns is_fall=true when MOCK_IS_FALL=true', async () => {
    const ml = loadService({ USE_MOCK_ML: 'true', MOCK_IS_FALL: 'true' })
    const res = await ml.predict([[0, 1, 2]])
    expect(res).toEqual({ is_fall: true, confidence: 0.94 })
    expect(axios.post).not.toHaveBeenCalled()
  })

  test('returns is_fall=false when MOCK_IS_FALL=false', async () => {
    const ml = loadService({ USE_MOCK_ML: 'true', MOCK_IS_FALL: 'false' })
    const res = await ml.predict([[0]])
    expect(res).toEqual({ is_fall: false, confidence: 0.08 })
  })
})

describe('mlService.predict — real branch', () => {
  test('POSTs to ML_SERVICE_URL/predict and normalizes response', async () => {
    const ml = loadService({ ML_SERVICE_URL: 'http://ml:8000' })
    axios.post.mockResolvedValueOnce({
      data: { is_fall: 1, confidence: '0.77' }
    })

    const features = [[1, 2, 3]]
    const res = await ml.predict(features)

    expect(axios.post).toHaveBeenCalledWith(
      'http://ml:8000/predict',
      { features },
      { timeout: 5000 }
    )
    expect(res).toEqual({ is_fall: true, confidence: 0.77 })
  })

  test('defaults confidence to 0 when missing', async () => {
    const ml = loadService({ ML_SERVICE_URL: 'http://ml:8000' })
    axios.post.mockResolvedValueOnce({ data: { is_fall: false } })

    const res = await ml.predict([[0]])
    expect(res).toEqual({ is_fall: false, confidence: 0 })
  })

  test('wraps axios errors in ML Service error', async () => {
    const ml = loadService({ ML_SERVICE_URL: 'http://ml:8000' })
    axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(ml.predict([[0]])).rejects.toThrow(/ML Service error: ECONNREFUSED/)
  })
})
