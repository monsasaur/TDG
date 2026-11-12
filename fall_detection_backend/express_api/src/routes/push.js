const router    = require('express').Router()
const dbService  = require('../services/dbService')
const pushService = require('../services/pushService')
const accountService = require('../services/accountService')

// แอปลงทะเบียน Expo push token (เรียกตอนเปิดแอปครั้งแรก / ทุกครั้งที่ token เปลี่ยน)
// ส่ง Authorization: Bearer <access token> มาด้วยเมื่อ login อยู่ → ผูกเครื่องกับบัญชี
// ไม่ส่งมา = ปลดการผูก (เช่นหลังออกจากระบบ) → หลังเปิดระบบบัญชีจะไม่ได้รับ push ของบ้านไหน
router.post('/register', async (req, res) => {
  const { token, device_id, platform } = req.body || {}

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' })
  }

  try {
    const who = await accountService.resolveUser(req.headers.authorization)
    // token หมดอายุ/ปลอม → ตอบ 401 ให้แอปลองใหม่ ไม่แอบปลดการผูกบัญชีเดิมทิ้ง
    if (who.status === 'invalid') {
      return res.status(401).json({ error: 'login token is invalid or expired' })
    }

    const saved = await dbService.registerPushToken({
      token,
      device_id: device_id || null,
      platform:  platform  || null,
      user_id:   who.user?.id ?? null,
    })
    console.log(`📲 push token registered: ${token.slice(0, 24)}... device=${device_id || '-'}` +
                ` user=${who.user ? 'linked' : 'none'}`)
    res.json({ ok: true, token: saved.token, user_linked: Boolean(who.user) })
  } catch (err) {
    console.error('register push token error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// debug: ดู token ที่ register อยู่ทั้งหมด
router.get('/tokens', async (_req, res) => {
  try {
    const tokens = await dbService.getAllPushTokens()
    res.json({ count: tokens.length, tokens })
  } catch (err) {
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
    }, { audience: 'all' })
    res.json({ message: 'Test push triggered', result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
