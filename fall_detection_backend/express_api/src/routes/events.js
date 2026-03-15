const router = require('express').Router()
const dbService = require('../services/dbService')

// ดู events ทั้งหมด
router.get('/', async (req, res) => {
  try {
    const { device_id, limit = 50 } = req.query
    const events = await dbService.getEvents({ device_id, limit: Number(limit) })
    res.json({ events, count: events.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ดูเฉพาะ fall events
router.get('/falls', async (req, res) => {
  try {
    const { device_id, limit = 50 } = req.query
    const events = await dbService.getFallEvents({ device_id, limit: Number(limit) })
    res.json({ events, count: events.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
