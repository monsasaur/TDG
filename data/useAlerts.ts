import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Alert } from "../types/alert"; // ใช้ Type Alert เดิมของคุณได้เลย แต่ต้องปรับบาง field ให้ตรง

/**
 * ดึงเวลาใหม่ทุกกี่มิลลิวินาที
 *
 * Express API เขียนแถวใน `alerts` ให้ทุกครั้งที่ตรวจพบการล้ม (appAlertService.js)
 * แอปจึงต้องดึงซ้ำเป็นระยะ ไม่งั้นเหตุการณ์ใหม่จะไม่โผล่จนกว่าจะเปิดแอปใหม่
 *
 * 10 วินาทีถือว่าพอ เพราะการแจ้งเตือนทันทีมาทาง push notification อยู่แล้ว
 * ตรงนี้เป็นแค่การอัปเดตรายการบนหน้าจอ
 */
const REFRESH_MS = 10_000;

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
      try {
        // ใช้ * แทนการไล่ชื่อคอลัมน์ เพราะฐานข้อมูลที่ยังไม่ได้รัน schema.sql จะไม่มี
        // คอลัมน์ fall_event_id — ถ้าระบุชื่อคอลัมน์ที่ไม่มีอยู่ ทั้งคำสั่งจะล้มและรายการว่างหมด
        const { data, error } = await supabase
          .from("alerts")
          .select("*, houses(name)")
          .order("created_at", { ascending: false }); // ใหม่ล่าสุดขึ้นก่อน

        if (error) throw error;

        if (data) {
          const formattedAlerts: Alert[] = data.map((a: any) => {
            // จำลองการจัดรูปแบบวันที่และเวลาจาก created_at
            // (ในระบบจริง แนะนำให้ใช้ date-fns หรือ dayjs จัดการใน Component)
            const dateObj = new Date(a.created_at);
            const timeString = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

            return {
              id: a.id,
              title: a.title,
              houseName: a.houses?.name || "ไม่ระบุ",
              description: a.description,
              location: a.location,
              time: timeString, // หรือใช้ a.created_at ไปเลย แล้วไป Format ที่หน้าจอเอา
              date: dateObj.toLocaleDateString('th-TH'), // จัดรูปแบบคร่าวๆ
              status: a.status,
              countdown: a.countdown,
              answeredBy: a.answered_by,
              timeline: a.timeline || [], // Timeline ที่เก็บเป็น JSON
              fallEventId: a.fall_event_id ?? null, // ใช้ตอนกดรับทราบ — ดู contexts/AlertsContext.tsx
              createdAt: a.created_at, // นับถอยหลังจากเวลาจริง — ดู components/AlertCardActive.tsx
            };
          });
          setAlerts(formattedAlerts);
        }
      } catch (error) {
        console.error("Error fetching alerts:", error);
      } finally {
        setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(fetchAlerts, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchAlerts]);

  return { alerts, isLoading, refetch: fetchAlerts };
}
