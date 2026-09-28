require("dotenv").config();
const aiVoiceAgentService = require("./src/services/aiVoiceAgentService");

async function runTest() {
  console.log("=== เริ่มการทดสอบระบบ AI ร่างข้อความ ===");

  // 1. กำหนดข้อมูลจำลอง (Mock Event)
  const mockEvent = {
    location: "ห้องน้ำชั้น 1",
    device_id: "ESP32-001",
    house_name: "บ้านไซม่อนคุง",
  };

  // 2. ปริ้นท์ข้อมูลที่จะส่งให้ AI ดูเพื่อยืนยัน Input
  console.log("\n📥 ข้อมูลเหตุการณ์ที่ส่งให้ AI:");
  console.log(`- สถานที่ (location): ${mockEvent.location}`);
  console.log(`- ชื่อบ้าน (house_name): ${mockEvent.house_name}`);
  console.log(`- รหัสอุปกรณ์ (device_id): ${mockEvent.device_id}`);

  console.log("\n⏳ กำลังรอให้ AI ประมวลผลและเรียบเรียงประโยค...");

  try {
    // แจ้งเตือนหากลืมเปิดสวิตช์ AI ใน .env
    if (process.env.AI_VOICE_ENABLED === "false") {
      console.warn(
        "⚠️ สังเกต: ตัวแปร AI_VOICE_ENABLED ใน .env เป็น false ระบบจะบังคับใช้ Fallback เสมอ",
      );
    }

    const message = await aiVoiceAgentService.generateCallMessage(mockEvent);

    // 3. ตรวจสอบ Output ที่ AI ตอบกลับมา
    if (message) {
      console.log(
        "\n✅ ทดสอบสำเร็จ! AI แต่งข้อความโดยดึงข้อมูลไปใช้ได้ตามนี้:",
      );
      console.log("--------------------------------------------------");
      console.log(message);
      console.log("--------------------------------------------------\n");
    } else {
      console.log("\n⚠️ AI คืนค่าเป็น null (ถอยกลับไปใช้ Fallback แบบตายตัว)");
      console.log(
        "สาเหตุที่เป็นไปได้: หมดเวลา Timeout, ข้อความมีอักขระต้องห้าม (<, >, &), หรือ API ขัดข้อง",
      );
    }
  } catch (error) {
    console.error("\n❌ เกิดข้อผิดพลาด:", error.message);
  }
}

runTest();
