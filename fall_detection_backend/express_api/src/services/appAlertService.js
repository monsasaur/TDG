/**
 * appAlertService.js
 * แปลง fall_events ให้เป็นแถวใน `alerts` ที่แอปมือถือแสดงได้ทันที
 *
 * ปัญหาที่แก้
 * -----------
 * `alerts` (แอป) กับ `fall_events` (CSI pipeline) เดิมไม่รู้จักกันเลย
 * แอปจึงแสดง seed data ล้วน ส่วนการล้มจริงเห็นได้ทางเดียวคือ poll API มา merge
 * ประวัติการแจ้งเตือนในแอปเลยเป็นของปลอม
 *
 * ตอนนี้ทุกครั้งที่ตรวจพบการล้ม ระบบเขียนแถวใน `alerts` ให้ด้วย
 * โดยหา house จากอุปกรณ์: fall_events.device_id → devices.code → devices.house_id
 *
 * ทุกฟังก์ชันในไฟล์นี้ **ห้าม throw** — งานนี้เป็นแค่การแสดงผลในแอป
 * ถ้าเขียนไม่สำเร็จ ระบบตรวจจับและแจ้งเตือนต้องทำงานต่อได้ตามปกติ
 */

const crypto    = require('crypto')
const dbService = require('./dbService')

// สถานะที่แอปเข้าใจ (types/alert.ts)
//   active      — รอผู้ดูแลกดรับทราบ
//   completed   — มีคนกดรับทราบในแอปแล้ว
//   in_progress — หมดเวลารอ ระบบโทรออกไปแล้ว แต่ยังไม่รู้ผลปลายสาย
//
// ไม่ตั้ง 'no_response' เพราะจะรู้ว่า "ไม่มีใครรับสาย" จริง ๆ ต้องมี
// Twilio status callback ก่อน — เดาเอาแล้วบอกผู้ใช้ว่าไม่มีใครรับ ทั้งที่อาจมีคนรับ
// เป็นการโกหกในเรื่องที่คนใช้ตัดสินใจต่อจากมัน

const STEP_DETECTED = 'ตรวจพบการล้ม'
const STEP_APP      = 'แจ้งเตือนผู้ดูแลในแอป'
const STEP_CALL     = 'โทรหาเบอร์ติดต่อฉุกเฉิน'

function describe({ house_name, location }) {
  const place = [house_name, location].filter(Boolean).join(' บริเวณ ')
  return `ตรวจพบการล้มที่ ${place || 'ไม่ระบุตำแหน่ง'} กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว`
}

function initialTimeline(confidence) {
  const pct = Number.isFinite(confidence) ? `ความมั่นใจ ${Math.round(confidence * 100)}%` : ''
  return [
    { label: STEP_DETECTED, detail: pct, status: 'error' },
    { label: STEP_APP,      detail: '',  status: 'pending' },
    { label: STEP_CALL,     detail: '',  status: 'pending' },
  ]
}

/** แก้ step เดียวใน timeline โดยไม่แตะ step อื่น */
function patchStep(timeline, label, detail, status) {
  const steps = Array.isArray(timeline) ? timeline : []
  return steps.map(s => (s.label === label ? { ...s, detail, status } : s))
}

/** timeline ที่เก็บใน Supabase เป็น JSON — mock mode เก็บเป็น array ตรง ๆ */
function readTimeline(alert) {
  if (!alert?.timeline) return []
  if (typeof alert.timeline === 'string') {
    try { return JSON.parse(alert.timeline) } catch { return [] }
  }
  return alert.timeline
}

module.exports = {
  /**
   * สร้าง alert ให้แอปแสดง ตอนตรวจพบการล้ม
   * @returns alert ที่สร้าง หรือ null ถ้าสร้างไม่ได้ (ไม่ throw)
   */
  createFromEvent: async (event, ack_timeout_seconds) => {
    try {
      const ctx = await dbService.getDeviceContext(event.device_id)

      // อุปกรณ์ยังไม่ได้ผูกกับบ้าน → สร้าง alert ไม่ได้เพราะ house_id เป็น FK บังคับ
      // เหตุการณ์ยังถูกบันทึกใน fall_events และแจ้งเตือนตามปกติ แค่ไม่โผล่ในแอป
      if (!ctx?.house_id) {
        console.warn(
          `⚠️  [ALERT] device="${event.device_id}" ยังไม่ได้ผูกกับบ้าน — ` +
          `ข้ามการสร้าง alert ในแอป (event ${event.id} ยังบันทึกปกติ)`
        )
        return null
      }

      const alert = {
        id:            crypto.randomUUID(),
        fall_event_id: event.id,
        house_id:      ctx.house_id,
        title:         'Emergency',
        description:   describe({ house_name: ctx.house_name, location: event.location }),
        location:      [ctx.house_name, event.location].filter(Boolean).join(' - '),
        status:        'active',
        answered_by:   null,
        countdown:     ack_timeout_seconds,
        timeline:      initialTimeline(event.confidence),
        created_at:    event.created_at || new Date().toISOString(),
      }

      return await dbService.createAlert(alert)
    } catch (err) {
      console.error(`❌ [ALERT] สร้าง alert สำหรับ event ${event?.id} ไม่สำเร็จ:`, err.message)
      return null
    }
  },

  /** ผู้ดูแลกดรับทราบในแอป */
  markAcknowledged: async (event_id, acknowledged_by) => {
    try {
      const existing = await dbService.getAlertByEvent(event_id)
      if (!existing) return null

      const who = acknowledged_by || 'ผู้ดูแล'
      return await dbService.updateAlertByEvent(event_id, {
        status:      'completed',
        answered_by: who,
        countdown:   null,
        timeline: patchStep(readTimeline(existing), STEP_APP, `รับทราบโดย : ${who}`, 'success'),
      })
    } catch (err) {
      console.error(`❌ [ALERT] อัปเดต ack ของ ${event_id} ไม่สำเร็จ:`, err.message)
      return null
    }
  },

  /** หมดเวลารอ ระบบโทรออกแล้ว */
  markEscalated: async (event_id, { sms_sent, call_made, ack_timeout_seconds } = {}) => {
    try {
      const existing = await dbService.getAlertByEvent(event_id)
      if (!existing) return null

      let timeline = readTimeline(existing)
      timeline = patchStep(
        timeline, STEP_APP,
        `ไม่มีการตอบรับภายใน ${ack_timeout_seconds ?? '-'} วินาที`, 'error'
      )

      const sent = [call_made && 'โทรออก', sms_sent && 'ส่ง SMS'].filter(Boolean).join(' และ ')
      timeline = patchStep(
        timeline, STEP_CALL,
        sent ? `${sent} แล้ว รอการตอบรับ` : 'ติดต่อไม่สำเร็จ',
        (call_made || sms_sent) ? 'pending' : 'error'
      )

      return await dbService.updateAlertByEvent(event_id, {
        status:    'in_progress',
        countdown: null,
        timeline,
      })
    } catch (err) {
      console.error(`❌ [ALERT] อัปเดต escalate ของ ${event_id} ไม่สำเร็จ:`, err.message)
      return null
    }
  },
}
