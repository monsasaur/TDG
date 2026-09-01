import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type DeviceStatus = "connected" | "disconnected";

export interface Device {
  id: string;
  name: string;
  code: string;
  wifi_ssid: string; // เปลี่ยนจาก wifi เฉยๆ เพื่อให้ตรงกับ Database
  status: DeviceStatus;
  houseName?: string; // จะได้มาจากการ Join
}

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDevices() {
      try {
        const { data, error } = await supabase
          .from("devices")
          .select(`
            id, 
            name, 
            code, 
            wifi_ssid, 
            status, 
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
          }));
          setDevices(formattedDevices);
        }
      } catch (error) {
        console.error("Error fetching devices:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDevices();
  }, []);

  return { devices, isLoading };
}