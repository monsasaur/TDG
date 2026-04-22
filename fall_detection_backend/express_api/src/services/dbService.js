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
const mockStore = new Map()  // fallback เมื่อไม่มี Supabase

function getClient() {
  if (!supabase && createClient &&
      process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  }
  return supabase
}

module.exports = {
  saveEvent: async (event) => {
    const client = getClient()

    if (!client) {
      const id = `mock-${Date.now()}`
      const record = { id, ...event, created_at: new Date().toISOString() }
      mockStore.set(id, record)
      console.log('📝 [DB mock] saveEvent:', id, event.is_fall ? 'FALL' : 'normal')
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
      console.log(`📝 [DB mock] ack event ${event_id} by ${acknowledged_by}`)
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
      console.log(`📝 [DB mock] escalate event ${event_id}`)
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
  }
}
