/**
 * เทสต์ระดับ route — ยิง HTTP จริงเข้า router ตัวจริง (พอร์ตสุ่ม · fetch ของ Node)
 * ใช้ accountService ตัวจริง เพื่อเช็คว่า route ต่อกับการตรวจสิทธิ์ถูก
 * ไม่ใช่แค่ว่า service ตัดสินถูก — ถ้ามีคนแก้ route แล้วเผลอตัดการตรวจออก เทสต์นี้ต้องล้ม
 */
const express = require('express')

jest.mock('../src/services/dbService', () => ({
  getEvent:          jest.fn(),
  acknowledgeEvent:  jest.fn(),
  registerPushToken: jest.fn(),
  getAllPushTokens:  jest.fn(),
  accountsEnabled:   jest.fn(),
  getUserFromToken:  jest.fn(),
  getDeviceContext:  jest.fn(),
  isHouseMember:     jest.fn(),
}))
jest.mock('../src/services/escalationService', () => ({ cancel: jest.fn() }))
jest.mock('../src/services/appAlertService', () => ({ markAcknowledged: jest.fn() }))
jest.mock('../src/services/alertService', () => ({ sendSms: jest.fn(), makeCall: jest.fn() }))
jest.mock('../src/services/pushService', () => ({ sendFallAlert: jest.fn() }))

let db, escalation, appAlert
let server, base

const MEMBER = { id: 'u-1', phone: '66812345678', user_metadata: { name: 'สมใจ' } }
const pendingEvent = { id: 'evt-1', device_id: 'ESP-0001A', acknowledged: false, escalated: false }

beforeAll(async () => {
  db         = require('../src/services/dbService')
  escalation = require('../src/services/escalationService')
  appAlert   = require('../src/services/appAlertService')
  const app = express()
  app.use(express.json())
  app.use('/api/v1/alert', require('../src/routes/alert'))
  app.use('/api/v1/push', require('../src/routes/push'))
  await new Promise((resolve) => { server = app.listen(0, resolve) })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  db.getEvent.mockResolvedValue({ ...pendingEvent })
  db.acknowledgeEvent.mockImplementation(async (_id, by) => ({ acknowledged_at: 'now', acknowledged_by: by }))
  db.accountsEnabled.mockResolvedValue(false)
  db.getUserFromToken.mockImplementation(async (jwt) => (jwt === 'good' ? MEMBER : null))
  db.getDeviceContext.mockResolvedValue({ house_id: 'h1' })
  db.isHouseMember.mockResolvedValue(true)
  db.registerPushToken.mockImplementation(async (row) => row)
  escalation.cancel.mockReturnValue(true)
  appAlert.markAcknowledged.mockResolvedValue(null)
})
afterEach(() => jest.restoreAllMocks())

const ack = (headers = {}, body = { acknowledged_by: 'ชื่อที่แอปส่งมา' }) =>
  fetch(`${base}/api/v1/alert/ack/evt-1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

describe('POST /api/v1/alert/ack — ก่อนรัน accounts.sql (แบบเดิม)', () => {
  test('ไม่ login ก็กดได้ ยกเลิกการโทร และใช้ชื่อที่แอปส่งมา', async () => {
    const res = await ack()
    expect(res.status).toBe(200)
    expect(escalation.cancel).toHaveBeenCalledWith('evt-1')
    expect(db.acknowledgeEvent).toHaveBeenCalledWith('evt-1', 'ชื่อที่แอปส่งมา')
    expect(appAlert.markAcknowledged).toHaveBeenCalledWith('evt-1', 'ชื่อที่แอปส่งมา')
  })

  test('ส่ง token เสียมา → 401 และไม่ยกเลิกการโทร', async () => {
    const res = await ack({ Authorization: 'Bearer expired' })
    expect(res.status).toBe(401)
    expect(escalation.cancel).not.toHaveBeenCalled()
    expect(db.acknowledgeEvent).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/alert/ack — หลังรัน accounts.sql', () => {
  beforeEach(() => db.accountsEnabled.mockResolvedValue(true))

  test('ไม่ login → 401 · การโทรฉุกเฉินยังไม่ถูกยกเลิก', async () => {
    const res = await ack()
    expect(res.status).toBe(401)
    expect(escalation.cancel).not.toHaveBeenCalled()
    expect(db.acknowledgeEvent).not.toHaveBeenCalled()
  })

  test('login แต่ไม่ใช่สมาชิกบ้านของอุปกรณ์ → 403 · การโทรยังไม่ถูกยกเลิก', async () => {
    db.isHouseMember.mockResolvedValue(false)
    const res = await ack({ Authorization: 'Bearer good' })
    expect(res.status).toBe(403)
    expect(escalation.cancel).not.toHaveBeenCalled()
    expect(db.acknowledgeEvent).not.toHaveBeenCalled()
  })

  test('สมาชิกบ้าน → 200 · "รับทราบโดย" มาจากบัญชีที่ตรวจแล้ว ไม่ใช่ชื่อที่แอปส่ง', async () => {
    const res = await ack({ Authorization: 'Bearer good' })
    expect(res.status).toBe(200)
    expect((await res.json()).acknowledged_by).toBe('สมใจ')
    expect(escalation.cancel).toHaveBeenCalledWith('evt-1')
    expect(db.acknowledgeEvent).toHaveBeenCalledWith('evt-1', 'สมใจ')
    expect(appAlert.markAcknowledged).toHaveBeenCalledWith('evt-1', 'สมใจ')
    expect(db.isHouseMember).toHaveBeenCalledWith('h1', 'u-1')
  })

  test('หมดเวลาแล้ว (escalated) → 409 แม้เป็นสมาชิก', async () => {
    db.getEvent.mockResolvedValue({ ...pendingEvent, escalated: true, escalated_at: 'then' })
    const res = await ack({ Authorization: 'Bearer good' })
    expect(res.status).toBe(409)
    expect(escalation.cancel).not.toHaveBeenCalled()
  })

  test('ไม่พบเหตุการณ์ → 404', async () => {
    db.getEvent.mockResolvedValue(null)
    expect((await ack({ Authorization: 'Bearer good' })).status).toBe(404)
  })
})

describe('POST /api/v1/push/register', () => {
  const register = (headers = {}) =>
    fetch(`${base}/api/v1/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ token: 'ExponentPushToken[abc]', platform: 'android' }),
    })

  test('login อยู่ → ผูกเครื่องกับบัญชี', async () => {
    const res = await register({ Authorization: 'Bearer good' })
    expect(res.status).toBe(200)
    expect((await res.json()).user_linked).toBe(true)
    expect(db.registerPushToken).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u-1' }))
  })

  test('ไม่ได้ login (หลังออกจากระบบ) → ปลดการผูก (user_id = null)', async () => {
    const res = await register()
    expect(res.status).toBe(200)
    expect(db.registerPushToken).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }))
  })

  test('token เสีย → 401 และไม่แตะการผูกเดิม', async () => {
    const res = await register({ Authorization: 'Bearer expired' })
    expect(res.status).toBe(401)
    expect(db.registerPushToken).not.toHaveBeenCalled()
  })
})
