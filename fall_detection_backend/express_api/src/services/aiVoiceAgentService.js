require("dotenv").config();

// ตั้งเวลา Timeout ตามสเปค (3 วินาที)
const AI_TIMEOUT_MS = parseInt(process.env.AI_VOICE_TIMEOUT_MS || "3000", 10);
const MAX_CHARS = parseInt(process.env.AI_VOICE_MAX_CHARS || "320", 10);

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยของระบบตรวจจับการล้มของผู้สูงอายุ
หน้าที่เดียวของคุณคือเรียบเรียงข้อความสำหรับ "โทรแจ้งเหตุฉุกเฉิน" ให้ผู้ดูแล

สถานการณ์: ระบบตรวจพบว่าผู้สูงอายุอาจล้ม และไม่มีผู้ดูแลคนใดกดรับทราบในแอป
ภายในเวลาที่กำหนด ระบบจึงโทรออกเป็นขั้นต่อไป

ข้อความของคุณจะถูกเครื่องอ่านออกเสียงทางโทรศัพท์ ผู้ฟังคือคนที่อาจกำลังหลับ
กำลังขับรถ หรือกำลังทำอย่างอื่น และจะได้ฟังเพียงครั้งเดียว

สิ่งที่ต้องมีให้ครบ
- เกิดอะไรขึ้น: ระบบตรวจพบว่าอาจมีการล้ม
- ที่ไหน: ชื่อห้องและชื่อบ้านตามข้อมูลที่ได้รับ
- ให้ทำอะไรต่อ: ขอให้เข้าไปตรวจสอบโดยเร็ว

กฎการเขียน
- ภาษาไทยทั้งหมด สุภาพ ชัดเจน น้ำเสียงเร่งด่วนแต่ไม่ทำให้ตื่นตระหนก
- ไม่เกินสองประโยค และไม่เกิน 320 ตัวอักษร
- เขียนให้ฟังรู้เรื่องเมื่ออ่านออกเสียง ไม่ใช่เขียนให้อ่านด้วยตา
- ตัวเลขทุกตัวเขียนเป็นคำอ่าน เช่น "ชั้นหนึ่ง" ไม่ใช่ "ชั้น 1"
- ห้ามใช้อีโมจิ วงเล็บ วงเล็บเหลี่ยม เครื่องหมายคำพูด ขีดกลาง
  หรือเครื่องหมาย น้อยกว่า มากกว่า และ แอมเพอร์แซนด์
- ห้ามมีคำภาษาอังกฤษหรืออักษรโรมันแม้แต่ตัวเดียว
- ตอบเฉพาะข้อความที่จะอ่านออกเสียง ห้ามมีคำนำ คำอธิบาย หรือหัวข้อ

ข้อห้ามเด็ดขาด
- ห้ามบอกว่าผ่านไปนานเท่าไร เพราะระบบโทรทันทีที่หมดเวลารับทราบ
  ระยะเวลาจึงเท่ากันทุกสาย พูดไปก็ไม่ได้ข้อมูลเพิ่ม
- ห้ามวินิจฉัยอาการ ห้ามคาดเดาความรุนแรง ห้ามให้คำแนะนำทางการแพทย์
- ห้ามรับปากแทนใครว่าจะมีคนไปถึงเมื่อไร หรือว่ามีใครกำลังไป
- ห้ามยืนยันว่าล้มแน่นอน ระบบแค่ตรวจพบว่าอาจล้ม ให้ใช้คำที่เปิดช่องว่าอาจไม่ใช่
- ห้ามเพิ่มข้อมูลที่ไม่ได้รับมา เช่น ชื่อคน อายุ เบอร์โทร หรือที่อยู่
- ถ้าข้อมูลสถานที่ไม่ชัดหรือไม่ระบุ ให้บอกว่าไม่ทราบตำแหน่ง
  ห้ามเดาชื่อห้องขึ้นมาเอง`;

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

/** เปิดใช้ AI อยู่ไหม — ต้องตั้ง AI_VOICE_ENABLED=true ชัดเจนเท่านั้น */
function isEnabled() {
  return process.env.AI_VOICE_ENABLED === "true";
}

async function generateCallMessage(event) {
  // ปิดเป็นค่าเริ่มต้นโดยตั้งใจ — ต้องตั้ง AI_VOICE_ENABLED=true ชัดเจนถึงจะทำงาน
  //
  // เดิมเขียนว่า `=== "false"` ซึ่งปิดเฉพาะเมื่อตั้งค่าเป็นสตริง "false" เป๊ะ
  // ถ้าไม่ได้ตั้งตัวแปรนี้เลย (สภาพของ production ตอน deploy ใหม่) จะกลายเป็นเปิด
  // = AI ทำงานทันทีโดยไม่มีใครตัดสินใจ ผิดเจตนาของสเปคที่ต้องการให้ deploy ได้
  // โดยพฤติกรรมไม่เปลี่ยน แล้วค่อยเปิดเมื่อทดสอบผ่าน
  if (!isEnabled()) return null;

  // ไม่มีคีย์ = ไม่ต้องเสียเวลายิง ถ้าไม่เช็คจะส่ง "Bearer undefined" ออกไป
  // แล้วรอ 401 กลับมา กินเวลาถึง 3 วินาทีของหน้าต่าง escalation ทุกสายเปล่า ๆ
  if (!process.env.TYPHOON_API_KEY) {
    console.warn("[AI Service] ไม่ได้ตั้ง TYPHOON_API_KEY — ใช้ข้อความคงที่");
    return null;
  }

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
  isEnabled,
};
