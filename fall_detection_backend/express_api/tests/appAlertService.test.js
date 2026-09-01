jest.mock('../src/services/dbService', () => ({
  getDeviceContext:   jest.fn(),
  createAlert:        jest.fn(),
  getAlertByEvent:    jest.fn(),
  updateAlertByEvent: jest.fn(),
}))

let db
let svc

function load() {
  jest.resetModules()
  db  = require('../src/services/dbService')
  svc = require('../src/services/appAlertService')
  db.createAlert.mockImplementation(async (a) => a)
  db.updateAlertByEvent.mockImplementation(async (_id, patch) => patch)
  return svc
}

const event = (o = {}) => ({
  id: 'evt-1', device_id: 'ESP-0001A', location: 'ห้องน้ำ',
  confidence: 0.97, is_fall: true, created_at: '2026-09-02T03:00:00.000Z', ...o,
})

const ctx = (o = {}) => ({ house_id: 'h1', house_name: 'บ้านแม่', device_name: 'Esp32', ...o })

const step = (timeline, label) => timeline.find((s) => s.label === label)

beforeEach(() => {
  load()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('createFromEvent', () => {
  test('สร้าง alert ที่แอปแสดงได้ทันที พร้อมผูกกับ fall event', async () => {
    db.getDeviceContext.mockResolvedValue(ctx())

    const alert = await svc.createFromEvent(event(), 60)

    expect(alert).toMatchObject({
      fall_event_id: 'evt-1',
      house_id: 'h1',
      status: 'active',
      countdown: 60,
      answered_by: null,
    })
    expect(alert.description).toContain('บ้านแม่')
    expect(alert.description).toContain('ห้องน้ำ')
    expect(alert.location).toBe('บ้านแม่ - ห้องน้ำ')
    expect(alert.created_at).toBe('2026-09-02T03:00:00.000Z')
  })

  test('timeline เริ่มต้น: ตรวจพบแล้ว ที่เหลือยังรอ', async () => {
    db.getDeviceContext.mockResolvedValue(ctx())
    const { timeline } = await svc.createFromEvent(event(), 60)

    expect(timeline).toHaveLength(3)
    expect(step(timeline, 'ตรวจพบการล้ม')).toMatchObject({ status: 'error', detail: 'ความมั่นใจ 97%' })
    expect(step(timeline, 'แจ้งเตือนผู้ดูแลในแอป').status).toBe('pending')
    expect(step(timeline, 'โทรหาเบอร์ติดต่อฉุกเฉิน').status).toBe('pending')
  })

  test('อุปกรณ์ยังไม่ผูกกับบ้าน → ข้ามการสร้าง ไม่ throw', async () => {
    db.getDeviceContext.mockResolvedValue(ctx({ house_id: null }))

    await expect(svc.createFromEvent(event(), 60)).resolves.toBeNull()
    expect(db.createAlert).not.toHaveBeenCalled()
  })

  test('ไม่รู้จักอุปกรณ์เลย → ข้าม ไม่ throw', async () => {
    db.getDeviceContext.mockResolvedValue(null)
    await expect(svc.createFromEvent(event(), 60)).resolves.toBeNull()
  })

  test('DB ล่ม → คืน null ไม่ throw (ห้ามกระทบ path แจ้งเตือน)', async () => {
    db.getDeviceContext.mockRejectedValue(new Error('supabase down'))
    await expect(svc.createFromEvent(event(), 60)).resolves.toBeNull()
  })
})

describe('markAcknowledged', () => {
  test('บันทึกว่าใครกดรับทราบ และปิด countdown', async () => {
    db.getAlertByEvent.mockResolvedValue({
      fall_event_id: 'evt-1',
      timeline: [
        { label: 'ตรวจพบการล้ม', detail: '', status: 'error' },
        { label: 'แจ้งเตือนผู้ดูแลในแอป', detail: '', status: 'pending' },
        { label: 'โทรหาเบอร์ติดต่อฉุกเฉิน', detail: '', status: 'pending' },
      ],
    })

    const patch = await svc.markAcknowledged('evt-1', 'ตังเม')

    expect(patch).toMatchObject({ status: 'completed', answered_by: 'ตังเม', countdown: null })
    expect(step(patch.timeline, 'แจ้งเตือนผู้ดูแลในแอป'))
      .toMatchObject({ status: 'success', detail: 'รับทราบโดย : ตังเม' })
    // ต้องไม่ไปแตะ step อื่น
    expect(step(patch.timeline, 'โทรหาเบอร์ติดต่อฉุกเฉิน').status).toBe('pending')
  })

  test('timeline ที่เก็บเป็น JSON string อ่านได้', async () => {
    db.getAlertByEvent.mockResolvedValue({
      fall_event_id: 'evt-1',
      timeline: JSON.stringify([{ label: 'แจ้งเตือนผู้ดูแลในแอป', detail: '', status: 'pending' }]),
    })
    const patch = await svc.markAcknowledged('evt-1', 'ฉัน')
    expect(step(patch.timeline, 'แจ้งเตือนผู้ดูแลในแอป').status).toBe('success')
  })

  test('ไม่มี alert ผูกอยู่ → คืน null เงียบ ๆ', async () => {
    db.getAlertByEvent.mockResolvedValue(null)
    await expect(svc.markAcknowledged('evt-1', 'ฉัน')).resolves.toBeNull()
    expect(db.updateAlertByEvent).not.toHaveBeenCalled()
  })
})

describe('markEscalated', () => {
  const existing = () => ({
    fall_event_id: 'evt-1',
    timeline: [
      { label: 'ตรวจพบการล้ม', detail: '', status: 'error' },
      { label: 'แจ้งเตือนผู้ดูแลในแอป', detail: '', status: 'pending' },
      { label: 'โทรหาเบอร์ติดต่อฉุกเฉิน', detail: '', status: 'pending' },
    ],
  })

  test('โทรออกสำเร็จ → in_progress ไม่ใช่ no_response', async () => {
    db.getAlertByEvent.mockResolvedValue(existing())

    const patch = await svc.markEscalated('evt-1', {
      sms_sent: true, call_made: true, ack_timeout_seconds: 60,
    })

    // ยังไม่รู้ว่าปลายสายรับหรือเปล่า — อ้างว่า "ไม่มีใครรับ" ไม่ได้
    expect(patch.status).toBe('in_progress')
    expect(patch.countdown).toBeNull()
    expect(step(patch.timeline, 'แจ้งเตือนผู้ดูแลในแอป'))
      .toMatchObject({ status: 'error', detail: 'ไม่มีการตอบรับภายใน 60 วินาที' })
    expect(step(patch.timeline, 'โทรหาเบอร์ติดต่อฉุกเฉิน').detail).toContain('โทรออก')
    expect(step(patch.timeline, 'โทรหาเบอร์ติดต่อฉุกเฉิน').detail).toContain('ส่ง SMS')
  })

  test('ติดต่อไม่สำเร็จเลย → step โทรเป็น error', async () => {
    db.getAlertByEvent.mockResolvedValue(existing())

    const patch = await svc.markEscalated('evt-1', {
      sms_sent: false, call_made: false, ack_timeout_seconds: 60,
    })

    expect(step(patch.timeline, 'โทรหาเบอร์ติดต่อฉุกเฉิน'))
      .toMatchObject({ status: 'error', detail: 'ติดต่อไม่สำเร็จ' })
  })

  test('DB ล่ม → คืน null ไม่ throw', async () => {
    db.getAlertByEvent.mockRejectedValue(new Error('down'))
    await expect(svc.markEscalated('evt-1', {})).resolves.toBeNull()
  })
})
