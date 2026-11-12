import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { isMissingRpc } from "../lib/authErrors";
import { formatThaiPhone } from "../lib/phone";
import type { HouseRole } from "./useHouses";

/**
 * สมาชิกจริงของบ้าน (บัญชีผู้ใช้) — จาก house_member_list() ใน supabase/accounts.sql
 *
 * members = null → ใช้ไม่ได้ (ยังไม่ login หรือยังไม่รัน accounts.sql)
 *   หน้าสมาชิกถอยไปแสดงจากผู้ติดต่อฉุกเฉินแบบเดิม
 */
export type MemberHouse = { id: string; name: string; role: HouseRole };

export type HouseMember = {
  userId: string;
  name: string;
  phone: string;
  isMe: boolean;
  houses: MemberHouse[];
};

type Row = {
  house_id: string;
  house_name: string;
  user_id: string;
  role: HouseRole;
  display_name: string;
  phone: string | null;
};

export function useHouseMembers(userId: string | null | undefined) {
  const [members, setMembers] = useState<HouseMember[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!userId) {
      setMembers(null);
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("house_member_list");
    if (error) {
      if (!isMissingRpc(error)) console.error("house_member_list failed:", error.message);
      setMembers(null);
      setIsLoading(false);
      return;
    }

    // หนึ่งแถวต่อ (บ้าน, คน) → รวมเป็นหนึ่งคนต่อหลายบ้าน
    const byUser = new Map<string, HouseMember>();
    for (const r of (data ?? []) as Row[]) {
      const phone = formatThaiPhone(r.phone);
      const m =
        byUser.get(r.user_id) ??
        {
          userId: r.user_id,
          name: r.display_name || phone || "สมาชิก",
          phone,
          isMe: r.user_id === userId,
          houses: [],
        };
      m.houses.push({ id: r.house_id, name: r.house_name, role: r.role });
      byUser.set(r.user_id, m);
    }
    setMembers([...byUser.values()]);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return { members, isLoading, refetch: fetchMembers };
}

/** เจ้าของบ้านนำสมาชิกออก — RLS ให้ลบได้เฉพาะ caregiver และเฉพาะเจ้าของบ้านนั้น */
export async function removeHouseMember(houseId: string, memberUserId: string): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase
    .from("house_members")
    .delete()
    .eq("house_id", houseId)
    .eq("user_id", memberUserId)
    .select("user_id");
  if (error) return { ok: false, message: error.message };
  // RLS ปฏิเสธแบบเงียบ — ไม่มี error แต่ไม่มีแถวถูกลบ
  if (!data || data.length === 0) return { ok: false, message: "เฉพาะเจ้าของบ้านที่นำผู้ดูแลออกได้" };
  return { ok: true };
}
