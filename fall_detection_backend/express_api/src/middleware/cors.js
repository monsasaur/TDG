/**
 * cors.js
 * เปิดให้ admin web app (Vite dev server / static host) เรียก API ข้าม origin ได้
 *
 * ต้อง mount ก่อน auth เสมอ — preflight (OPTIONS) ไม่ได้แนบ x-api-key มาด้วย
 * ถ้าให้ auth ทำงานก่อนจะโดน 401 ตั้งแต่ preflight แล้ว browser จะไม่ยิง request จริงเลย
 *
 * ADMIN_ORIGINS=http://localhost:5173,https://admin.example.com
 *   ไม่ตั้ง → default เป็น Vite dev server บนเครื่อง
 *   ตั้งเป็น "*" → อนุญาตทุก origin (ใช้เฉพาะตอน dev)
 *
 * DEV_WEB_ORIGINS=http://localhost:8081
 *   เฉพาะตอนทดสอบแอป Expo บนเว็บในเครื่อง — origin ในรายการนี้ส่ง x-api-key ได้ด้วย
 *   (เช่นกดรับทราบการแจ้งเตือนจากหน้าเว็บ) · ไม่ตั้ง = ปิด เหมือนเดิมทุกอย่าง
 *   ห้ามตั้งบน Render/production — รับเฉพาะ origin ที่เป็น localhost / 127.0.0.1 เท่านั้น ค่าอื่นถูกทิ้ง
 */

function devWebOrigins() {
  return (process.env.DEV_WEB_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(o => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))
}

function allowedOrigins() {
  const raw = process.env.ADMIN_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173'
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

module.exports = (req, res, next) => {
  const origin  = req.headers.origin
  const allowed = allowedOrigins()

  if (origin && devWebOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key')
    res.setHeader('Access-Control-Max-Age', '600')
  } else if (origin && (allowed.includes('*') || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
    // อนุญาตแค่ Authorization (Bearer token ของ admin) — ไม่ใส่ x-api-key
    // SEC-02: ห้ามวาง API key ในโค้ดฝั่งเบราว์เซอร์ ปิดที่ชั้น CORS ไปเลย
    // เบราว์เซอร์จะยิง x-api-key ข้าม origin ไม่ได้แม้จะมีคนเผลอเขียนไว้
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
}
