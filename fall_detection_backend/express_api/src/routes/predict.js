const router = require('express').Router()
const { predictBody } = require('../middleware/validate')
const mlService         = require('../services/mlService')
const dbService         = require('../services/dbService')
const escalationService = require('../services/escalationService')
const pushService       = require('../services/pushService')

router.post('/', predictBody, async (req, res) => {
  const { device_id, timestamp, location, features } = req.body

  try {
    // 0. อุปกรณ์ยังส่งข้อมูลอยู่ — อัปเดตทุกครั้งที่มี packet เข้ามา ไม่ใช่เฉพาะตอนล้ม
    //    ถ้าอัปเดตเฉพาะตอนล้ม บ้านที่ปลอดภัยที่สุดจะถูกแสดงว่า offline (BA doc 12.2 จุดที่ 2)
    //    fire-and-forget — ห้ามให้หน้า admin ทำให้ path ตรวจจับการล้มช้าลงหรือพัง (NFR-10)
    dbService.touchDevice(device_id).catch((err) =>
      console.error('touchDevice failed:', err.message)
    )

    // 1. ML inference (binary)
    const { is_fall, confidence } = await mlService.predict(features)

    // 2. Not a fall → แค่ log (ไม่บันทึก DB เพื่อไม่ให้ table บวม)
    if (!is_fall) {
      return res.json({
        is_fall:   false,
        confidence,
        action:    'monitoring',
        timestamp: new Date().toISOString()
      })
    }

    // 3. Device นี้พึ่ง escalate ไป → กัน spam
    if (escalationService.inCooldown(device_id)) {
      console.log(`⏭  [COOLDOWN] device=${device_id} — skip new alert`)
      return res.json({
        is_fall:   true,
        confidence,
        action:    'cooldown',
        timestamp: new Date().toISOString()
      })
    }

    // 4. บันทึก event ลง DB
    const event = await dbService.saveEvent({
      device_id,
      timestamp: timestamp || Date.now(),
      location:  location  || 'unknown',
      is_fall:   true,
      confidence
    })

    // 5. เริ่ม timer — รอ caregiver กด ack ในแอป
    escalationService.schedule(event)

    // 6. ยิง push notification ไปทุก device ที่ลงทะเบียน (fire-and-forget)
    pushService.sendFallAlert(event).catch((err) =>
      console.error('push send failed:', err.message)
    )

    res.json({
      event_id:             event.id,
      is_fall:              true,
      confidence,
      action:               'awaiting_acknowledge',
      ack_timeout_seconds:  escalationService.ACK_TIMEOUT_SECONDS,
      timestamp:            new Date().toISOString()
    })

  } catch (err) {
    console.error('Predict error:', err.message)
    res.status(500).json({ error: 'Prediction failed' })
  }
})

module.exports = router
