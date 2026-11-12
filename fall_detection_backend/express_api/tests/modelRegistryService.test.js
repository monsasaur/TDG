/**
 * ทะเบียนเวอร์ชันโมเดล — กติกาต้องตรงกับ frontend (tdg-admin/src/lib/domain.js)
 * ถ้าฝั่งใดฝั่งหนึ่งเปลี่ยนกติกา เทสต์ชุดนี้ต้องเปลี่ยนตาม
 */
jest.mock('../src/services/dbService')

const db       = require('../src/services/dbService')
const registry = require('../src/services/modelRegistryService')

let store

beforeEach(() => {
  store = new Map()
  db.listModels.mockImplementation(async () =>
    [...store.values()].sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1)))
  db.getModel.mockImplementation(async v => store.get(v) || null)
  db.createModel.mockImplementation(async ({ version, notes }) => {
    if (store.has(version)) throw new Error('duplicate version')
    const row = { version, notes, status: 'testing', tested: false,
                  uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    store.set(version, row)
    return row
  })
  db.updateModel.mockImplementation(async (v, patch) => {
    const prev = store.get(v)
    if (!prev) return null
    const next = { ...prev, ...patch, updated_at: new Date().toISOString() }
    store.set(v, next)
    return next
  })
  db.activateModel.mockImplementation(async v => {
    const models = [...store.values()]
    const previous = models.find(m => m.status === 'active') || null
    for (const m of models) {
      if (m.status === 'active' && m.version !== v) store.set(m.version, { ...m, status: 'inactive' })
    }
    store.set(v, { ...store.get(v), status: 'active' })
    return { model: store.get(v), previous_active: previous ? previous.version : null }
  })
})

async function seed(version, { tested = false, status = 'testing' } = {}) {
  await registry.create({ version, notes: 'note' })
  if (tested) await registry.markTested(version)
  if (status === 'active') await db.updateModel(version, { status: 'active' })
  return store.get(version)
}

describe('create', () => {
  test('เวอร์ชันใหม่เริ่มที่ testing และยังไม่ผ่านการทดสอบ', async () => {
    const m = await registry.create({ version: '1.0.0', notes: '  ทดสอบ  ' })
    expect(m.status).toBe('testing')
    expect(m.tested).toBe(false)
    expect(m.notes).toBe('ทดสอบ')          // trim แล้ว
  })

  test.each(['1.0', 'v1.0.0', '1.0.0-beta', '', 'abc'])(
    'ปฏิเสธเวอร์ชันรูปแบบผิด: %s', async (version) => {
      await expect(registry.create({ version, notes: 'x' }))
        .rejects.toMatchObject({ key: 'versionError', status: 400 })
    })

  test('ปฏิเสธ notes ว่างหรือเกิน 240 ตัว', async () => {
    await expect(registry.create({ version: '1.0.0', notes: '   ' }))
      .rejects.toMatchObject({ key: 'notesError', status: 400 })
    await expect(registry.create({ version: '1.0.0', notes: 'x'.repeat(241) }))
      .rejects.toMatchObject({ key: 'notesError', status: 400 })
  })

  test('notes ยาว 240 พอดีผ่าน — ขอบเขตต้องรวมค่าสุดท้าย', async () => {
    const m = await registry.create({ version: '1.0.0', notes: 'x'.repeat(240) })
    expect(m.notes).toHaveLength(240)
  })

  test('เวอร์ชันซ้ำได้ 409', async () => {
    await seed('1.0.0')
    await expect(registry.create({ version: '1.0.0', notes: 'x' }))
      .rejects.toMatchObject({ key: 'versionError', status: 409 })
  })

  test('ชนกันตอนสร้างพร้อมกัน — ฐานข้อมูลเป็นคนตัดสิน', async () => {
    db.getModel.mockResolvedValueOnce(null)        // ผ่านการเช็คล่วงหน้า
    db.createModel.mockRejectedValueOnce(new Error('duplicate version'))
    await expect(registry.create({ version: '9.9.9', notes: 'x' }))
      .rejects.toMatchObject({ key: 'versionError', status: 409 })
  })
})

describe('activate', () => {
  test('ยังไม่ทดสอบ → 409 testedRequired', async () => {
    await seed('1.0.0')
    await expect(registry.activate('1.0.0'))
      .rejects.toMatchObject({ key: 'testedRequired', status: 409 })
  })

  test('ทดสอบแล้ว → active ได้ และตัวเดิมกลายเป็น inactive', async () => {
    await seed('1.0.0', { tested: true, status: 'active' })
    await seed('2.0.0', { tested: true })

    const res = await registry.activate('2.0.0')
    expect(res.model.status).toBe('active')
    expect(res.previous_active).toBe('1.0.0')
    expect(store.get('1.0.0').status).toBe('inactive')
  })

  test('มี active ได้ทีละตัวเดียวเสมอ', async () => {
    await seed('1.0.0', { tested: true, status: 'active' })
    await seed('2.0.0', { tested: true })
    await registry.activate('2.0.0')
    expect([...store.values()].filter(m => m.status === 'active')).toHaveLength(1)
  })

  test('activate ตัวที่ active อยู่แล้ว — ไม่เปลี่ยนอะไร', async () => {
    await seed('1.0.0', { tested: true, status: 'active' })
    const res = await registry.activate('1.0.0')
    expect(res.unchanged).toBe(true)
    expect(res.previous_active).toBeNull()
  })

  test('ไม่พบเวอร์ชัน → 404', async () => {
    await expect(registry.activate('9.9.9'))
      .rejects.toMatchObject({ key: 'notFound', status: 404 })
  })
})

describe('markTested', () => {
  test('ตั้ง tested=true โดยไม่เปลี่ยน status', async () => {
    await seed('1.0.0')
    const m = await registry.markTested('1.0.0')
    expect(m.tested).toBe(true)
    expect(m.status).toBe('testing')
  })

  test('ไม่พบเวอร์ชัน → 404', async () => {
    await expect(registry.markTested('9.9.9'))
      .rejects.toMatchObject({ key: 'notFound', status: 404 })
  })
})

describe('list', () => {
  test('บอกเวอร์ชันที่ใช้งานอยู่ และ has_data', async () => {
    expect(await registry.list()).toMatchObject({ has_data: false, active_version: null })
    await seed('1.0.0', { tested: true, status: 'active' })
    expect(await registry.list()).toMatchObject({ has_data: true, active_version: '1.0.0' })
  })
})
