import { SystemAlert } from "../types/alert";

export const mockSystemAlerts: SystemAlert[] = [
  {
    id: "s1",
    title: "อุปกรณ์ขาดการเชื่อมต่อกับ WiFi",
    deviceName: "Esp32 - ห้องนอน",
    houseName: "บ้านแม่",
  },
  {
    id: "s2",
    title: "อุปกรณ์ขาดการเชื่อมต่อกับ WiFi",
    deviceName: "Esp32 - ห้องน้ำ",
    houseName: "บ้านแม่",
  },
  {
    id: "s3",
    title: "อุปกรณ์ขาดการเชื่อมต่อกับ WiFi",
    deviceName: "Esp32 - ห้องครัว",
    houseName: "บ้านพ่อ",
  },
];
