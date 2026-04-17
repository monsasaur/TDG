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
  // No response - 1669 ก็ไม่รับ
  {
    id: "7",
    title: "Emergency",
    houseName: "บ้านพ่อ",
    description: "ตรวจพบการล้มที่ บ้านพ่อ บริเวณ ห้องนั่งเล่น กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านพ่อ - ห้องนั่งเล่น",
    time: "22:15",
    date: "5 ธันวาคม 2568",
    status: "no_response",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "ไม่มีการรับสาย", status: "error" },
      { label: "ติดต่อเบอร์ 1669", detail: "ไม่มีการรับสายจากเบอร์ 1669", status: "error" },
    ],
  },
  // Completed - แม่รับเอง
  {
    id: "8",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องนอน กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องนอน",
    time: "06:45",
    date: "3 ธันวาคม 2568",
    status: "completed",
    answeredBy: "แม่",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : แม่", status: "success" },
    ],
  },
  // Completed - 1669 รับ
  {
    id: "9",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "11:20",
    date: "28 พฤศจิกายน 2568",
    status: "completed",
    answeredBy: "เบอร์ 1669",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "ไม่มีการรับสาย", status: "error" },
      { label: "ติดต่อเบอร์ 1669", detail: "รับสายโดย : 1669", status: "success" },
    ],
  },
  // Completed - น้อม
  {
    id: "10",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "13:00",
    date: "20 พฤศจิกายน 2568",
    status: "completed",
    answeredBy: "น้อม",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : น้อม", status: "success" },
    ],
  },
  // No response
  {
    id: "11",
    title: "Emergency",
    houseName: "บ้านพ่อ",
    description: "ตรวจพบการล้มที่ บ้านพ่อ บริเวณ ห้องครัว กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านพ่อ - ห้องครัว",
    time: "19:50",
    date: "15 พฤศจิกายน 2568",
    status: "no_response",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "ไม่มีการรับสาย", status: "error" },
      { label: "ติดต่อเบอร์ 1669", detail: "ไม่มีการรับสายจากเบอร์ 1669", status: "error" },
    ],
  },
  // Completed - พี่สาว
  {
    id: "12",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องนั่งเล่น กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องนั่งเล่น",
    time: "09:15",
    date: "8 พฤศจิกายน 2568",
    status: "completed",
    answeredBy: "พี่สาว",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : พี่สาว", status: "success" },
    ],
  },
  // Completed - ฉัน
  {
    id: "13",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องน้ำ",
    time: "16:30",
    date: "1 พฤศจิกายน 2568",
    status: "completed",
    answeredBy: "ฉัน",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : ฉัน", status: "success" },
    ],
  },
  // Completed - น้อม
  {
    id: "14",
    title: "Emergency",
    houseName: "บ้านพ่อ",
    description: "ตรวจพบการล้มที่ บ้านพ่อ บริเวณ ห้องนอน กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านพ่อ - ห้องนอน",
    time: "21:00",
    date: "25 ตุลาคม 2568",
    status: "completed",
    answeredBy: "น้อม",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : น้อม", status: "success" },
    ],
  },
  // Completed - แม่
  {
    id: "15",
    title: "Emergency",
    houseName: "บ้านแม่",
    description: "ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องนอน กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว",
    location: "บ้านแม่ - ห้องนอน",
    time: "05:30",
    date: "18 ตุลาคม 2568",
    status: "completed",
    answeredBy: "แม่",
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "ไม่มีการตรวจสอบ", status: "error" },
      { label: "โทรหาเบอร์ติดต่อฉุกเฉิน", detail: "รับสายโดย : แม่", status: "success" },
    ],
  },
];
