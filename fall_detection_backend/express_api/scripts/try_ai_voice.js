#!/usr/bin/env node
/**
 * ลองให้ AI (OpenTyphoon) เรียบเรียงข้อความโทรแจ้งหนึ่งครั้ง — ยิง API จริง ใช้เครดิต
 * ไม่โทรออก ไม่เขียนฐานข้อมูล แค่พิมพ์ข้อความที่ได้กับเวลาที่ใช้
 *
 *   AI_VOICE_ENABLED=true node scripts/try_ai_voice.js
 *
 * ต้องมี TYPHOON_API_KEY ใน .env · ได้ null = ตอนโทรจริงจะใช้ข้อความมาตรฐานแทน
 * (ย้ายมาจาก test-ai.js ที่เคยอยู่ root ของ package)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const ai = require('../src/services/aiVoiceAgentService')

const sample = {
  location: 'ห้องน้ำชั้น 1',
  device_id: 'ESP-0001A',
  house_name: 'บ้านคุณยาย',
}

;(async () => {
  if (!ai.isEnabled()) {
    console.warn('⚠️  AI_VOICE_ENABLED ไม่ได้ตั้งเป็น true — ระบบจะใช้ข้อความมาตรฐานเสมอ')
  }
  console.log('ส่งให้ AI:', { location: sample.location, house_name: sample.house_name })

  const t0 = Date.now()
  const message = await ai.generateCallMessage(sample)
  const ms = Date.now() - t0

  if (message) {
    console.log(`\n✅ ได้ข้อความใน ${ms} ms:\n${message}\n`)
  } else {
    console.log(`\n⚠️  ได้ null ใน ${ms} ms — ตอนโทรจริงจะใช้ข้อความมาตรฐานแทน`)
    console.log('สาเหตุที่เป็นไปได้: ปิด AI · ไม่มีคีย์ · หมดเวลา · API ขัดข้อง · ข้อความไม่ผ่านการตรวจ')
  }
})()
