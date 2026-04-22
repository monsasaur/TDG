const router = require('express').Router()
const alertService      = require('../services/alertService')
const dbService         = require('../services/dbService')
const escalationService = require('../services/escalationService')

// ผู้ดูแลกด "รับทราบ" ในแอป → ยกเลิก escalation
router.post('/ack/:event_id', async (req, res) => {
  const { event_id } = req.params
  const { acknowledged_by } = req.body || {}

  try {
    const event = await dbService.getEvent(event_id)
    if (!event) {
      return res.status(404).json({ error: 'event not found' })
    }

    if (event.acknowledged) {
      return res.json({
        event_id,
        acknowledged:         true,
        acknowledged_at:      event.acknowledged_at,
        acknowledged_by:      event.acknowledged_by,
        escalation_cancelled: false,
        message:              'already acknowledged'
      })
    }

    if (event.escalated) {
      return res.status(409).json({
        event_id,
        error:   'event already escalated (timeout exceeded)',
        escalated_at: event.escalated_at
      })
    }

    const cancelled = escalationService.cancel(event_id)
    const updated   = await dbService.acknowledgeEvent(event_id, acknowledged_by)

    res.json({
      event_id,
      acknowledged:         true,
      acknowledged_at:      updated.acknowledged_at,
      acknowledged_by:      updated.acknowledged_by,
      escalation_cancelled: cancelled
    })

  } catch (err) {
    console.error('Ack error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ทดสอบ Twilio SMS + Voice
router.post('/test', async (_req, res) => {
  try {
    const [smsRes, callRes] = await Promise.allSettled([
      alertService.sendSms({
        device_id:  'TEST_DEVICE',
        location:   'test_room',
        confidence: 0.99,
        event_id:   'test-event'
      }),
      alertService.makeCall({
        location: 'test_room',
        event_id: 'test-event'
      })
    ])

    res.json({
      message: 'Test alert triggered',
      sms:     smsRes.status  === 'fulfilled' ? smsRes.value  : { error: smsRes.reason?.message },
      call:    callRes.status === 'fulfilled' ? callRes.value : { error: callRes.reason?.message }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
