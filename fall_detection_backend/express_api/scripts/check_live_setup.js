#!/usr/bin/env node
/**
 * เช็คก่อนทดสอบสด — ทุกอย่างที่ต้องพร้อมถึงจะได้
 * "ล้ม → การ์ดขึ้นในแอป → กดรับทราบ → ระบบไม่โทร"
 *
 * อ่านอย่างเดียว ไม่เขียนอะไรลงฐานข้อมูล · ไม่พิมพ์คีย์ออกมา
 *
 *   node scripts/check_live_setup.js               # เช็คบอร์ด ESP-B96AB8
 *   node scripts/check_live_setup.js ESP-0001A     # เช็คเครื่องอื่น
 *
 * ทางแก้แต่ละข้อ: docs/reports/live_test_rf_v2.md หัวข้อ "ให้เหตุการณ์ขึ้นในแอป"
 * exit 0 = ไม่มีข้อที่ต้องแก้ (❌) · exit 1 = มี
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const DEVICE_CODE = process.argv[2] || 'ESP-B96AB8'
const FIX = 'ดู docs/reports/live_test_rf_v2.md หัวข้อ "ให้เหตุการณ์ขึ้นในแอป"'

let failed = 0
const ok   = (msg)      => console.log(`✅ ${msg}`)
const warn = (msg, fix) => console.log(`⚠️  ${msg}${fix ? `\n    → ${fix}` : ''}`)
const fail = (msg, fix) => { failed++; console.log(`❌ ${msg}${fix ? `\n    → ${fix}` : ''}`) }
const info = (msg)      => console.log(`   ${msg}`)

/**
 * role ของคีย์ Supabase (anon / service_role)
 * คีย์แบบใหม่ไม่ใช่ JWT ดูจากคำนำหน้า · คีย์แบบเก่าถอดส่วน payload ของ JWT (ไม่ได้ตรวจลายเซ็น)
 */
function keyRole(key) {
  if (key.startsWith('sb_secret_')) return 'service_role'
  if (key.startsWith('sb_publishable_')) return 'anon'
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))
    return payload.role || null
  } catch {
    return null
  }
}

/** คอลัมน์ที่ยังไม่มีคืน error 42703 · ตารางที่ยังไม่มีคืน 42P01 / PGRST205 */
function missing(error) {
  return error && ['42703', '42P01', 'PGRST205'].includes(error.code)
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) {
    fail('express_api/.env ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_KEY',
         `Express จะเก็บเหตุการณ์ในหน่วยความจำ แอปไม่เห็นอะไรเลย · ${FIX} ข้อ 2`)
    return
  }
  ok('ตั้ง SUPABASE_URL / SUPABASE_KEY แล้ว')

  const role = keyRole(key)
  if (role === 'service_role') ok('SUPABASE_KEY เป็น service_role')
  else warn(`SUPABASE_KEY เป็น ${role || 'คีย์ที่อ่าน role ไม่ได้'} ไม่ใช่ service_role`,
            'ใช้ได้เฉพาะตอนที่ยังไม่รัน accounts.sql · ฝั่งเซิร์ฟเวอร์ควรใช้ service_role')

  const { createClient } = require('@supabase/supabase-js')
  const db = createClient(url, key)

  // รัน accounts.sql แล้วหรือยัง (ดูจากตาราง house_members) — รันแล้ว RLS เปิด คีย์ที่ไม่ใช่ service_role เขียนอะไรไม่ได้
  // ไม่ใช้ head: true — HEAD ไปตารางที่ไม่มี supabase-js คืน error = null (ดู dbService.accountsEnabled)
  const hm = await db.from('house_members').select('user_id').limit(1)
  if (missing(hm.error)) info('ยังไม่ได้รัน accounts.sql — ยังไม่มีระบบบัญชี ทุกคนเห็นทุกบ้าน')
  else if (hm.error) warn(`เช็คตาราง house_members ไม่ได้: ${hm.error.message}`)
  else if (role === 'service_role') ok('รัน accounts.sql แล้ว · Express ใช้ service_role ข้าม RLS ได้')
  else fail('รัน accounts.sql แล้ว (เปิด RLS) แต่ SUPABASE_KEY ไม่ใช่ service_role',
            'Express จะเขียน fall_events / alerts ไม่ได้ · ใช้ service_role key (Supabase → Project Settings → API)')

  const fe = await db.from('fall_events').select('id', { count: 'exact', head: true })
  if (fe.error) {
    fail(`อ่านตาราง fall_events ไม่ได้: ${fe.error.message}`, 'เช็ค SUPABASE_URL / SUPABASE_KEY')
    return
  }
  ok(`ต่อฐานข้อมูลได้ · fall_events มี ${fe.count ?? '?'} แถว`)

  const al = await db.from('alerts').select('id, fall_event_id').limit(1)
  if (missing(al.error)) fail('alerts ยังไม่มีคอลัมน์ fall_event_id — Express สร้างการ์ดในแอปไม่ได้', `${FIX} ข้อ 1 (รัน schema.sql)`)
  else if (al.error) fail(`อ่านตาราง alerts ไม่ได้: ${al.error.message}`)
  else ok('alerts มีคอลัมน์ fall_event_id')

  const adm = await db.from('devices').select('last_seen_at, is_active, installed_at').limit(1)
  if (missing(adm.error)) warn('devices ยังไม่มีคอลัมน์ของหน้า Admin (last_seen_at / is_active / installed_at)',
                               'ไม่กระทบการทดสอบสด แต่หน้า Admin จะพัง · รัน schema.sql')
  else if (!adm.error) ok('devices มีคอลัมน์ของหน้า Admin')

  const dev = await db.from('devices').select('id, name, code, house_id, houses(name)').eq('code', DEVICE_CODE)
  if (dev.error) fail(`ค้น ${DEVICE_CODE} ใน devices ไม่ได้: ${dev.error.message}`)
  else if (!dev.data.length) fail(`ไม่มี ${DEVICE_CODE} ในตาราง devices — เหตุการณ์จะไม่ผูกกับบ้าน การ์ดไม่ขึ้นในแอป`, `${FIX} ข้อ 3`)
  else {
    const d = dev.data[0]
    ok(`${DEVICE_CODE} ลงทะเบียนแล้ว · บ้าน ${d.houses?.name ?? d.house_id} (${d.house_id}) · ชื่อ "${d.name}"`)
  }

  const tok = await db.from('push_tokens').select('token', { count: 'exact', head: true })
  if (tok.error) warn(`อ่าน push_tokens ไม่ได้: ${tok.error.message}`)
  else if (!tok.count) warn('ยังไม่มีมือถือลงทะเบียน push ในฐานข้อมูล', 'เปิดแอปบนมือถือ (dev build) ให้ลงทะเบียน token ก่อน ไม่งั้นมือถือไม่เด้ง')
  else ok(`มีมือถือลงทะเบียน push ${tok.count} เครื่อง`)
}

