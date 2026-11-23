/**
 * เบอร์มือถือไทย ↔ รูปแบบที่ Supabase Auth ใช้ (E.164)
 *
 * ช่องกรอกเบอร์ในแอปล็อกรหัสประเทศไว้ที่ +66 (components/PhoneInput.tsx)
 * และหน้า welcome รับเฉพาะเบอร์ที่ขึ้นต้นด้วย 6 8 9 (ไม่นับ 0 นำหน้า) ยาว 9 หลัก
 */

const THAI_MOBILE = /^0?([689]\d{8})$/;

/**
 * ตัดรหัสประเทศ 66 ออกจากเบอร์ที่วาง/พิมพ์มาแบบสากล (BUG-008)
 * เดิม "+66812345678" ถูกตัดเหลือ 9 หลักเป็น "668123456" = เบอร์ของคนอื่น โดยไม่มี error
 *
 * ตัดเฉพาะเมื่อแน่ใจว่าเป็นรหัสประเทศ — ไม่งั้นจะชนกับเบอร์ 06x ที่พิมพ์โดยไม่มี 0 นำหน้า ("66xxxxxxx" 9 หลัก):
 *   - มี + นำหน้า ("+66 81 234 5678" · "+660812345678")
 *   - หรือตัวเลขยาว 11 หลักขึ้นไปที่ขึ้นต้น 66 (เบอร์ไทยแบบไม่มี 0 ยาวสุด 9 หลัก จึงไม่มีทางยาวขนาดนี้)
 * เหลือ 0 นำหน้าหลังตัด ("+66 081...") ก็คงไว้ ตัวกรองถัดไปรับได้
 */
function stripCountryCode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const hadPlus = raw.trim().startsWith("+");
  if (digits.startsWith("66") && (hadPlus || digits.length >= 11)) return digits.slice(2);
  return digits;
}

/** "0812345678" · "812345678" · "081-234-5678" · "+66812345678" → "+66812345678" · ไม่ใช่มือถือไทยคืน null */
export function toE164TH(input: string): string | null {
  const m = THAI_MOBILE.exec(stripCountryCode(input));
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
 * ตัดรหัสประเทศ 66 ออกก่อน (ดู stripCountryCode) · เก็บเฉพาะตัวเลข · ตัวแรกต้องเป็น 0 6 8 9 ไม่งั้นคงค่าเดิมไว้
 * ยาวสุด 10 หลักถ้าขึ้นต้น 0 ไม่งั้น 9 — ยกเว้นขึ้นต้น 66 ยอมให้ถึง 10 หลักไว้ก่อน
 * เพราะอาจเป็นคนพิมพ์ 66812345678 ทีละตัว พอครบ 11 หลักจะถูกตัด 66 ออกเหลือ 812345678
 * (ถ้าหยุดที่ 9 หลัก = เบอร์ 066... ตามปกติ · ค้างที่ 10 หลัก toE164TH จะไม่ผ่าน หน้าจอขึ้นว่าเบอร์ไม่ถูกต้อง)
 */
export function sanitizePhoneInput(input: string, prev: string): string {
  const digits = stripCountryCode(input);
  if (digits.length === 0) return "";
  if (!VALID_FIRST_DIGITS.includes(digits[0])) return prev;
  const max = digits[0] === "0" || digits.startsWith("66") ? 10 : 9;
  return digits.slice(0, max);
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
