const axios = require('axios')

/**
 * Render ส่ง ML_SERVICE_URL มาจาก `fromService … property: hostport` (render.yaml)
 * ซึ่งได้ค่าแบบ "tdg-ml-service:10000" — ไม่มี http:// นำหน้า axios จะเรียกไม่ได้เลย
 * เติม http:// ให้ถ้าไม่มี scheme และตัด / ท้ายออก
 */
function normalizeUrl(raw) {
  if (!raw) return raw
  const url = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`
  return url.replace(/\/+$/, '')
}

const ML_URL   = normalizeUrl(process.env.ML_SERVICE_URL)
const USE_MOCK = process.env.USE_MOCK_ML === 'true'

// รอ ML service ได้นานเท่าไร — ค่าเริ่มต้น 5 วิ
// แผนฟรีของ Render ML service หลับหลังไม่มีคนเรียก 15 นาที และตื่นราว 1 นาที → render.yaml ตั้ง ML_TIMEOUT_MS ให้ยาวกว่านั้น
// ไม่งั้นการล้มครั้งแรกหลังหลับจะ error แล้วหายไปเลย ไม่ใช่แค่ช้า
const ML_TIMEOUT_MS = (() => {
  const n = Number(process.env.ML_TIMEOUT_MS)
  return Number.isFinite(n) && n > 0 ? n : 5000
})()
const MOCK_IS_FALL = (process.env.MOCK_IS_FALL || 'true') === 'true'

// Mock response ตอนโมเดลจริงยังไม่เสร็จ
// ตั้งค่าใน .env:
//   USE_MOCK_ML=true
//   MOCK_IS_FALL=true   → สร้าง event ล้มทุกครั้ง (ทดสอบ flow)
//   MOCK_IS_FALL=false  → ไม่ล้ม (ทดสอบ no-op)
function mockPredict() {
  const base = { model_name: 'mock', model_version: 'mock' }
  return MOCK_IS_FALL
    ? { is_fall: true,  confidence: 0.94, risk_score: 94, ...base }
    : { is_fall: false, confidence: 0.08, risk_score: 8,  ...base }
}

module.exports = {
  predict: async (features) => {
    if (USE_MOCK) {
      const result = mockPredict()
      console.log(`🧪 [MOCK ML] is_fall=${result.is_fall} confidence=${result.confidence}`)
      return result
    }

    try {
      const res = await axios.post(`${ML_URL}/predict`,
        { features },
        { timeout: ML_TIMEOUT_MS }
      )
      // normalize response — ML service ควรคืน {is_fall, confidence}
      // และตั้งแต่ 2026-09-09 คืน {model_name, model_version, risk_score} มาด้วย
      // ML service รุ่นเก่าไม่ส่งสามตัวหลังมา → เก็บเป็น null ไม่ใช่ค่าปลอม
      // เพราะ null บอกว่า "ไม่รู้" ส่วน 0 หรือ 'unknown' จะดูเหมือนข้อมูลจริง
      const risk = res.data.risk_score
      return {
        is_fall:       Boolean(res.data.is_fall),
        confidence:    Number(res.data.confidence ?? 0),
        model_name:    res.data.model_name    ?? null,
        model_version: res.data.model_version ?? null,
        risk_score:    risk === undefined || risk === null ? null : Number(risk)
      }
    } catch (err) {
      const wrapped = new Error(`ML Service error: ${err.message}`)
      // ML ตอบ 4xx = ข้อมูลที่ส่งมาผิด (เช่นจำนวน feature ไม่ตรงโมเดล: rf_v1 416 · rf_v2_event 39)
      // ไม่ใช่ server พัง — ส่งต่อเป็น 400 ให้ฝั่งอุปกรณ์รู้ว่าต้องแก้ข้อมูล (BUG-011 · เดิมกลายเป็น 500)
      const status = err.response?.status
      if (status >= 400 && status < 500) {
        wrapped.badInput = true
        const detail = err.response.data?.detail
        wrapped.detail = typeof detail === 'string' ? detail : null
      }
      throw wrapped
    }
  }
}
