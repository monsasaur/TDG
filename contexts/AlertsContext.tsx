import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, SystemAlert, TimelineStep } from "../types/alert";
import { supabase } from "../data/supabaseClient";
import { acknowledgeEvent } from "../lib/api";

// เปลี่ยนชื่อตอน Import เพื่อไม่ให้ชื่อชนกับ Context Hook ด้านล่าง
import { useAlerts as useFetchAlerts } from "../data/useAlerts";
import { useSystemAlerts as useFetchSystemAlerts } from "../data/useSystemAlerts";

type ClearOptions = {
  house?: string;
  clearFall: boolean;
  clearSystem: boolean;
};

/** ผลของการกดรับทราบ — หน้าจอใช้เลือกข้อความที่จะบอกผู้ใช้ */
export type AckResult = "acknowledged" | "already_escalated" | "failed";

type AlertsContextType = {
  alerts: Alert[];
  systemAlerts: SystemAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  setSystemAlerts: React.Dispatch<React.SetStateAction<SystemAlert[]>>;
  clearAlerts: (opts: ClearOptions) => void;
  acknowledgeAlert: (id: string) => Promise<AckResult>;
  isLoading: boolean; // เพิ่มสถานะ Loading เข้าไปให้หน้า UI รู้ว่ากำลังดึงข้อมูล
};

/**
 * ชื่อที่บันทึกว่าใครกดรับทราบ — ยังเป็นค่าคงที่เพราะแอปยังไม่มีระบบบัญชีผู้ใช้
 * (ข้อ E3 ใน docs/reports/app_completion_plan.md) · ใช้คำเดียวกับค่าเริ่มต้นของ backend
 * (appAlertService.markAcknowledged) หน้าจอจะได้ไม่เปลี่ยนคำหลังดึงข้อมูลรอบถัดไป
 */
const ACK_BY = "ผู้ดูแล";

/** ต้องตรงกับ STEP_APP ใน fall_detection_backend/express_api/src/services/appAlertService.js */
const STEP_APP = "แจ้งเตือนผู้ดูแลในแอป";

/**
 * ถือผลการกดไว้บนหน้าจอนานสุดเท่านี้ ระหว่างรอฐานข้อมูลตามทัน
 *
 * backend อัปเดตแถว alerts หลังตอบกลับแอปไปแล้ว และรอบดึงซ้ำที่ออกไปก่อนกดอาจกลับมาทีหลัง
 * ถ้าไม่ถือไว้ รายการจะเด้งกลับเป็น "ยังไม่รับทราบ" พร้อมนับถอยหลังใหม่ได้นานถึง 10 วิ
 */
const HOLD_MS = 30_000;

