import { Ionicons } from "@expo/vector-icons";
import { AlertStatus } from "../types/alert";

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
  no_response: { label: "ไม่มีการตอบรับ", icon: "alert", bg: "#FDE4E2", fg: "#C8322B" },
  in_progress: { label: "โทรออกแล้ว", icon: "call", bg: "#FDECD9", fg: "#C46A12" },
  completed: { label: "รับทราบแล้ว", icon: "checkmark", bg: "#DDF3E5", fg: "#1E8A4C" },
};

/** สีจุดในไทม์ไลน์ของการ์ดรายละเอียด */
export const STEP_DOT = { success: "#1E8A4C", error: "#C8322B", pending: "#D1D5DB" } as const;
