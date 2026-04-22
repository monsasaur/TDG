import { useEffect, useState } from "react";
import { SystemAlert } from "../types/alert";
import { supabase } from "./supabaseClient"; // เรียกใช้ตัวเชื่อมต่อที่เราเพิ่งสร้าง

export function useSystemAlerts() {
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDisconnectedDevices() {
      try {
        const { data, error } = await supabase
          .from("devices")
          .select(`id, name, houses(name)`)
          .eq("status", "disconnected");

        if (error) throw error;

        if (data) {
          const formattedAlerts: SystemAlert[] = data.map((d: any) => ({
            id: `sa-${d.id}`,
            deviceId: d.id,
            title: "อุปกรณ์ขาดการเชื่อมต่อกับ WiFi",
            deviceName: d.name,
            houseName: d.houses?.name || "ไม่ระบุบ้าน",
          }));
          setSystemAlerts(formattedAlerts);
        }
      } catch (error) {
        console.error("Error fetching system alerts:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDisconnectedDevices();
  }, []);

  return { systemAlerts, isLoading };
}
