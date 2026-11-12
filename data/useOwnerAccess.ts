import { useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useMyHouseRoles } from "./useHouses";

/**
 * ทำสิ่งที่เฉพาะเจ้าของบ้านทำได้หรือไม่ — ให้หน้าจอซ่อน/ปิดปุ่มตั้งแต่แรก
 * แทนการปล่อยให้กดแล้วฐานข้อมูลปฏิเสธ (RLS ใน supabase/accounts.sql)
 *
 * enforced = false → ยังไม่ login หรือยังไม่รัน accounts.sql (ไม่มีบทบาท) → อนุญาตทุกอย่างแบบเดิม
 * ฐานข้อมูลยังเป็นตัวบังคับจริง — ตรงนี้แค่ช่วยให้ผู้ใช้ไม่เจอปุ่มที่กดไม่ได้
 */
export function useOwnerAccess() {
  const { user } = useAuth();
  const { roles, refetch } = useMyHouseRoles(user?.id);
  const enforced = roles !== null;

  const isOwner = useCallback(
    (houseId: string | null | undefined) =>
      !enforced || (!!houseId && roles?.get(houseId) === "owner"),
    [enforced, roles],
  );

  return { enforced, isOwner, refetch };
}
