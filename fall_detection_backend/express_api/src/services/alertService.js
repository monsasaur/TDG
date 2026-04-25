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

function recipients() {
  return (process.env.ALERT_PHONES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

module.exports = {
  // SMS — ใช้ตอน escalation (ไม่มีการตอบรับภายใน timeout)
  sendSms: async ({ device_id, location, confidence, event_id }) => {
    const phones = recipients();
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
  makeCall: async ({ location, event_id }) => {
    const phones = recipients();
    if (phones.length === 0) return { skipped: true };

    const voiceMessage = `ตรวจพบเหตุการณ์ล้มในบริเวณ ห้องนั่งเล่น ที่กลุ่มบ้าน บ้านไซม่อนคุง โปรดตรวจสอบความปลอดภัยและเข้าช่วยเหลือทันที `;

    // === Fake mode — log แทนการยิงจริง ===
    if (isFakeMode()) {
      for (const to of phones) {
        fakeBox("📞 TWILIO VOICE CALL (simulated)", [
          `From    : ${process.env.TWILIO_PHONE || "+1xxxxxxxxxx"}`,
          `To      : ${to}`,
          `Event   : ${event_id}`,
          `Lang    : th-TH`,
          "─── TwiML Say ───",
          `"${voiceMessage}"`,
          `(ซ้ำอีก 1 ครั้ง)`,
        ]);
      }
      console.log(
        `✅ Calls (fake) made ${phones.length}/${phones.length} (event=${event_id})`,
      );
      return { made: phones.length, failed: 0, mode: "fake" };
    }

    if (!twilioReady()) {
      console.log("⚠️  Twilio not configured — skip call");
      return { skipped: true };
    }

    const results = await Promise.allSettled(
      phones.map((to) =>
        getClient().calls.create({
          twiml: `
              <Response>
                <Say language="th-TH" voice="Google.th-TH-Chirp3-HD-Kore">${voiceMessage}</Say>
                <Pause length="1"/>
                <Say language="th-TH" voice="Google.th-TH-Chirp3-HD-Kore">ย้ำ ${voiceMessage}</Say>
              </Response>
            `,
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
    console.log(`✅ Calls made ${made}/${phones.length} (event=${event_id})`);
    return { made, failed: failed.length };
  },
};
