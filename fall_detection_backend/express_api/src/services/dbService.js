/**
 * dbService.js
 * บันทึก event ลง Supabase
 * ถ้ายังไม่ config → log แทน
 */

const { createClient } = (() => {
  try { return require('@supabase/supabase-js') }
  catch { return { createClient: null } }
})()

let supabase = null

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
      console.log('📝 [DB mock] saveEvent:', JSON.stringify(event))
      return { id: `mock-${Date.now()}`, ...event }
    }

    const { data, error } = await client
      .from('fall_events')
      .insert([event])
      .select()
      .single()

    if (error) throw new Error(`DB error: ${error.message}`)
    return data
  },

  getEvents: async ({ device_id, limit = 50 } = {}) => {
    const client = getClient()
    if (!client) return []

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
    if (!client) return []

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
