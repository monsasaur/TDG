import { isMissingRpc } from "../lib/authErrors";
import { supabase } from "./supabaseClient";

/**
 * บ้านพื้นฐาน — บัญชีที่ไม่มีบ้านสักหลัง (เพิ่งสมัคร หรือถูกนำออกจากบ้านสุดท้าย)
 * ระบบสร้างบ้านชื่อ "บ้าน" ให้เองโดยไม่ต้องให้ผู้ใช้กดสร้าง
 *
 * เรียกจาก <DefaultHouseSetup /> ใน app/_layout.tsx ที่เดียว แต่กันไว้อีกชั้นด้วย
 * ตัวแปรระดับโมดูล เผื่อถูกเรียกซ้อนกันหลายรอบระหว่างรอคำตอบจากฐานข้อมูล
 */

export const DEFAULT_HOUSE_NAME = "บ้าน";

/** ลองสร้างซ้ำได้เร็วสุดทุกกี่มิลลิวินาที (กันวนเรียกตอนเน็ตมีปัญหา) */
const RETRY_MS = 15_000;

const lastTry = new Map<string, number>();
let inFlight: Promise<boolean> | null = null;

async function create(): Promise<boolean> {
  // create_house() สร้างบ้าน + ตั้งคนเรียกเป็นเจ้าของบ้านในคำสั่งเดียว (supabase/accounts.sql)
  const { error } = await supabase.rpc("create_house", { p_name: DEFAULT_HOUSE_NAME });
  if (!error) return true;

  // ฐานข้อมูลยังไม่ได้รัน accounts.sql — สร้างแถวตรง ๆ แบบเดียวกับหน้าเพิ่มบ้าน
  if (isMissingRpc(error)) {
    const { error: insertError } = await supabase
      .from("houses")
      .insert([{ id: `h${Date.now()}`, name: DEFAULT_HOUSE_NAME }]);
    if (!insertError) return true;
    console.warn("[defaultHouse] สร้างบ้านพื้นฐานไม่ได้:", insertError.message);
    return false;
  }

  console.warn("[defaultHouse] สร้างบ้านพื้นฐานไม่ได้:", error.message);
  return false;
}

/**
 * สร้างบ้านพื้นฐานให้บัญชีนี้ถ้ายังไม่มีบ้าน — คืน true เมื่อสร้างสำเร็จ (ผู้เรียกควรดึงรายการบ้านใหม่)
 * เรียกซ้ำระหว่างรออยู่จะได้ผลของครั้งเดิม ไม่ยิงซ้ำ
 */
export async function ensureDefaultHouse(userId: string): Promise<boolean> {
  const now = Date.now();
  const last = lastTry.get(userId) ?? 0;
  if (now - last < RETRY_MS) return false;
  if (inFlight) return inFlight;

  lastTry.set(userId, now);
  inFlight = create().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
