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

type ApiExtra = { apiBaseUrl?: string; apiKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as ApiExtra;

// เว็บรันบนเครื่องเดียวกับ backend อยู่แล้ว 10.0.2.2 ใช้ไม่ได้
const fallbackBaseUrl =
  Platform.OS === "web" ? "http://localhost:3000" : "http://10.0.2.2:3000";

export const API_BASE_URL = extra.apiBaseUrl ?? fallbackBaseUrl;
export const API_KEY = extra.apiKey ?? "dev-secret-key-123";

export type BackendFallEvent = {
  id: string;
  device_id: string;
  timestamp: number;
  location: string;
  is_fall: boolean;
  confidence: number;
  acknowledged?: boolean;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  escalated?: boolean;
  escalated_at?: string | null;
  sms_sent?: boolean;
  call_made?: boolean;
  created_at?: string;
};

const headers = {
  "x-api-key": API_KEY,
  "Content-Type": "application/json",
};

export async function fetchFallEvents(limit = 20): Promise<BackendFallEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/events/falls?limit=${limit}`, {
    headers,
  });
  if (!res.ok) throw new Error(`GET /events/falls ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

export async function acknowledgeEvent(
  eventId: string,
  acknowledgedBy = "caregiver"
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/alert/ack/${eventId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`POST /alert/ack ${res.status}`);
  }
}

export async function registerPushToken(payload: {
  token: string;
  device_id?: string | null;
  platform?: string | null;
}): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/push/register`, {
    method: "POST",
    headers,
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
