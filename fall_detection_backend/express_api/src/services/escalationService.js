/**
 * escalationService.js
 * จัดการ timer สำหรับ Binary + Acknowledge flow
 *
 * Flow:
 *   1. Fall detected → schedule(event) → รอ ack
 *   2. caregiver กด ack ในแอป → cancel(event_id) → จบ
 *   3. หมดเวลา → ยิง Twilio SMS + Call + mark DB
 *
 * Note: เก็บ timer ใน memory — server restart จะหาย
 *       ถ้าต้อง production-grade ให้ใช้ Redis / BullMQ
 */

const alertService = require('./alertService')
const dbService    = require('./dbService')
const demoLog      = require('../utils/demoLog')

const ACK_TIMEOUT_SECONDS = Number(process.env.ACK_TIMEOUT_SECONDS || 60)
const COOLDOWN_SECONDS    = Number(process.env.COOLDOWN_SECONDS    || 300)

// event_id → timeout handle
const pendingTimers = new Map()

// device_id → timestamp ของ alert ล่าสุด (กัน spam)
const deviceCooldown = new Map()

function inCooldown(device_id) {
  const last = deviceCooldown.get(device_id)
  if (!last) return false
  const elapsed = (Date.now() - last) / 1000
  return elapsed < COOLDOWN_SECONDS
}

function markCooldown(device_id) {
  deviceCooldown.set(device_id, Date.now())
}

async function escalate(event) {
  const { id: event_id, device_id, location, confidence } = event

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

module.exports = {
  ACK_TIMEOUT_SECONDS,
  COOLDOWN_SECONDS,

  inCooldown,

  // เริ่มจับเวลา ack สำหรับ event นี้
  schedule: (event) => {
    const { id: event_id, device_id } = event

    if (pendingTimers.has(event_id)) {
      console.log(`⏭  [ESCALATE] already scheduled for ${event_id}`)
      return
    }

    markCooldown(device_id)

    const handle = setTimeout(
      () => escalate(event),
      ACK_TIMEOUT_SECONDS * 1000
    )

    pendingTimers.set(event_id, handle)
    if (process.env.DEMO_LOG !== 'true') {
      console.log(`⏱  [ESCALATE] scheduled event=${event_id} timeout=${ACK_TIMEOUT_SECONDS}s`)
    }
  },

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

  pendingCount: () => pendingTimers.size
}
