/**
 * adminService.js
 * ตรรกะทั้งหมดของหน้า Admin Client
 *
 * หลักการจาก TDG_BA.pdf:
 *   NFR-09 — การคำนวณสถานะและอัตราต่าง ๆ ต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
 *            หน้าเว็บมีหน้าที่แสดงผล ไม่คำนวณอะไรเอง (กันสูตรสองชุดที่ให้ผลไม่ตรงกัน)
 *   NFR-08 — เวลาทุกจุดอิงเวลาไทย ไม่ใช่ UTC
 *   REP-07 — ทุกตัวเลขต้องบอกช่วงเวลาที่ใช้คำนวณ
 *   REP-08 — ไม่มีข้อมูลในช่วงนั้นต้องบอกว่าไม่มี ไม่ใช่แสดง 0
 *   REP-09 — ต้องระบุเวลาที่คำนวณล่าสุด
 */

const dbService = require('./dbService')

// OI-01 ยังไม่ปิด — เกณฑ์ offline จริงต้องดูว่า ESP32 ส่งข้อมูลถี่แค่ไหนในสภาพใช้งานจริง
// ตั้งเป็น env ไว้ก่อนเพื่อให้ปรับได้โดยไม่ต้องแก้โค้ด (BR-02)
const OFFLINE_AFTER_MINUTES = Number(process.env.DEVICE_OFFLINE_AFTER_MINUTES || 15)

// NFR-08 — เวลาไทย UTC+7
const TZ_OFFSET_HOURS = Number(process.env.ADMIN_TZ_OFFSET_HOURS || 7)

// กันดึงทั้งตารางมาคำนวณ (NFR-03) — ถ้าชนเพดานบ่อยแปลว่าต้องย้ายไปรวมยอดด้วย SQL
const MAX_SCAN = Number(process.env.ADMIN_MAX_SCAN || 5000)

const MAX_PAGE_SIZE     = 200
const DEFAULT_PAGE_SIZE = 50

// เที่ยงคืนของ "วันนี้" ตามเวลาไทย คืนเป็น Date ในระบบ UTC
function thaiMidnight(now = new Date()) {
  const shifted = new Date(now.getTime() + TZ_OFFSET_HOURS * 3600_000)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - TZ_OFFSET_HOURS * 3600_000)
}

/**
 * BR-03 / BR-04 — เหตุการณ์หนึ่งรายการมีได้สถานะเดียวเท่านั้น
 * escalated มาก่อน acknowledged เพราะเป็นปลายทางสุดท้ายของ flow
 */
function eventStatus(event) {
  if (event.escalated)    return 'escalated'
  if (event.acknowledged) return 'acknowledged'
  return 'pending'
}

// ผู้ดูแลใช้เวลากี่วินาทีกว่าจะกดรับทราบ — ประโยชน์ที่ได้ฟรีจากการเก็บเป็น timestamp
function ackLatencySeconds(event) {
  if (!event.acknowledged_at || !event.created_at) return null
  const diff = new Date(event.acknowledged_at) - new Date(event.created_at)
  return diff >= 0 ? Math.round(diff / 1000) : null
}

function decorate(event) {
  return {
    ...event,
    status:                eventStatus(event),
    ack_latency_seconds:   ackLatencySeconds(event)
  }
}

function isOnline(last_seen_at, now = Date.now()) {
  if (!last_seen_at) return false
  return (now - new Date(last_seen_at).getTime()) <= OFFLINE_AFTER_MINUTES * 60_000
}

