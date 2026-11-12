import { Platform } from "react-native";

/**
 * ที่เก็บค่าเล็ก ๆ ในเครื่อง — มือถือใช้ AsyncStorage · เว็บใช้ localStorage
 * dev client ที่ build ก่อนเพิ่ม AsyncStorage ไม่มี native module → ถอยไปเก็บในหน่วยความจำ (หายเมื่อปิดแอป)
 * เหมือนที่ data/supabaseClient.ts ทำกับ session
 */
type KV = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const memory = new Map<string, string>();
const memoryKV: KV = {
  getItem: async (k) => memory.get(k) ?? null,
  setItem: async (k, v) => {
    memory.set(k, v);
  },
};

let kv: KV | null = null;

function resolve(): KV {
  if (kv) return kv;
  if (Platform.OS === "web") {
    kv = {
      getItem: async (k) => {
        try {
          return globalThis.localStorage?.getItem(k) ?? null;
        } catch {
          return null;
        }
      },
      setItem: async (k, v) => {
        try {
          globalThis.localStorage?.setItem(k, v);
        } catch {
          // โหมดส่วนตัว / ถูกบล็อก — ไม่จำ แต่ไม่พัง
        }
      },
    };
    return kv;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-async-storage/async-storage");
    kv = (mod.default ?? mod) as KV;
  } catch {
    console.warn("[deviceStorage] AsyncStorage ไม่มีใน build นี้ — เก็บในหน่วยความจำแทน");
    kv = memoryKV;
  }
  return kv;
}

/** อ่านไม่ได้ (native module ไม่มี ฯลฯ) → null แทนการ throw */
export async function readItem(key: string): Promise<string | null> {
  try {
    return await resolve().getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function writeItem(key: string, value: string): Promise<void> {
  try {
    await resolve().setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}