/** หน้าตาของ alert หลังกดรับทราบ — ให้ตรงกับที่ backend เขียนลงฐานข้อมูล */
function toAcknowledged(a: Alert): Alert {
  const hasAppStep = a.timeline.some((s) => s.label === STEP_APP);
  const timeline: TimelineStep[] = hasAppStep
    ? a.timeline.map((s) =>
        s.label === STEP_APP
          ? { ...s, detail: `รับทราบโดย : ${ACK_BY}`, status: "success" as const }
          : s,
      )
    : // ข้อมูลตัวอย่างใน seed ไม่มี step นี้ — แทรกต่อจาก step แรกแบบที่หน้า home ทำมาตลอด
      [
        ...a.timeline.slice(0, 1),
        { label: "ยืนยันการตรวจสอบ", detail: `โดย : ${ACK_BY}`, status: "success" as const },
        ...a.timeline.slice(1),
      ];
  return {
    ...a,
    status: "completed",
    answeredBy: ACK_BY,
    countdown: undefined,
    timeline,
  };
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  // 1. ดึงข้อมูลจริงจาก Supabase ผ่าน Hooks ที่เราเพิ่งสร้าง
  const { alerts: fetchedAlerts, isLoading: isLoadingAlerts } =
    useFetchAlerts();
  const { systemAlerts: fetchedSystemAlerts, isLoading: isLoadingSystem } =
    useFetchSystemAlerts();

  // 2. สร้าง State ภายใน Context เหมือนเดิม เริ่มต้นเป็น Array ว่างๆ
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);

  // ค่าล่าสุดของ alerts — หน้าจอเก็บ callback ไว้นาน (renderItem ที่ memo) จึงห้ามอ่านจาก closure เก่า
  const alertsRef = useRef<Alert[]>([]);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // alert ที่เพิ่งกดรับทราบ ซึ่งฐานข้อมูลอาจยังไม่ตามทัน — ดู HOLD_MS
  const held = useRef(new Map<string, { alert: Alert; until: number }>());

  // 3. เมื่อดึงข้อมูลเสร็จ ให้อัปเดตข้อมูลเข้า State
  useEffect(() => {
    if (isLoadingAlerts) return;
    const now = Date.now();
    setAlerts(
      fetchedAlerts.map((a) => {
        const h = held.current.get(a.id);
        if (!h) return a;
        // ฐานข้อมูลตามทันแล้ว (หรือมีสถานะอื่นมาแทน เช่นโทรออกไปแล้ว) หรือถือนานพอแล้ว → ใช้ของจริง
        if (a.status !== "active" || now > h.until) {
          held.current.delete(a.id);
          return a;
        }
        return h.alert;
      }),
    );
  }, [fetchedAlerts, isLoadingAlerts]);

  useEffect(() => {
    if (!isLoadingSystem) {
      setSystemAlerts(fetchedSystemAlerts);
    }
  }, [fetchedSystemAlerts, isLoadingSystem]);

  /**
   * กดรับทราบ: แสดงผลทันทีแล้วค่อยบันทึก — บันทึกไม่สำเร็จจะย้อนกลับ
   * ไม่ปล่อยให้หน้าจอบอกว่ารับทราบแล้วทั้งที่ระบบยังจะโทรฉุกเฉิน
   */
  const acknowledgeAlert = async (id: string): Promise<AckResult> => {
    const before = alertsRef.current.find((a) => a.id === id);
    if (!before) return "failed";
    if (before.status !== "active") return "acknowledged";

    const show = (a: Alert) => {
      held.current.set(id, { alert: a, until: Date.now() + HOLD_MS });
      setAlerts((prev) => prev.map((x) => (x.id === id ? a : x)));
    };
    const after = toAcknowledged(before);
    show(after);

    try {
      if (before.fallEventId) {
        // เหตุการณ์จริง — ต้องส่งถึง backend ถึงจะยกเลิกการโทรฉุกเฉินได้
        const result = await acknowledgeEvent(before.fallEventId, ACK_BY);
        if (result === "already_escalated") {
          show({ ...before, status: "in_progress", countdown: undefined });
          return "already_escalated";
        }
      } else {
        // ข้อมูลตัวอย่าง (seed) ไม่มีเหตุการณ์ใน backend ให้ยกเลิก — บันทึกลงแถว alerts ตรง ๆ
        // ไม่งั้นการดึงซ้ำรอบถัดไปจะพาสถานะเดิมกลับมา
        const { data, error } = await supabase
          .from("alerts")
          .update({
            status: after.status,
            answered_by: ACK_BY,
            countdown: null,
            timeline: after.timeline,
          })
          .eq("id", id)
          .select("id");
        if (error) throw new Error(error.message);
        // RLS ปฏิเสธแบบเงียบได้ — ไม่มี error แต่ไม่มีแถวไหนถูกแก้
        if (!data || data.length === 0) throw new Error("ไม่มีแถวถูกบันทึก");
      }
      return "acknowledged";
    } catch (err) {
      console.error("acknowledge failed:", err);
      held.current.delete(id);
      setAlerts((prev) => prev.map((x) => (x.id === id ? before : x)));
      return "failed";
    }
  };

  const clearAlerts = ({ house, clearFall, clearSystem }: ClearOptions) => {
    if (clearFall) {
      setAlerts((prev) =>
        house ? prev.filter((a) => a.houseName !== house) : [],
      );
    }
    if (clearSystem) {
      setSystemAlerts((prev) =>
        house ? prev.filter((a) => a.houseName !== house) : [],
      );
    }

    // หมายเหตุ: ในอนาคต ถ้าคุณอยากให้การกด Clear ตรงนี้ ลบข้อมูลในฐานข้อมูลจริงๆ ด้วย
    // คุณสามารถเพิ่มโค้ด supabase.from('alerts').delete().eq(...) ลงไปในนี้ได้เลยครับ!
  };

  const isLoading = isLoadingAlerts || isLoadingSystem;

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        systemAlerts,
        setAlerts,
        setSystemAlerts,
        clearAlerts,
        acknowledgeAlert,
        isLoading,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
