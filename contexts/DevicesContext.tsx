import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Device, useDevices as useFetchDevices } from "../data/useDevices"; // เปลี่ยนจาก mockDevices เป็น Hook และเปลี่ยนชื่อเพื่อไม่ให้ชนกัน
import { supabase } from "../data/supabaseClient";

type DevicesContextType = {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  updateDevice: (id: string, updates: Partial<Device>) => Promise<void>;
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
    // อัปเดต State ก่อน เพื่อให้ UI เปลี่ยนทันทีไม่ต้องรอ network
    const before = devices.find((d) => d.id === id);
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );

    // houseName เป็นค่าที่ join มาจากตาราง houses ไม่ใช่คอลัมน์ของ devices
    // ส่งขึ้นไปจะทำให้ Supabase ปฏิเสธทั้งคำสั่ง — ตัดออกก่อน
    const { houseName, ...patch } = updates;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from("devices").update(patch).eq("id", id);

    if (error) {
      // เขียนไม่สำเร็จ = ย้อน state กลับ ไม่ปล่อยให้ UI โชว์สิ่งที่ไม่ได้บันทึก
      if (before) {
        setDevices((prev) => prev.map((d) => (d.id === id ? before : d)));
      }
      console.error("Error updating device in Supabase:", error);
      throw new Error(error.message);
    }
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
