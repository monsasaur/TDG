import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = 'https://uszsloljezycwqebultu.supabase.co';

const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzenNsb2xqZXp5Y3dxZWJ1bHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTI1ODcsImV4cCI6MjA4ODY4ODU4N30.HRt07mguyz1Is-0PaCVcw-qtdIQYleolbBckFv4cpYM';

type SessionStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

/**
 * ที่เก็บ session ของการเข้าสู่ระบบ
 *
 * เว็บ: ไม่ต้องส่ง supabase-js ใช้ localStorage เอง
 * มือถือ: AsyncStorage — แต่ dev client ที่ build ก่อนเพิ่ม AsyncStorage ไม่มี native module
 * ตัว package จะ throw ตอนโหลด กรณีนั้นใช้หน่วยความจำแทน แอปไม่ crash แค่ต้อง login ใหม่ทุกครั้งที่เปิด
 */
function sessionStorage(): SessionStorage | undefined {
  if (Platform.OS === 'web') return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    return (mod.default ?? mod) as SessionStorage;
  } catch {
    console.warn('[auth] ไม่มี AsyncStorage ใน build นี้ — เก็บ session ในหน่วยความจำ ต้อง login ใหม่ทุกครั้งที่เปิดแอป');
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
      removeItem: (key) => {
        memory.delete(key);
      },
    };
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: sessionStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// มือถือ: ต่ออายุ token เฉพาะตอนแอปอยู่หน้าจอ (แนวทางของ Supabase สำหรับ React Native)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
