import { SystemAlert } from "../types/alert";
import { mockDevices } from "./mockDevices";

export const mockSystemAlerts: SystemAlert[] = mockDevices
  .filter((d) => d.status === "disconnected")
  .map((d) => ({
    id: `sa-${d.id}`,
    deviceId: d.id,
    title: "อุปกรณ์ขาดการเชื่อมต่อกับ WiFi",
    deviceName: d.name,
    houseName: d.house,
  }));
