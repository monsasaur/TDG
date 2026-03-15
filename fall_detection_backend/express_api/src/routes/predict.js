const router = require('express').Router()
const { predictBody } = require('../middleware/validate')
const mlService    = require('../services/mlService')
const alertService = require('../services/alertService')
const dbService    = require('../services/dbService')

router.post('/', predictBody, async (req, res) => {
  const { device_id, timestamp, location, features } = req.body

  try {
    // 1. ส่งไป ML Service (binary: fall / non_fall)
    const result = await mlService.predict(features)

    const {
      is_fall,
      confidence,
      fall_level,         // rule-based: "A" | "B" | "C" | null
      risk_score,
      duration_on_floor,  // วินาทีที่อยู่บนพื้น
      alert: alertMsg,
      probabilities
    } = result

    const alerted = is_fall && confidence > 0.85

    // 2. บันทึก DB
    await dbService.saveEvent({
      device_id,
      timestamp:         timestamp || Date.now(),
      location:          location  || 'unknown',
      is_fall,
      fall_level:        fall_level        ?? null,
      confidence,
      risk_score,
      duration_on_floor: duration_on_floor ?? 0,
      alert_message:     alertMsg          ?? '-',
      alerted
    })

    // 3. Alert ตามระดับความรุนแรง
    if (alerted) {
      if (fall_level === 'C') {
        // ฉุกเฉิน → SMS + Voice Call
        await Promise.all([
          alertService.notify({ device_id, location, confidence, fall_level, duration_on_floor }),
          alertService.call({ device_id, location, fall_level })
        ])
      } else if (fall_level === 'B') {
        // แจ้ง caregiver → SMS เท่านั้น
        await alertService.notify({ device_id, location, confidence, fall_level, duration_on_floor })
      } else if (fall_level === 'A') {
        // แจ้งเตือนเบา → log เท่านั้น
        console.log(`⚠️  [Level A] Fall detected — device: ${device_id}, duration: ${duration_on_floor}s`)
      }
    }

    res.json({
      is_fall,
      fall_level,
      confidence,
      risk_score,
      duration_on_floor,
      alert:     alertMsg,
      action:    is_fall ? `alert_level_${fall_level}` : 'monitoring',
      timestamp: new Date().toISOString()
    })

  } catch (err) {
    console.error('Predict error:', err.message)
    res.status(500).json({ error: 'Prediction failed' })
  }
})

module.exports = router
