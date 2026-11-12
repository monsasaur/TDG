// expo-server-sdk เป็น ESM ที่ jest โหลดตรงไม่ได้ — โหมด fake ไม่ได้ใช้มันอยู่แล้ว
jest.mock('expo-server-sdk', () => ({
  Expo: class {
    static isExpoPushToken(t) { return /^ExponentPushToken\[/.test(t) }
  },
}))

jest.mock('../src/services/dbService', () => ({
  accountsEnabled:       jest.fn(),
  getAllPushTokens:      jest.fn(),
  getDeviceContext:      jest.fn(),
  getHouseMemberIds:     jest.fn(),
  getPushTokensForUsers: jest.fn(),
  removePushToken:       jest.fn(),
}))

let db
let push

const ALL    = [{ token: 'ExponentPushToken[a]' }, { token: 'ExponentPushToken[b]' }]
const MEMBER = [{ token: 'ExponentPushToken[a]', user_id: 'u-1' }]
const event  = { id: 'evt-1', device_id: 'ESP-0001A', location: 'ห้องน้ำ', confidence: 0.9 }

beforeEach(() => {
  jest.resetModules()
  process.env.PUSH_MODE = 'fake'
  db   = require('../src/services/dbService')
  push = require('../src/services/pushService')
  db.accountsEnabled.mockResolvedValue(false)
  db.getAllPushTokens.mockResolvedValue(ALL)
  db.getDeviceContext.mockResolvedValue({ house_id: 'h1' })
  db.getHouseMemberIds.mockResolvedValue(['u-1'])
  db.getPushTokensForUsers.mockResolvedValue(MEMBER)
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  delete process.env.PUSH_MODE
  jest.restoreAllMocks()
})

describe('recipientsFor', () => {
  test('ยังไม่เปิดระบบบัญชี → ทุกเครื่องแบบเดิม', async () => {
    expect(await push.recipientsFor(event)).toEqual({ tokens: ALL, scope: 'all' })
    expect(db.getDeviceContext).not.toHaveBeenCalled()
  })

  test('เปิดแล้ว → เฉพาะเครื่องของสมาชิกบ้านที่อุปกรณ์ติดตั้งอยู่', async () => {
    db.accountsEnabled.mockResolvedValue(true)
    expect(await push.recipientsFor(event)).toEqual({ tokens: MEMBER, scope: 'house' })
    expect(db.getHouseMemberIds).toHaveBeenCalledWith('h1')
    expect(db.getPushTokensForUsers).toHaveBeenCalledWith(['u-1'])
    expect(db.getAllPushTokens).not.toHaveBeenCalled()
  })

  test('เปิดแล้ว + อุปกรณ์ไม่ได้ผูกกับบ้าน → ไม่ส่งให้ใคร (ไม่ส่งให้คนแปลกหน้า)', async () => {
    db.accountsEnabled.mockResolvedValue(true)
    db.getDeviceContext.mockResolvedValue(null)
    expect(await push.recipientsFor(event)).toEqual({ tokens: [], scope: 'unlinked' })
    expect(db.getAllPushTokens).not.toHaveBeenCalled()
  })

  test("audience 'all' (POST /push/test) → ทุกเครื่องแม้เปิดระบบบัญชีแล้ว", async () => {
    db.accountsEnabled.mockResolvedValue(true)
    expect((await push.recipientsFor(event, { audience: 'all' })).scope).toBe('all')
  })
})

describe('sendFallAlert', () => {
  test('ส่งเฉพาะสมาชิก (fake mode นับจำนวนที่ส่ง)', async () => {
    db.accountsEnabled.mockResolvedValue(true)
    expect(await push.sendFallAlert(event)).toMatchObject({ sent: 1, failed: 0, mode: 'fake' })
  })

  test('ไม่มีเครื่องของสมาชิก → ข้าม push และเตือนใน log ว่าการโทรยังทำงาน', async () => {
    db.accountsEnabled.mockResolvedValue(true)
    db.getPushTokensForUsers.mockResolvedValue([])
    expect(await push.sendFallAlert(event)).toMatchObject({ sent: 0, skipped: true, scope: 'house' })
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('การโทรฉุกเฉินยังทำงาน'))
  })

  test('ฐานข้อมูลล่ม → ไม่ throw (push เป็น fire-and-forget)', async () => {
    db.accountsEnabled.mockRejectedValue(new Error('down'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(await push.sendFallAlert(event)).toMatchObject({ sent: 0, error: 'down' })
  })
})
