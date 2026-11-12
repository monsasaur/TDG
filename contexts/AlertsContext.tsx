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
import { readItem, writeItem } from "../lib/deviceStorage";
import { useAuth } from "./AuthContext";

// เปลี่ยนชื่อตอน Import เพื่อไม่ให้ชื่อชนกับ Context Hook ด้านล่าง
import { useAlerts as useFetchAlerts } from "../data/useAlerts";
import { useSystemAlerts as useFetchSystemAlerts } from "../data/useSystemAlerts";

type ClearOptions = {
  house?: string;
  clearFall: boolean;
  clearSystem: boolean;
};

/**
 * "ลบการแจ้งเตือน" = ซ่อนจากรายการของบัญชีนี้บนเครื่องนี้ ไม่ได้ลบจากฐานข้อมูล
 * (เดิมแค่กรองออกจาก state แล้วรอบดึงซ้ำ 10 วิพากลับมา)
 * สมาชิกคนอื่นในบ้านยังเห็น · ประวัติเหตุการณ์ยังอยู่ครบ
 * การ์ดที่ยังรอการรับทราบ (active) ไม่ถูกซ่อนเด็ดขาด — ห้ามให้เหตุฉุกเฉินที่ยังนับถอยหลังหายจากจอ
 */
const hiddenKey = (userId: string | null) => `hidden_alerts:${userId ?? "anon"}`;

/** ผลของการกดรับทราบ — หน้าจอใช้เลือกข้อความที่จะบอกผู้ใช้ */
export type AckResult = "acknowledged" | "already_escalated" | "not_allowed" | "failed";

type AlertsContextType = {
  alerts: Alert[];
  systemAlerts: SystemAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  setSystemAlerts: React.Dispatch<React.SetStateAction<SystemAlert[]>>;
  clearAlerts: (opts: ClearOptions) => void;
  acknowledgeAlert: (id: string) => Promise<AckResult>;
  isLoading: boolean; // เพิ่มสถานะ Loading เข้าไปให้หน้า UI รู้ว่ากำลังดึงข้อมูล
  /** ดึงใหม่ทันทีไม่รอรอบ 10 วิ — เช่นหลังเข้าร่วมบ้าน */
  refresh: () => Promise<void>;
};

/**
 * ชื่อที่บันทึกว่าใครกดรับทราบ = ชื่อที่แสดงของบัญชีที่ login อยู่ (AuthContext.displayName)
 * ยังไม่ login ใช้คำนี้แทน — คำเดียวกับค่าเริ่มต้นของ backend (appAlertService.markAcknowledged)
 * ⚠️ ชื่อยังส่งจากแอป backend ไม่ได้ตรวจกับ token (ข้อ E3 ใน docs/reports/app_completion_plan.md)
 */
