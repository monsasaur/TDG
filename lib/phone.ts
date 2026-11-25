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

/**
 * ปิดเลขกลางของเบอร์คนอื่น — "0912345678" → "091-XXX-5678" (เห็นหน้า 3 หลัง 4)
 * ใช้กับเบอร์ที่ไม่ใช่ของเจ้าของเครื่อง เช่นรายชื่อสมาชิกในบ้าน
 * เบอร์ของตัวเองให้แสดงเต็มด้วย formatThaiPhone ตามเดิม
 */
export function maskThaiPhone(value: string | null | undefined): string {
  const formatted = formatThaiPhone(value);
  const parts = formatted.split("-");
  if (parts.length !== 3) return formatted;
  return `${parts[0]}-XXX-${parts[2]}`;
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

// ── เบอร์ผู้ติดต่อฉุกเฉิน ─────────────────────────────────────────
// ต่างจากเบอร์ login: ผู้ติดต่ออาจเป็นเบอร์บ้านได้ ไม่ใช่มือถือเสมอ
// เก็บในฐานแบบเลขในประเทศล้วน "0812345678" / "021234567" ให้ทุกแถวรูปแบบเดียวกัน
// (เดิมเก็บตัวเลขอะไรก็ได้ 1–20 หลัก วาง +66 มาก็ได้ "66812345678")
// เบอร์สั้นอย่าง 1669 ยังไม่รับ — Twilio โทรเบอร์สั้นของไทยไม่ได้ (รอ PM ตัดสินใจ)

const CONTACT_MOBILE = /^0?([689]\d{8})$/; // มือถือ 10 หลัก · พิมพ์ไม่มี 0 นำหน้าก็รับ
const CONTACT_LANDLINE = /^0[2-7]\d{7}$/; // เบอร์บ้าน 9 หลัก (02 กรุงเทพ · 03x–07x ต่างจังหวัด)

export const CONTACT_PHONE_ERROR = "กรอกเบอร์มือถือ 10 หลัก หรือเบอร์บ้าน 9 หลัก ขึ้นต้นด้วย 0";

// ตัด +66 / 66 แล้วเติม 0 กลับ — "+66 81-234-5678" → "0812345678" · "+66 2 123 4567" → "021234567"
function toNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  const stripped = stripCountryCode(input);
  return stripped !== digits && !stripped.startsWith("0") ? `0${stripped}` : stripped;
}

/**
 * ตัวกรองช่องเบอร์ผู้ติดต่อฉุกเฉิน (หน้าเพิ่ม / แก้ผู้ติดต่อ)
 * ตัด +66 แล้วเติม 0 · เก็บเฉพาะตัวเลข · ยาวสุด 10 หลัก
 * คนพิมพ์ 66812345678 ทีละตัว: ค้างที่ 10 หลักก่อน พอหลักที่ 11 มาจะถูกตัด 66 เหลือ 0812345678
 * ตรวจว่าเป็นเบอร์ที่ใช้ได้ตอนกดบันทึก (normalizeContactPhone) ไม่ใช่ระหว่างพิมพ์
 */
export function sanitizeContactPhoneInput(input: string): string {
  return toNationalDigits(input).slice(0, 10);
}

/** เบอร์ผู้ติดต่อที่จะบันทึก "0812345678" / "021234567" · ไม่ใช่มือถือหรือเบอร์บ้านไทยคืน null */
export function normalizeContactPhone(input: string): string | null {
  const d = toNationalDigits(input);
  const mobile = CONTACT_MOBILE.exec(d);
  if (mobile) return `0${mobile[1]}`;
  if (CONTACT_LANDLINE.test(d)) return d;
  return null;
}

/**
 * แสดงเบอร์ผู้ติดต่อ: มือถือ "081-234-5678" · กรุงเทพ "02-123-4567" · ต่างจังหวัด "053-123-456"
 * แถวเก่าที่อ่านไม่ออก (เช่นเบอร์ 1 หลักที่บันทึกไว้ก่อนมีการตรวจ) แสดงตามที่เก็บไว้
 */
export function formatContactPhone(value: string | null | undefined): string {
  if (!value) return "";
  const n = normalizeContactPhone(value);
  if (!n) return value;
  if (n.length === 10) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  if (n.startsWith("02")) return `${n.slice(0, 2)}-${n.slice(2, 5)}-${n.slice(5)}`;
  return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
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
