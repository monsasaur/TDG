import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Device, useDevices as useFetchDevices } from "../data/useDevices"; // เปลี่ยนจาก mockDevices เป็น Hook และเปลี่ยนชื่อเพื่อไม่ให้ชนกัน
// import { supabase } from "../data/supabaseClient"; // เปิดคอมเมนต์นี้เมื่อต้องการอัปเดตขึ้นฐานข้อมูลจริง

type DevicesContextType = {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  isLoading: boolean; // เพิ่ม Loading ให้หน้า UI รู้
};

const DevicesContext = createContext<DevicesContextType | undefined>(undefined);

export function DevicesProvider({ children }: { children: ReactNode }) {
  // 1. ดึงข้อมูลจาก Supabase ผ่าน Hook
  const { devices: fetchedDevices, isLoading: isFetching } = useFetchDevices();

  // 2. สร้าง State ภายใน Context (เริ่มต้นเป็น Array ว่าง)
  const [devices, setDevices] = useState<Device[]>([]);

  // 3. เมื่อดึงข้อมูลเสร็จ อัปเดตข้อมูลเข้า State
  useEffect(() => {
    if (!isFetching) {
      setDevices(fetchedDevices);
    }
  }, [fetchedDevices, isFetching]);

  const updateDevice = async (id: string, updates: Partial<Device>) => {
    // อัปเดต State ภายในแอป (เพื่อให้ UI เปลี่ยนทันทีโดยไม่ต้องรอโหลด)
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );

    /* // --- โค้ดสำหรับอัปเดตลง Supabase จริง (ถ้าต้องการเปิดใช้ ให้เอา Comment ออก) ---
    try {
      // หมายเหตุ: ต้องตรวจสอบด้วยว่า updates มี field ตรงกับในตาราง devices ใน database หรือไม่
      const { error } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', id);
        
      if (error) throw error;
    } catch (error) {
      console.error("Error updating device in Supabase:", error);
    }
    */
  };

  return (
    <DevicesContext.Provider
      value={{ devices, setDevices, updateDevice, isLoading: isFetching }}
    >
      {children}
    </DevicesContext.Provider>
  );
}

// ชื่อ useDevices ด้านล่างนี้จะเหมือนเดิม ทำให้ไม่ต้องไปแก้โค้ดในหน้า UI Component อื่นๆ เลยครับ
export function useDevices() {
  const ctx = useContext(DevicesContext);
  if (!ctx) throw new Error("useDevices must be used within DevicesProvider");
  return ctx;
}
