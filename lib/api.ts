/**
 * API client สำหรับ Fall Detection backend
 *
 * ตั้ง API_BASE_URL ให้ตรงกับ IP ของ Mac + port
 * (localhost ใช้ไม่ได้บนมือถือจริง — ต้องเป็น IP ใน LAN)
 *
 * เช็ค IP ด้วย: `ipconfig getifaddr en0`
 */

export const API_BASE_URL = "http://172.20.10.7:3000";
export const API_KEY = "dev-secret-key-123";

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
