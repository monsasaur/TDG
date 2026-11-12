import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Device, useDevices as useFetchDevices } from "../data/useDevices"; // เปลี่ยนจาก mockDevices เป็น Hook และเปลี่ยนชื่อเพื่อไม่ให้ชนกัน
import { supabase } from "../data/supabaseClient";
import { useAuth } from "./AuthContext";

type DevicesContextType = {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  updateDevice: (id: string, updates: Partial<Device>) => Promise<void>;
  /** ลบอุปกรณ์จากฐานข้อมูล — RLS ปฏิเสธ (ไม่ใช่เจ้าของบ้าน) จะ throw */
  deleteDevice: (id: string) => Promise<void>;
  isLoading: boolean; // เพิ่ม Loading ให้หน้า UI รู้
  /** ดึงใหม่ทันที — เช่นหลังเข้าร่วมบ้าน (บ้านที่เห็นเปลี่ยนแต่บัญชีเดิม) */
  refresh: () => Promise<void>;
};

const DevicesContext = createContext<DevicesContextType | undefined>(undefined);

export function DevicesProvider({ children }: { children: ReactNode }) {
  // 1. ดึงข้อมูลจาก Supabase ผ่าน Hook
  const {
    devices: fetchedDevices,
    isLoading: isFetching,
    refetch,
  } = useFetchDevices();

  // เปลี่ยนบัญชี (login / logout) = ชุดอุปกรณ์ที่มีสิทธิ์เห็นเปลี่ยน ต้องดึงใหม่
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    refetch();
  }, [userId, refetch]);

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
    // houseId ในแอปคือคอลัมน์ house_id
    const { houseName, houseId, ...rest } = updates;
    const patch: Record<string, unknown> = { ...rest };
    if (houseId !== undefined) patch.house_id = houseId;
    if (Object.keys(patch).length === 0) return;

    const { data, error } = await supabase
      .from("devices")
      .update(patch)
      .eq("id", id)
      .select("id");

    // RLS ปฏิเสธแบบเงียบได้ — ไม่มี error แต่ไม่มีแถวไหนถูกแก้
    // (เช่น caregiver แก้อุปกรณ์ ซึ่ง accounts.sql ให้ทำได้เฉพาะ owner)
    const denied = !error && (!data || data.length === 0);
    if (error || denied) {
      // เขียนไม่สำเร็จ = ย้อน state กลับ ไม่ปล่อยให้ UI โชว์สิ่งที่ไม่ได้บันทึก
      if (before) {
        setDevices((prev) => prev.map((d) => (d.id === id ? before : d)));
      }
      console.error("Error updating device in Supabase:", error ?? "no row updated");
      throw new Error(error ? error.message : "เฉพาะเจ้าของบ้านที่แก้ไขอุปกรณ์ได้");
    }
  };

  const deleteDevice = async (id: string) => {
    const { data, error } = await supabase.from("devices").delete().eq("id", id).select("id");
    if (error) throw new Error(error.message);
    // RLS ปฏิเสธแบบเงียบ — ไม่มี error แต่ไม่มีแถวถูกลบ
    if (!data || data.length === 0) throw new Error("เฉพาะเจ้าของบ้านที่ลบอุปกรณ์ได้");
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <DevicesContext.Provider
      value={{ devices, setDevices, updateDevice, deleteDevice, isLoading: isFetching, refresh: refetch }}
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
