export type AlertStatus = "active" | "completed" | "no_response" | "in_progress";

export type StepStatus = "success" | "error" | "pending";

export type TimelineStep = {
  label: string;
  detail: string;
  status: StepStatus;
};

export type Alert = {
  id: string;
  title: string;
  houseName: string;
  description: string;
  location: string;
  time: string;
  date: string;
  status: AlertStatus;
  countdown?: number;
  answeredBy?: string;
  timeline: TimelineStep[];
  /**
   * id ของแถวใน fall_events ที่ทำให้เกิด alert นี้ — ต้องใช้ตัวนี้ตอนกดรับทราบ ไม่ใช่ `id`
   * ข้อมูลตัวอย่างใน seed ไม่มี (null)
   */
  fallEventId?: string | null;
  /** เวลาที่บันทึกแถวนี้ (ISO จากฐานข้อมูล) — ใช้คิดเวลาที่เหลือก่อนระบบโทรฉุกเฉิน */
  createdAt?: string;
};

export type SystemAlert = {
  id: string;
  deviceId: string;
  title: string;
  deviceName: string;
  houseName: string;
};
