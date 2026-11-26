import { useCallback, useEffect, useState } from "react";
import { ensureDefaultHouse } from "./defaultHouse";
import { supabase } from "./supabaseClient"; // แก้ path ให้ตรง

/** ตรงกับ max_houses ใน create_house() / join_house() ของ supabase/accounts.sql */
export const MAX_HOUSES = 5;

// สร้าง Type สำหรับ House (หรือนำไปใส่ในไฟล์ types รวมก็ได้ครับ)
export interface House {
  id: string;
  name: string;
}

/**
 * รายการบ้านเก็บไว้ที่เดียว แล้วแจกให้ทุก useHouses ที่เปิดอยู่
 *
 * เดิมแต่ละ hook ดึงเองแยกกัน ตัวที่ mount ไว้ตั้งแต่เปิดแอป (เช่น HouseFilterProvider)
 * จึงไม่เห็นบ้านที่เพิ่งสร้าง/เพิ่งเข้าร่วม แล้วไปบังคับตัวกรองกลับเป็นบ้านเดิม
 * — อาการ "กดเปลี่ยนบ้านไม่ได้"
 */
const houseListeners = new Set<(houses: House[], loading: boolean) => void>();
let cache: House[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;

/**
 * กำลังสร้างบ้านพื้นฐานให้บัญชีที่ยังไม่มีบ้าน (เพิ่งสมัคร / ออกจากบ้านสุดท้าย)
 *
 * ระหว่างนี้ยังตอบไม่ได้ว่า "ไม่มีบ้าน" — ถ้าตอบ หน้าหลักจะขึ้น "ยังไม่มีบ้านในระบบ"
 * แวบหนึ่งก่อนบ้านจะถูกสร้างเสร็จ จึงนับเป็นสถานะกำลังโหลดเหมือนกัน
 */
let preparingDefault = false;
let ensuring = false;

/** บัญชีที่ login อยู่ · undefined = ยังไม่รู้ (ยังไม่ได้อ่าน session) */
let currentUserId: string | null | undefined = undefined;

function emit() {
  const loading = !loaded || preparingDefault;
  houseListeners.forEach((fn) => fn(cache, loading));
}

async function readUserId(): Promise<string | null> {
  if (currentUserId !== undefined) return currentUserId;
  const { data } = await supabase.auth.getSession();
  // onAuthStateChange อาจตอบก่อนแล้ว — ของมันใหม่กว่า
  if (currentUserId === undefined) currentUserId = data.session?.user?.id ?? null;
  return currentUserId;
}

/** ดึงรายการบ้านอย่างเดียว ไม่แตะสถานะบ้านพื้นฐาน (กันเรียกวน) */
async function loadHouses(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("houses")
      .select("id, name")
      .order("created_at", { ascending: true }); // เรียงตามเวลาที่สร้าง
    if (error) throw error;
    if (data) cache = data;
  } catch (error) {
    console.error("Error fetching houses:", error);
  } finally {
    loaded = true;
  }
}

/**
 * บัญชีนี้ไม่มีบ้านสักหลัง → สร้างบ้านพื้นฐานให้ แล้วดึงรายการใหม่
 * ลองครั้งเดียวต่อรอบ และไม่ว่าผลจะเป็นอย่างไรต้องปลด preparingDefault เสมอ
 * (สร้างไม่สำเร็จ เช่นเน็ตหลุด → หน้าหลักขึ้นปุ่ม "เพิ่มบ้าน" ตามเดิม ไม่ค้างที่โครงร่าง)
 */
async function ensureDefault(userId: string): Promise<void> {
  if (ensuring) return;
  ensuring = true;
  try {
    const created = await ensureDefaultHouse(userId);
    if (created) await loadHouses();
  } finally {
    ensuring = false;
    preparingDefault = false;
    emit();
  }
}

/** ดึงรายการบ้านใหม่ให้ทุกหน้าพร้อมกัน · force = true บังคับยิงใหม่แม้มีคำขอค้างอยู่ */
export async function fetchHouses(force = false): Promise<void> {
  if (inflight && !force) return inflight;
  const run = (async () => {
    await loadHouses();

    const userId = cache.length === 0 ? await readUserId() : null;
    if (cache.length === 0 && userId) {
      // ยังไม่ emit ว่า "โหลดเสร็จแล้วไม่มีบ้าน" — รอผลการสร้างบ้านพื้นฐานก่อน
      preparingDefault = true;
      emit();
      await ensureDefault(userId);
      return;
    }

    preparingDefault = false;
    emit();
  })();
  inflight = run;
  await run;
  if (inflight === run) inflight = null;
}

