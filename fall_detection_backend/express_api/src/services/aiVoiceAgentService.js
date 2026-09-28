require("dotenv").config();

// ตั้งเวลา Timeout ตามสเปค (3 วินาที)
const AI_TIMEOUT_MS = parseInt(process.env.AI_VOICE_TIMEOUT_MS || "3000", 10);
const MAX_CHARS = parseInt(process.env.AI_VOICE_MAX_CHARS || "320", 10);

const SYSTEM_PROMPT = `คุณคือระบบ AI อัตโนมัติสำหรับโทรแจ้งเหตุฉุกเฉิน
หน้าที่ของคุณคือเรียบเรียงข้อความแจ้งเตือนผู้ดูแลเมื่อมีผู้สูงอายุล้มแล้วไม่มีการตอบรับในแอป

กฎการเขียน:
1. ให้ยึดโครงสร้างหลัก: "ตรวจพบผู้สูงอายุล้มในบริเวณ [สถานที่] ที่ [ชื่อบ้าน] กรุณาเข้าให้ความช่วยเหลือโดยด่วน"
2. สามารถปรับแต่งคำเชื่อมให้ฟังดูเป็นธรรมชาติเหมือนมนุษย์พูด
3. ห้ามแต่งเติมข้อมูลที่ไม่มีอยู่จริง ห้ามบอกเวลาเป็นตัวเลข และห้ามวินิจฉัยอาการ
4. ห้ามใส่อีโมจิ วงเล็บ เครื่องหมายพิเศษ หรือคำภาษาอังกฤษ
5. ให้ตอบเฉพาะเนื้อหาที่จะใช้อ่านออกเสียงเท่านั้น ห้ามมีคำอธิบายเพิ่มเติม`;

// ฟังก์ชันตรวจสอบความปลอดภัยก่อนส่งข้อความไป Twilio
function validateMessage(msg) {
  if (!msg) return false;
  if (msg.length > MAX_CHARS) return false;
  // ห้ามมีเครื่องหมายที่ทำให้ XML (TwiML) พังเด็ดขาด
  if (/[<>&]/.test(msg)) return false;
  // ต้องมีภาษาไทยผสมอยู่ เพื่อป้องกันการตอบเป็นภาษาอื่นล้วน
  if (!/[ก-๙]/.test(msg)) return false;
  return true;
}

async function generateCallMessage(event) {
  // สวิตช์ปิด/เปิด AI ตามสเปค ถ้าเป็น false จะข้ามไปใช้ข้อความเดิมทันที
  if (process.env.AI_VOICE_ENABLED === "false") return null;

  // เตรียมข้อมูลจาก Event (ดึงจาก location หรือ device_name ที่ได้จากฐานข้อมูล)
  let locationName = event.location || event.device_name || "ไม่ระบุตำแหน่ง";

  // ตัดคำว่า "Esp32 - " หรือ "ESP32-" ออก เพื่อให้อ่านออกเสียงเป็นธรรมชาติ
  locationName = locationName.replace(/esp32\s*-\s*/i, "").trim();

  const houseName = event.house_name || "บ้านของผู้ใช้งาน";

  const eventSummary = `ข้อมูลเหตุการณ์:\n- สถานที่: ${locationName}\n- ชื่อบ้าน: ${houseName}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(
      "https://api.opentyphoon.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TYPHOON_API_KEY}`,
        },
        body: JSON.stringify({
          model: "typhoon-v2.5-30b-a3b-instruct",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: eventSummary },
          ],
          max_tokens: 150,
          temperature: 0.2, // ลดอุณหภูมิลงให้ตอบตรงไปตรงมา ไม่เพ้อเจ้อ
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null; // ห้ามโยน Error คืน null เพื่อให้ Fallback ทำงาน
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content?.trim();

    if (validateMessage(aiMessage)) {
      return aiMessage;
    } else {
      console.warn(
        "[AI Service] ข้อความไม่ผ่าน Validation, ถอยกลับไปใช้ Fallback",
      );
      return null;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`[AI Service] เกิดข้อผิดพลาดหรือหมดเวลา: ${error.message}`);
    return null; // ปลอดภัยไว้ก่อน ถ้าพังก็โยนกลับไปหา Rule-based
  }
}

module.exports = {
  generateCallMessage,
};
