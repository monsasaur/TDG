import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient"; // แก้ path ให้ตรง

export const MAX_HOUSES = 5;

// สร้าง Type สำหรับ House (หรือนำไปใส่ในไฟล์ types รวมก็ได้ครับ)
export interface House {
  id: string;
  name: string;
}

export function useHouses() {
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHouses() {
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
    }

    fetchHouses();
  }, []);

  return { houses, isLoading };
}