async function checkMlService() {
  const url = process.env.ML_SERVICE_URL
  if (!url) {
    fail('express_api/.env ยังไม่ได้ตั้ง ML_SERVICE_URL', 'ตั้งเป็น http://localhost:8000')
    return
  }
  let h
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) })
    h = await res.json()
  } catch {
    info(`ML service ที่ ${url} ยังไม่ได้เปิด — เปิดตอนทดสอบ (FALL_MODEL=rf_v2_event)`)
    return
  }
  // ML service ของเราตอบ model_version เสมอ — ไม่มีแปลว่าโปรแกรมอื่นจองพอร์ตนี้อยู่
  // (เจอจริง 2026-11-12: โปรเจกต์อื่นบนเครื่องฟัง :8000 อยู่ uvicorn จะเปิดไม่ขึ้น)
  if (!h || !('model_version' in h)) {
    fail(`มีโปรแกรมอื่นตอบอยู่ที่ ${url} — ไม่ใช่ ML service ของเรา (ตอบ ${JSON.stringify(h).slice(0, 60)})`,
         'ปิดโปรแกรมนั้น (lsof -iTCP:8000 -sTCP:LISTEN ดูว่าตัวไหน) หรือรัน ML service พอร์ตอื่นแล้วแก้ ML_SERVICE_URL')
  } else if (h.model_version === 'rf_v2_event') {
    ok(`ML service ใช้ rf_v2_event (${h.n_features} ค่า · threshold ${h.threshold})`)
  } else {
    warn(`ML service ใช้ ${h.model_version} ไม่ใช่ rf_v2_event`,
         'ทดสอบสดต้องรัน FALL_MODEL=rf_v2_event uvicorn app.main:app --port 8000')
  }
}

function showSettings() {
  const ack = Number(process.env.ACK_TIMEOUT_SECONDS || 60)
  if (ack < 30) {
    warn(`ACK_TIMEOUT_SECONDS = ${ack} — ระบบจะโทรฉุกเฉินหลังตรวจพบแค่ ${ack} วิ กดรับทราบในแอปแทบไม่ทัน`,
         'ทดสอบ/ถ่ายวิดีโอให้ใส่ ACK_TIMEOUT_SECONDS=60 ตอนรัน Express (ค่าบนบรรทัดคำสั่งชนะ .env)')
  }
  console.log('\nค่าที่ Express จะใช้ (เปลี่ยนตอนรันได้ เช่น COOLDOWN_SECONDS=20 TWILIO_MODE=fake npm run dev):')
  info(`ACK_TIMEOUT_SECONDS = ${process.env.ACK_TIMEOUT_SECONDS || '60 (ค่าเริ่มต้น)'}`)
  info(`COOLDOWN_SECONDS    = ${process.env.COOLDOWN_SECONDS || '300 (ค่าเริ่มต้น) — แจ้งผิดครั้งเดียวจะบังการล้มจริงไป 5 นาที'}`)
  info(`TWILIO_MODE         = ${process.env.TWILIO_MODE || 'real (ค่าเริ่มต้น) — โทรจริง'}`)
  info(`PUSH_MODE           = ${process.env.PUSH_MODE || 'real (ค่าเริ่มต้น)'}`)
}

;(async () => {
  console.log(`เช็คความพร้อมทดสอบสด · อุปกรณ์ ${DEVICE_CODE}\n`)
  await checkSupabase()
  await checkMlService()
  showSettings()
  console.log(failed ? `\n❌ ต้องแก้ ${failed} ข้อก่อน การ์ดถึงจะขึ้นในแอป` : '\n✅ พร้อม — การล้มที่ตรวจพบจะขึ้นเป็นการ์ดในแอป')
  process.exit(failed ? 1 : 0)
})()
