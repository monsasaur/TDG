import { Alert } from "../types/alert";

export const mockAlerts: Alert[] = [
  // Active - กำลังเกิดเหตุ มี countdown
  {
    id: "1",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว ภายในเวลา 60 วินาที",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "14:42",
    date: "วันนี้",
    status: "active",
    countdown: 60,
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "", status: "error" },
      { label: "ติดต่อเบอร์ฉุกเฉิน", detail: "", status: "pending" },
      { label: "ติดต่อเบอร์ 1669", detail: "", status: "pending" },
    ],
  },
  // Completed - ยืนยันแล้ว จบดี
  {
    id: "2",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "14:42",
    date: "วันนี้",
    status: "completed",
    answeredBy: "ฉัน",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : ฉัน", status: "success" },
      { label: "ติดต่อเบอร์ 1669", detail: "", status: "pending" },
    ],
  },
  // Completed - มีคนรับสาย
  {
    id: "3",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "07:30",
    date: "1 มกราคม",
    status: "completed",
    answeredBy: "ฉัน",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : ฉัน", status: "success" },
    ],
  },
  // No response - ไม่มีใครรับสาย
  {
    id: "4",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "07:30",
    date: "20 ธันวาคม 2568",
    status: "no_response",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "ไม่มีการรับสายจากเบอร์ติดต่อฉุกเฉิน", status: "error" },
      { label: "ติดต่อเบอร์ 1669", detail: "ไม่มีการรับสายจากเบอร์ 1669", status: "error" },
    ],
  },
  // Completed - พ่อรับ
  {
    id: "5",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "07:30",
    date: "16 ธันวาคม 2568",
    status: "completed",
    answeredBy: "พี่สาว",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : พี่สาว", status: "success" },
    ],
  },
  // Completed - บ้านพ่อ
  {
    id: "6",
    title: "Emergency",
    houseName: "บ้านพ่อ",
    description: "ตรวจพบการล้มที่ บ้านพ่อ บริเวณ ห้องนอน กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านพ่อ - ห้องนอน",
    time: "07:30",
    date: "8 ธันวาคม 2568",
    status: "completed",
    answeredBy: "น้อม",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : น้อม", status: "success" },
    ],
  },
];
