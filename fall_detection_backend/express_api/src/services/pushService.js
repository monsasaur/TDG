/**
 * pushService.js
 * ส่ง Expo Push Notification ไปทุก device ที่ลงทะเบียนไว้
 *
 * Modes:
 *   - real (default) → ยิงผ่าน Expo Push API จริง
 *   - fake           → log ออก console แทน (set PUSH_MODE=fake)
 *
 * Expo Push Service ฟรี ไม่ต้อง API key — แค่มี Expo push token ที่ valid
 */

const { Expo } = require('expo-server-sdk')

let expo = null
function getExpo() {
  if (!expo) expo = new Expo({ useFcmV1: true })
  return expo
}

function isFakeMode() {
  return (process.env.PUSH_MODE || 'real').toLowerCase() === 'fake'
}

function fakeBox(title, lines) {
  const W = 62
  const pad = (s) => {
    const visibleLen = [...s].length
    return s + ' '.repeat(Math.max(0, W - 4 - visibleLen))
  }
  console.log('╔' + '═'.repeat(W - 2) + '╗')
  console.log('║ ' + pad(title) + ' ║')
  console.log('╠' + '═'.repeat(W - 2) + '╣')
  for (const ln of lines) console.log('║ ' + pad(ln) + ' ║')
  console.log('╚' + '═'.repeat(W - 2) + '╝')
}

const dbService = require('./dbService')

/**
 * ยิง push เมื่อตรวจพบ fall — เรียกจาก predict.js
 * fire-and-forget (ไม่ throw ออกไปที่ HTTP response)
 */
async function sendFallAlert(event) {
  const { id: event_id, device_id, location, confidence } = event

  try {
    const tokens = await dbService.getAllPushTokens()
    if (tokens.length === 0) {
      if (process.env.DEMO_LOG !== 'true') {
        console.log(`⚠️  no push tokens registered — skip push (event=${event_id})`)
      }
      return { sent: 0, failed: 0, skipped: true }
    }

    const title = '🚨 ตรวจพบการล้ม!'
    const body  = `${location || 'ไม่ทราบตำแหน่ง'} — กรุณาตรวจสอบภายใน 60 วินาที`
    const data  = { event_id, device_id, location, confidence, type: 'fall_alert' }

    // === Fake mode — log แทนการยิงจริง ===
    if (isFakeMode()) {
      for (const t of tokens) {
        fakeBox('🔔 EXPO PUSH (simulated)', [
          `Token   : ${t.token.slice(0, 32)}...`,
          `Device  : ${t.device_id || '-'}`,
          `Event   : ${event_id}`,
          '─── payload ───',
          `title   : ${title}`,
          `body    : ${body}`,
          `data    : ${JSON.stringify(data)}`,
        ])
      }
      console.log(`✅ Push (fake) sent ${tokens.length}/${tokens.length} (event=${event_id})`)
      return { sent: tokens.length, failed: 0, mode: 'fake' }
    }

    // === Real mode — ส่งผ่าน Expo Push API ===
    const messages = []
    const invalid  = []

    for (const t of tokens) {
      if (!Expo.isExpoPushToken(t.token)) {
        invalid.push(t.token)
        continue
      }
      messages.push({
        to: t.token,
        sound: 'default',
        priority: 'high',
        channelId: 'fall_alert',  // ตรงกับ Android channel
        title,
        body,
        data,
      })
    }

    // ลบ token ที่ format ไม่ถูกออก (ไม่ใช่ Expo token)
    for (const bad of invalid) {
      console.warn(`⚠️  invalid Expo token, removing: ${bad.slice(0, 24)}...`)
      await dbService.removePushToken(bad).catch(() => {})
    }

    if (messages.length === 0) {
      return { sent: 0, failed: 0, skipped: true }
    }

    const chunks = getExpo().chunkPushNotifications(messages)
    const tickets = []
    for (const chunk of chunks) {
      try {
        const t = await getExpo().sendPushNotificationsAsync(chunk)
        tickets.push(...t)
      } catch (err) {
        console.error('❌ Expo push chunk failed:', err.message)
      }
    }

    const ok = tickets.filter((x) => x.status === 'ok').length
    const ng = tickets.filter((x) => x.status === 'error')

    // จัดการ token ที่ถูก unregister โดย FCM/APNs
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i]
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
        const dead = messages[i]?.to
        if (dead) {
          console.warn(`⚠️  removing dead token: ${dead.slice(0, 24)}...`)
          await dbService.removePushToken(dead).catch(() => {})
        }
      }
    }

    if (ng.length) {
      console.error(`❌ Push: ${ng.length}/${tickets.length} failed`,
        ng.map((e) => e.message))
    }

    console.log(`✅ Push sent ${ok}/${tickets.length} (event=${event_id})`)
    return { sent: ok, failed: ng.length }
  } catch (err) {
    console.error(`❌ sendFallAlert(${event_id}) error:`, err.message)
    return { sent: 0, failed: 0, error: err.message }
  }
}

module.exports = {
  sendFallAlert,
}
