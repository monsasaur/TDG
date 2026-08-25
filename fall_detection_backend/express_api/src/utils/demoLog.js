/**
 * demoLog.js — log ที่ดูดีบนกล้อง
 * เปิดใช้เมื่อ DEMO_LOG=true ใน .env
 */

const ENABLED = process.env.DEMO_LOG === 'true'

// ANSI color codes — ไม่ต้องลง dep
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  bgRed:  '\x1b[41m',
  bgGreen:'\x1b[42m',
  bgYellow:'\x1b[43m',
}

function ts() {
  const d = new Date()
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`
}

function banner(label, lines, color = 'red') {
  if (!ENABLED) return
  const W = 64
  const bg = c[`bg${color.charAt(0).toUpperCase()}${color.slice(1)}`] || c.bgRed
  const fg = c[color] || c.red

  const pad = (s) => {
    const visible = s.replace(/\x1b\[[0-9;]*m/g, '')
    // นับ visual width: emoji ~2 cells, ASCII = 1 cell
    let width = 0
    for (const ch of visible) {
      const cp = ch.codePointAt(0)
      width += (cp > 0x1100 && (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf))) ? 2 : 1
    }
    return s + ' '.repeat(Math.max(0, W - 3 - width))
  }

  console.log()
  console.log(fg + '┏' + '━'.repeat(W) + '┓' + c.reset)
  console.log(fg + '┃' + bg + c.bold + c.white + ' ' + pad(label) + ' ' + c.reset + fg + '┃' + c.reset)
  console.log(fg + '┣' + '━'.repeat(W) + '┫' + c.reset)
  for (const ln of lines) {
    console.log(fg + '┃ ' + c.reset + pad(ln) + ' ' + fg + '┃' + c.reset)
  }
  console.log(fg + '┗' + '━'.repeat(W) + '┛' + c.reset)
  console.log()
}

function step(num, label, detail) {
  if (!ENABLED) return
  console.log(`${c.dim}[${ts()}]${c.reset} ${c.bold}${c.cyan}STEP ${num}${c.reset} ${c.bold}${label}${c.reset}${detail ? c.dim + ' — ' + detail + c.reset : ''}`)
}

function info(msg) {
  if (!ENABLED) return
  console.log(`${c.dim}[${ts()}]${c.reset} ${msg}`)
}

function success(msg) {
  if (!ENABLED) return
  console.log(`${c.dim}[${ts()}]${c.reset} ${c.green}✓${c.reset} ${msg}`)
}

module.exports = { ENABLED, banner, step, info, success, c, ts }
