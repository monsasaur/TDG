/**
 * auth.js
 * ตรวจ x-api-key โดยแยกสิทธิ์ตามผู้เรียก ไม่ใช้คีย์ตัวเดียวร่วมกันทั้งระบบ
 *
 * ปัญหาที่แก้
 * -----------
 * เดิมมี API_KEY ตัวเดียวใช้ร่วมกันหมด — ESP32, แอปมือถือ, และ endpoint สาธิต
 * แอปที่ build แล้วมีคีย์ฝังอยู่ในตัวเสมอ ใครแกะ APK ได้ก็เรียกได้ทุกเส้น
 * รวมถึง POST /api/v1/demo/fire ที่สั่งให้ระบบโทรออกจริง
 *
 * แยกเป็น 3 scope คนละคีย์:
 *   device  — ESP32 ส่ง CSI เข้ามา          → POST /predict
 *   app     — แอปมือถือ                     → /events, /alert/ack, /push
 *   demo    — ปุ่มสาธิต (iOS Shortcut ฯลฯ)  → /demo/fire, /alert/test
 *
 * คีย์ของแอปจึงสั่งให้ระบบโทรออกไม่ได้ และคีย์ที่หลุดจาก ESP32 ก็อ่าน event ไม่ได้
 *
 * ความเข้ากันได้กับของเดิม
 * ------------------------
 * scope ไหนไม่ได้ตั้งคีย์เฉพาะไว้ จะถอยไปใช้ API_KEY ตัวเดิม
 * ระบบที่ตั้งแค่ API_KEY อยู่ตอนนี้จึงทำงานเหมือนเดิมทุกประการ ไม่พังกลางการสาธิต
 * แล้วค่อยทยอยตั้งคีย์แยกทีหลัง
 *
 * หน้า /api/v1/admin/* ไม่ผ่านไฟล์นี้ — ใช้ Bearer token ของตัวเอง (ดู adminAuth.js)
 */

// เส้นทางที่ไม่ต้องยืนยันตัวตน
const PUBLIC_PATHS = new Set(['/health'])

// จับ scope จาก path — เรียงจากเจาะจงไปกว้าง เพราะ /alert/test ต้องชนะ /alert
const SCOPE_RULES = [
  [/^\/api\/v1\/demo(\/|$)/,       'demo'],
  [/^\/api\/v1\/alert\/test(\/|$)/, 'demo'],
  [/^\/api\/v1\/predict(\/|$)/,    'device'],
  [/^\/api\/v1\/alert(\/|$)/,      'app'],
  [/^\/api\/v1\/events(\/|$)/,     'app'],
  [/^\/api\/v1\/push(\/|$)/,       'app'],
]

const ENV_BY_SCOPE = {
  device: 'DEVICE_API_KEY',
  app:    'APP_API_KEY',
  demo:   'DEMO_API_KEY',
}

function scopeFor(path) {
  for (const [pattern, scope] of SCOPE_RULES) {
    if (pattern.test(path)) return scope
  }
  return null   // เส้นที่ไม่ได้ระบุ scope → ยอมรับคีย์ของ scope ไหนก็ได้
}

/** คีย์ที่ยอมรับสำหรับ scope นี้ — ไม่ได้ตั้งเฉพาะไว้ก็ถอยไปใช้ API_KEY */
function acceptedKeys(scope) {
  const shared = process.env.API_KEY
  if (!scope) {
    return [process.env.DEVICE_API_KEY, process.env.APP_API_KEY,
            process.env.DEMO_API_KEY, shared].filter(Boolean)
  }
  const specific = process.env[ENV_BY_SCOPE[scope]]
  return specific ? [specific] : [shared].filter(Boolean)
}

module.exports = (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) return next()

  const provided = req.headers['x-api-key']
  // originalUrl มี path เต็มรวม mount prefix — ต้องใช้ตัวนี้ ไม่ใช่ req.path
  // เผื่อกรณีถูกเรียกโดยไม่มี originalUrl (เทสต์ / mount แบบอื่น) ให้ถอยไป req.path
  const url      = String(req.originalUrl || req.path || '')
  const scope    = scopeFor(url.split('?')[0])
  const accepted = acceptedKeys(scope)

  if (accepted.length === 0) {
    console.error('❌ ไม่ได้ตั้ง API_KEY หรือคีย์ประจำ scope เลย — ปฏิเสธทุก request')
    return res.status(503).json({ error: 'server auth not configured' })
  }

  if (!provided || !accepted.includes(provided)) {
    // ไม่บอกว่าคีย์ผิดหรือใช้ผิด scope — บอกไปก็ช่วยคนเดาเฉย ๆ
    return res.status(401).json({ error: 'Unauthorized' })
  }

  req.apiScope = scope
  next()
}

module.exports.scopeFor = scopeFor
