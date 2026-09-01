/**
 * escalationService.js
 * จัดการ timer สำหรับ Binary + Acknowledge flow
 *
 * Flow:
 *   1. Fall detected → schedule(event) → รอ ack
 *   2. caregiver กด ack ในแอป → cancel(event_id) → จบ
 *   3. หมดเวลา → ยิง Twilio SMS + Call + mark DB
 *
 * ── การกู้คืนหลัง server restart ──────────────────────────────────────────
 * setTimeout อยู่ใน memory — restart แล้วหาย เหตุการณ์ที่กำลังรอ ack อยู่จะค้าง
 * สถานะ pending ตลอดกาล ไม่มีวันถูกโทรออกและไม่มีวันถูกนับใน escalation rate
 *
 * แก้โดย "ไม่เก็บ timer" แต่สร้างใหม่จาก DB แทน — ข้อมูลที่ต้องใช้มีครบอยู่แล้ว:
 *   เหตุการณ์ถึงกำหนด escalate เมื่อ  created_at + ACK_TIMEOUT_SECONDS
 *   เหตุการณ์ยังรออยู่เมื่อ           !acknowledged && !escalated
 *
 * จึงไม่ต้องเพิ่ม Redis/BullMQ ให้ระบบมีของต้องดูแลเพิ่ม:
 *   - ตอน boot   → recoverPending() ตั้ง timer ใหม่ / escalate ตัวที่เลยกำหนดไปแล้ว
 *   - ทุก N วินาที → sweeper เรียกซ้ำเป็นตาข่ายรองรับ เผื่อ timer หายระหว่างทาง
 */

const alertService = require('./alertService')
const dbService    = require('./dbService')
const demoLog      = require('../utils/demoLog')

const ACK_TIMEOUT_SECONDS = Number(process.env.ACK_TIMEOUT_SECONDS || 60)
const COOLDOWN_SECONDS    = Number(process.env.COOLDOWN_SECONDS    || 300)

// ตาข่ายรองรับ — เรียก recoverPending ซ้ำทุกกี่วินาที
const SWEEP_SECONDS = Number(process.env.ESCALATION_SWEEP_SECONDS || 60)

// ย้อนไปหาเหตุการณ์ที่ค้างอยู่ไกลแค่ไหนตอน boot
const RECOVERY_LOOKBACK_HOURS = Number(process.env.ESCALATION_RECOVERY_LOOKBACK_HOURS || 24)

// เลยกำหนดมานานเกินนี้แล้ว = สายไปแล้ว ไม่โทร
// โทรหาผู้ดูแลเรื่องการล้มเมื่อ 5 ชั่วโมงที่แล้วไม่ได้ช่วยใคร แต่ก็ปล่อยค้าง pending ไม่ได้
// จึงบันทึกว่า escalate แล้วโดยไม่ได้ส่งอะไร (sms_sent/call_made = false) ให้เห็นชัดว่าหลุด
const MAX_ESCALATION_AGE_SECONDS = Number(process.env.ESCALATION_MAX_AGE_SECONDS || 3600)

// event_id → timeout handle
const pendingTimers = new Map()

// device_id → timestamp ของ alert ล่าสุด (กัน spam)
const deviceCooldown = new Map()

let sweepTimer   = null
let sweeping     = false

function inCooldown(device_id) {
  const last = deviceCooldown.get(device_id)
  if (!last) return false
  const elapsed = (Date.now() - last) / 1000
  return elapsed < COOLDOWN_SECONDS
}

// at = เวลาที่เกิดเหตุการณ์ ไม่ใช่เวลาที่บันทึก — ตอนกู้คืนต้องนับจากของเดิม
// ไม่งั้นเหตุการณ์เก่าที่เพิ่งกู้มาจะไปบล็อก alert ใหม่ของอุปกรณ์นั้น
function markCooldown(device_id, at = Date.now()) {
  const prev = deviceCooldown.get(device_id)
  if (!prev || at > prev) deviceCooldown.set(device_id, at)
}