const DEFAULT_ACK_BY = "ผู้ดูแล";

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
function toAcknowledged(a: Alert, who: string): Alert {
  const hasAppStep = a.timeline.some((s) => s.label === STEP_APP);
  const timeline: TimelineStep[] = hasAppStep
    ? a.timeline.map((s) =>
        s.label === STEP_APP
          ? { ...s, detail: `รับทราบโดย : ${who}`, status: "success" as const }
          : s,
      )
    : // ข้อมูลตัวอย่างใน seed ไม่มี step นี้ — แทรกต่อจาก step แรกแบบที่หน้า home ทำมาตลอด
      [
        ...a.timeline.slice(0, 1),
        { label: "ยืนยันการตรวจสอบ", detail: `โดย : ${who}`, status: "success" as const },
        ...a.timeline.slice(1),
      ];
  return {
    ...a,
    status: "completed",
    answeredBy: who,
    countdown: undefined,
    timeline,
  };
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  // 1. ดึงข้อมูลจริงจาก Supabase ผ่าน Hooks ที่เราเพิ่งสร้าง
  const {
    alerts: fetchedAlerts,
    isLoading: isLoadingAlerts,
    refetch: refetchAlerts,
  } = useFetchAlerts();

  // เปลี่ยนบัญชี = บ้านที่เห็นเปลี่ยน ดึงใหม่ทันที ไม่รอรอบ 10 วิ
  const { user, displayName } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    refetchAlerts();
  }, [userId, refetchAlerts]);

  // ชื่อคนกดรับทราบ — เก็บใน ref เพราะ acknowledgeAlert ถูกเรียกจาก closure เก่าได้
  const whoRef = useRef(DEFAULT_ACK_BY);
  useEffect(() => {
    whoRef.current = user ? displayName : DEFAULT_ACK_BY;
  }, [user, displayName]);
  const { systemAlerts: fetchedSystemAlerts, isLoading: isLoadingSystem } =
    useFetchSystemAlerts();

  // รายการที่ผู้ใช้ซ่อนไว้ — แยกตามบัญชี · เปลี่ยนบัญชีแล้วโหลดชุดของบัญชีนั้น
  const hidden = useRef<Set<string>>(new Set());
  const [hiddenVersion, setHiddenVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    readItem(hiddenKey(userId)).then((raw) => {
      if (!alive) return;
      try {
        hidden.current = new Set(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        hidden.current = new Set();
      }
      setHiddenVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  const saveHidden = () => writeItem(hiddenKey(userId), JSON.stringify([...hidden.current]));

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
      fetchedAlerts.filter((a) => a.status === "active" || !hidden.current.has(a.id)).map((a) => {
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
  }, [fetchedAlerts, isLoadingAlerts, hiddenVersion]);

  useEffect(() => {
    if (isLoadingSystem) return;
    // แจ้งเตือนระบบคือ "สถานะ" (อุปกรณ์หลุดอยู่) ไม่ใช่เหตุการณ์ — อุปกรณ์กลับมาต่อได้แล้ว (หายจากรายการ)
    // ให้ลืมว่าเคยซ่อน จะได้ขึ้นใหม่ถ้าหลุดอีกครั้ง
    const present = new Set(fetchedSystemAlerts.map((a) => a.id));
    let pruned = false;
    for (const id of [...hidden.current]) {
      if (id.startsWith("sa-") && !present.has(id)) {
        hidden.current.delete(id);
        pruned = true;
      }
    }
    if (pruned) void saveHidden();
    setSystemAlerts(fetchedSystemAlerts.filter((a) => !hidden.current.has(a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveHidden อ่าน userId ล่าสุดอยู่แล้ว
  }, [fetchedSystemAlerts, isLoadingSystem, hiddenVersion]);

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
    const who = whoRef.current;
    const after = toAcknowledged(before, who);
    show(after);

    try {
      if (before.fallEventId) {
        // เหตุการณ์จริง — ต้องส่งถึง backend ถึงจะยกเลิกการโทรฉุกเฉินได้
        const result = await acknowledgeEvent(before.fallEventId, who);
        if (result === "already_escalated") {
          show({ ...before, status: "in_progress", countdown: undefined });
          return "already_escalated";
        }
        if (result === "not_allowed") {
          // backend ไม่ยอมรับ → การโทรฉุกเฉินยังไม่ถูกยกเลิก ต้องย้อนหน้าจอกลับ
          held.current.delete(id);
          setAlerts((prev) => prev.map((x) => (x.id === id ? before : x)));
          return "not_allowed";
        }
      } else {
        // ข้อมูลตัวอย่าง (seed) ไม่มีเหตุการณ์ใน backend ให้ยกเลิก — บันทึกลงแถว alerts ตรง ๆ
        // ไม่งั้นการดึงซ้ำรอบถัดไปจะพาสถานะเดิมกลับมา
        const { data, error } = await supabase
          .from("alerts")
          .update({
            status: after.status,
            answered_by: who,
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
    const inScope = (houseName: string) => !house || houseName === house;
    const ids: string[] = [];
    if (clearFall) {
      for (const a of alertsRef.current) {
        if (inScope(a.houseName) && a.status !== "active") ids.push(a.id);
      }
    }
    if (clearSystem) {
      for (const a of systemAlerts) if (inScope(a.houseName)) ids.push(a.id);
    }
    if (ids.length === 0) return;

    for (const id of ids) hidden.current.add(id);
    void saveHidden();
    const gone = new Set(ids);
    setAlerts((prev) => prev.filter((a) => !gone.has(a.id)));
    setSystemAlerts((prev) => prev.filter((a) => !gone.has(a.id)));
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
        refresh: refetchAlerts,
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
