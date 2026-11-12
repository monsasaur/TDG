import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type DeviceStatus = "connected" | "disconnected";

export interface Device {
  id: string;
  name: string;
  code: string;
  wifi_ssid: string; // เปลี่ยนจาก wifi เฉยๆ เพื่อให้ตรงกับ Database
  status: DeviceStatus;
  houseName?: string; // จะได้มาจากการ Join
  /** devices.house_id — ใช้เช็คว่าเป็นเจ้าของบ้านของอุปกรณ์นี้ไหม และตอนย้ายบ้าน */
  houseId?: string | null;
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // เรียกซ้ำได้ — DevicesContext ใช้ดึงใหม่ตอนเปลี่ยนบัญชี (แต่ละบัญชีเห็นอุปกรณ์ไม่เหมือนกัน)
  const fetchDevices = useCallback(async () => {
      try {
        const { data, error } = await supabase
          .from("devices")
          .select(`
            id, 
            name, 
            code, 
            wifi_ssid, 
            status, 
            house_id,
            houses(name)
          `);

        if (error) throw error;

        if (data) {
          const formattedDevices: Device[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            wifi_ssid: d.wifi_ssid || "",
            status: d.status,
            houseName: d.houses?.name || "ไม่ระบุ",
            houseId: d.house_id ?? null,
          }));
          setDevices(formattedDevices);
        }
      } catch (error) {
        console.error("Error fetching devices:", error);
      } finally {
        setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return { devices, isLoading, refetch: fetchDevices };
}