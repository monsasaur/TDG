import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import Constants from "expo-constants";

/**
 * ออนไลน์อยู่ไหม — ใช้กับป๊อปอัป "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้" (components/OfflineGate.tsx)
 *
 * โปรเจกต์นี้ยังไม่มี expo-network / NetInfo (ไม่อยากเพิ่ม dependency เพื่อเรื่องเดียว)
 * จึงเช็คด้วยการยิงไปที่ Supabase ที่แอปต้องใช้จริงอยู่แล้ว — ตอบอะไรกลับมาก็ถือว่าต่อเน็ตได้
 * ยิงไม่ออก (fetch throw / หมดเวลา) = ออฟไลน์
 *
 * ยิงถี่ขึ้นตอนออฟไลน์ เพื่อให้ป๊อปอัปหายเองทันทีที่เน็ตกลับมา
 */

const ONLINE_EVERY_MS = 20_000;
const OFFLINE_EVERY_MS = 4_000;
const TIMEOUT_MS = 5_000;

type NetworkContextType = {
  online: boolean;
  /** เช็คเดี๋ยวนี้ (เช่นตอนผู้ใช้กดปุ่มในป๊อปอัป) */
  recheck: () => void;
};

const NetworkContext = createContext<NetworkContextType>({ online: true, recheck: () => {} });

function healthUrl(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string };
  const base = (extra.supabaseUrl ?? "").replace(/\/+$/, "");
  return base ? `${base}/auth/v1/health` : null;
}

async function probe(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // ตอบ error code อะไรมาก็ได้ ขอแค่ตอบ = เน็ตถึงปลายทาง
    await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const url = useRef(healthUrl());
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (!url.current || busy.current) return;
    busy.current = true;
    const ok = await probe(url.current);
    busy.current = false;
    setOnline(ok);
  }, []);

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), online ? ONLINE_EVERY_MS : OFFLINE_EVERY_MS);
    // กลับมาเปิดแอป → เช็คทันที ไม่ต้องรอรอบถัดไป
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [check, online]);

  return <NetworkContext.Provider value={{ online, recheck: () => void check() }}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
