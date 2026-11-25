import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHouses } from "../data/useHouses";
import { readItem, writeItem } from "../lib/deviceStorage";
import { useAlerts } from "./AlertsContext";

/**
 * ตัวกรองบ้าน — ใช้ร่วมกันทั้งแอป (หน้าหลัก · แจ้งเตือนระบบ · อุปกรณ์)
 *
 * เลือกบ้านไหนไว้ ทุกหน้าใช้ค่าเดียวกัน และจำไว้ข้ามการเปิดแอป (deviceStorage)
 * ข้อยกเว้นเดียว: มีการแจ้งเตือนการล้มที่ยังรอตรวจสอบ และบัญชีนี้มีหลายบ้าน
 * → สลับเป็น "ทั้งหมด" ให้เอง จะได้ไม่พลาดเหตุของบ้านที่ไม่ได้กรองอยู่
 */

export const ALL_HOUSES = "ทั้งหมด";

const STORAGE_KEY = "middle.houseFilter";

type HouseFilterContextType = {
  /** ชื่อบ้านที่เลือกอยู่ หรือ ALL_HOUSES */
  selected: string;
  setSelected: (name: string) => void;
  /** อ่านค่าที่จำไว้เสร็จแล้วหรือยัง (กันหน้าจอกระพริบจากค่าเริ่มต้น) */
  ready: boolean;
};

const HouseFilterContext = createContext<HouseFilterContextType | undefined>(undefined);

export function HouseFilterProvider({ children }: { children: ReactNode }) {
  const { houses } = useHouses();
  const { alerts } = useAlerts();
  const [selected, setSelectedState] = useState(ALL_HOUSES);
  const [ready, setReady] = useState(false);

  const names = useMemo(() => houses.map((h) => h.name), [houses]);

  // อ่านค่าที่จำไว้ตอนเปิดแอป
  useEffect(() => {
    let alive = true;
    readItem(STORAGE_KEY)
      .then((saved) => {
        if (alive && saved) setSelectedState(saved);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setSelected = (name: string) => {
    setSelectedState(name);
    void writeItem(STORAGE_KEY, name);
  };

  // บ้านที่จำไว้ถูกลบ / เปลี่ยนบัญชี / มีบ้านเดียว → ปรับให้ตรงกับบ้านที่มีอยู่จริง
  useEffect(() => {
    if (!ready || names.length === 0) return;
    if (names.length === 1) {
      if (selected !== names[0]) setSelected(names[0]);
      return;
    }
    if (selected !== ALL_HOUSES && !names.includes(selected)) setSelected(ALL_HOUSES);
  }, [ready, names, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // มีการล้มที่ยังรอตรวจสอบ + หลายบ้าน → เปิดเป็น "ทั้งหมด"
  const seenActive = useRef<Set<string>>(new Set());
  useEffect(() => {
    const active = alerts.filter((a) => a.status === "active");
    const fresh = active.some((a) => !seenActive.current.has(a.id));
    seenActive.current = new Set(active.map((a) => a.id));
    if (!ready || !fresh || names.length <= 1) return;
    if (selected !== ALL_HOUSES) setSelected(ALL_HOUSES);
  }, [alerts, ready, names.length, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HouseFilterContext.Provider value={{ selected, setSelected, ready }}>{children}</HouseFilterContext.Provider>
  );
}

export function useHouseFilter() {
  const ctx = useContext(HouseFilterContext);
  if (!ctx) throw new Error("useHouseFilter ต้องอยู่ใน HouseFilterProvider");
  return ctx;
}
