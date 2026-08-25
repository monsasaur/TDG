/**
 * demo.js — manual trigger สำหรับ live demo
 * ข้าม ML inference ไปสร้าง fall event ตรงๆ แล้วยิง push + escalation
 *
 * ใช้คู่กับ iOS Shortcut บนมือถือ:
 *   POST /api/v1/demo/fire
 *   header: x-api-key
 *   body:   { device_id?, location? }   ทุก field optional
 */

const router            = require('express').Router()
const dbService         = require('../services/dbService')
const escalationService = require('../services/escalationService')
const pushService       = require('../services/pushService')
const demoLog           = require('../utils/demoLog')

router.post('/fire', async (req, res) => {
  const device_id = req.body?.device_id || 'esp32-demo-01'
  const location  = req.body?.location  || 'ห้องนอนผู้สูงอายุ'
  const confidence = Number((0.962 + Math.random() * 0.027).toFixed(3))

  try {
    if (escalationService.inCooldown(device_id)) {
      return res.json({
        is_fall: true,
        action:  'cooldown',
        message: 'device อยู่ใน cooldown — ไม่สร้าง event ใหม่'
      })
    }

    demoLog.banner('🚨 FALL DETECTED', [
      `device      : ${device_id}`,
      `location    : ${location}`,
      `confidence  : ${confidence}`,
      `timestamp   : ${new Date().toISOString()}`,
    ], 'red')

    demoLog.step(1, 'CSI Inference', `LSTM predict → fall (${confidence})`)

    const event = await dbService.saveEvent({
      device_id,
      timestamp: Date.now(),
      location,
      is_fall:   true,
      confidence
    })
    demoLog.step(2, 'Database', `event saved → ${event.id}`)

    escalationService.schedule(event)
    demoLog.step(3, 'Escalation', `timer armed (${escalationService.ACK_TIMEOUT_SECONDS}s window)`)

    pushService.sendFallAlert(event)
      .then((r) => {
        if (r?.skipped) {
          demoLog.step(4, 'Push Notification', `skipped (no tokens registered)`)
        } else {
          demoLog.step(4, 'Push Notification', `sent ${r?.sent ?? 0}/${(r?.sent ?? 0) + (r?.failed ?? 0)} to caregiver app`)
        }
      })
      .catch((err) => console.error('push send failed:', err.message))

    if (!demoLog.ENABLED) {
      console.log(`Inference complete: is_fall=true confidence=${confidence}`)
      console.log(`[DEMO FIRE] event=${event.id} device=${device_id}`)
    }

    res.json({
      event_id:            event.id,
      is_fall:             true,
      confidence,
      action:              'awaiting_acknowledge',
      ack_timeout_seconds: escalationService.ACK_TIMEOUT_SECONDS,
      timestamp:           new Date().toISOString()
    })
  } catch (err) {
    console.error('Demo fire error:', err.message)
    res.status(500).json({ error: 'Demo fire failed' })
  }
})

module.exports = router
