/**
 * callOutcomeService.js
 * ตามผลของสายฉุกเฉินที่ยิงออกไป แล้วอัปเดตการ์ดในแอปให้ตรงความจริง
 *
 * ทำไมต้องมี
 * -----------
 * เดิมพอระบบโทรออก การ์ดค้างที่ "โทรออกแล้ว" ตลอดไป ทั้งที่เรื่องยังไม่จบ —
 * มีคนรับสายก็ไม่รู้ ไม่มีใครรับเลยก็ไม่รู้ คนใช้จึงไม่รู้ว่าต้องทำอะไรต่อ
 *
 * ทำไมใช้วิธีถาม Twilio เป็นระยะ แทน status callback
 * --------------------------------------------------
 * status callback ต้องมี URL สาธารณะให้ Twilio ยิงกลับ ซึ่งตอน dev ในเครื่องไม่มี
 * (และตอน deploy ก็ต้องเปิด endpoint เพิ่ม) — การถามสถานะเองด้วย REST ใช้ได้ทั้งสองที่
 * โดยไม่ต้องเปิดอะไรเพิ่ม และข้อมูลที่ได้เป็นของจริงจาก Twilio เหมือนกัน
 *
 * สรุปว่า "รับสาย" เมื่อ Twilio บอกสถานะ in-progress (ยกสายแล้ว) หรือ completed ที่คุยนานกว่า 0 วินาที
 * ไม่มีใครรับ = ทุกสายจบด้วย no-answer / busy / failed / canceled
 */

const appAlertService = require("./appAlertService");

/** ถามสถานะทุกกี่มิลลิวินาที */
const POLL_MS = Number(process.env.CALL_POLL_MS || 5000);
/** เลิกตามหลังจากกี่มิลลิวินาที (กันค้างถ้า Twilio ไม่ตอบ) */
const GIVE_UP_MS = Number(process.env.CALL_POLL_TIMEOUT_MS || 5 * 60 * 1000);

const FINAL = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

/** งานที่กำลังตามอยู่ — กันตามซ้ำถ้า escalate ซ้ำด้วยเหตุการณ์เดียวกัน */
const watching = new Set();

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !sid.startsWith("AC")) return null;
  return require("twilio")(sid, token);
}

/** ชื่อที่เอาไปแสดงในการ์ด — มีชื่อผู้ติดต่อก็ใช้ชื่อ ไม่มีก็ใช้เบอร์ */
function label({ name, to }) {
  if (name && to) return `${name} (${to})`;
  return name || to || "ผู้ติดต่อฉุกเฉิน";
}

/**
 * ตามผลของสายทั้งชุดจนจบ แล้วอัปเดตการ์ดครั้งเดียวตอนทุกสายจบแล้ว
 * (ตามที่ตกลงไว้: สรุปผลหลังคนที่รับคนสุดท้ายวางสาย)
 * @param {string} event_id
 * @param {{sid: string, to: string, name?: string|null}[]} calls
 */
async function watch(event_id, calls) {
  if (!event_id || !Array.isArray(calls) || calls.length === 0) return;
  if (watching.has(event_id)) return;

  const client = getClient();
  if (!client) return; // โหมด fake / ยังไม่ได้ตั้ง Twilio — ไม่มีอะไรให้ตาม

  watching.add(event_id);
  const started = Date.now();
  // เก็บผลล่าสุดของแต่ละสาย
  const state = new Map(calls.map((c) => [c.sid, { ...c, status: "queued", answered: false, seconds: 0 }]));

  try {
    while (Date.now() - started < GIVE_UP_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));

      await Promise.all(
        [...state.values()].map(async (c) => {
          if (FINAL.has(c.status)) return;
          try {
            const call = await client.calls(c.sid).fetch();
            c.status = call.status;
            c.seconds = Number(call.duration || 0);
            // in-progress = ปลายสายยกหูแล้ว · completed ที่คุยนานกว่า 0 วินาที ก็ถือว่ารับ
            if (call.status === "in-progress" || (call.status === "completed" && c.seconds > 0)) {
              c.answered = true;
            }
          } catch (err) {
            console.error(`❌ [CALL] อ่านสถานะสาย ${c.sid} ไม่ได้:`, err.message);
          }
        }),
      );

      if ([...state.values()].every((c) => FINAL.has(c.status))) break;
    }

    const all = [...state.values()];
    const answered = all.filter((c) => c.answered);
    const summary = answered.length
      ? `รับสายโดย ${answered.map(label).join(", ")}`
      : `โทรครบ ${all.length} เบอร์ ไม่มีใครรับสาย`;
    console.log(`📞 [CALL] event=${event_id} → ${summary}`);

    await appAlertService.markCallOutcome(event_id, {
      answered: answered.map((c) => ({ who: label(c), seconds: c.seconds })),
      total: all.length,
      unanswered: all.filter((c) => !c.answered).map((c) => ({ who: label(c), status: c.status })),
    });
  } finally {
    watching.delete(event_id);
  }
}

module.exports = { watch, _label: label };
