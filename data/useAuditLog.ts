import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * ประวัติการเปลี่ยนแปลง — ตาราง audit_logs ที่ trigger ใน supabase/accounts.sql บันทึก
 * RLS ให้เห็นเฉพาะสิ่งที่ตัวเองทำ + ทุกอย่างของบ้านที่ตัวเองเป็นเจ้าของ
 * unavailable = ยังไม่รัน accounts.sql (ยังไม่มีตาราง) หรือยังไม่ได้ login
 */
export type AuditEntry = {
  id: number;
  at: string;
  actor: string | null;
  house_ids: string[];
  entity: string;
  entity_id: string | null;
  action: "insert" | "update" | "delete";
  changes: Record<string, any> | null;
};

const LIMIT = 100;

export function useAuditLog(userId: string | null | undefined) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    if (!userId) {
      setUnavailable(true);
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, at, actor, house_ids, entity, entity_id, action, changes")
      .order("at", { ascending: false })
      .limit(LIMIT);
    if (error) {
      // ไม่มีตาราง (42P01 / PGRST205) = ยังไม่เปิดระบบบัญชี · อื่น ๆ log ไว้ แล้วแสดงว่าว่าง
      if (!["42P01", "PGRST205"].includes(error.code ?? "")) console.error("audit log:", error.message);
      setUnavailable(["42P01", "PGRST205"].includes(error.code ?? ""));
      setEntries([]);
    } else {
      setUnavailable(false);
      setEntries((data ?? []) as AuditEntry[]);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  return { entries, unavailable, isLoading, refetch: fetchLog };
}

/** ค่าใหม่ของคอลัมน์ (update เก็บเป็น {old, new} · insert/delete เก็บทั้งแถว) */
function after(e: AuditEntry, col: string): any {
  const v = e.changes?.[col];
  return e.action === "update" ? v?.new : v;
}
function before(e: AuditEntry, col: string): any {
  const v = e.changes?.[col];
  return e.action === "update" ? v?.old : v;
}
const changed = (e: AuditEntry, col: string) => e.action === "update" && !!e.changes && col in e.changes;

/**
 * แปลงหนึ่งแถวเป็นประโยคที่คนอ่านรู้เรื่อง · คืน null = ไม่ต้องแสดง (ซ้ำกับแถวอื่น)
 * @param nameOf ชื่อจาก user id (สมาชิกบ้าน) · ไม่รู้จักคืน "สมาชิกเดิม"
 */
export function describeAudit(e: AuditEntry, nameOf: (userId: string) => string): string | null {
  const who = e.actor ? nameOf(e.actor) : "ระบบ";
  // update เก็บเฉพาะคอลัมน์ที่เปลี่ยน — ชื่อของแถวอยู่ใน _label (accounts.sql → audit_row)
  const name = (col = "name") => after(e, col) ?? before(e, col) ?? e.changes?._label ?? "";

  switch (e.entity) {
    case "houses":
      if (e.action === "insert") return `${who} สร้างบ้าน ${name()}`;
      if (e.action === "delete") return `${who} ลบบ้าน ${name()}`;
      if (changed(e, "name")) return `${who} เปลี่ยนชื่อบ้าน ${before(e, "name")} → ${after(e, "name")}`;
      return null;

    case "devices":
      if (e.action === "insert") return `${who} เพิ่มอุปกรณ์ ${name()}`;
      if (e.action === "delete") return `${who} ลบอุปกรณ์ ${name()}`;
      if (changed(e, "name")) return `${who} เปลี่ยนชื่ออุปกรณ์ ${before(e, "name")} → ${after(e, "name")}`;
      if (changed(e, "wifi_ssid")) return `${who} เปลี่ยน WiFi ของอุปกรณ์เป็น ${after(e, "wifi_ssid") ?? "-"}`;
      return null; // สถานะเชื่อมต่อเปลี่ยนเอง ไม่ใช่การกระทำของคน

    case "alerts":
      if (e.action === "insert") return `${who} ตรวจพบเหตุการณ์ ${name("title")}${name("location") ? ` ที่ ${name("location")}` : ""}`;
      if (changed(e, "answered_by") || after(e, "status") === "completed") {
        return `${who} รับทราบการแจ้งเตือน${after(e, "answered_by") ? ` (ชื่อที่บันทึก: ${after(e, "answered_by")})` : ""}`;
      }
      if (after(e, "status") === "in_progress") return "ไม่มีผู้รับทราบทันเวลา ระบบโทรหาเบอร์ฉุกเฉิน";
      if (e.action === "delete") return `${who} ลบการแจ้งเตือน`;
      return null;

    case "emergency_contacts":
      if (e.action === "insert") return `${who} เพิ่มผู้ติดต่อฉุกเฉิน ${name()} ${after(e, "phone") ?? ""}`.trim();
      if (e.action === "delete") return `${who} ลบผู้ติดต่อฉุกเฉิน ${name()}`;
      if (changed(e, "phone")) return `${who} แก้เบอร์ ${name()}: ${before(e, "phone")} → ${after(e, "phone")}`;
      if (changed(e, "name")) return `${who} เปลี่ยนชื่อผู้ติดต่อ ${before(e, "name")} → ${after(e, "name")}`;
      return null;

    case "house_contacts":
      if (e.action === "insert") return `${who} ผูกผู้ติดต่อฉุกเฉินกับบ้าน`;
      if (e.action === "delete") return `${who} นำผู้ติดต่อฉุกเฉินออกจากบ้าน`;
      return null;

    case "house_members": {
      const target = e.entity_id ? nameOf(e.entity_id) : "สมาชิก";
      if (e.action === "insert") return after(e, "role") === "owner" ? null : `${target} เข้าร่วมบ้าน`;
      if (e.action === "delete") return e.actor === e.entity_id ? `${who} ออกจากบ้าน` : `${who} นำ ${target} ออกจากบ้าน`;
      return null;
    }

    case "house_invites":
      return e.action === "insert" ? `${who} สร้างรหัสเชิญเข้าบ้าน` : null; // การใช้รหัสแสดงเป็น "เข้าร่วมบ้าน" แล้ว

    default:
      return null;
  }
}
