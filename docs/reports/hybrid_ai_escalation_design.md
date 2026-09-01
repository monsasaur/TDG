# Hybrid AI Escalation Call — Design Doc

**สถานะ:** แนวคิด (Phase 2) — ยังไม่ implement
**วันที่:** 2026-08-26

## ปัญหา / แรงจูงใจ

ปัจจุบัน `escalationService.js` เป็น rule-based ล้วน: ตั้ง timer คงที่ (`ACK_TIMEOUT_SECONDS`) → ถ้าไม่มีใครกด acknowledge ในแอป → ยิง Twilio SMS + Voice Call พร้อมข้อความ TTS ตายตัว (`makeCall`, `sendSms` ใน `alertService.js`)

คำถาม: ถ้าเอา AI agent มาแทน rule-based ตรงจุด "โทร" จะเป็นยังไง?

## ทางเลือกที่พิจารณา

| แนวทาง | ข้อดี | ข้อเสีย |
|---|---|---|
| A. แทนทั้งหมดด้วย AI (ตัดสินใจ escalate ด้วย AI) | ยืดหยุ่นสูง ปรับ threshold ตามบริบทได้ | Safety-critical path พึ่ง AI/API — ถ้า LLM ล่มหรือช้า = ไม่แจ้งเตือนเลย ยอมรับไม่ได้ |
| B. Rule-based ล้วนเหมือนเดิม | เร็ว, deterministic, ทดสอบง่าย, ทำงานได้แม้ไม่มีเน็ต/AI | เนื้อหาการโทรตายตัว ไม่ปรับตามสถานการณ์ |
| **C. Hybrid (เลือกแนวทางนี้)** | ได้ทั้งความน่าเชื่อถือของ rule-based + ความฉลาดของ AI ตรงจุดที่ไม่กระทบความปลอดภัย | ซับซ้อนขึ้นเล็กน้อย ต้องออกแบบ fallback ให้ดี |

## แนวทาง Hybrid (C) — สรุปหลักการ

> **ตัวกระตุ้นว่า "เมื่อไหร่ต้อง escalate" ยังคง rule-based เหมือนเดิม 100%**
> **AI agent เข้ามาช่วยเฉพาะ "เนื้อหา/การโต้ตอบตอนโทร" เท่านั้น**

เหตุผล: การตัดสินใจว่าเกิดเหตุฉุกเฉินหรือยังต้องเร็วและคาดเดาผลได้เสมอ (deterministic) — ส่วนที่ AI เพิ่มมูลค่าได้จริงคือทำให้บทสนทนาตอนโทรฉลาดขึ้น ไม่ใช่ท่องสคริปต์ซ้ำเดิม

### Flow เดิม (rule-based ล้วน)

```
Fall detected → schedule(event) [timer เริ่มนับ]
  → ไม่มี ack ภายใน ACK_TIMEOUT_SECONDS
  → escalate() → alertService.sendSms() + alertService.makeCall()
                 (TTS อ่านข้อความคงที่ ทุกครั้งเหมือนกัน)
  → dbService.markEscalated()
```

### Flow ใหม่ (hybrid)

```
Fall detected → schedule(event)              [เหมือนเดิม — rule-based]
  → ไม่มี ack ภายใน ACK_TIMEOUT_SECONDS       [เหมือนเดิม — rule-based]
  → escalate()
       ├─ sendSms()                           [เหมือนเดิม — ไม่แตะ]
       └─ makeCall():
            ├─ ลองเรียก aiVoiceAgentService.callWithAgent(event)
            │     - LLM ร่าง/ปรับบทพูดตามบริบท (location, confidence, เวลา)
            │     - โต้ตอบกับผู้ดูแลได้ (เช่น ผู้ดูแลถามซ้ำ "ล้มตรงไหนนะ")
            │     - timeout สั้น (เช่น 3-5 วิ) ถ้า AI service ไม่ตอบทัน
            │
            └─ ถ้า AI agent fail/timeout/error ➜ FALLBACK ทันที
                  → alertService.makeCall() เดิม (TTS ข้อความคงที่)
                  [ไม่มีทางที่ผู้ใช้จะไม่ได้รับสายเพราะ AI ล่ม]
  → dbService.markEscalated({ call_made, via: "ai" | "fallback" })
```

> ✅ **สเปคสำหรับ implement Phase 2a เขียนเสร็จแล้ว** → [`spec_hybrid_ai_escalation_phase2a.md`](spec_hybrid_ai_escalation_phase2a.md)
> คำถามเปิด 5 ข้อด้านล่างตอบครบแล้วในสเปคนั้น รวมถึงข้อสรุปว่า **ไม่ต้องหา Thai TTS provider ใหม่**

## ส่วนที่ต้องเพิ่ม/แก้ (เมื่อจะ implement จริง)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `escalationService.js` | **ไม่แก้ trigger logic** (schedule/cancel/timer เดิมทั้งหมด) แก้แค่จุดเรียก `makeCall` ให้ลอง AI ก่อนแล้ว fallback |
| `services/aiVoiceAgentService.js` (ใหม่) | ห่อ LLM (ร่างบทพูด) + Text-to-Speech ภาษาไทย + ต่อสายผ่าน Twilio (`<Gather>`/`<Connect>` ของ TwiML แทน `<Say>` แบบ static) |
| `dbService.js` | เพิ่ม field `escalation_method` ('ai' / 'fallback') ใน log เพื่อ track ว่าตอนไหนใช้ AI สำเร็จ/fail |
| Twilio webhook | ต้องเพิ่ม endpoint รับ speech-to-text จากฝั่งผู้ดูแล ถ้าจะให้โต้ตอบสองทางจริง (ไม่ใช่แค่พูดฝ่ายเดียว) |

