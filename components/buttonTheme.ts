// ชุดสีของปุ่มหลักในแอป — "pink" = แบบเดิม · "gray" = แบบลองใหม่
// เปลี่ยนกลับได้ที่ BUTTON_THEME บรรทัดเดียว
//
// ⚠️ ต้องเขียนชื่อคลาสเต็ม ๆ เป็นข้อความตายตัว (NativeWind อ่านคลาสจากซอร์สตอน build
//    ประกอบสตริงสีแบบ `bg-[${สี}]` จะไม่ได้สี) และไฟล์ต้องอยู่ใน components/ ที่ tailwind สแกน
//
// ไม่รวม: ปุ่มลบ · ข้อความ error · การ์ดแจ้งเตือนฉุกเฉิน — สีแดงตรงนั้นบอกความหมาย (อันตราย/ด่วน) คงไว้
const BUTTON_THEMES = {
  pink: {
    solid: "bg-[#FF3055]",          // ปุ่มหลักที่กดได้
    solidSoft: "bg-[#FFD4DC]",      // ปุ่มหลักที่ยังกดไม่ได้ (โทนอ่อน)
    solidMuted: "bg-[#F0D9DD]",     // ปุ่มหลักที่ยังกดไม่ได้ (หน้าเข้าสู่ระบบ/สมัคร)
    solidDim: "bg-[#C56E76]",       // ปุ่มบันทึกที่ยังไม่มีอะไรเปลี่ยน
    textOnSoft: "text-[#FFF6F8]",
    outline: "border-[#FF3055]",
    outlineText: "text-[#FF3055]",
  },
  gray: {
    solid: "bg-[#4B5563]",
    solidSoft: "bg-[#D1D5DB]",
    solidMuted: "bg-[#E5E7EB]",
    solidDim: "bg-[#9CA3AF]",
    textOnSoft: "text-[#F9FAFB]",
    outline: "border-[#4B5563]",
    outlineText: "text-[#4B5563]",
  },
} as const;

export const BUTTON_THEME: keyof typeof BUTTON_THEMES = "gray";
export const BTN = BUTTON_THEMES[BUTTON_THEME];
