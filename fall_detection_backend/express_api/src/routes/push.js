const router    = require('express').Router()
const dbService  = require('../services/dbService')
const pushService = require('../services/pushService')

// แอปลงทะเบียน Expo push token (เรียกตอนเปิดแอปครั้งแรก / ทุกครั้งที่ token เปลี่ยน)
router.post('/register', async (req, res) => {
  const { token, device_id, platform } = req.body || {}

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' })
  }

  try {
    const saved = await dbService.registerPushToken({
      token,
      device_id: device_id || null,
      platform:  platform  || null,
    })
    console.log(`📲 push token registered: ${token.slice(0, 24)}... device=${device_id || '-'}`)
    res.json({ ok: true, token: saved.token })
  } catch (err) {
    console.error('register push token error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ทดสอบยิง push ไปทุก device ที่ลงทะเบียน
router.post('/test', async (_req, res) => {
  try {
    const result = await pushService.sendFallAlert({
      id:         'test-event',
      device_id:  'TEST_DEVICE',
      location:   'ห้องนั่งเล่น (test)',
      confidence: 0.99,
    })
    res.json({ message: 'Test push triggered', result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
