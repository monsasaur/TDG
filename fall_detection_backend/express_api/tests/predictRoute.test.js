/**
 * เทสต์ระดับ route ของ /api/v1/predict — สถานะ HTTP ที่อุปกรณ์ได้รับ
 * BUG-011: ส่งจำนวน feature ผิดโมเดล เดิมได้ 500 เหมือน server พัง ต้องได้ 400
 */
const express = require('express')

jest.mock('../src/services/mlService', () => ({ predict: jest.fn() }))
jest.mock('../src/services/dbService', () => ({ touchDevice: jest.fn(), saveEvent: jest.fn() }))
jest.mock('../src/services/escalationService', () => ({ inCooldown: jest.fn(), schedule: jest.fn(), ACK_TIMEOUT_SECONDS: 60 }))
jest.mock('../src/services/appAlertService', () => ({ createFromEvent: jest.fn() }))
jest.mock('../src/services/pushService', () => ({ sendFallAlert: jest.fn() }))

let ml, db
let server, base

beforeAll(async () => {
  ml = require('../src/services/mlService')
  db = require('../src/services/dbService')
  const app = express()
  app.use(express.json())
  app.use('/api/v1/predict', require('../src/routes/predict'))
  await new Promise((resolve) => { server = app.listen(0, resolve) })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  db.touchDevice.mockResolvedValue(null)
})
afterEach(() => jest.restoreAllMocks())

const predict = (features = [[0.1, 0.2]]) =>
  fetch(`${base}/api/v1/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: 'ESP-0001A', features }),
  })

test('จำนวน feature ไม่ตรงโมเดล → 400 พร้อม detail จาก ML service', async () => {
  ml.predict.mockRejectedValue(Object.assign(new Error('ML Service error: 400'), {
    badInput: true, detail: 'rf_v2_event ต้องการ 39 ค่าต่อ window แต่ได้ 416',
  }))
  const res = await predict()
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({
    error: 'Invalid features',
    detail: 'rf_v2_event ต้องการ 39 ค่าต่อ window แต่ได้ 416',
  })
  expect(db.saveEvent).not.toHaveBeenCalled()
})

test('ML service ล่ม → ยังเป็น 500', async () => {
  ml.predict.mockRejectedValue(new Error('ML Service error: ECONNREFUSED'))
  const res = await predict()
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'Prediction failed' })
})

test('ไม่ล้ม → 200 monitoring', async () => {
  ml.predict.mockResolvedValue({ is_fall: false, confidence: 0.1 })
  const res = await predict()
  expect(res.status).toBe(200)
  expect((await res.json()).action).toBe('monitoring')
})
