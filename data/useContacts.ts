import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export const MAX_MEMBERS_PER_HOUSE = 6;
export const MAX_EXTERNAL_PER_HOUSE = 4;

export type ContactType = "self" | "member" | "external";

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  type: ContactType;
  houses: string[]; // รายชื่อบ้านที่คนนี้ดูแล
}

export function useContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchContacts() {
      try {
        // ดึง Contact พร้อมกับข้อมูลที่ Join ผ่านตาราง house_contacts
        const { data, error } = await supabase
          .from("emergency_contacts")
          .select(`
            id, 
            name, 
            phone, 
            contact_type,
            house_contacts (
              houses (name)
            )
          `);

        if (error) throw error;

        if (data) {
          const formattedContacts: EmergencyContact[] = data.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            type: c.contact_type,
            // ดึงชื่อบ้านออกมาจาก Nested Object ของ Supabase
            houses: c.house_contacts.map((hc: any) => hc.houses?.name).filter(Boolean),
          }));
          setContacts(formattedContacts);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchContacts();
  }, []);

  return { contacts, isLoading };
}