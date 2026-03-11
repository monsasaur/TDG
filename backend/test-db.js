require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkUsersData() {
  try {
    console.log("⏳ กำลังเชื่อมต่อฐานข้อมูล...");
    await client.connect();
    
    // เปลี่ยนคำสั่ง SQL เป็นการดึงข้อมูลจากตาราง users
    const result = await client.query('SELECT * FROM users');
    
    console.log("✅ เชื่อมต่อสำเร็จ! นี่คือข้อมูลในตาราง users ของคุณ:");
    
    // แสดงผลข้อมูลในรูปแบบตารางให้อ่านง่าย
    console.table(result.rows);
    
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาด:", err.message);
  } finally {
    await client.end();
  }
}

checkUsersData();