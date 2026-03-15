const router = require('express').Router()
const alertService = require('../services/alertService')

// ทดสอบ alert
router.post('/test', async (req, res) => {
  try {
    await alertService.notify({
      device_id: 'TEST_DEVICE',
      location:  'test_room',
      confidence: 0.99
    })
    res.json({ message: 'Test alert sent' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router