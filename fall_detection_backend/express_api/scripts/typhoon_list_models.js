#!/usr/bin/env node
/**
 * ดูรายชื่อโมเดลที่คีย์ OpenTyphoon ใช้ได้ — ใช้เช็คตอนจะเปลี่ยนรุ่นโมเดลใน aiVoiceAgentService.js
 * อ่านอย่างเดียว ไม่ได้เรียกโมเดล
 *
 *   node scripts/typhoon_list_models.js
 *
 * (ย้ายมาจาก check-model.js ที่เคยอยู่ root ของ package)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

;(async () => {
  if (!process.env.TYPHOON_API_KEY) {
    console.error('ไม่ได้ตั้ง TYPHOON_API_KEY ใน .env')
    process.exit(1)
  }
  try {
    const res = await fetch('https://api.opentyphoon.ai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.TYPHOON_API_KEY}` },
    })
    console.log(JSON.stringify(await res.json(), null, 2))
  } catch (err) {
    console.error('❌ ดึงรายชื่อโมเดลไม่ได้:', err.message)
    process.exit(1)
  }
})()
