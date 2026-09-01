/**
 * openapi.js
 * สเปค OpenAPI 3 ของ Express API — ใช้เสิร์ฟหน้า Swagger UI ที่ /docs
 *
 * เขียนเป็น JS object ไม่ใช่ YAML เพื่อไม่ต้องเพิ่ม dependency สำหรับ parse
 * และ import ค่าจริงจาก env ได้ (เช่น ACK_TIMEOUT_SECONDS ที่ตั้งไว้จริง)
 */

const ackTimeout = Number(process.env.ACK_TIMEOUT_SECONDS || 60)

const ERR = (description) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
})

const TIMELINE_STEP = {
  type: 'object',
  properties: {
    step:   { type: 'string', enum: ['detected', 'acknowledged', 'escalated'] },
    at:     { type: 'string', format: 'date-time' },
    detail: { type: 'object', additionalProperties: true },
  },
}

const FALL_EVENT = {
  type: 'object',
  properties: {
    id:              { type: 'string', format: 'uuid' },
    device_id:       { type: 'string', example: 'ESP-0001A', description: 'ตรงกับ devices.code' },
    timestamp:       { type: 'integer', format: 'int64', example: 1788282521596 },
    location:        { type: 'string', example: 'ห้องนอน' },
    is_fall:         { type: 'boolean' },
    confidence:      { type: 'number', format: 'float', example: 0.97 },
    acknowledged:    { type: 'boolean' },
    acknowledged_at: { type: 'string', format: 'date-time', nullable: true },
    acknowledged_by: { type: 'string', nullable: true },
    escalated:       { type: 'boolean' },
    escalated_at:    { type: 'string', format: 'date-time', nullable: true },
    sms_sent:        { type: 'boolean' },
    call_made:       { type: 'boolean' },
    created_at:      { type: 'string', format: 'date-time' },
  },
}

const ADMIN_EVENT = {
  allOf: [
    FALL_EVENT,
    {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'acknowledged', 'escalated'],
          description: 'คำนวณฝั่งเซิร์ฟเวอร์ตาม BR-03/BR-04 — escalated ชนะ acknowledged',
        },
        ack_latency_seconds: { type: 'integer', nullable: true },
      },
    },
  ],
}

