/**
 * dbService.js
 * บันทึก/อัพเดต event ลง Supabase
 * ถ้ายังไม่ config → log แทน (in-memory fallback)
 */

const { createClient } = (() => {
  try { return require('@supabase/supabase-js') }
  catch { return { createClient: null } }
})()

let supabase = null
const mockStore = new Map()        // fallback เมื่อไม่มี Supabase (fall_events + push_tokens)
const mockDevices = new Map()      // fallback ของตาราง devices
const mockAlerts = new Map()      // fallback ของตาราง alerts
let mockSeq = 0                    // กัน id ชนกันเมื่อบันทึกหลาย event ในมิลลิวินาทีเดียวกัน

function getClient() {
  if (!supabase && createClient &&
      process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  }
  return supabase
}

// ตรงกับสถานะที่หน้า admin ใช้ filter
function matchStatus(event, status) {
  switch (status) {
    case 'pending':      return !event.acknowledged && !event.escalated
    case 'acknowledged': return Boolean(event.acknowledged)
    case 'escalated':    return Boolean(event.escalated)
    case 'fall':         return Boolean(event.is_fall)
    default:             return true
  }
}

module.exports = {
  saveEvent: async (event) => {
    const client = getClient()

    if (!client) {
      const id = `mock-${Date.now()}-${++mockSeq}`
      const record = { id, ...event, created_at: new Date().toISOString() }
      mockStore.set(id, record)
      if (process.env.DEMO_LOG !== 'true') {
        console.log('📝 [DB mock] saveEvent:', id, event.is_fall ? 'FALL' : 'normal')
      }
      return record
    }

    const { data, error } = await client
      .from('fall_events')
      .insert([event])
      .select()
      .single()

    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  getEvent: async (event_id) => {
    const client = getClient()
    if (!client) return mockStore.get(event_id) || null

    const { data, error } = await client
      .from('fall_events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (error) return null
    return data
  },

  // ผู้ดูแลกดรับทราบในแอป
  acknowledgeEvent: async (event_id, acknowledged_by) => {
    const client = getClient()
    const patch = {
      acknowledged:    true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: acknowledged_by || null
    }

    if (!client) {
      const prev = mockStore.get(event_id)
      if (!prev) return null
      const updated = { ...prev, ...patch }
      mockStore.set(event_id, updated)
      if (process.env.DEMO_LOG !== 'true') {
        console.log(`📝 [DB mock] ack event ${event_id} by ${acknowledged_by}`)
      }
      return updated
    }

    const { data, error } = await client
      .from('fall_events')
      .update(patch)
      .eq('id', event_id)
      .select()
      .single()

    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  // ระบบ escalate (หมดเวลา ack)
  markEscalated: async (event_id, { sms_sent, call_made }) => {
    const client = getClient()
    const patch = {
      escalated:    true,
      escalated_at: new Date().toISOString(),
      sms_sent:     Boolean(sms_sent),
      call_made:    Boolean(call_made)
    }

    if (!client) {
      const prev = mockStore.get(event_id)
      if (!prev) return null
      const updated = { ...prev, ...patch }
      mockStore.set(event_id, updated)
      if (process.env.DEMO_LOG !== 'true') {
        console.log(`📝 [DB mock] escalate event ${event_id}`)
      }
      return updated
    }

    const { data, error } = await client
      .from('fall_events')
      .update(patch)
      .eq('id', event_id)
      .select()
      .single()

    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  getEvents: async ({ device_id, limit = 50 } = {}) => {
    const client = getClient()
    if (!client) return Array.from(mockStore.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)

    let query = client
      .from('fall_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (device_id) query = query.eq('device_id', device_id)

    const { data, error } = await query
    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  // ----- Expo push tokens -----
  registerPushToken: async ({ token, device_id, platform }) => {
    const client = getClient()
    const now = new Date().toISOString()

    if (!client) {
      mockStore.set(`push:${token}`, { token, device_id, platform, updated_at: now })
      console.log(`📝 [DB mock] registerPushToken token=${token.slice(0, 24)}... device=${device_id}`)
      return { token, device_id, platform }
    }

    const { data, error } = await client
      .from('push_tokens')
      .upsert(
        [{ token, device_id, platform, updated_at: now }],
        { onConflict: 'token' }
      )
      .select()
      .single()

    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  getAllPushTokens: async () => {
    const client = getClient()
    if (!client) {
      return Array.from(mockStore.entries())
        .filter(([k]) => k.startsWith('push:'))
        .map(([, v]) => v)
    }

    const { data, error } = await client
      .from('push_tokens')
      .select('token, device_id, platform')

    if (error) throw new Error(`DB error: ${error.message}`)
    return data || []
  },

  removePushToken: async (token) => {
    const client = getClient()
    if (!client) {
      mockStore.delete(`push:${token}`)
      return
    }
    await client.from('push_tokens').delete().eq('token', token)
  },

  getFallEvents: async ({ device_id, limit = 50 } = {}) => {
    const client = getClient()
    if (!client) return Array.from(mockStore.values())
      .filter(e => e.is_fall)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)

    let query = client
      .from('fall_events')
      .select('*')
      .eq('is_fall', true)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (device_id) query = query.eq('device_id', device_id)

    const { data, error } = await query
    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  /**
   * queryEvents — ใช้โดยหน้า admin (ข้ามทุก device)
   * ต่างจาก getEvents ตรงที่ filter สถานะ/ช่วงวันที่ได้ และคืน total ไว้ทำ pagination
   * from/to เทียบกับ created_at (ISO string)
   */
  queryEvents: async ({ device_id, status, from, to, limit = 100, offset = 0 } = {}) => {
    const client = getClient()

    if (!client) {
      // mockStore เก็บทั้ง event และ push token — คัดเฉพาะ event ด้วย timestamp
      let rows = Array.from(mockStore.values())
        .filter(e => typeof e.timestamp === 'number')

      if (device_id) rows = rows.filter(e => e.device_id === device_id)
      if (from)      rows = rows.filter(e => e.created_at >= from)
      if (to)        rows = rows.filter(e => e.created_at <= to)
      rows = rows.filter(e => matchStatus(e, status))
      rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

      return { events: rows.slice(offset, offset + limit), total: rows.length }
    }

    let query = client
      .from('fall_events')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (device_id) query = query.eq('device_id', device_id)
    if (from)      query = query.gte('created_at', from)
    if (to)        query = query.lte('created_at', to)

    if (status === 'pending')      query = query.eq('acknowledged', false).eq('escalated', false)
    if (status === 'acknowledged') query = query.eq('acknowledged', true)
    if (status === 'escalated')    query = query.eq('escalated', true)
    if (status === 'fall')         query = query.eq('is_fall', true)

    const { data, error, count } = await query
    if (error) throw new Error(`DB error: ${error.message}`)
    return { events: data || [], total: count ?? (data || []).length }
  },

  // ----- devices (ตาม TDG_BA.pdf 12.2 จุดที่ 2) -----
  //
  // ใช้ตาราง `devices` ตัวเดียวกับแอปมือถือ โดย fall_events.device_id ↔ devices.code
  // (ตัดสินใจ 2026-09-01 — เหตุผลอยู่ใน supabase/schema.sql)
  //
  // แปลงคอลัมน์ของแอปให้เป็นรูปแบบที่ adminService ใช้:
  //     device_id ← code   ·   label ← name   ·   owner_name ← houses.name

  /**
   * touchDevice — อัปเดต last_seen_at ของอุปกรณ์
   * ต้องเรียกทุกครั้งที่ ESP32 ส่งข้อมูลเข้ามา ไม่ใช่เฉพาะตอนตรวจพบการล้ม
   * (บ้านที่ปลอดภัยจะไม่มีเหตุการณ์ล้มเลยเป็นเดือน — ถ้าอัปเดตเฉพาะตอนล้ม
   *  อุปกรณ์ที่ทำงานดีที่สุดจะถูกแสดงว่า offline ซึ่งกลับหัวกลับหางกับความจริง)
   *
   * ไม่สร้างแถวใหม่ให้อุปกรณ์ที่ไม่รู้จัก — `devices.house_id` เป็น FK บังคับ
   * การแทรกแถวลอย ๆ จะทำให้ข้อมูลฝั่งแอปเสีย อุปกรณ์ต้องถูกลงทะเบียนผ่านแอปก่อน
   */
  touchDevice: async (device_id) => {
    if (!device_id) return null
    const client = getClient()
    const now = new Date().toISOString()

    if (!client) {
      const prev = mockDevices.get(device_id)
      const record = prev
        ? { ...prev, last_seen_at: now }
        : { code: device_id, name: null, house_id: null,
            last_seen_at: now, is_active: true, installed_at: now }
      mockDevices.set(device_id, record)
      return record
    }

    const { data, error } = await client
      .from('devices')
      .update({ last_seen_at: now })
      .eq('code', device_id)
      .select()

    if (error) throw new Error(`DB error: ${error.message}`)

    if (!data || data.length === 0) {
      // อุปกรณ์ส่งข้อมูลเข้ามาแต่ยังไม่ได้ลงทะเบียนในแอป — บันทึก event ต่อได้ตามปกติ
      // แต่จะไม่โผล่ในหน้า Devices จนกว่าจะผูกกับบ้าน
      console.warn(`⚠️  [DEVICE] ไม่รู้จัก code="${device_id}" — ยังไม่ได้ลงทะเบียนผ่านแอป`)
      return null
    }
    return data[0]
  },

  // include_inactive = true → รวมอุปกรณ์ที่ปลดการติดตั้งแล้วด้วย (BR-08)
  listDevices: async ({ include_inactive = false } = {}) => {
    const client = getClient()

    // แปลงแถวของตาราง devices (ฝั่งแอป) → รูปแบบที่ adminService ใช้
    const normalize = (row) => ({
      device_id:    row.code,
      label:        row.name || null,
      owner_name:   row.houses?.name || null,
      location:     null,               // ตาราง devices ของแอปยังไม่มีคอลัมน์นี้
      last_seen_at: row.last_seen_at || null,
      is_active:    row.is_active !== false,
      installed_at: row.installed_at || null
    })

    if (!client) {
      return Array.from(mockDevices.values())
        .filter(d => include_inactive || d.is_active !== false)
        .sort((a, b) => String(a.code).localeCompare(String(b.code)))
        .map(normalize)
    }

    let query = client
      .from('devices')
      .select('code, name, last_seen_at, is_active, installed_at, houses(name)')
      .order('code')
    if (!include_inactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw new Error(`DB error: ${error.message}`)
    return (data || []).map(normalize)
  },

  // ----- alerts (ตารางที่แอปมือถือแสดง) -----
  //
  // แยกจาก fall_events คนละหน้าที่:
  //   fall_events = บันทึกดิบของ CSI pipeline ใช้โดย backend/admin
  //   alerts      = สิ่งที่ผู้ใช้เห็นในแอป มี title/description/timeline พร้อมแสดง
  // ผูกกันด้วย alerts.fall_event_id

  /** หา house จากอุปกรณ์ — fall_events.device_id ↔ devices.code */
  getDeviceContext: async (device_id) => {
    if (!device_id) return null
    const client = getClient()

    if (!client) {
      const d = mockDevices.get(device_id)
      return d ? { house_id: d.house_id || null, house_name: null, device_name: d.name || null } : null
    }

    const { data, error } = await client
      .from('devices')
      .select('house_id, name, houses(name)')
      .eq('code', device_id)
      .maybeSingle()

    if (error || !data) return null
    return {
      house_id:    data.house_id || null,
      house_name:  data.houses?.name || null,
      device_name: data.name || null
    }
  },

  createAlert: async (alert) => {
    const client = getClient()

    if (!client) {
      const record = { ...alert, created_at: alert.created_at || new Date().toISOString() }
      mockAlerts.set(alert.id, record)
      return record
    }

    const { data, error } = await client.from('alerts').insert([alert]).select().single()
    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  /** อัปเดต alert ที่ผูกกับ fall event นี้ — ไม่เจอก็ไม่ใช่ error */
  updateAlertByEvent: async (fall_event_id, patch) => {
    const client = getClient()

    if (!client) {
      for (const [id, a] of mockAlerts) {
        if (a.fall_event_id === fall_event_id) {
          const updated = { ...a, ...patch }
          mockAlerts.set(id, updated)
          return updated
        }
      }
      return null
    }

    const { data, error } = await client
      .from('alerts')
      .update(patch)
      .eq('fall_event_id', fall_event_id)
      .select()

    if (error) throw new Error(`DB error: ${error.message}`)
    return (data && data[0]) || null
  },

  getAlertByEvent: async (fall_event_id) => {
    const client = getClient()
    if (!client) {
      return Array.from(mockAlerts.values())
        .find(a => a.fall_event_id === fall_event_id) || null
    }
    const { data, error } = await client
      .from('alerts').select('*').eq('fall_event_id', fall_event_id).maybeSingle()
    if (error) return null
    return data
  },

  // 'supabase' = ต่อจริง | 'memory' = fallback in-memory (restart แล้วหาย)
  mode: () => (getClient() ? 'supabase' : 'memory')
}
