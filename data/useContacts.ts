import { useCallback, useEffect, useState } from "react";
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

/**
 * รายชื่อผู้ติดต่อฉุกเฉินเก็บไว้ที่เดียว แล้วแจกให้ทุกหน้าที่เปิดอยู่
 *
 * เดิมดึงครั้งเดียวตอน mount — ลบ/แก้ผู้ติดต่อแล้วหน้าเดิมยังค้างของเก่า
 * ต้องออกจากหน้าแล้วเข้าใหม่ถึงจะอัปเดต
 */
type Listener = (contacts: EmergencyContact[], loading: boolean) => void;
const listeners = new Set<Listener>();
let cache: EmergencyContact[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;

function emit() {
  listeners.forEach((fn) => fn(cache, !loaded));
}

export async function fetchContacts(force = false): Promise<void> {
  if (inflight && !force) return inflight;
  const run = (async () => {
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
        cache = data.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          type: c.contact_type,
          // ดึงชื่อบ้านออกมาจาก Nested Object ของ Supabase
          houses: c.house_contacts.map((hc: any) => hc.houses?.name).filter(Boolean),
        }));
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      loaded = true;
      emit();
    }
  })();
  inflight = run;
  await run;
  if (inflight === run) inflight = null;
}

/** เรียกหลังเพิ่ม / แก้ / ลบผู้ติดต่อ — ทุกหน้าที่เปิดอยู่จะเห็นผลทันที */
export function notifyContactsChanged() {
  void fetchContacts(true);
}

// เปลี่ยนบัญชี → ของเก่าใช้ไม่ได้แล้ว
supabase.auth.onAuthStateChange(() => {
  cache = [];
  loaded = false;
  emit();
  void fetchContacts(true);
});

export function useContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>(cache);
  const [isLoading, setIsLoading] = useState(!loaded);

  useEffect(() => {
    const listener: Listener = (next, loading) => {
      setContacts(next);
      setIsLoading(loading);
    };
    listeners.add(listener);
    void fetchContacts();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refetch = useCallback(() => fetchContacts(true), []);

  return { contacts, isLoading, refetch };
}
