/**
 * API client สำหรับ Fall Detection backend
 *
 * ค่า URL และคีย์มาจาก app.config.js (อ่านจาก env ตอน build) ไม่ hardcode ในไฟล์นี้
 * ตั้งค่าตอน dev บนเครื่องตัวเองด้วย .env.local:
 *
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000   # IP เครื่องคุณ ถ้าใช้มือถือจริง
 *   EXPO_PUBLIC_API_KEY=dev-secret-key-123
 *
 * ตอน build ผ่าน EAS ให้ตั้งเป็น environment variable ต่อ profile (ดู eas.json)
 *
 * ⚠️ ข้อจำกัดที่ยังไม่แก้: คีย์นี้ยังเป็นตัวเดียวกับที่ ESP32 ใช้ และแอปที่ build แล้ว
 *    มีคีย์อยู่ในตัวเสมอ ใครแกะ APK ได้ก็เรียก POST /api/v1/demo/fire สั่งให้ระบบ
 *    โทรออกจริงได้ ทางแก้จริงคือแยก auth ของแอปออกจาก x-api-key ของอุปกรณ์
 *    (แบบเดียวกับที่ทำไปแล้วฝั่งเว็บ admin — ดู SEC-01 ใน TDG_BA.pdf)
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../data/supabaseClient";

type ApiExtra = { apiBaseUrl?: string; apiKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as ApiExtra;

// เว็บรันบนเครื่องเดียวกับ backend อยู่แล้ว 10.0.2.2 ใช้ไม่ได้
const fallbackBaseUrl =
  Platform.OS === "web" ? "http://localhost:3000" : "http://10.0.2.2:3000";

export const API_BASE_URL = extra.apiBaseUrl ?? fallbackBaseUrl;
export const API_KEY = extra.apiKey ?? "dev-secret-key-123";

const headers = {
  "x-api-key": API_KEY,
  "Content-Type": "application/json",
};

/**
 * แนบ access token ของบัญชีที่ login อยู่ — backend ใช้ยืนยันว่าใครกดรับทราบ และเครื่องนี้เป็นของใคร
 * (x-api-key บอกแค่ว่าเป็นแอปของเรา · ดู express_api/src/services/accountService.js)
 * ยังไม่ login = ส่งแค่ x-api-key แบบเดิม
 */
async function withUserToken(base: Record<string, string>): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
  } catch {
    return base;
  }
}

/**
 * 409 = หมดเวลารอแล้ว ระบบโทรฉุกเฉินไปแล้ว ยกเลิกไม่ได้
 * not_allowed = 401/403 — หลังเปิดระบบบัญชี ต้อง login ด้วยบัญชีที่เป็นสมาชิกบ้านนี้
 */
export type AckResponse = "acknowledged" | "already_escalated" | "not_allowed";

/**
 * รอ backend นานสุดเท่านี้ — ค้างนานกว่านี้ให้ถือว่าไม่สำเร็จ ผู้ใช้จะได้รู้ตัวและกดใหม่
 * แทนที่หน้าจอจะบอกว่ารับทราบแล้วทั้งที่ระบบยังนับเวลาโทรฉุกเฉินอยู่
 * (เช่นมือถือไม่ได้อยู่วงเดียวกับเครื่องที่รัน backend — fetch ค้างได้เป็นนาที)
 */
const ACK_TIMEOUT_MS = 8_000;

/**
 * แจ้ง backend ว่ามีผู้ดูแลรับทราบเหตุการณ์แล้ว → ยกเลิกการโทรฉุกเฉิน
 *
 * `eventId` ต้องเป็น **id ของ fall_events** (`alerts.fall_event_id`) ไม่ใช่ `alerts.id`
 * backend หาเหตุการณ์จากตาราง fall_events — ส่ง id ผิดตัวจะได้ 404
 * แล้วระบบโทรฉุกเฉินตามเวลาเหมือนไม่มีใครกด (บั๊กที่เกิดจริง 2 ก.ย. – 12 พ.ย. 2026)
 */
export async function acknowledgeEvent(
  eventId: string,
  acknowledgedBy?: string
): Promise<AckResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACK_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/alert/ack/${encodeURIComponent(eventId)}`,
      {
        method: "POST",
        headers: await withUserToken(headers),
        body: JSON.stringify(
          acknowledgedBy ? { acknowledged_by: acknowledgedBy } : {}
        ),
        signal: controller.signal,
      }
    );
    if (res.status === 409) return "already_escalated";
    if (res.status === 401 || res.status === 403) return "not_allowed";
    if (!res.ok) throw new Error(`POST /alert/ack ${res.status}`);
    return "acknowledged";
  } finally {
    clearTimeout(timer);
  }
}

export async function registerPushToken(payload: {
  token: string;
  device_id?: string | null;
  platform?: string | null;
}): Promise<void> {
  // login อยู่ → ผูกเครื่องกับบัญชี · ไม่ได้ login → ปลดการผูก (push ของบ้านส่งเฉพาะเครื่องสมาชิก)
  const res = await fetch(`${API_BASE_URL}/api/v1/push/register`, {
    method: "POST",
    headers: await withUserToken(headers),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST /push/register ${res.status}`);
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      headers: { "x-api-key": API_KEY },
    });
    return res.ok;
  } catch {
    return false;
  }
}
