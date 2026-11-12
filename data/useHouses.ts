import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient"; // แก้ path ให้ตรง

/** ตรงกับ max_houses ใน create_house() / join_house() ของ supabase/accounts.sql */
export const MAX_HOUSES = 5;

// สร้าง Type สำหรับ House (หรือนำไปใส่ในไฟล์ types รวมก็ได้ครับ)
export interface House {
  id: string;
  name: string;
}

export function useHouses() {
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // เรียกซ้ำได้ — หน้าที่เพิ่ม/เข้าร่วมบ้านแล้วกลับมาต้องดึงใหม่ (หน้าเดิมยังค้างอยู่ใน stack ไม่ได้ mount ใหม่)
  const fetchHouses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("houses")
        .select("id, name")
        .order("created_at", { ascending: true }); // เรียงตามเวลาที่สร้าง

      if (error) throw error;
      if (data) setHouses(data);
    } catch (error) {
      console.error("Error fetching houses:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  return { houses, isLoading, refetch: fetchHouses };
}
