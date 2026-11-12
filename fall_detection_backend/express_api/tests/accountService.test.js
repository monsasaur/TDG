jest.mock('../src/services/dbService', () => ({
  accountsEnabled:  jest.fn(),
  getUserFromToken: jest.fn(),
  getDeviceContext: jest.fn(),
  isHouseMember:    jest.fn(),
}))

let db
let svc

beforeEach(() => {
  jest.resetModules()
  db  = require('../src/services/dbService')
  svc = require('../src/services/accountService')
  db.accountsEnabled.mockResolvedValue(false)
  db.getDeviceContext.mockResolvedValue({ house_id: 'h1' })
  db.isHouseMember.mockResolvedValue(true)
})

const event = { id: 'evt-1', device_id: 'ESP-0001A' }
const user  = (o = {}) => ({ id: 'u-1', phone: '66812345678', user_metadata: { name: 'สมใจ' }, ...o })

describe('bearerFrom / displayName', () => {
  test('อ่าน token จาก header Bearer เท่านั้น', () => {
    expect(svc.bearerFrom('Bearer abc.def')).toBe('abc.def')
    expect(svc.bearerFrom('bearer   abc')).toBe('abc')
    expect(svc.bearerFrom('Basic abc')).toBeNull()
    expect(svc.bearerFrom(undefined)).toBeNull()
  })

  test('ชื่อที่แสดง: ชื่อในบัญชี → เบอร์ → ค่าเริ่มต้น', () => {
    expect(svc.displayName(user())).toBe('สมใจ')
    expect(svc.displayName(user({ user_metadata: { name: '  ' } }))).toBe('081-234-5678')
    expect(svc.displayName({})).toBe('ผู้ดูแล')
  })
})

describe('resolveUser', () => {
  test('ไม่ส่ง token มา → none (ไม่ถามฐานข้อมูล)', async () => {
    expect(await svc.resolveUser(undefined)).toEqual({ user: null, status: 'none' })
    expect(db.getUserFromToken).not.toHaveBeenCalled()
  })

  test('token ใช้ไม่ได้ → invalid', async () => {
    db.getUserFromToken.mockResolvedValue(null)
    expect((await svc.resolveUser('Bearer bad')).status).toBe('invalid')
  })

  test('ไม่มีฐานข้อมูลให้ตรวจ (mock) → unverifiable ไม่ใช่ invalid', async () => {
    db.getUserFromToken.mockResolvedValue(undefined)
    expect(await svc.resolveUser('Bearer x')).toEqual({ user: null, status: 'unverifiable' })
  })
})

describe('authorizeAck — ก่อนเปิดระบบบัญชี (ทำงานแบบเดิม)', () => {
  test('ไม่ login ก็กดได้ ใช้ชื่อที่แอปส่งมา', async () => {
    expect(await svc.authorizeAck(event, undefined, 'ผู้ดูแล')).toEqual({ ok: true, acknowledged_by: 'ผู้ดูแล' })
  })

  test('login อยู่ → ใช้ชื่อจากบัญชีที่ตรวจแล้ว ไม่ใช่ชื่อที่แอปอ้าง', async () => {
    db.getUserFromToken.mockResolvedValue(user())
    expect(await svc.authorizeAck(event, 'Bearer ok', 'คนอื่น')).toEqual({ ok: true, acknowledged_by: 'สมใจ' })
  })

  test('ส่ง token เสียมา → 401 ไม่แอบกดให้', async () => {
    db.getUserFromToken.mockResolvedValue(null)
    expect(await svc.authorizeAck(event, 'Bearer bad', 'x')).toMatchObject({ ok: false, status: 401 })
  })
})

describe('authorizeAck — เปิดระบบบัญชีแล้ว', () => {
  beforeEach(() => db.accountsEnabled.mockResolvedValue(true))

  test('ไม่ login → 401 (มีแค่ x-api-key ของแอปไม่พอ)', async () => {
    expect(await svc.authorizeAck(event, undefined, 'ผู้ดูแล')).toMatchObject({ ok: false, status: 401 })
  })

  test('สมาชิกบ้าน → กดได้ ชื่อจากบัญชี', async () => {
    db.getUserFromToken.mockResolvedValue(user())
    expect(await svc.authorizeAck(event, 'Bearer ok', 'ชื่อปลอม')).toEqual({ ok: true, acknowledged_by: 'สมใจ' })
    expect(db.isHouseMember).toHaveBeenCalledWith('h1', 'u-1')
  })

  test('ไม่ใช่สมาชิกบ้าน → 403 ยกเลิกการโทรของบ้านอื่นไม่ได้', async () => {
    db.getUserFromToken.mockResolvedValue(user())
    db.isHouseMember.mockResolvedValue(false)
    expect(await svc.authorizeAck(event, 'Bearer ok')).toMatchObject({ ok: false, status: 403 })
  })

  test('อุปกรณ์ไม่ได้ผูกกับบ้าน → 403', async () => {
    db.getUserFromToken.mockResolvedValue(user())
    db.getDeviceContext.mockResolvedValue(null)
    expect(await svc.authorizeAck(event, 'Bearer ok')).toMatchObject({ ok: false, status: 403 })
  })
})
