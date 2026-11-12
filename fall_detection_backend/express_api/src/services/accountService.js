/**
 * accountService.js
 * ผูกคำขอจากแอปกับบัญชีผู้ใช้ (Supabase Auth) — ใช้คู่กับ x-api-key ไม่ได้แทน
 *
 * แอปส่ง `Authorization: Bearer <access token ของ Supabase>` มาด้วยเมื่อ login อยู่
 * x-api-key บอกแค่ว่า "เป็นแอปของเรา" (คีย์ฝังใน APK ใครแกะก็ได้)
 * token บอกว่า "เป็นใคร" — ใช้ตัดสินว่ากดรับทราบเหตุการณ์ของบ้านนี้ได้ไหม
 *
 * ก่อนรัน accounts.sql (dbService.accountsEnabled() = false) ทุกอย่างทำงานแบบเดิม
 * ทดสอบสดและแอปที่ยังไม่ login จึงไม่พัง
 */

const dbService = require('./dbService')

const DEFAULT_ACK_BY = 'ผู้ดูแล'   // ตรงกับค่าเริ่มต้นใน appAlertService และ AlertsContext ของแอป

/** "Bearer xxx" → "xxx" · ไม่มี / ผิดรูป → null */
function bearerFrom(header) {
  if (typeof header !== 'string') return null
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return m ? m[1] : null
}

/** "66812345678" / "+66812345678" → "081-234-5678" (Supabase เก็บเบอร์แบบไม่มี +) */
function formatThaiPhone(phone) {
  if (!phone) return ''
  const d = String(phone).replace(/\D/g, '')
  const local = d.startsWith('66') ? `0${d.slice(2)}` : d
  return local.length === 10 ? `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}` : local
}

/** ชื่อที่แสดง — เหมือน AuthContext.displayName ของแอป */
function displayName(user) {
  const name = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : ''
  return name || formatThaiPhone(user?.phone) || DEFAULT_ACK_BY
}

/**
 * หาว่าใครเป็นคนเรียก
 * @returns {{ user: object|null, status: 'none'|'ok'|'invalid'|'unverifiable' }}
 *   none          ไม่ได้ส่ง token มา
 *   invalid       ส่งมาแต่ใช้ไม่ได้ (หมดอายุ / ปลอม)
 *   unverifiable  ไม่มีฐานข้อมูลให้ตรวจ (mock) — ทำเหมือนไม่ได้ส่งมา
 */
async function resolveUser(authHeader) {
  const jwt = bearerFrom(authHeader)
  if (!jwt) return { user: null, status: 'none' }
  const user = await dbService.getUserFromToken(jwt)
  if (user === undefined) return { user: null, status: 'unverifiable' }
  if (!user) return { user: null, status: 'invalid' }
  return { user, status: 'ok' }
}

/**
 * ใครกดรับทราบเหตุการณ์นี้ได้บ้าง
 *
 * ยังไม่เปิดระบบบัญชี → ได้ทุกคนที่มี x-api-key แบบเดิม (ส่ง token มาก็ใช้ชื่อจากบัญชี)
 * เปิดแล้ว → ต้อง login และเป็นสมาชิกของบ้านที่อุปกรณ์ติดตั้งอยู่
 *   ไม่งั้นใครมีคีย์ของแอปก็ดึงรายการเหตุการณ์แล้วกดรับทราบแทนบ้านอื่น = ยกเลิกการโทรฉุกเฉินของคนอื่นได้
 * ชื่อ "รับทราบโดย" มาจากบัญชีที่ตรวจแล้ว ไม่เชื่อชื่อที่แอปส่งมา
 *
 * @returns {{ ok: true, acknowledged_by?: string } | { ok: false, status: number, error: string }}
 */
async function authorizeAck(event, authHeader, claimedName) {
  const who = await resolveUser(authHeader)
  if (who.status === 'invalid') {
    return { ok: false, status: 401, error: 'login token is invalid or expired' }
  }

  if (!(await dbService.accountsEnabled())) {
    return { ok: true, acknowledged_by: who.user ? displayName(who.user) : claimedName || undefined }
  }

  if (!who.user) return { ok: false, status: 401, error: 'login required' }

  const ctx = await dbService.getDeviceContext(event.device_id)
  if (!ctx?.house_id || !(await dbService.isHouseMember(ctx.house_id, who.user.id))) {
    return { ok: false, status: 403, error: 'not a member of the house this device belongs to' }
  }
  return { ok: true, acknowledged_by: displayName(who.user) }
}

module.exports = { bearerFrom, formatThaiPhone, displayName, resolveUser, authorizeAck, DEFAULT_ACK_BY }
