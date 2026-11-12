/**
 * เบอร์มือถือไทย ↔ รูปแบบที่ Supabase Auth ใช้ (E.164)
 *
 * ช่องกรอกเบอร์ในแอปล็อกรหัสประเทศไว้ที่ +66 (components/PhoneInput.tsx)
 * และหน้า welcome รับเฉพาะเบอร์ที่ขึ้นต้นด้วย 6 8 9 (ไม่นับ 0 นำหน้า) ยาว 9 หลัก
 */

const THAI_MOBILE = /^0?([689]\d{8})$/;

/** "0812345678" · "812345678" · "081-234-5678" → "+66812345678" · ไม่ใช่มือถือไทยคืน null */
export function toE164TH(input: string): string | null {
  const m = THAI_MOBILE.exec(input.replace(/\D/g, ""));
  return m ? `+66${m[1]}` : null;
}

/**
 * แสดงผลแบบไทย "081-234-5678"
 * รับได้ทั้ง "+66812345678" และ "66812345678" (Supabase เก็บ user.phone แบบไม่มี +)
 */
export function formatThaiPhone(value: string | null | undefined): string {
  if (!value) return "";
  const d = value.replace(/\D/g, "");
  const local = d.startsWith("66") ? `0${d.slice(2)}` : d.startsWith("0") ? d : `0${d}`;
  if (local.length !== 10) return local;
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

const VALID_FIRST_DIGITS = ["0", "6", "8", "9"];

/**
 * ตัวกรองช่องกรอกเบอร์ (ใช้ร่วมกันหน้า welcome / login / register)
 * เก็บเฉพาะตัวเลข · ตัวแรกต้องเป็น 0 6 8 9 ไม่งั้นคงค่าเดิมไว้ · ยาวสุด 10 หลักถ้าขึ้นต้น 0 ไม่งั้น 9
 */
export function sanitizePhoneInput(input: string, prev: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (!VALID_FIRST_DIGITS.includes(digits[0])) return prev;
  return digits.slice(0, digits[0] === "0" ? 10 : 9);
}

/**
 * เบอร์ที่พิมพ์ไว้หน้า welcome — ส่งต่อให้หน้า login / register
 * เก็บในหน่วยความจำแทนการใส่ใน route params เพราะบนเว็บ params กลายเป็น URL (ติดประวัติเบราว์เซอร์)
 */
let draftPhone = "";
export function rememberPhone(digits: string): void {
  draftPhone = digits;
}
export function rememberedPhone(): string {
  return draftPhone;
}
