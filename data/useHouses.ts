import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient"; // แก้ path ให้ตรง

/** ตรงกับ max_houses ใน create_house() / join_house() ของ supabase/accounts.sql */
export const MAX_HOUSES = 5;

// สร้าง Type สำหรับ House (หรือนำไปใส่ในไฟล์ types รวมก็ได้ครับ)
export interface House {
  id: string;
  name: string;
}

export function useHouses() {
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // เรียกซ้ำได้ — หน้าที่เพิ่ม/เข้าร่วมบ้านแล้วกลับมาต้องดึงใหม่ (หน้าเดิมยังค้างอยู่ใน stack ไม่ได้ mount ใหม่)
  const fetchHouses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("houses")
        .select("id, name")
        .order("created_at", { ascending: true }); // เรียงตามเวลาที่สร้าง

      if (error) throw error;
      if (data) setHouses(data);
    } catch (error) {
      console.error("Error fetching houses:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  return { houses, isLoading, refetch: fetchHouses };
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
