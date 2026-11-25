import { useCallback, useEffect, useState } from "react";
import { SystemAlert } from "../types/alert";
import { supabase } from "./supabaseClient"; // เรียกใช้ตัวเชื่อมต่อที่เราเพิ่งสร้าง

/**
 * ดึงสถานะอุปกรณ์ซ้ำทุกกี่มิลลิวินาที — อุปกรณ์หลุด/กลับมาต่อระหว่างเปิดแอปค้างไว้
 * ต้องเห็นบนหน้าจอเอง ไม่ใช่รอเปิดแอปใหม่ (จุดแดงบนแท็บคิดจากรายการนี้)
 */
const REFRESH_MS = 15_000;

export function useSystemAlerts() {
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDisconnectedDevices = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchDisconnectedDevices();
    const timer = setInterval(fetchDisconnectedDevices, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchDisconnectedDevices]);

  return { systemAlerts, isLoading, refetch: fetchDisconnectedDevices };
}
