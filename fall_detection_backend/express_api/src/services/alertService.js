const aiVoiceAgentService = require("./aiVoiceAgentService");
require("dotenv").config();

let client = null;

function getClient() {
  if (!client) {
    const twilio = require("twilio");
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }
  return client;
}

function twilioReady() {
  return (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_ACCOUNT_SID !== "your_sid"
  );
}

function isFakeMode() {
  return (process.env.TWILIO_MODE || "real").toLowerCase() === "fake";
}

function envPhones() {
  return (process.env.ALERT_PHONES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * เบอร์ไทยในรูปแบบที่ Twilio ต้องการ (+66…)
 * "081-234-5678" · "0812345678" · "66812345678" · "+66 81 234 5678" → "+66812345678"
 * เบอร์บ้าน 9 หลัก "021234567" → "+6621234567" · อ่านไม่ออก → null (ข้ามเบอร์นั้น ไม่โทรมั่ว)
 */
function toE164TH(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (/^0[689]\d{8}$/.test(d) || /^0[2-7]\d{7}$/.test(d)) return `+66${d.slice(1)}`;
  if (/^66[689]\d{8}$/.test(d) || /^66[2-7]\d{7}$/.test(d)) return `+${d}`;
  return null;
}

function maskPhone(p) {
  return String(p).replace(/^(\+?\d{4})\d+(\d{3})$/, "$1xxxx$2");
}

/**
 * ใครต้องได้รับสาย / SMS ของเหตุการณ์นี้
 *   1) ผู้ติดต่อฉุกเฉินของบ้านที่อุปกรณ์ผูกอยู่ (กรอกในแอป)
 *   2) บ้านยังไม่มีผู้ติดต่อ / หาบ้านไม่เจอ / อ่านฐานข้อมูลไม่ได้ → ALERT_PHONES ใน .env
 *      (ถอยแบบนี้เพื่อไม่ให้เหตุฉุกเฉินเงียบ — ดีกว่าไม่โทรหาใครเลย)
 */
async function resolveRecipients(device_id) {
  let houseName = null;
  if (device_id) {
    try {
      const db = require("./dbService");
      const ctx = await db.getDeviceContext(device_id);
      houseName = ctx?.house_name || null;
      if (ctx?.house_id) {
        const contacts = await db.getHouseContactPhones(ctx.house_id);
        const phones = [...new Set(contacts.map((c) => toE164TH(c.phone)).filter(Boolean))];
        const skipped = contacts.length - contacts.filter((c) => toE164TH(c.phone)).length;
        if (skipped > 0) console.log(`⚠️  [CONTACTS] ข้ามเบอร์ที่อ่านไม่ออก ${skipped} เบอร์ (house=${ctx.house_id})`);
        if (phones.length > 0) {
          console.log(`📇 [CONTACTS] house=${ctx.house_id} → ${phones.map(maskPhone).join(", ")}`);
          return { phones, source: "house", houseName };
        }
      }
    } catch (err) {
      console.error("❌ [CONTACTS] lookup failed — ใช้ ALERT_PHONES แทน:", err.message);
    }
  }
  return { phones: envPhones(), source: "env", houseName };
}

function fakeBox(title, lines) {
  const W = 62;
  const pad = (s) => {
    const visibleLen = [...s].length;
    return s + " ".repeat(Math.max(0, W - 4 - visibleLen));
  };
  console.log("╔" + "═".repeat(W - 2) + "╗");
  console.log("║ " + pad(title) + " ║");
  console.log("╠" + "═".repeat(W - 2) + "╣");
  for (const ln of lines) console.log("║ " + pad(ln) + " ║");
  console.log("╚" + "═".repeat(W - 2) + "╝");
}

// ข้อความที่ใส่ใน TwiML ต้อง escape — ชื่อบริเวณมาจากผู้ใช้ และบทพูดมาจาก AI
// ถ้ามี & หรือ < หลุดเข้าไป XML จะเสีย Twilio ปฏิเสธทั้งสาย = ไม่มีใครได้รับโทรฉุกเฉิน (BUG-013)
function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * บทพูดตอนโทรแบบไม่ใช้ AI — ให้ผู้รับสายรู้ทันทีว่า ที่ไหน · เมื่อไร · ต้องทำอะไร
 * ชื่อบ้านหาจากอุปกรณ์ (ไม่เจอก็ข้ามไป) · เวลาเป็นเวลาไทยแบบอ่านออกเสียง "22 นาฬิกา 50 นาที"
 */
function buildFallbackMessage({ location, houseName, at, ackSeconds } = {}) {
  const when = new Date(at || Date.now());
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(Number.isNaN(when.getTime()) ? new Date() : when);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const time = mm === 0 ? `${hh} นาฬิกา` : `${hh} นาฬิกา ${mm} นาที`;

  const place = [houseName, location ? `บริเวณ${location}` : ""].filter(Boolean).join(" ");
  const where = place ? `ที่${place}` : "ในบ้าน";
  const wait = Number(ackSeconds) > 0 ? ` ภายใน ${Number(ackSeconds)} วินาที` : "";

  return (
    `เรียนผู้ติดต่อฉุกเฉิน นี่คือสายอัตโนมัติจากระบบแจ้งเตือนการล้ม ` +
    `ระบบตรวจพบว่ามีผู้สูงอายุล้ม${where} เมื่อเวลา ${time} ` +
    `และยังไม่มีผู้ดูแลกดรับทราบในแอป${wait} ` +
    `กรุณาโทรหาผู้สูงอายุ หรือเข้าไปตรวจสอบโดยด่วน ` +
    `หากมีอาการบาดเจ็บ โปรดโทรเรียกรถพยาบาลที่หมายเลข หนึ่ง หก หก เก้า`
  );
}

function buildCallTwiml(message) {
  const say = escapeXml(message);
  return `
              <Response>
                <Say language="th-TH" voice="Google.th-TH-Chirp3-HD-Kore">${say}</Say>
                <Pause length="1"/>
                <Say language="th-TH" voice="Google.th-TH-Chirp3-HD-Kore">ย้ำ ${say}</Say>
              </Response>
            `;
}

module.exports = {
  escapeXml,
  buildCallTwiml,
  buildFallbackMessage,
  toE164TH,
  resolveRecipients,

  // SMS — ใช้ตอน escalation (ไม่มีการตอบรับภายใน timeout)
  sendSms: async ({ device_id, location, confidence, event_id }) => {
    const { phones } = await resolveRecipients(device_id);
    if (phones.length === 0) {
      console.log("⚠️  ALERT_PHONES empty — skip SMS");
      return { skipped: true };
    }

    const message = [
      "🚨 Fall Alert!",
      `📍 Location   : ${location}`,
      `📟 Device     : ${device_id}`,
      `📊 Confidence : ${Math.round(confidence * 100)}%`,
      `🕐 เวลา       : ${new Date().toLocaleString("th-TH")}`,
      "",
      "⚠️ ไม่มีผู้ตอบรับในแอป กรุณาตรวจสอบผู้สูงอายุทันที",
    ].join("\n");

    // === Fake mode — log แทนการยิงจริง ===
    if (isFakeMode()) {
      for (const to of phones) {
        fakeBox("💬 TWILIO SMS (simulated)", [
          `From    : ${process.env.TWILIO_PHONE || "+1xxxxxxxxxx"}`,
          `To      : ${to}`,
          `Event   : ${event_id}`,
          "─── body ───",
          ...message.split("\n"),
        ]);
      }
      console.log(
        `✅ SMS (fake) sent ${phones.length}/${phones.length} (event=${event_id})`,
      );
      return { sent: phones.length, failed: 0, mode: "fake" };
    }

    if (!twilioReady()) {
      console.log("⚠️  Twilio not configured — skip SMS");
      return { skipped: true };
    }

    const results = await Promise.allSettled(
      phones.map((to) =>
        getClient().messages.create({
          body: message,
          from: process.env.TWILIO_PHONE,
          to,
        }),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      console.error(
        `❌ SMS: ${failed.length}/${phones.length} failed`,
        failed.map((f) => f.reason?.message),
      );
    }

    const sent = phones.length - failed.length;
    console.log(`✅ SMS sent ${sent}/${phones.length} (event=${event_id})`);
    return { sent, failed: failed.length };
  },

  // Voice Call — ใช้ตอน escalation
  // Voice Call — ใช้ตอน escalation
  makeCall: async ({ location, event_id, event }) => {
    // 👈 1. เปลี่ยนพารามิเตอร์มารับ event ทั้งก้อน
    const { phones, houseName: resolvedHouse } = await resolveRecipients(event?.device_id);
    if (phones.length === 0) return { skipped: true };

    // 2. กำหนดข้อความและวิธีตั้งต้นเป็น Fallback
    let escalationMethod = "fallback";
    // ชื่อบ้านช่วยให้ผู้รับสายรู้ว่าเป็นบ้านไหน (คนหนึ่งอาจเป็นผู้ติดต่อของหลายบ้าน) · หาไม่ได้ก็โทรต่อโดยไม่มีชื่อบ้าน
    const houseName = resolvedHouse;
    let voiceMessage = buildFallbackMessage({
      location,
      houseName,
      at: event?.created_at,
      ackSeconds: process.env.ACK_TIMEOUT_SECONDS || 60,
    });

    // 3. ลองเรียกใช้ AI ร่างข้อความตามบริบท
    if (event) {
      const aiMessage = await aiVoiceAgentService.generateCallMessage(event);
      if (aiMessage) {
        voiceMessage = aiMessage;
        escalationMethod = "ai";
      }
    }

    // === Fake mode — log แทนการยิงจริง ===
    if (isFakeMode()) {
      for (const to of phones) {
        fakeBox(
          `📞 TWILIO VOICE CALL (simulated) - Via: ${escalationMethod.toUpperCase()}`,
          [
            `From    : ${process.env.TWILIO_PHONE || "+1xxxxxxxxxx"}`,
            `To      : ${to}`,
            `Event   : ${event_id}`,
            `Lang    : th-TH`,
            "─── TwiML Say ───",
            `"${voiceMessage}"`,
            `(ซ้ำอีก 1 ครั้ง)`,
          ],
        );
      }
      console.log(
        `✅ Calls (fake) made ${phones.length}/${phones.length} (event=${event_id})`,
      );
      // 👈 4. ส่ง method กลับไปด้วย
      return {
        made: phones.length,
        failed: 0,
        mode: "fake",
        method: escalationMethod,
      };
    }

    if (!twilioReady()) {
      console.log("⚠️  Twilio not configured — skip call");
      return { skipped: true };
    }

    const results = await Promise.allSettled(
      phones.map((to) =>
        getClient().calls.create({
          twiml: buildCallTwiml(voiceMessage),
          from: process.env.TWILIO_PHONE,
          to,
        }),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      console.error(
        `❌ Call: ${failed.length}/${phones.length} failed`,
        failed.map((f) => f.reason?.message),
      );
    }

    const made = phones.length - failed.length;
    if (process.env.DEMO_LOG !== "true") {
      console.log(
        `✅ Calls made ${made}/${phones.length} (event=${event_id}, via=${escalationMethod})`,
      );
    }

    // 👈 5. ส่ง method กลับไปให้ escalationService รับไปบันทึก
    return { made, failed: failed.length, method: escalationMethod };
  },
};
