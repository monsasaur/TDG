import { Ionicons } from "@expo/vector-icons";
import { Alert, AlertStatus } from "../types/alert";

/**
 * สีตามสถานะการแจ้งเตือน ดีไซน์ v2 — โทนหม่นให้เข้ากับธีมขาว-เทา-Charcoal
 * แต่ยังแยกสถานะออกจากกันได้ด้วยไอคอน + ข้อความ (ไม่ใช้สีอย่างเดียว)
 *   active      = แดงสด — ยังรอคนกดรับทราบ ต้องเด่นที่สุดในจอ
 *   no_response = แดง · in_progress = ส้มอำพัน · completed = เขียว (สดน้อยกว่าการ์ดที่ยังรอ แต่ยังอ่านง่าย)
 */
export type StatusLook = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
};

export const STATUS_LOOK: Record<AlertStatus, StatusLook> = {
  active: { label: "รอการตรวจสอบ", icon: "notifications", bg: "#FDECEC", fg: "#DC2626" },
  no_response: { label: "ไม่มีคนรับสาย", icon: "call-outline", bg: "#FDE4E2", fg: "#C8322B" },
  in_progress: { label: "โทรออกแล้ว", icon: "call", bg: "#FDECD9", fg: "#C46A12" },
  completed: { label: "รับทราบแล้ว", icon: "checkmark", bg: "#DDF3E5", fg: "#1E8A4C" },
};

/** ขั้น "โทรหาเบอร์ติดต่อฉุกเฉิน" ในไทม์ไลน์ (ฝั่ง backend: appAlertService.STEP_CALL) */
const STEP_CALL = "โทรหาเบอร์ติดต่อฉุกเฉิน";

/** จบเรื่องเพราะมีคนรับสาย (ไม่ใช่เพราะกดรับทราบในแอป) */
export function answeredByCall(alert: Alert): boolean {
  return (
    alert.status === "completed" &&
    (alert.timeline ?? []).some((s) => s.label === STEP_CALL && s.status === "success")
  );
}

/**
 * ป้ายสถานะของการ์ดใบนี้ — ต่างจาก STATUS_LOOK ตรงที่แยก "รับทราบในแอป" กับ "รับสายปลายทาง"
 * เพราะสองอย่างนี้จบเรื่องคนละทาง คนอ่านต้องรู้ว่าใครเป็นคนจัดการ
 */
export function lookFor(alert: Alert): StatusLook {
  const base = STATUS_LOOK[alert.status];
  if (answeredByCall(alert)) return { ...base, label: "รับสายแล้ว", icon: "call" };
  return base;
}

/** สีจุดในไทม์ไลน์ของการ์ดรายละเอียด */
export const STEP_DOT = { success: "#1E8A4C", error: "#C8322B", pending: "#D1D5DB" } as const;
