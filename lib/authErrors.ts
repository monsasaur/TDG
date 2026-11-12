/**
 * แปลง error จาก Supabase (Auth และฟังก์ชันใน accounts.sql) เป็นข้อความไทยที่ผู้ใช้ทำอะไรต่อได้
 */

type SupabaseLikeError = { message?: string; code?: string; status?: number } | null | undefined;

/** error ตอนสมัคร / เข้าสู่ระบบ */
export function authErrorMessage(err: SupabaseLikeError): string {
  if (!err) return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials"))
    return "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง";
  if (code === "user_already_exists" || code === "phone_exists" || msg.includes("already registered"))
    return "เบอร์นี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
  if (code === "weak_password" || msg.includes("password should be"))
    return "รหัสผ่านต้องยาวอย่างน้อย 6 ตัว";
  if (
    code === "phone_provider_disabled" ||
    msg.includes("unsupported phone provider") ||
    msg.includes("phone signups are disabled")
  )
    return "ระบบยังไม่ได้เปิดให้เข้าด้วยเบอร์โทร (ต้องเปิด Phone provider ใน Supabase)";
  if (code === "signup_disabled" || msg.includes("signups not allowed"))
    return "ระบบปิดรับสมัครสมาชิกใหม่อยู่";
  if (code === "phone_not_confirmed" || msg.includes("phone not confirmed"))
    return "เบอร์นี้ยังไม่ได้ยืนยัน";
  if (code === "over_request_rate_limit" || err.status === 429)
    return "ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่";
  if (msg.includes("network request failed") || msg.includes("failed to fetch"))
    return "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  return err.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}

/** ฐานข้อมูลยังไม่ได้รัน accounts.sql — ฟังก์ชันที่เรียกยังไม่มี */
export function isMissingRpc(err: SupabaseLikeError): boolean {
  if (!err) return false;
  return (
    err.code === "PGRST202" ||
    err.code === "42883" ||
    /could not find the function/i.test(err.message ?? "")
  );
}

/** error จาก create_house / create_house_invite / join_house (ข้อความไทยมาจาก accounts.sql อยู่แล้ว) */
export function houseRpcErrorMessage(err: SupabaseLikeError): string {
  if (!err) return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
  const msg = err.message ?? "";
  if (isMissingRpc(err)) return "ยังไม่ได้เปิดระบบบัญชีบนฐานข้อมูล (ต้องรัน accounts.sql)";
  if (err.code === "P0002") return "รหัสบ้านไม่ถูกต้อง ตรวจตัวอักษรอีกครั้ง หรือขอรหัสใหม่จากเจ้าของบ้าน";
  // ยังไม่ login: accounts.sql ถอนสิทธิ์เรียกฟังก์ชันจาก anon → Postgres ตอบ "permission denied for function"
  if (err.code === "42501" && /permission denied/i.test(msg)) return "ต้องเข้าสู่ระบบก่อน";
  if (/network request failed|failed to fetch/i.test(msg)) return "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  // P0001 / 42501 ที่ accounts.sql raise เองเป็นข้อความไทยที่อ่านรู้เรื่องอยู่แล้ว
  return msg || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
}
