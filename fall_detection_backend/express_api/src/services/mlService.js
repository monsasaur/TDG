const axios = require('axios')

const ML_URL   = process.env.ML_SERVICE_URL
const USE_MOCK = process.env.USE_MOCK_ML === 'true'
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
        { timeout: 5000 }
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
      throw new Error(`ML Service error: ${err.message}`)
    }
  }
}
