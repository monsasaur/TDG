require("dotenv").config();

async function checkModels() {
  try {
    const response = await fetch("https://api.opentyphoon.ai/v1/models", {
      headers: { Authorization: `Bearer ${process.env.TYPHOON_API_KEY}` },
    });

    const data = await response.json();
    console.log("🔍 ข้อมูลที่ API ตอบกลับมาแบบดิบๆ:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("❌ ดึงข้อมูลไม่ได้:", err.message);
  }
}

checkModels();
