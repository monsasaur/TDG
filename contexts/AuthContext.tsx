import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../data/supabaseClient";
import { authErrorMessage } from "../lib/authErrors";
import { formatThaiPhone, toE164TH } from "../lib/phone";

/**
 * บัญชีผู้ใช้ — เข้าระบบด้วยเบอร์โทร + รหัสผ่าน (Supabase Auth)
 *
 * ต้องเปิด Phone provider ใน Supabase และ **ปิด "Enable phone confirmations"**
 * เพราะรอบนี้แอปยังไม่มีขั้นยืนยัน OTP ทาง SMS (Twilio ตอนนี้ส่งเข้าเบอร์ไทยไม่ได้)
 * สิทธิ์ว่าใครเห็นบ้านไหนอยู่ที่ฐานข้อมูล (fall_detection_backend/supabase/accounts.sql)
 */

type Result = { ok: true } | { ok: false; message: string };

type AuthContextType = {
  session: Session | null;
  user: User | null;
  /** กำลังอ่าน session ที่เก็บไว้ตอนเปิดแอป */
  loading: boolean;
  /** ชื่อที่แสดง — ใช้เป็น "รับทราบโดย" ด้วย */
  displayName: string;
  /** เบอร์ของบัญชีแบบ 081-234-5678 */
  phoneDisplay: string;
  signIn: (phone: string, password: string) => Promise<Result>;
  signUp: (phone: string, password: string, name: string) => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(data.session);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const phoneDisplay = formatThaiPhone(user?.phone);
  const metaName = typeof user?.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  const displayName = metaName || phoneDisplay || "ผู้ดูแล";

  const signIn = async (phone: string, password: string): Promise<Result> => {
    const e164 = toE164TH(phone);
    if (!e164) return { ok: false, message: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
    const { error } = await supabase.auth.signInWithPassword({ phone: e164, password });
    return error ? { ok: false, message: authErrorMessage(error) } : { ok: true };
  };

  const signUp = async (phone: string, password: string, name: string): Promise<Result> => {
    const e164 = toE164TH(phone);
    if (!e164) return { ok: false, message: "เบอร์โทรศัพท์ไม่ถูกต้อง" };
    const { data, error } = await supabase.auth.signUp({
      phone: e164,
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) return { ok: false, message: authErrorMessage(error) };
    // เปิดการยืนยันเบอร์ไว้ = ได้บัญชีแต่ยังไม่มี session จนกว่าจะยืนยัน OTP ซึ่งแอปรอบนี้ยังไม่มี
    if (!data.session) {
      return {
        ok: false,
        message: "สมัครแล้ว แต่ระบบยังเปิดการยืนยันเบอร์ทาง SMS อยู่ ซึ่งแอปรอบนี้ยังไม่รองรับ",
      };
    }
    return { ok: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user, loading, displayName, phoneDisplay, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
