/**
 * adminAuthService.js
 * ยืนยันตัวตน admin แยกจาก x-api-key ที่ ESP32 กับแอปมือถือใช้
 *
 * ทำไมต้องแยก (TDG_BA.pdf ข้อ 14.1, SEC-01):
 *   เว็บ admin ทำงานบนเบราว์เซอร์ — ทุกอย่างที่หน้าเว็บใช้เรียก API จะถูกส่งไปกับหน้าเว็บ
 *   และเปิดดูได้ด้วย DevTools ถ้าใช้ API key ตัวเดิม คนนอกที่เห็น key จะเรียกได้ทุกเส้น
 *   รวมถึง POST /api/v1/demo/fire ที่สร้างเหตุการณ์ล้มปลอมและทำให้ระบบโทรออกจริง
 *
 * วิธีที่ใช้: username เดียว + scrypt hash ใน env + session token เก็บใน memory
 *   - ไม่เพิ่ม dependency ใหม่ (ใช้ crypto ของ Node)
 *   - เอกสาร BA ข้อ 14.3 เสนอ Supabase Auth เป็นตัวเลือกที่เหมาะที่สุด
 *     ตัวนี้เป็น implementation ชั่วคราวที่ทำให้ endpoint ปลอดภัยได้ทันที
 *     และเปลี่ยนไป Supabase Auth ทีหลังได้โดยแก้แค่ไฟล์นี้
 *
 * ข้อจำกัดที่รู้ตัว: session เก็บใน memory — server restart แล้ว admin ต้อง login ใหม่
 *   (ข้อจำกัดเดียวกับ escalationService)
 */

const crypto = require('crypto')

const SESSION_HOURS   = Number(process.env.ADMIN_SESSION_HOURS || 8)   // SEC-04
const SESSION_TTL_MS  = SESSION_HOURS * 60 * 60 * 1000
const MAX_ATTEMPTS    = Number(process.env.ADMIN_MAX_LOGIN_ATTEMPTS || 5)  // SEC-08
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

const SCRYPT_KEYLEN = 64

// token → { username, created_at, last_used_at }
const sessions = new Map()

// key (username|ip) → { count, first_at }
const failedAttempts = new Map()

/**
 * สร้าง hash สำหรับเก็บใน ADMIN_PASSWORD_HASH (SEC-05 — เข้ารหัสทางเดียว)
 * รูปแบบ: scrypt$<saltHex>$<hashHex>
 */
function hashPassword(password, salt) {
  const saltBuf = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(16)
  const hash    = crypto.scryptSync(password, saltBuf, SCRYPT_KEYLEN)
  return `scrypt$${saltBuf.toString('hex')}$${hash.toString('hex')}`
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const [, saltHex, hashHex] = parts
  let expected
  try {
    expected = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (expected.length !== SCRYPT_KEYLEN) return false

  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN)
  return crypto.timingSafeEqual(actual, expected)
}

function isConfigured() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH)
}

function pruneExpired(now = Date.now()) {
  for (const [token, session] of sessions) {
    if (now - session.last_used_at > SESSION_TTL_MS) sessions.delete(token)
  }
}

function attemptKey(username, ip) {
  return `${username || ''}|${ip || ''}`
}

function isRateLimited(username, ip, now = Date.now()) {
  const record = failedAttempts.get(attemptKey(username, ip))
  if (!record) return false
  if (now - record.first_at > ATTEMPT_WINDOW_MS) {
    failedAttempts.delete(attemptKey(username, ip))
    return false
  }
  return record.count >= MAX_ATTEMPTS
}

function recordFailure(username, ip, now = Date.now()) {
  const key    = attemptKey(username, ip)
  const record = failedAttempts.get(key)
  if (!record || now - record.first_at > ATTEMPT_WINDOW_MS) {
    failedAttempts.set(key, { count: 1, first_at: now })
  } else {
    record.count += 1
  }
}

module.exports = {
  hashPassword,
  isConfigured,
  SESSION_HOURS,

  /**
   * คืน { ok: true, token, expires_at } หรือ { ok: false, reason }
   * reason ใช้เลือก HTTP status เท่านั้น — ข้อความที่ส่งกลับหา client
   * ต้องไม่บอกว่าผิดที่ username หรือ password (SEC-09)
   */
  login: ({ username, password, ip }) => {
    if (!isConfigured()) return { ok: false, reason: 'not_configured' }
    if (!username || !password) return { ok: false, reason: 'invalid_credentials' }

    const now = Date.now()
    if (isRateLimited(username, ip, now)) return { ok: false, reason: 'rate_limited' }

    const userOk = username === process.env.ADMIN_USERNAME
    const passOk = verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)

    // ตรวจทั้งสองอย่างเสมอ ไม่ตัดออกก่อน เพื่อไม่ให้เวลาตอบต่างกันจนเดา username ได้
    if (!userOk || !passOk) {
      recordFailure(username, ip, now)
      return { ok: false, reason: 'invalid_credentials' }
    }

    failedAttempts.delete(attemptKey(username, ip))
    pruneExpired(now)

    const token = crypto.randomBytes(32).toString('hex')
    sessions.set(token, { username, created_at: now, last_used_at: now })

    return {
      ok: true,
      token,
      expires_at: new Date(now + SESSION_TTL_MS).toISOString()
    }
  },

  // คืน session ถ้า token ยังใช้ได้ (พร้อมเลื่อนเวลาหมดอายุออกไป) — ไม่ได้ก็คืน null
  verify: (token) => {
    if (!token) return null
    const session = sessions.get(token)
    if (!session) return null

    const now = Date.now()
    if (now - session.last_used_at > SESSION_TTL_MS) {
      sessions.delete(token)
      return null
    }

    session.last_used_at = now
    return { username: session.username, created_at: session.created_at }
  },

  logout: (token) => (token ? sessions.delete(token) : false),

  activeSessions: () => {
    pruneExpired()
    return sessions.size
  },

  // ใช้ในเทสต์เท่านั้น
  _reset: () => {
    sessions.clear()
    failedAttempts.clear()
  }
}
