import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useReadState } from "../contexts/ReadStateContext";
import { useAuditLog } from "./useAuditLog";

/**
 * จำนวนรายการใหม่ในประวัติการเปลี่ยนแปลงที่ยังไม่ได้เปิดดู
 *
 * ใช้ทั้งที่เมนูในหน้าตั้งค่า และจุดแดงบนแท็บ "ตั้งค่า" ของแถบเมนูล่าง
 * (อยู่หน้าไหนก็ต้องเห็นว่ามีเรื่องใหม่ ไม่ใช่เห็นเฉพาะตอนเปิดหน้าตั้งค่า)
 */
export function useUnreadAuditCount(): number {
  const { user } = useAuth();
  const { entries } = useAuditLog(user?.id);
  const { unreadCount, markRead, ready } = useReadState();

  const ids = useMemo(() => entries.map((e) => `audit-${e.id}`), [entries]);
  const count = unreadCount(ids);

  // ครั้งแรกของเครื่อง/บัญชีนี้ ประวัติเก่าทั้งหมดไม่ใช่ "เรื่องใหม่" — ตั้งเป็นอ่านแล้วไว้ก่อน
  // ไม่งั้นเปิดแอปมาจะขึ้นจุดแดง 100 ทั้งที่ผู้ใช้ยังไม่ได้ทำอะไร
  const baselinedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = user?.id ?? "guest";
    if (!ready || baselinedFor.current === key || ids.length === 0) return;
    baselinedFor.current = key;
    if (unreadCount(ids) === ids.length) markRead(ids);
  }, [ready, ids, user?.id, unreadCount, markRead]);

  return count;
}
