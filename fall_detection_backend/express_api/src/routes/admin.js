/**
 * admin.js — Admin Client API (TDG_BA.pdf ข้อ 13.2)
 *
 * ทุกเส้นยกเว้น /login ต้องมี Authorization: Bearer <token> (SEC-03)
 * BR-07 — เส้นที่เกี่ยวกับเหตุการณ์/อุปกรณ์อ่านอย่างเดียว
 * ยกเว้น /models/* ซึ่งเป็นทะเบียนเวอร์ชันโมเดล (เมทาดาทา ไม่ได้ deploy อะไร)
 */

const router           = require('express').Router()
const adminAuth        = require('../middleware/adminAuth')
const adminAuthService = require('../services/adminAuthService')
const adminService     = require('../services/adminService')
const modelRegistry    = require('../services/modelRegistryService')

// SEC-09 — ไม่เปิดเผยโครงสร้างภายในระบบผ่านข้อความ error
function fail(res, err, label) {
  console.error(`Admin ${label} error:`, err.message)
  res.status(500).json({ error: 'internal error' })
}

// ----- FR-22 / FR-23 authentication -----

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  const result = adminAuthService.login({ username, password, ip: req.ip })

  if (result.ok) {
    return res.json({
      token:      result.token,
      expires_at: result.expires_at,
      username
    })
  }

  if (result.reason === 'not_configured') {
    return res.status(503).json({ error: 'admin auth not configured' })
  }
  if (result.reason === 'rate_limited') {
    // SEC-08 — จำกัดจำนวนครั้งที่ลองผิด
    return res.status(429).json({ error: 'too many attempts, try again later' })
  }
  // SEC-09 — ไม่บอกว่าผิดที่ username หรือ password
  return res.status(401).json({ error: 'invalid credentials' })
})

router.post('/logout', adminAuth, (req, res) => {
  adminAuthService.logout(adminAuth.bearerToken(req))
  res.json({ logged_out: true })
})

// ----- ทุกเส้นด้านล่างต้องผ่าน adminAuth -----

// FR-01 ถึง FR-06 — ตัวเลขสรุปทั้งหมดของ Dashboard
router.get('/summary', adminAuth, async (_req, res) => {
  try {
    res.json(await adminService.getSummary())
  } catch (err) {
    fail(res, err, 'summary')
  }
})

// FR-08 ถึง FR-13 — event log ทุก device พร้อมตัวกรองและแบ่งหน้า
router.get('/events', adminAuth, async (req, res) => {
  try {
    const { from, to, device_id, status, limit, offset } = req.query

    const allowed = ['pending', 'acknowledged', 'escalated', 'fall']
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` })
    }

    res.json(await adminService.getEvents({ from, to, device_id, status, limit, offset }))
  } catch (err) {
    fail(res, err, 'events')
  }
})

// FR-14 — รายละเอียดเหตุการณ์เดียว พร้อมไทม์ไลน์
router.get('/events/:id', adminAuth, async (req, res) => {
  try {
    const event = await adminService.getEventDetail(req.params.id)
    if (!event) return res.status(404).json({ error: 'event not found' })
    res.json(event)
  } catch (err) {
    fail(res, err, 'event detail')
  }
})

// FR-16 ถึง FR-21 — รายการอุปกรณ์พร้อมสถานะ
router.get('/devices', adminAuth, async (req, res) => {
  try {
    const { status, include_inactive } = req.query

    if (status && !['online', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'status must be online or offline' })
    }

    res.json(await adminService.getDevices({
      status,
      include_inactive: include_inactive === 'true'
    }))
  } catch (err) {
    fail(res, err, 'devices')
  }
})

// ----- ทะเบียนเวอร์ชันโมเดล — รองรับหน้า Admin → Models -----
//
// ⚠️ เมทาดาทาอย่างเดียว: ตั้ง active ที่นี่ไม่ได้ทำให้ ML service เปลี่ยนโมเดลจริง
//    ยังต้องมีคนไปเปลี่ยนไฟล์ใน ml_service เอง (predict.py hardcode path อยู่)

// ส่ง key ของข้อความกลับไปให้ frontend แปลเอง — ไม่ส่งข้อความไทย/อังกฤษจาก server
// เพราะ i18n อยู่ฝั่ง frontend อยู่แล้ว (src/i18n/messages.js)
function modelFail(res, err, label) {
  if (err instanceof modelRegistry.ModelError) {
    return res.status(err.status).json({ error: err.key })
  }
  return fail(res, err, label)
}

router.get('/models', adminAuth, async (_req, res) => {
  try {
    res.json(await modelRegistry.list())
  } catch (err) {
    modelFail(res, err, 'models')
  }
})

router.post('/models', adminAuth, async (req, res) => {
  try {
    const { version, notes } = req.body || {}
    res.status(201).json(await modelRegistry.create({ version, notes }))
  } catch (err) {
    modelFail(res, err, 'model create')
  }
})

router.post('/models/:version/test', adminAuth, async (req, res) => {
  try {
    res.json(await modelRegistry.markTested(req.params.version))
  } catch (err) {
    modelFail(res, err, 'model test')
  }
})

// rollback ใช้เส้นเดียวกับ activate — ฝั่ง frontend แค่ส่งเวอร์ชันเก่ามาแทน
// response มี previous_active ให้ ไม่ต้องจำสถานะไว้ในเบราว์เซอร์ (รีเฟรชแล้วหาย)
router.post('/models/:version/activate', adminAuth, async (req, res) => {
  try {
    res.json(await modelRegistry.activate(req.params.version))
  } catch (err) {
    modelFail(res, err, 'model activate')
  }
})

module.exports = router
