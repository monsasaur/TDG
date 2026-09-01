#!/usr/bin/env node
/**
 * generate_api_docs.js
 * สร้าง docs/API_REFERENCE.md จาก src/docs/openapi.js
 *
 *   npm run docs
 *
 * ทำไมต้อง generate ไม่พิมพ์มือ
 * ----------------------------
 * คู่มือที่พิมพ์มือจะล้าสมัยเงียบ ๆ ทันทีที่โค้ดเปลี่ยน — เกิดขึ้นมาแล้วกับหัวข้อ
 * Database Schema ใน CLAUDE.md จนทำให้เอกสาร BA สั่งให้เพิ่มฟิลด์ที่มีอยู่แล้ว
 *
 * ไฟล์นี้ทำให้มีแหล่งความจริงเดียวคือ openapi.js ซึ่งถูก tests/openapi.test.js
 * เทียบกับ route จริงอยู่แล้ว ห่วงโซ่จึงเป็น:  โค้ด → spec → คู่มือ
 */

const fs   = require('fs')
const path = require('path')

const spec = require('../src/docs/openapi')

const OUT = path.join(__dirname, '..', '..', '..', 'docs', 'API_REFERENCE.md')

const AUTH_LABEL = {
  apiKey:     '`x-api-key`',
  adminToken: '`Authorization: Bearer`',
}

const out = []
const w = (line = '') => out.push(line)

/** scope ของ x-api-key ที่ endpoint นี้ต้องใช้ — อ่านจาก tag */
function keyScope(op) {
  if (op.tags?.includes('Demo'))      return '`DEMO_API_KEY`'
  if (op.tags?.includes('Detection')) return '`DEVICE_API_KEY`'
  if (op.tags?.includes('Admin'))     return null
  return '`APP_API_KEY`'
}

function authLine(op) {
  const sec = op.security ?? spec.security ?? []
  if (sec.length === 0) return 'ไม่ต้องยืนยันตัวตน'

  const names = sec.flatMap((entry) => Object.keys(entry))
  if (names.includes('adminToken')) {
    return `${AUTH_LABEL.adminToken} — token จาก \`POST /api/v1/admin/login\``
  }
  const scope = keyScope(op)
  return scope ? `${AUTH_LABEL.apiKey} — ใช้ ${scope}` : AUTH_LABEL.apiKey
}

function renderParams(params) {
  if (!params?.length) return
  w('**Query / Path parameters**')
  w()
  w('| ชื่อ | อยู่ที่ | ชนิด | จำเป็น | คำอธิบาย |')
  w('|---|---|---|:---:|---|')
  for (const p of params) {
    const s = p.schema || {}
    const type = s.enum ? s.enum.map((v) => `\`${v}\``).join(' \\| ')
                        : `\`${s.type || '-'}\``
    const dflt = s.default !== undefined ? ` (ค่าเริ่มต้น \`${s.default}\`)` : ''
    w(`| \`${p.name}\` | ${p.in} | ${type} | ${p.required ? '✔' : ''} | ${(p.description || '') + dflt} |`)
  }
  w()
}

function renderBody(body) {
  if (!body) return
  const schema = body.content?.['application/json']?.schema
  if (!schema?.properties) return

  w(`**Request body** (JSON)${body.required ? ' — จำเป็น' : ''}`)
  w()
  w('| field | ชนิด | จำเป็น | คำอธิบาย |')
  w('|---|---|:---:|---|')
  const required = new Set(schema.required || [])
  for (const [name, p] of Object.entries(schema.properties)) {
    const type = p.enum ? p.enum.map((v) => `\`${v}\``).join(' \\| ') : `\`${p.type}\``
    const extra = [
      p.description,
      p.default !== undefined ? `ค่าเริ่มต้น \`${p.default}\`` : null,
      p.example !== undefined ? `เช่น \`${p.example}\`` : null,
    ].filter(Boolean).join(' · ')
    w(`| \`${name}\` | ${type} | ${required.has(name) ? '✔' : ''} | ${extra} |`)
  }
  w()
}

function renderResponses(responses) {
  const codes = Object.keys(responses)
  w('**Responses**')
  w()
  w('| รหัส | ความหมาย |')
  w('|---|---|')
  for (const code of codes) w(`| \`${code}\` | ${responses[code].description || ''} |`)
  w()

  // ตัวอย่าง 200 — รองรับทั้ง example เดี่ยวและ examples หลายกรณี
  const json = responses['200']?.content?.['application/json']
  if (!json) return

  if (json.examples) {
    for (const [name, ex] of Object.entries(json.examples)) {
      w(`<details><summary>ตัวอย่าง — ${name}</summary>`)
      w()
      w('```json')
      w(JSON.stringify(ex.value, null, 2))
      w('```')
      w()
      w('</details>')
      w()
    }
  } else if (json.example) {
    w('<details><summary>ตัวอย่าง response</summary>')
    w()
    w('```json')
    w(JSON.stringify(json.example, null, 2))
    w('```')
    w()
    w('</details>')
    w()
  }
}

// ---------- หัวเอกสาร ----------
w(`# ${spec.info.title} — คู่มือ API`)
w()
w('> ⚠️ **ไฟล์นี้สร้างอัตโนมัติ ห้ามแก้มือ**')
w('> แก้ที่ `fall_detection_backend/express_api/src/docs/openapi.js` แล้วรัน `npm run docs`')
w('>')
w('> เวอร์ชันกดยิงได้: รันเซิร์ฟเวอร์แล้วเปิด `http://localhost:3000/docs`')
w()
w(`เวอร์ชัน \`${spec.info.version}\``)
w()
w(spec.info.description)
w()
w('---')
w()

// ---------- สารบัญ ----------
const byTag = new Map(spec.tags.map((t) => [t.name, []]))
for (const [p, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    const tag = op.tags?.[0] || 'อื่น ๆ'
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag).push({ path: p, method: method.toUpperCase(), op })
  }
}

w('## สารบัญ')
w()
for (const [tag, items] of byTag) {
  if (!items.length) continue
  w(`**${tag}**`)
  w()
  for (const { method, path: p, op } of items) {
    const anchor = `${method}-${p}`.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '-').replace(/^-|-$/g, '')
    w(`- [\`${method} ${p}\`](#${anchor}) — ${op.summary}`)
  }
  w()
}
w('---')
w()

// ---------- รายละเอียดแต่ละ endpoint ----------
for (const [tag, items] of byTag) {
  if (!items.length) continue
  const tagInfo = spec.tags.find((t) => t.name === tag)
  w(`## ${tag}`)
  if (tagInfo?.description) { w(); w(`_${tagInfo.description}_`) }
  w()

  for (const { method, path: p, op } of items) {
    w(`### \`${method} ${p}\``)
    w()
    w(`**${op.summary}**`)
    w()
    if (op.description) { w(op.description); w() }
    w(`**สิทธิ์:** ${authLine(op)}`)
    w()
    renderParams(op.parameters)
    renderBody(op.requestBody)
    renderResponses(op.responses)
    w('---')
    w()
  }
}

w('<sub>สร้างจาก `src/docs/openapi.js` ด้วย `npm run docs`</sub>')

const content = out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (current !== content) {
    console.error('❌ docs/API_REFERENCE.md ไม่ตรงกับ spec — รัน `npm run docs` แล้ว commit ด้วย')
    process.exit(1)
  }
  console.log('✅ docs/API_REFERENCE.md ตรงกับ spec')
  process.exit(0)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, content)
console.log(`✅ เขียน ${path.relative(path.join(__dirname, '..', '..', '..'), OUT)} (${content.split('\n').length} บรรทัด)`)