function eventTimeMs(event) {
  const parsed = Date.parse(event.created_at)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

async function escalate(event) {
  const { id: event_id, device_id, location, confidence } = event

  // เช็คสถานะล่าสุดก่อนยิงจริง — กันโทรซ้ำเมื่อ timer กับ sweeper คว้า event เดียวกัน
  // หรือ ack เพิ่งเข้ามาพอดี
  //
  // อ่าน DB ไม่ได้ → ยิงต่อ ไม่บล็อก นี่คือ path ฉุกเฉิน โทรซ้ำยังดีกว่าไม่มีใครได้รับสาย
  try {
    const fresh = await dbService.getEvent(event_id)
    if (fresh && (fresh.acknowledged || fresh.escalated)) {
      console.log(`⏭  [ESCALATE] skip ${event_id} — already ${fresh.escalated ? 'escalated' : 'acknowledged'}`)
      pendingTimers.delete(event_id)
      return
    }
  } catch (err) {
    console.error(`⚠️  [ESCALATE] state check failed for ${event_id}, escalating anyway:`, err.message)
  }

  if (demoLog.ENABLED) {
    demoLog.banner('☎️  ESCALATING — NO ACK RECEIVED', [
      `event       : ${event_id}`,
      `device      : ${device_id}`,
      `triggering  : Twilio Voice Call`,
    ], 'yellow')
  } else {
    console.log(`🚨 [ESCALATE] event=${event_id} device=${device_id}`)
  }

  try {
    const [smsRes, callRes] = await Promise.all([
      alertService.sendSms({ device_id, location, confidence, event_id })
        .then(v => ({ status: 'fulfilled', value: v }))
        .catch(reason => ({ status: 'rejected', reason })),
      alertService.makeCall({ location, event_id })
        .then(v => ({ status: 'fulfilled', value: v }))
        .catch(reason => ({ status: 'rejected', reason })),
    ])

    const smsOk = smsRes.status === 'fulfilled' &&
                  !smsRes.value?.skipped &&
                  (smsRes.value?.failed ?? 0) === 0

    const callOk = callRes.status === 'fulfilled' &&
                   !callRes.value?.skipped &&
                   (callRes.value?.failed ?? 0) === 0

    if (demoLog.ENABLED) {
      const sent = smsRes.value?.sent ?? 0
      const smsTotal = sent + (smsRes.value?.failed ?? 0)
      demoLog.success(`SMS → ${smsOk ? `sent ${sent}/${smsTotal}` : 'failed'}`)

      const made = callRes.value?.made ?? 0
      const total = made + (callRes.value?.failed ?? 0)
      demoLog.success(`Call → ${callOk ? `placed ${made}/${total}` : 'failed'}`)
    }

    await dbService.markEscalated(event_id, { sms_sent: smsOk, call_made: callOk })
  } catch (err) {
    console.error(`❌ Escalation failed for ${event_id}:`, err.message)
  } finally {
    pendingTimers.delete(event_id)
  }
}

// เหตุการณ์ที่หลุดไปนานเกินกว่าจะโทรได้แล้ว — ปิดสถานะไว้ ไม่ปล่อยค้าง pending
async function markDropped(event) {
  const ageMinutes = Math.round((Date.now() - eventTimeMs(event)) / 60000)
  console.warn(
    `⚠️  [ESCALATE] event=${event.id} หลุดไป ${ageMinutes} นาที — เกิน ` +
    `ESCALATION_MAX_AGE_SECONDS (${MAX_ESCALATION_AGE_SECONDS}s) ไม่โทรออก ` +
    `บันทึกเป็น escalated ที่ไม่ได้ส่งอะไร`
  )
  try {
    await dbService.markEscalated(event.id, { sms_sent: false, call_made: false })
  } catch (err) {
    console.error(`❌ markDropped failed for ${event.id}:`, err.message)
  }
}

// ตั้ง timer ให้ event หนึ่งรายการ — delayMs ไม่ระบุ = นับเต็ม ACK_TIMEOUT_SECONDS จากตอนนี้
function schedule(event, { delayMs, cooldownAt } = {}) {
  const { id: event_id, device_id } = event

  if (pendingTimers.has(event_id)) {
    console.log(`⏭  [ESCALATE] already scheduled for ${event_id}`)
    return
  }

  markCooldown(device_id, cooldownAt)

  const delay  = Number.isFinite(delayMs) ? Math.max(delayMs, 0) : ACK_TIMEOUT_SECONDS * 1000
  const handle = setTimeout(() => escalate(event), delay)

  // timer ตัวนี้ต้องไม่ทำให้ process ค้างตอนปิดตัว
  if (typeof handle.unref === 'function') handle.unref()

  pendingTimers.set(event_id, handle)
  if (process.env.DEMO_LOG !== 'true') {
    console.log(`⏱  [ESCALATE] scheduled event=${event_id} timeout=${Math.round(delay / 1000)}s`)
  }
}

/**
 * สร้าง timer ใหม่จากสถานะใน DB
 * เรียกตอน boot และเรียกซ้ำเป็นระยะโดย sweeper
 *
 * คืนสรุปว่าทำอะไรไปบ้าง ไว้ให้เทสต์และ log ตรวจได้
 */
async function recoverPending() {
  if (sweeping) return { skipped: true }
  sweeping = true

  const summary = { rescheduled: 0, escalated: 0, dropped: 0, scanned: 0 }

  try {
    const from = new Date(Date.now() - RECOVERY_LOOKBACK_HOURS * 3600_000).toISOString()
    const { events } = await dbService.queryEvents({ status: 'pending', from, limit: 500 })

    const now = Date.now()

    for (const event of (events || [])) {
      if (!event.is_fall) continue          // เก็บเฉพาะเหตุการณ์ล้ม
      if (pendingTimers.has(event.id)) continue   // มี timer อยู่แล้วในรอบนี้

      summary.scanned += 1

      const createdMs = eventTimeMs(event)
      const remaining = createdMs + ACK_TIMEOUT_SECONDS * 1000 - now

      if (remaining > 0) {
        // ยังไม่ถึงกำหนด — ตั้ง timer ใหม่ด้วยเวลาที่เหลือจริง ไม่ใช่เริ่มนับใหม่
        schedule(event, { delayMs: remaining, cooldownAt: createdMs })
        summary.rescheduled += 1
        continue
      }

      const ageSeconds = (now - createdMs) / 1000
      if (ageSeconds > MAX_ESCALATION_AGE_SECONDS) {
        await markDropped(event)
        summary.dropped += 1
      } else {
        markCooldown(event.device_id, createdMs)
        await escalate(event)
        summary.escalated += 1
      }
    }

    if (summary.scanned > 0) {
      console.log(
        `🔁 [ESCALATE] recover: reschedule ${summary.rescheduled} · ` +
        `escalate ${summary.escalated} · dropped ${summary.dropped}`
      )
    }
  } catch (err) {
    console.error('❌ recoverPending failed:', err.message)
  } finally {
    sweeping = false
  }

  return summary
}

module.exports = {
  ACK_TIMEOUT_SECONDS,
  COOLDOWN_SECONDS,
  SWEEP_SECONDS,
  MAX_ESCALATION_AGE_SECONDS,

  inCooldown,
  schedule,
  recoverPending,

  // ยกเลิก escalation (caregiver กดรับทราบทัน)
  cancel: (event_id) => {
    const handle = pendingTimers.get(event_id)
    if (!handle) return false

    clearTimeout(handle)
    pendingTimers.delete(event_id)
    if (process.env.DEMO_LOG !== 'true') {
      console.log(`✅ [ESCALATE] cancelled event=${event_id}`)
    } else {
      demoLog.success(`Caregiver acknowledged event=${event_id} → escalation cancelled`)
    }
    return true
  },

  isPending: (event_id) => pendingTimers.has(event_id),

  pendingCount: () => pendingTimers.size,

  // เรียกครั้งเดียวตอน server เริ่มทำงาน
  startSweeper: () => {
    if (sweepTimer) return sweepTimer
    sweepTimer = setInterval(() => { recoverPending() }, SWEEP_SECONDS * 1000)
    if (typeof sweepTimer.unref === 'function') sweepTimer.unref()
    return sweepTimer
  },

  stopSweeper: () => {
    if (!sweepTimer) return false
    clearInterval(sweepTimer)
    sweepTimer = null
    return true
  }
}
