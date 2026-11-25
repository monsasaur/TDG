// ดีไซน์ของหน้าเข้าสู่ระบบ · สมัครใช้งาน · เริ่มต้นใช้งาน · หน้าหลัก · ตั้งค่า · การแจ้งเตือน · โปรไฟล์
// "v1" = แบบเดิม · "v2" = ตามสเปค frontend_ui_spec_admin_app.md (โทนขาว-เทา ปุ่ม Charcoal แถบเมนูล่าง)
// เปลี่ยนกลับได้บรรทัดเดียว — ตรรกะทั้งหมด (login สมัคร ดึงข้อมูล กดรับทราบ) ใช้ร่วมกันทั้งสองแบบ
export const DESIGN = "v2" as "v1" | "v2";
export const V2 = DESIGN === "v2";

// Color tokens จากสเปค (หัวข้อ 5) — ใช้ค่าเดียวกันทุกหน้า
export const TOKENS = {
  background: "#F2F3F5",
  surface: "#FFFFFF",
  primary: "#292A32",
  secondaryText: "#858891",
  border: "#E5E6E9",
  accent: "#D8C5B5",
  success: "#16A34A",
  error: "#DC2626",
} as const;

// คลาส NativeWind ของ token ข้างบน (ต้องเขียนเป็นสตริงเต็ม ๆ ให้ NativeWind อ่านเจอ)
export const V2C = {
  dark: "bg-[#292A32]",
  darkDisabled: "bg-[#9CA3AF]",
  page: "bg-[#F2F3F5]",
} as const;
