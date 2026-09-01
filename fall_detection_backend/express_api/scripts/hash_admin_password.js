#!/usr/bin/env node
/**
 * สร้างค่า ADMIN_PASSWORD_HASH สำหรับใส่ใน .env
 * SEC-05 — รหัสผ่านต้องเก็บแบบเข้ารหัสทางเดียว ห้ามเก็บเป็นข้อความธรรมดา
 *
 *   node scripts/hash_admin_password.js 'รหัสผ่านที่ต้องการ'
 */

const { hashPassword } = require('../src/services/adminAuthService')

const password = process.argv[2]

if (!password) {
  console.error('usage: node scripts/hash_admin_password.js <password>')
  process.exit(1)
}

if (password.length < 12) {
  console.error('รหัสผ่านควรยาวอย่างน้อย 12 ตัวอักษร')
  process.exit(1)
}

console.log('\nเพิ่มบรรทัดนี้ใน .env (อย่า commit ค่าจริงขึ้น git):\n')
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}\n`)
