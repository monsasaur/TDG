/**
 * OTP ของขั้นตอนสมัครใช้งาน — **โหมดจำลองในเครื่อง ยังไม่ได้ส่ง SMS จริง**
 *
 * ทำไมถึงจำลอง: Supabase ปิด "Enable phone confirmations" ไว้ และ Twilio ของทีม
 * ยังส่ง SMS เข้าเบอร์ไทยไม่ได้ (ดู contexts/AuthContext.tsx) — ยิง /auth/v1/otp ตอนนี้ได้
 * `otp_disabled` กลับมา flow จึงเดินต่อไม่ได้ถ้าผูกกับของจริงเลย
 *
 * รหัสเก็บอยู่ในหน่วยความจำของแอปเท่านั้น (ปิดแอป = หาย) และหน้า OTP แสดงรหัสบนจอ
 * ให้กรอก — ห้ามใช้แบบนี้ใน production
 *
 * ตอนเปลี่ยนเป็นของจริง: แทน issueOtp ด้วย supabase.auth.signInWithOtp({ phone })
 * และ verifyOtp ด้วย supabase.auth.verifyOtp({ phone, token, type: "sms" })
 * ส่วนหน้าจอทั้งสามหน้าใช้ต่อได้เลย
 */

/** true = ยังไม่ได้ส่ง SMS จริง ใช้รหัสคงที่ MOCK_CODE แทน */
export const MOCK_OTP = true;

/**
 * รหัสของโหมดจำลอง — คงที่ 000000 เพื่อไม่ต้องเอารหัสสุ่มไปโชว์บนหน้าจอ
 * ของจริงรหัสจะมาทาง SMS ค่านี้จะไม่ถูกใช้
 */
const MOCK_CODE = "000000";

/** ความยาวรหัส OTP */
export const OTP_LENGTH = 6;

/** รหัสหมดอายุใน 5 นาที */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** กดขอรหัสใหม่ได้ทุกกี่วินาที */
export const OTP_RESEND_SECONDS = 30;

/** กรอกผิดได้กี่ครั้งก่อนต้องขอรหัสใหม่ */
const MAX_ATTEMPTS = 5;

/** ยืนยันเบอร์แล้วมีเวลากรอกชื่อ/รหัสผ่านกี่นาทีก่อนต้องยืนยันใหม่ */
const VERIFIED_TTL_MS = 10 * 60 * 1000;

type Pending = {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
};

let pending: Pending | null = null;
let verified: { phone: string; at: number } | null = null;

/**
 * ออกรหัสใหม่ให้เบอร์นี้ (ทับของเดิม) — นับเวลาหมดอายุและจำนวนครั้งที่กรอกผิดใหม่ทั้งหมด
 * phone ต้องเป็นรูปแบบ E.164 แล้ว (+66xxxxxxxxx)
 */
export function issueOtp(phone: string): void {
  pending = { phone, code: MOCK_CODE, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 };
}

export type OtpResult = { ok: true } | { ok: false; message: string };

/** ตรวจรหัสที่ผู้ใช้กรอก — ถูกแล้วถือว่าเบอร์นี้ยืนยันแล้ว 10 นาที */
export function verifyOtp(phone: string, input: string): OtpResult {
  const code = input.replace(/\D/g, "");
  if (!pending || pending.phone !== phone)
    return { ok: false, message: "ยังไม่ได้ขอรหัสสำหรับเบอร์นี้ กดขอรหัสใหม่" };
  if (Date.now() > pending.expiresAt)
    return { ok: false, message: "รหัสหมดอายุแล้ว กดขอรหัสใหม่" };
  if (code.length !== OTP_LENGTH)
    return { ok: false, message: `กรอกรหัส ${OTP_LENGTH} หลัก` };

  if (code !== pending.code) {
    pending.attempts += 1;
    const left = MAX_ATTEMPTS - pending.attempts;
    if (left <= 0) {
      pending = null;
      return { ok: false, message: "กรอกผิดหลายครั้งเกินไป กดขอรหัสใหม่" };
    }
    return { ok: false, message: `รหัสไม่ถูกต้อง ลองได้อีก ${left} ครั้ง` };
  }

  pending = null;
  verified = { phone, at: Date.now() };
  return { ok: true };
}

/** เบอร์นี้เพิ่งยืนยัน OTP ผ่านหรือยัง — หน้ากรอกชื่อ/รหัสผ่านใช้กันคนข้ามขั้นตอน */
export function isPhoneVerified(phone: string): boolean {
  if (!verified || verified.phone !== phone) return false;
  return Date.now() - verified.at <= VERIFIED_TTL_MS;
}

/** ล้างสถานะทั้งหมด — เรียกเมื่อสมัครเสร็จหรือผู้ใช้ถอยออกจาก flow */
export function clearOtp(): void {
  pending = null;
  verified = null;
}
