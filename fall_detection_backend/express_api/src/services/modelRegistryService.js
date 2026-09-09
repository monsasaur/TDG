/**
 * modelRegistryService.js
 * ทะเบียนเวอร์ชันโมเดล — รองรับหน้า Admin → Models
 *
 * ⚠️ ขอบเขต: **เมทาดาทาอย่างเดียว**
 * ------------------------------------------------------------
 * บริการนี้ไม่ได้อัปโหลดไฟล์โมเดล ไม่ได้ deploy และไม่ได้ทดสอบคุณภาพโมเดลจริง
 * การกด "active" คือการบันทึกว่า *ควร* ใช้เวอร์ชันไหน — คนต้องไปเปลี่ยนไฟล์
 * ใน ml_service เองอยู่ดี (app/predict.py ยัง hardcode path ของ rf_v1.pkl)
 *
 * เขียนไว้ตรงนี้เพื่อไม่ให้ใครเข้าใจว่ากดปุ่มแล้วระบบเปลี่ยนโมเดลให้จริง
 *
 * กติกาเดียวกับที่ frontend ใช้อยู่ (tdg-admin/src/lib/domain.js `modelTransition`)
 *   - เวอร์ชันต้องเป็น x.y.z และห้ามซ้ำ
 *   - notes 1-240 ตัวอักษร (trim แล้ว)
 *   - อัปโหลดใหม่ → status=testing, tested=false
 *   - test  → tested=true (ไม่เปลี่ยน status)
 *   - activate → ต้อง tested=true ก่อน ไม่งั้น 409 testedRequired
 *   - active ได้ทีละเวอร์ชันเดียว
 */

const dbService = require('./dbService')

const VERSION_RE = /^\d+\.\d+\.\d+$/
const NOTES_MAX  = 240

class ModelError extends Error {
  constructor(key, status) {
    super(key)
    this.key    = key      // ตรงกับคีย์ข้อความใน i18n ของ frontend
    this.status = status
  }
}

module.exports = {
  ModelError,

  list: async () => {
    const models  = await dbService.listModels()
    const active  = models.find(m => m.status === 'active') || null
    return {
      models,
      active_version: active ? active.version : null,
      has_data: models.length > 0,
      calculated_at: new Date().toISOString()
    }
  },

  create: async ({ version, notes }) => {
    const v = String(version || '').trim()
    const n = String(notes   || '').trim()

    if (!VERSION_RE.test(v))            throw new ModelError('versionError', 400)
    if (!n || n.length > NOTES_MAX)     throw new ModelError('notesError',   400)
    if (await dbService.getModel(v))    throw new ModelError('versionError', 409)

    try {
      return await dbService.createModel({ version: v, notes: n })
    } catch (err) {
      // แข่งกันสร้างเวอร์ชันเดียวกันพร้อมกัน — ฐานข้อมูลเป็นคนตัดสิน
      if (/duplicate/i.test(err.message)) throw new ModelError('versionError', 409)
      throw err
    }
  },

  /**
   * ทำเครื่องหมายว่าทดสอบแล้ว
   *
   * ⚠️ ไม่ได้รันการทดสอบใด ๆ — เป็นการบันทึกว่ามีคนทดสอบแล้วเท่านั้น
   *    ถ้าวันหลังมีการทดสอบจริง ให้เรียกจากตรงนี้
   */
  markTested: async (version) => {
    const model = await dbService.getModel(version)
    if (!model) throw new ModelError('notFound', 404)
    return dbService.updateModel(version, { tested: true })
  },

  activate: async (version) => {
    const model = await dbService.getModel(version)
    if (!model)       throw new ModelError('notFound', 404)
    if (!model.tested) throw new ModelError('testedRequired', 409)
    if (model.status === 'active') {
      return { model, previous_active: null, unchanged: true }
    }
    return dbService.activateModel(version)
  }
}
