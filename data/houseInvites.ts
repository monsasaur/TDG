import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { houseRpcErrorMessage } from "../lib/authErrors";

/**
 * เชิญเข้าบ้าน — ฝั่งเจ้าของบ้านสร้างรหัส ฝั่งคนถูกเชิญกรอกรหัสหรือสแกน QR
 * ฟังก์ชันฝั่งฐานข้อมูลอยู่ใน fall_detection_backend/supabase/accounts.sql
 *   create_house_invite(p_house_id)  เฉพาะเจ้าของบ้าน · รหัส 6 ตัว ใช้ได้ครั้งเดียว มีวันหมดอายุ
 *   join_house(p_code)               เข้าบ้านเป็น caregiver
 *
 * ⚠️ คนละเรื่องกับรหัสจับคู่อุปกรณ์ (PoP) ใน app/device-pairing-code.tsx
 */

/** QR เชิญเข้าบ้านเก็บข้อความแบบนี้ — มีคำนำหน้ากันไปสับสนกับ QR อื่น (เช่น QR บนกล่องอุปกรณ์) */
export const INVITE_QR_PREFIX = "MIDDLE-HOUSE:";

/** ตัวอักษรที่ create_house_invite() ใช้ — ไม่มี I O 0 1 */
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** ทำให้รหัสที่พิมพ์มาเป็นรูปแบบเดียวกับในฐานข้อมูล (ตัวใหญ่ ไม่มีช่องว่าง/ขีด) */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

/** ข้อความใน QR → รหัสเชิญ · ไม่ใช่ QR เชิญเข้าบ้านคืน null */
export function parseInviteQr(data: string): string | null {
  const text = data.trim();
  const body = text.toUpperCase().startsWith(INVITE_QR_PREFIX)
    ? text.slice(INVITE_QR_PREFIX.length)
    : text;
  const code = normalizeInviteCode(body);
  return CODE_RE.test(code) ? code : null;
}

type JoinResult = { ok: true; houseId: string; houseName: string | null } | { ok: false; message: string };

/** เข้าบ้านด้วยรหัสเชิญ — สำเร็จแล้วคืนชื่อบ้านด้วย (ตอนนี้เป็นสมาชิกแล้วจึงอ่านได้) */
export async function joinHouse(code: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc("join_house", { p_code: normalizeInviteCode(code) });
  if (error) return { ok: false, message: houseRpcErrorMessage(error) };

  const houseId = String(data);
  const { data: house } = await supabase.from("houses").select("name").eq("id", houseId).maybeSingle();
  return { ok: true, houseId, houseName: house?.name ?? null };
}

/**
 * timestamptz จาก PostgREST มีเศษวินาทีถึง 6 หลัก (…:00.123456+00:00)
 * ตัดเหลือ 3 หลักก่อน parse — ไม่ต้องพึ่งว่า JS engine บนมือถือรับรูปแบบยาวได้
 */
function parseTimestamp(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, "$1"));
}

export type HouseInvite = {
  code: string;
  /** อายุรหัสเป็นวินาที — คิดจาก created_at → expires_at ของ server ไม่ใช้นาฬิกาเครื่อง (อาจเพี้ยน) */
  seconds: number;
};

/** สร้างรหัสเชิญของบ้านนี้ตอนเปิดหน้า · refresh() ขอรหัสใหม่ · version เพิ่มทุกครั้งที่ได้รหัสใหม่ */
export function useHouseInvite(houseId: string | undefined) {
  const [invite, setInvite] = useState<HouseInvite | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const req = ++latest.current;
    if (!houseId) {
      setError("ไม่พบบ้านที่จะเชิญ กลับไปเลือกบ้านใหม่");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("create_house_invite", {
      p_house_id: houseId,
    });
    if (req !== latest.current) return; // มีคำขอใหม่กว่าแล้ว (กดรีเฟรชซ้ำ) — ทิ้งผลเก่า
    setLoading(false);

    const row = (Array.isArray(data) ? data[0] : data) as
      | { code: string; created_at: string; expires_at: string }
      | null;
    if (rpcError || !row) {
      setInvite(null);
      setError(houseRpcErrorMessage(rpcError));
      return;
    }
    const ms = parseTimestamp(row.expires_at) - parseTimestamp(row.created_at);
    // parse ไม่ได้ (ไม่ควรเกิด) → ใช้ค่าเดียวกับใน accounts.sql
    const seconds = Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : 15 * 60;
    setInvite({ code: row.code, seconds });
    setVersion((v) => v + 1);
  }, [houseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { invite, error, loading, version, refresh };
}
