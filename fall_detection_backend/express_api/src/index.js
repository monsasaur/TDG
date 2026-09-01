require('dotenv').config()
const express = require('express')
const app = express()

app.use(express.json())

// ต้องมาก่อน auth — preflight (OPTIONS) ไม่ได้แนบ credential มาด้วย
app.use(require('./middleware/cors'))

// Swagger UI — ต้อง mount ก่อน auth เพราะหน้าเอกสารเองไม่ควรต้องมีคีย์
// (endpoint ที่มันยิงยังต้องใส่คีย์ผ่านปุ่ม Authorize เหมือนเดิม)
// ปิดได้ด้วย ENABLE_API_DOCS=false ถ้าไม่อยากเปิดเผยรายการ endpoint บน production
if (process.env.ENABLE_API_DOCS !== 'false') {
  const swaggerUi = require('swagger-ui-express')
  const openapi   = require('./docs/openapi')

  app.get('/openapi.json', (_req, res) => res.json(openapi))
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
    customSiteTitle: 'Fall Detection API',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none', tryItOutEnabled: true },
  }))
}

// Admin Client ใช้ token ของตัวเอง ไม่ใช่ x-api-key ที่ ESP32/แอปมือถือใช้ร่วมกัน (SEC-01)
// จึง mount ก่อน auth middleware ตัวหลัก แล้วตรวจสิทธิ์เองในระดับ route
app.use('/api/v1/admin', require('./routes/admin'))

app.use(require('./middleware/auth'))

app.use('/api/v1/predict', require('./routes/predict'))
app.use('/api/v1/alert',   require('./routes/alert'))
app.use('/api/v1/events',  require('./routes/events'))
app.use('/api/v1/push',    require('./routes/push'))
app.use('/api/v1/demo',    require('./routes/demo'))

app.get('/health', (req, res) => res.json({ 
  status: 'ok',
  timestamp: new Date().toISOString()
}))

const escalationService = require('./services/escalationService')

const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`API running on port ${PORT}`)

  // timer ของ escalation อยู่ใน memory — restart แล้วหาย
  // สร้างใหม่จากสถานะใน DB แล้วเปิด sweeper ไว้เป็นตาข่ายรองรับ
  // ไม่งั้นเหตุการณ์ที่กำลังรอ ack ตอน server ล้มจะค้าง pending ตลอดกาล
  await escalationService.recoverPending()
  escalationService.startSweeper()
  console.log(`🔁 escalation sweeper every ${escalationService.SWEEP_SECONDS}s`)
  if (process.env.ENABLE_API_DOCS !== 'false') {
    console.log(`📖 API docs → http://localhost:${PORT}/docs`)
  }
})