/** เรียกหลังสร้าง / เข้าร่วม / ออกจากบ้าน เพื่อให้ทุกหน้าที่ใช้ useHouses อัปเดตตาม */
export function notifyHousesChanged() {
  void fetchHouses(true);
}

// เปลี่ยนบัญชี (login / ออกจากระบบ) → ของเก่าใช้ไม่ได้แล้ว ล้างแล้วดึงใหม่
supabase.auth.onAuthStateChange((_event, session) => {
  const nextUserId = session?.user?.id ?? null;
  const sameUser = currentUserId === nextUserId;
  currentUserId = nextUserId;
  // token refresh ของบัญชีเดิม — รายการบ้านยังใช้ได้ ไม่ต้องล้างให้จอกระพริบ
  if (sameUser && loaded) return;
  cache = [];
  loaded = false;
  preparingDefault = false;
  emit();
  void fetchHouses(true);
});

export function useHouses() {
  const [houses, setHouses] = useState<House[]>(cache);
  const [isLoading, setIsLoading] = useState(!loaded || preparingDefault);

  useEffect(() => {
    const listener = (next: House[], loading: boolean) => {
      setHouses(next);
      setIsLoading(loading);
    };
    houseListeners.add(listener);
    void fetchHouses();
    return () => {
      houseListeners.delete(listener);
    };
  }, []);

  const refetch = useCallback(() => fetchHouses(true), []);

  return { houses, isLoading, refetch };
}

/**
 * บัญชีที่ login อยู่มองเห็นบ้านอย่างน้อยหนึ่งหลังไหม — ใช้ตัดสินว่าหลัง login ไปหน้า home หรือหน้าเริ่มต้นใช้งาน
 * null = เช็คไม่ได้ (เน็ตหลุด / ฐานข้อมูลตอบ error) → ผู้เรียกควรถือว่ามีไว้ก่อน ไม่ขวางทางเข้าแอป
 * หลังรัน accounts.sql RLS กรองให้เห็นเฉพาะบ้านที่เป็นสมาชิก · ก่อนรันจะเห็นทุกบ้านในตาราง
 */
export async function hasAnyHouse(): Promise<boolean | null> {
  const { data, error } = await supabase.from("houses").select("id").limit(1);
  if (error) return null;
  return (data?.length ?? 0) > 0;
}

export type HouseRole = "owner" | "caregiver";

/**
 * บทบาทของบัญชีที่ login อยู่ในแต่ละบ้าน (ตาราง house_members ของ supabase/accounts.sql)
 * roles = null → ยังไม่ได้ login หรือฐานข้อมูลยังไม่ได้รัน accounts.sql (ไม่มีบทบาทให้ดู)
 * แยกจาก useHouses เพราะหลายหน้าใช้ useHouses แต่ต้องการบทบาทแค่หน้าจัดการบ้าน
 */
export function useMyHouseRoles(userId: string | null | undefined) {
  const [roles, setRoles] = useState<Map<string, HouseRole> | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!userId) {
      setRoles(null);
      return;
    }
    const { data, error } = await supabase
      .from("house_members")
      .select("house_id, role")
      .eq("user_id", userId);
    // ไม่มีตาราง (ยังไม่รัน accounts.sql) หรืออ่านไม่ได้ → ไม่รู้บทบาท ใช้พฤติกรรมเดิม
    if (error || !data) {
      setRoles(null);
      return;
    }
    setRoles(new Map(data.map((r: { house_id: string; role: HouseRole }) => [r.house_id, r.role])));
  }, [userId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, refetch: fetchRoles };
}

/**
 * ออกจากบ้าน (caregiver) — ลบแถวสมาชิกของตัวเอง
 * accounts.sql ให้ caregiver ออกเองได้ · owner ออกไม่ได้ (กันบ้านไม่มีเจ้าของ)
 * RLS ปฏิเสธแบบเงียบได้ (ไม่มี error แต่ไม่มีแถวถูกลบ) → ถือว่าไม่สำเร็จ
 */
export async function leaveHouse(houseId: string, userId: string): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase
    .from("house_members")
    .delete()
    .eq("house_id", houseId)
    .eq("user_id", userId)
    .select("house_id");
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) return { ok: false, message: "เจ้าของบ้านออกจากบ้านของตัวเองไม่ได้" };
  return { ok: true };
}