module.exports = {
  openapi: '3.0.3',

  info: {
    title: 'Fall Detection API',
    version: '1.0.0',
    description: `
ระบบตรวจจับการล้มด้วย WiFi CSI — API ฝั่ง cloud

### การยืนยันตัวตน — คีย์แยกตามผู้เรียก

| scope | header | เรียกอะไรได้ |
|---|---|---|
| device | \`x-api-key: DEVICE_API_KEY\` | \`POST /predict\` |
| app | \`x-api-key: APP_API_KEY\` | \`/events\`, \`/alert/ack\`, \`/push/register\`, \`/push/tokens\` |
| demo | \`x-api-key: DEMO_API_KEY\` | \`/demo/fire\`, \`/alert/test\`, \`/push/test\` |
| admin | \`Authorization: Bearer <token>\` | \`/admin/*\` (ขอ token จาก \`POST /admin/login\`) |

scope ไหนไม่ได้ตั้งคีย์เฉพาะไว้ จะถอยไปใช้ \`API_KEY\` ตัวเดิม

**กด Authorize มุมขวาบนเพื่อใส่คีย์ก่อนลองยิง** — วิธีใช้หน้านี้แบบละเอียดอยู่ที่ \`docs/SWAGGER_GUIDE.md\`

### หมายเหตุ
- \`POST /demo/fire\` **สั่งให้ระบบโทรออกจริง** ถ้า \`TWILIO_MODE=real\` — เช็คก่อนกด
- \`/predict\` ที่ไม่พบการล้ม จะไม่บันทึกลง DB เพื่อไม่ให้ตารางบวม
- อุปกรณ์เดิมที่เพิ่ง escalate ไปจะติด cooldown (\`COOLDOWN_SECONDS\`)
`.trim(),
  },

  servers: [
    { url: 'http://localhost:3000', description: 'เครื่องตัวเอง' },
    { url: '/', description: 'เซิร์ฟเวอร์ปัจจุบัน' },
  ],

  tags: [
    { name: 'Detection',  description: 'ESP32 ส่งข้อมูลเข้ามา' },
    { name: 'Events',     description: 'ดูเหตุการณ์และกดรับทราบ' },
    { name: 'Push',       description: 'Push notification' },
    { name: 'Demo',       description: '⚠️ ใช้สาธิต — สั่งให้ระบบโทรออกจริงได้' },
    { name: 'Admin',      description: 'หน้าเว็บ admin (ใช้ Bearer token คนละชั้นกับ x-api-key)' },
    { name: 'System',     description: '' },
  ],

  components: {
    securitySchemes: {
      apiKey:     { type: 'apiKey', in: 'header', name: 'x-api-key' },
      adminToken: { type: 'http', scheme: 'bearer', description: 'token จาก POST /api/v1/admin/login' },
    },
    schemas: { FallEvent: FALL_EVENT, AdminEvent: ADMIN_EVENT, TimelineStep: TIMELINE_STEP },
  },

  security: [{ apiKey: [] }],

  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'เช็คว่าเซิร์ฟเวอร์ยังทำงานอยู่',
        security: [],
        responses: {
          200: {
            description: 'ปกติ',
            content: { 'application/json': { example: { status: 'ok', timestamp: '2026-09-02T04:00:00.000Z' } } },
          },
        },
      },
    },

    '/api/v1/predict': {
      post: {
        tags: ['Detection'],
        summary: 'ESP32 ส่ง CSI features เข้ามาให้ทำนาย',
        description:
          'ใช้ **DEVICE_API_KEY** · ถ้าเป็นการล้มจะบันทึก event, เริ่มจับเวลารอ acknowledge, ' +
          'สร้าง alert ให้แอป และยิง push · ถ้าไม่ล้มจะไม่บันทึกลง DB',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['device_id', 'features'],
                properties: {
                  device_id: { type: 'string', example: 'ESP-0001A' },
                  timestamp: { type: 'integer', format: 'int64', description: 'ไม่ส่งมาก็ใช้เวลาปัจจุบัน' },
                  location:  { type: 'string', example: 'ห้องนอน', default: 'unknown' },
                  features: {
                    type: 'array',
                    description: 'array ของ array — (sequence_len, 416)',
                    items: { type: 'array', items: { type: 'number' } },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'ทำนายเสร็จ — action บอกว่าเกิดอะไรต่อ',
            content: {
              'application/json': {
                examples: {
                  ไม่ล้ม:   { value: { is_fall: false, confidence: 0.12, action: 'monitoring', timestamp: '2026-09-02T04:00:00.000Z' } },
                  ล้ม:     { value: { event_id: 'e6b1…', is_fall: true, confidence: 0.97, action: 'awaiting_acknowledge', ack_timeout_seconds: ackTimeout, timestamp: '2026-09-02T04:00:00.000Z' } },
                  ติดcooldown: { value: { is_fall: true, confidence: 0.95, action: 'cooldown', timestamp: '2026-09-02T04:00:00.000Z' } },
                },
              },
            },
          },
          400: ERR('device_id หรือ features ไม่ถูกต้อง'),
          401: ERR('คีย์ผิด หรือใช้คีย์ผิด scope'),
          500: ERR('ทำนายไม่สำเร็จ'),
        },
      },
    },

    '/api/v1/events': {
      get: {
        tags: ['Events'],
        summary: 'ดู event ทั้งหมด',
        parameters: [
          { name: 'device_id', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          200: {
            description: 'รายการ event',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    events: { type: 'array', items: FALL_EVENT },
                    count:  { type: 'integer' },
                  },
                },
              },
            },
          },
          401: ERR('ไม่ได้รับอนุญาต'),
        },
      },
    },

    '/api/v1/events/falls': {
      get: {
        tags: ['Events'],
        summary: 'ดูเฉพาะเหตุการณ์ล้ม',
        parameters: [
          { name: 'device_id', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { 200: { description: 'รายการเหตุการณ์ล้ม' }, 401: ERR('ไม่ได้รับอนุญาต') },
      },
    },

    '/api/v1/alert/ack/{event_id}': {
      post: {
        tags: ['Events'],
        summary: 'ผู้ดูแลกดรับทราบ — ยกเลิกการโทรฉุกเฉิน',
        description: 'ยกเลิก escalation timer และอัปเดต alert ที่แอปแสดงเป็น completed',
        parameters: [{ name: 'event_id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { acknowledged_by: { type: 'string', example: 'ตังเม' } } },
            },
          },
        },
        responses: {
          200: {
            description: 'รับทราบแล้ว',
            content: {
              'application/json': {
                example: { event_id: 'e6b1…', acknowledged: true, acknowledged_at: '2026-09-02T04:00:20.000Z', acknowledged_by: 'ตังเม', escalation_cancelled: true },
              },
            },
          },
          404: ERR('ไม่พบ event'),
          409: ERR('หมดเวลาไปแล้ว ระบบ escalate ไปเรียบร้อย — กดรับทราบไม่ได้อีก'),
          401: ERR('ไม่ได้รับอนุญาต'),
        },
      },
    },

    '/api/v1/alert/test': {
      post: {
        tags: ['Demo'],
        summary: '⚠️ ทดสอบ Twilio — ส่ง SMS และโทรออกจริงถ้า TWILIO_MODE=real',
        description: 'ใช้ **DEMO_API_KEY**',
        responses: { 200: { description: 'ยิงแล้ว — ดูผลใน sms/call' }, 401: ERR('ต้องใช้ DEMO_API_KEY') },
      },
    },

    '/api/v1/push/register': {
      post: {
        tags: ['Push'],
        summary: 'ลงทะเบียน Expo push token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: {
                  token:     { type: 'string', example: 'ExponentPushToken[xxxxxxxx]' },
                  device_id: { type: 'string' },
                  platform:  { type: 'string', enum: ['ios', 'android'] },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'ลงทะเบียนแล้ว' }, 400: ERR('ไม่มี token'), 401: ERR('ไม่ได้รับอนุญาต') },
      },
    },

    '/api/v1/push/tokens': {
      get: {
        tags: ['Push'],
        summary: 'ดู token ที่ลงทะเบียนไว้ (debug)',
        responses: { 200: { description: 'รายการ token' }, 401: ERR('ไม่ได้รับอนุญาต') },
      },
    },

    '/api/v1/push/test': {
      post: {
        tags: ['Demo'],
        summary: 'ยิง push ทดสอบไปทุก token',
        description: 'ใช้ **DEMO_API_KEY**',
        responses: { 200: { description: 'ยิงแล้ว' }, 401: ERR('ต้องใช้ DEMO_API_KEY') },
      },
    },

    '/api/v1/demo/fire': {
      post: {
        tags: ['Demo'],
        summary: '⚠️ จำลองการล้ม — ข้าม ML ไปสร้าง event จริง',
        description:
          'ใช้ **DEMO_API_KEY** · สร้าง fall event, เริ่มจับเวลา, สร้าง alert ให้แอป, ยิง push ' +
          `· ถ้าไม่มีใครกดรับทราบภายใน ${ackTimeout} วินาที **ระบบจะโทรออกจริง** (เมื่อ TWILIO_MODE=real)`,
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  device_id: { type: 'string', default: 'esp32-demo-01', description: 'ต้องตรงกับ devices.code ที่ผูกกับบ้านแล้ว ไม่งั้น alert จะไม่โผล่ในแอป' },
                  location:  { type: 'string', default: 'ห้องนอนผู้สูงอายุ' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'สร้าง event แล้ว หรือติด cooldown',
            content: {
              'application/json': {
                examples: {
                  สร้างแล้ว: { value: { event_id: 'e6b1…', is_fall: true, confidence: 0.973, action: 'awaiting_acknowledge', ack_timeout_seconds: ackTimeout, timestamp: '2026-09-02T04:00:00.000Z' } },
                  ติดcooldown: { value: { is_fall: true, action: 'cooldown', message: 'device อยู่ใน cooldown — ไม่สร้าง event ใหม่' } },
                },
              },
            },
          },
          401: ERR('ต้องใช้ DEMO_API_KEY'),
        },
      },
    },

    '/api/v1/admin/login': {
      post: {
        tags: ['Admin'],
        summary: 'เข้าสู่ระบบ admin',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: { username: { type: 'string' }, password: { type: 'string', format: 'password' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'ได้ token — เอาไปกด Authorize', content: { 'application/json': { example: { token: 'a766d6…', expires_at: '2026-09-02T12:00:00.000Z', username: 'admin' } } } },
          401: ERR('username หรือ password ไม่ถูกต้อง'),
          429: ERR('ลองผิดเกินกำหนด รอสักครู่'),
          503: ERR('ยังไม่ได้ตั้ง ADMIN_USERNAME / ADMIN_PASSWORD_HASH'),
        },
      },
    },

    '/api/v1/admin/logout': {
      post: {
        tags: ['Admin'],
        summary: 'ออกจากระบบ',
        security: [{ adminToken: [] }],
        responses: { 200: { description: 'ออกแล้ว' }, 401: ERR('token ไม่ถูกต้องหรือหมดอายุ') },
      },
    },

    '/api/v1/admin/summary': {
      get: {
        tags: ['Admin'],
        summary: 'ตัวเลขสรุปของ Dashboard',
        description: 'คำนวณฝั่งเซิร์ฟเวอร์ทั้งหมด · "สัปดาห์นี้" = ย้อนหลัง 7 วันเต็ม · เวลาไทย UTC+7',
        security: [{ adminToken: [] }],
        responses: {
          200: {
            description: 'ตัวเลขสรุป — has_data แยก "ไม่มีข้อมูล" ออกจาก "มีแต่เป็นศูนย์"',
            content: {
              'application/json': {
                example: {
                  devices: { total: 2, online: 2, offline: 0, has_data: true, offline_after_minutes: 15 },
                  falls: { today: 2, week: 2, has_data: true },
                  escalation: { escalated_week: 0, falls_week: 2, rate: 0, has_data: true },
                  window: { today_from: '2026-09-01T17:00:00.000Z', week_from: '2026-08-26T04:00:00.000Z', week_definition: 'rolling_7_days', timezone: 'UTC+7' },
                  calculated_at: '2026-09-02T04:00:00.000Z',
                  truncated: false,
                },
              },
            },
          },
          401: ERR('token ไม่ถูกต้องหรือหมดอายุ'),
        },
      },
    },

    '/api/v1/admin/events': {
      get: {
        tags: ['Admin'],
        summary: 'event ทุกอุปกรณ์ พร้อมตัวกรองและแบ่งหน้า',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'เทียบกับ created_at' },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'device_id', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'acknowledged', 'escalated', 'fall'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          200: {
            description: 'รายการ event',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    events: { type: 'array', items: ADMIN_EVENT },
                    pagination: { type: 'object', properties: { total: { type: 'integer' }, limit: { type: 'integer' }, offset: { type: 'integer' }, has_more: { type: 'boolean' } } },
                    filters: { type: 'object', additionalProperties: true },
                    has_data: { type: 'boolean' },
                    calculated_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          400: ERR('status ไม่ถูกต้อง'),
          401: ERR('token ไม่ถูกต้องหรือหมดอายุ'),
        },
      },
    },

    '/api/v1/admin/events/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'รายละเอียด event พร้อมไทม์ไลน์',
        security: [{ adminToken: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'event + timeline',
            content: {
              'application/json': {
                example: {
                  id: 'e6b1…', device_id: 'ESP-0001A', status: 'acknowledged', ack_latency_seconds: 12,
                  timeline: [
                    { step: 'detected', at: '2026-09-02T04:00:00.000Z', detail: { confidence: 0.97 } },
                    { step: 'acknowledged', at: '2026-09-02T04:00:12.000Z', detail: { by: 'ตังเม', latency_seconds: 12 } },
                  ],
                },
              },
            },
          },
          404: ERR('ไม่พบ event'),
          401: ERR('token ไม่ถูกต้องหรือหมดอายุ'),
        },
      },
    },

    '/api/v1/admin/devices': {
      get: {
        tags: ['Admin'],
        summary: 'รายการอุปกรณ์พร้อมสถานะ online/offline',
        description: 'online/offline คำนวณจาก last_seen_at ฝั่งเซิร์ฟเวอร์ · อุปกรณ์ที่ไม่เคยส่งข้อมูลเลยก็ยังปรากฏ',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['online', 'offline'] } },
          { name: 'include_inactive', in: 'query', schema: { type: 'boolean', default: false }, description: 'รวมอุปกรณ์ที่ปลดการติดตั้งแล้ว' },
        ],
        responses: {
          200: {
            description: 'รายการอุปกรณ์',
            content: {
              'application/json': {
                example: {
                  devices: [{ device_id: 'ESP-0001A', label: 'Esp32 - ห้องนอน', owner_name: 'บ้านแม่', location: null, last_seen_at: '2026-09-02T03:59:00.000Z', is_active: true, installed_at: null, status: 'online', events: { total: 3, falls: 3, escalated: 1, last_fall_at: '2026-09-02T03:00:00.000Z' } }],
                  offline_after_minutes: 15,
                  has_data: true,
                  calculated_at: '2026-09-02T04:00:00.000Z',
                },
              },
            },
          },
          400: ERR('status ต้องเป็น online หรือ offline'),
          401: ERR('token ไม่ถูกต้องหรือหมดอายุ'),
        },
      },
    },
  },
}
