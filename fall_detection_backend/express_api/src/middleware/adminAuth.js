/**
 * adminAuth.js
 * SEC-03 — ทุกเส้น /api/v1/admin/* ต้องตรวจสอบสิทธิ์ทุกครั้ง ไม่พึ่งการซ่อน URL
 *
 * รับ token ผ่าน Authorization: Bearer <token> ที่ได้จาก POST /api/v1/admin/login
 * ไม่รับ x-api-key — นั่นคือ key ที่ ESP32 กับแอปมือถือใช้ร่วมกัน (SEC-01)
 */

const adminAuthService = require('../services/adminAuthService')

function bearerToken(req) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (!token || scheme.toLowerCase() !== 'bearer') return null
  return token.trim()
}

module.exports = (req, res, next) => {
  // ยังไม่ตั้งรหัส admin → ปฏิเสธไว้ก่อน ไม่เปิดทิ้งไว้
  if (!adminAuthService.isConfigured()) {
    return res.status(503).json({ error: 'admin auth not configured' })
  }

  const session = adminAuthService.verify(bearerToken(req))
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.admin = session
  next()
}

module.exports.bearerToken = bearerToken