## ความเสี่ยง / คำถามที่ต้องตอบก่อน implement

1. **Latency** — AI agent ต้อง respond ภายในกี่วินาทีก่อนตัด fallback? (แนะนำ ≤ 3-5 วิ เพราะเป็นสายฉุกเฉิน)
2. **ภาษาไทย** — TTS/LLM provider ไหนรองรับเสียงไทยธรรมชาติและเร็วพอ (ต้องทดสอบจริง ไม่ใช่แค่ demo)
3. **ค่าใช้จ่าย** — ต้นทุนต่อสาย (LLM + TTS + Twilio) เทียบกับ static TTS เดิมที่แทบไม่มีต้นทุนเพิ่ม
4. **การทดสอบ** — ต้องมี test case จำลอง "AI agent ไม่ตอบสนอง" เพื่อยืนยันว่า fallback ทำงานจริงทุกครั้ง (ห้ามมี edge case ที่ไม่มีใครได้รับสายเลย)
5. **Privacy** — ข้อมูลผู้ป่วย/ตำแหน่งที่ล้ม ส่งไป LLM API ภายนอก ต้องพิจารณานโยบายข้อมูลส่วนบุคคล

## Phase 2b (แผนอนาคต — มีเงื่อนไข): trigger ก็อาจเป็น AI-assisted ได้

Phase 2a (ด้านบน) คือขั้นแรกที่จะทำ — AI ช่วยแค่เนื้อหาการโทร ส่วน trigger ยังเป็น rule-based ล้วน

ในอนาคต **ถ้า** เก็บข้อมูล/routine ทดสอบได้มากพอจนมั่นใจว่า AI จะไม่ hallucinate ก็มีแผนขยับให้ AI agent เข้ามาช่วย "ตัดสินใจว่าเมื่อไหร่ต้อง escalate" ด้วยเหมือนกัน — แต่ต้องผ่านเกณฑ์ความน่าเชื่อถือก่อนเสมอ ไม่ใช่สลับไปใช้ AI ทันทีที่มี API

### ทำไมถึงจะดีขึ้น (ถ้าผ่านเกณฑ์แล้ว)

- **ลด false alarm** — กฎตายตัวคือไม่มี ack ใน 60 วิ = escalate ทันที แต่ AI ที่ดูสัญญาณ CSI ต่อเนื่องได้ อาจเห็นว่าคนลุกขึ้นเดินต่อได้เองหลังล้ม (ไม่ได้บาดเจ็บจริง) แล้วชะลอ/ยกเลิกการโทรฉุกเฉินได้ ลดการโทรก่อกวนที่ไม่จำเป็น
- **ปรับตามบริบทแต่ละบ้าน/แต่ละคน** — บางคนเดินไปหยิบมือถือช้าโดยธรรมชาติ (ไม่ได้เป็นอะไร) แต่กฎตายตัวจะ escalate เหมือนกันหมดทุกคนที่ 60 วิ AI ที่เรียนรู้ pattern เฉพาะบ้าน/เฉพาะคนได้ จะลดการแจ้งเตือนพลาดแบบนี้ลง
- **ตัดสินใจไวขึ้นในเคสที่ชัดเจนว่าอันตราย** — ถ้าสัญญาณบ่งชี้ชัดว่าล้มแรงและนิ่งสนิทไม่ขยับเลย AI อาจลด waiting time ลงจาก 60 วิ แทนที่จะรอครบเวลาตายตัวเสมอ

### เกณฑ์ก่อนอนุญาตให้ AI แตะ trigger จริง (Shadow Mode)

1. รัน AI agent แบบ **shadow mode** ก่อน — ให้ AI ตัดสินใจคู่กับ rule-based ทุกครั้ง แต่ **log ไว้เฉยๆ ไม่ให้สั่งอะไรจริง** (rule-based ยังเป็นคนสั่งการทั้งหมด)
2. เก็บข้อมูลเปรียบเทียบ AI vs rule-based vs ground truth (สอบถามผู้ใช้จริงว่าตอนนั้นล้มจริงไหม/อันตรายแค่ไหน) จำนวนเคสมากพอ (ต้องกำหนดจำนวนขั้นต่ำ เช่น ≥ N เคสต่อเนื่องไม่มี false negative เลย)
3. ผ่านเกณฑ์แล้วค่อยเปิดให้ AI มีสิทธิ์ปรับ (ไม่ใช่แทนที่) เวลารอ/ตัดสินใจ escalate แบบจำกัดขอบเขต — และยังต้องมี rule-based เป็น hard limit เผื่อกัน (เช่น ห้ามรอเกิน 90 วิ ไม่ว่า AI จะบอกอะไร)

### สรุป

Hybrid = **Phase 2a: rule-based ตัดสินใจ escalate (ไม่แตะ) + AI agent ช่วยเฉพาะเนื้อหาการโทร พร้อม fallback แบบ rule-based เดิมเสมอ** → **Phase 2b (มีเงื่อนไข): เปิดให้ AI ช่วยปรับ trigger ได้ทีละน้อย หลังพิสูจน์ผ่าน shadow mode แล้วเท่านั้น** — เป็นแนวทางที่ได้ประโยชน์จาก AI โดยไม่ยอมแลกกับความน่าเชื่อถือของระบบแจ้งเตือนฉุกเฉิน ซึ่งเป็นหัวใจของโปรเจกต์นี้

ดูสถานะ Phase 2 โดยรวมได้ที่ [project_status_summary.md](project_status_summary.md)
