import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { readItem, writeItem } from "../lib/deviceStorage";
import { useAuth } from "./AuthContext";

/**
 * "อ่านแล้ว" ของการแจ้งเตือน — เก็บเป็นรายการ id ในเครื่อง แยกตามบัญชี
 *
 * ใช้กับ
 *   - การ์ดแจ้งเตือนระบบ (`sa-<deviceId>`) — กดดูแล้วจุดแดงบนแท็บหาย และการ์ดเปลี่ยนเป็นสีอ่านแล้ว
 *   - ประวัติการเปลี่ยนแปลง (`audit-<id>`) — มีรายการใหม่แล้วขึ้นจุดแดงที่เมนูในหน้าตั้งค่า
 *
 * เก็บในเครื่อง ไม่ใช่ในฐานข้อมูล — "อ่านแล้ว" เป็นเรื่องของเครื่องนี้ ไม่ใช่ของทั้งบ้าน
 * (เหมือนการลบการแจ้งเตือนที่ซ่อนเฉพาะเครื่อง)
 */

type ReadStateContextType = {
  isRead: (id: string) => boolean;
  /** ทำเครื่องหมายว่าอ่านแล้ว (ส่งทีละอันหรือหลายอันก็ได้) */
  markRead: (ids: string | string[]) => void;
  /**
   * ลบเครื่องหมายของรายการที่หายไปแล้ว — เช่นอุปกรณ์กลับมาออนไลน์
   * ถ้าหลุดอีกครั้งต้องนับเป็นของใหม่ที่ยังไม่อ่าน
   */
  prune: (prefix: string, keepIds: string[]) => void;
  /** จำนวนที่ยังไม่อ่านจากรายการที่ส่งมา */
  unreadCount: (ids: string[]) => number;
  /** อ่านค่าที่เก็บไว้ในเครื่องเสร็จแล้วหรือยัง (ก่อนหน้านั้นทุกอย่างจะดูเหมือนยังไม่อ่าน) */
  ready: boolean;
};

const ReadStateContext = createContext<ReadStateContextType | undefined>(undefined);

/** เก็บได้มากสุดกี่ id (ตัดของเก่าทิ้ง ไม่ให้ไฟล์โตไม่สิ้นสุด) */
const MAX_IDS = 500;

export function ReadStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = `middle.readState.${user?.id ?? "guest"}`;
  const [read, setRead] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const loadedFor = useRef<string | null>(null);

  // เปลี่ยนบัญชี → อ่านของบัญชีนั้นมาใหม่
  useEffect(() => {
    let alive = true;
    loadedFor.current = null;
    setReady(false);
    setRead(new Set());
    readItem(storageKey).then((saved) => {
      if (!alive) return;
      loadedFor.current = storageKey;
      setReady(true);
      if (!saved) return;
      try {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) setRead(new Set(ids.filter((x) => typeof x === "string")));
      } catch {
        // ค่าเสีย — เริ่มใหม่เป็นว่าง
      }
    });
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const save = useCallback(
    (next: Set<string>) => {
      // ยังอ่านค่าเดิมไม่เสร็จ อย่าเพิ่งเขียนทับ
      if (loadedFor.current !== storageKey) return;
      void writeItem(storageKey, JSON.stringify([...next].slice(-MAX_IDS)));
    },
    [storageKey],
  );

  const markRead = useCallback(
    (ids: string | string[]) => {
      const list = Array.isArray(ids) ? ids : [ids];
      setRead((prev) => {
        if (list.every((id) => prev.has(id))) return prev;
        const next = new Set(prev);
        list.forEach((id) => next.add(id));
        save(next);
        return next;
      });
    },
    [save],
  );

  const prune = useCallback(
    (prefix: string, keepIds: string[]) => {
      const keep = new Set(keepIds);
      setRead((prev) => {
        const stale = [...prev].filter((id) => id.startsWith(prefix) && !keep.has(id));
        if (stale.length === 0) return prev;
        const next = new Set(prev);
        stale.forEach((id) => next.delete(id));
        save(next);
        return next;
      });
    },
    [save],
  );

  const isRead = useCallback((id: string) => read.has(id), [read]);
  const unreadCount = useCallback((ids: string[]) => ids.filter((id) => !read.has(id)).length, [read]);

  return (
    <ReadStateContext.Provider value={{ isRead, markRead, prune, unreadCount, ready }}>
      {children}
    </ReadStateContext.Provider>
  );
}

export function useReadState() {
  const ctx = useContext(ReadStateContext);
  if (!ctx) throw new Error("useReadState ต้องอยู่ใน ReadStateProvider");
  return ctx;
}
