import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert, SystemAlert } from "../types/alert";

// เปลี่ยนชื่อตอน Import เพื่อไม่ให้ชื่อชนกับ Context Hook ด้านล่าง
import { useAlerts as useFetchAlerts } from "../data/useAlerts";
import { useSystemAlerts as useFetchSystemAlerts } from "../data/useSystemAlerts.ts";

type ClearOptions = {
  house?: string;
  clearFall: boolean;
  clearSystem: boolean;
};

type AlertsContextType = {
  alerts: Alert[];
  systemAlerts: SystemAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  setSystemAlerts: React.Dispatch<React.SetStateAction<SystemAlert[]>>;
  clearAlerts: (opts: ClearOptions) => void;
  isLoading: boolean; // เพิ่มสถานะ Loading เข้าไปให้หน้า UI รู้ว่ากำลังดึงข้อมูล
};

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

  // 3. เมื่อดึงข้อมูลเสร็จ ให้อัปเดตข้อมูลเข้า State
  useEffect(() => {
    if (!isLoadingAlerts) {
      setAlerts(fetchedAlerts);
    }
  }, [fetchedAlerts, isLoadingAlerts]);

  useEffect(() => {
    if (!isLoadingSystem) {
      setSystemAlerts(fetchedSystemAlerts);
    }
  }, [fetchedSystemAlerts, isLoadingSystem]);

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