module.exports = {
  OFFLINE_AFTER_MINUTES,
  TZ_OFFSET_HOURS,
  eventStatus,
  thaiMidnight,

  /**
   * GET /api/v1/admin/summary — FR-01 ถึง FR-06, REP-01 ถึง REP-06
   *
   * REP-10: "สัปดาห์นี้" = ย้อนหลัง 7 วันเต็มจากปัจจุบัน ไม่ใช่นับจากวันจันทร์
   *
   * BR-06: เหตุการณ์ที่ถูกกรองด้วย cooldown ไม่ถูกนับเป็น escalated — ข้อนี้ถูกต้องอยู่แล้ว
   *        เพราะ predict.js return ตั้งแต่เจอ cooldown โดยไม่ saveEvent
   *        เหตุการณ์พวกนั้นจึงไม่อยู่ใน DB ไม่ถูกนับทั้งตัวตั้งและตัวหาร
   */
  getSummary: async () => {
    const now         = new Date()
    const weekStart   = new Date(now.getTime() - 7 * 24 * 3600_000)
    const todayStart  = thaiMidnight(now)

    const [{ events: weekEvents }, devices] = await Promise.all([
      dbService.queryEvents({ from: weekStart.toISOString(), limit: MAX_SCAN }),
      dbService.listDevices()   // BR-08 — นับเฉพาะ is_active = true
    ])

    const falls      = weekEvents.filter(e => e.is_fall)
    const fallsToday = falls.filter(e => new Date(e.created_at) >= todayStart)
    const escalated  = falls.filter(e => e.escalated)

    const nowMs  = now.getTime()
    const online = devices.filter(d => isOnline(d.last_seen_at, nowMs))

    return {
      devices: {
        // REP-01/02/03 — online + offline ต้องเท่ากับ total เสมอ (AC-01)
        total:   devices.length,
        online:  online.length,
        offline: devices.length - online.length,
        has_data: devices.length > 0,
        offline_after_minutes: OFFLINE_AFTER_MINUTES
      },
      falls: {
        today: fallsToday.length,       // REP-04
        week:  falls.length,            // REP-05
        // REP-08 — แยก "ไม่มีข้อมูลในช่วงนี้" ออกจาก "มีข้อมูลแต่เป็นศูนย์"
        has_data: falls.length > 0
      },
      escalation: {
        // BR-05 — escalated ÷ เหตุการณ์ล้มทั้งหมดในช่วงเวลาเดียวกัน
        escalated_week: escalated.length,
        falls_week:     falls.length,
        rate: falls.length > 0
          ? Number((escalated.length / falls.length).toFixed(4))
          : null,                        // ไม่มีตัวหาร → ไม่มีอัตรา ไม่ใช่ 0%
        has_data: falls.length > 0
      },
      // REP-07 — บอกช่วงเวลาที่ใช้คำนวณให้ชัด ไม่ปล่อยให้เดา
      window: {
        today_from: todayStart.toISOString(),
        week_from:  weekStart.toISOString(),
        week_definition: 'rolling_7_days',
        timezone: `UTC+${TZ_OFFSET_HOURS}`
      },
      calculated_at: now.toISOString(),  // REP-09
      truncated: weekEvents.length >= MAX_SCAN
    }
  },

  /**
   * GET /api/v1/admin/events — FR-08 ถึง FR-13
   * รับ from, to, device_id, status, limit, offset ใช้พร้อมกันได้ทั้งหมด (FR-12)
   */
  getEvents: async ({ from, to, device_id, status, limit, offset } = {}) => {
    // ค่าที่ส่งมาไม่ถูกต้อง (ติดลบ / ไม่ใช่ตัวเลข) ให้ตกกลับไปใช้ค่าเริ่มต้น
    // ไม่ใช่ปัดขึ้นเป็น 1 ซึ่งจะได้ผลลัพธ์หน้าละแถวเดียวโดยไม่มีใครรู้ตัว
    const parsedLimit  = Math.floor(Number(limit))
    const parsedOffset = Math.floor(Number(offset))

    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE

    const safeOffset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0

    const { events, total } = await dbService.queryEvents({
      from, to, device_id, status,
      limit:  safeLimit,
      offset: safeOffset
    })

    return {
      events: events.map(decorate),
      pagination: {                      // FR-13
        total,
        limit:    safeLimit,
        offset:   safeOffset,
        has_more: safeOffset + events.length < total
      },
      filters:  { from: from || null, to: to || null, device_id: device_id || null, status: status || null },
      has_data: total > 0,               // REP-08
      calculated_at: new Date().toISOString()
    }
  },

  /**
   * GET /api/v1/admin/events/:id — FR-14
   * คืนไทม์ไลน์ของการแจ้งเตือนให้หน้าเว็บแสดงได้เลย ไม่ต้องประกอบเอง (NFR-09)
   */
  getEventDetail: async (event_id) => {
    const event = await dbService.getEvent(event_id)
    if (!event) return null

    const timeline = [
      { step: 'detected', at: event.created_at, detail: { confidence: event.confidence } }
    ]

    if (event.acknowledged) {
      timeline.push({
        step: 'acknowledged',
        at:   event.acknowledged_at,
        detail: {
          by:              event.acknowledged_by,
          latency_seconds: ackLatencySeconds(event)
        }
      })
    }

    if (event.escalated) {
      timeline.push({
        step: 'escalated',
        at:   event.escalated_at,
        detail: { sms_sent: event.sms_sent, call_made: event.call_made }
      })
    }

    return { ...decorate(event), timeline }
  },

  /**
   * GET /api/v1/admin/devices — FR-16 ถึง FR-21
   *
   * FR-21: อ่านจากตาราง devices เป็นหลัก ไม่ใช่ประกอบรายการจาก fall_events
   *        อุปกรณ์ที่พังตั้งแต่ติดตั้งและไม่เคยส่งข้อมูลเลยจึงยังปรากฏในรายการ
   */
  getDevices: async ({ status, include_inactive = false } = {}) => {
    const now = Date.now()

    const [devices, { events }] = await Promise.all([
      dbService.listDevices({ include_inactive }),
      dbService.queryEvents({ limit: MAX_SCAN })
    ])

    // รวมยอดเหตุการณ์ต่ออุปกรณ์ไว้ล่วงหน้า
    const stats = new Map()
    for (const event of events) {
      const s = stats.get(event.device_id) ||
        { total: 0, falls: 0, escalated: 0, last_fall_at: null }
      s.total += 1
      if (event.is_fall) {
        s.falls += 1
        if (!s.last_fall_at || event.created_at > s.last_fall_at) {
          s.last_fall_at = event.created_at
        }
      }
      if (event.escalated) s.escalated += 1
      stats.set(event.device_id, s)
    }

    let rows = devices.map(device => {
      const s = stats.get(device.device_id) ||
        { total: 0, falls: 0, escalated: 0, last_fall_at: null }
      return {
        device_id:    device.device_id,
        label:        device.label,
        owner_name:   device.owner_name,
        location:     device.location,
        last_seen_at: device.last_seen_at,
        is_active:    device.is_active !== false,
        installed_at: device.installed_at,
        // AC-13 — อุปกรณ์ที่ส่งข้อมูลปกติแต่ไม่มีเหตุการณ์ล้มเลย ต้องเป็น online
        status:       isOnline(device.last_seen_at, now) ? 'online' : 'offline',
        events: {
          total:        s.total,
          falls:        s.falls,
          escalated:    s.escalated,
          last_fall_at: s.last_fall_at
        }
      }
    })

    if (status === 'online' || status === 'offline') {   // FR-20
      rows = rows.filter(d => d.status === status)
    }

    return {
      devices: rows,
      offline_after_minutes: OFFLINE_AFTER_MINUTES,
      filters:  { status: status || null, include_inactive },
      has_data: rows.length > 0,
      calculated_at: new Date().toISOString()
    }
  }
}
