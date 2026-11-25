import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import PageHeader from "../components/PageHeader";
import { BTN } from "../components/buttonTheme";
import { V2, V2C } from "../components/designVersion";
import { maskThaiPhone, toE164TH } from "../lib/phone";
import { issueOtp, OTP_LENGTH, OTP_RESEND_SECONDS, OTP_TTL_MS, verifyOtp } from "../lib/devOtp";

/**
 * สมัครใช้งาน ขั้นที่ 2 จาก 3 — ยืนยันเบอร์ด้วยรหัส OTP
 *
 * ⚠️ ยังไม่ได้ส่ง SMS จริง (lib/devOtp.ts) — รหัสในโหมดทดสอบคงที่คือ 000000
 * ไม่มีการแสดงรหัสบนหน้าจอ ของจริงให้เปลี่ยนไปเรียก supabase.auth.signInWithOtp / verifyOtp
 */
export default function RegisterOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = typeof params.phone === "string" ? params.phone : "";
  const e164 = toE164TH(phone);
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(OTP_RESEND_SECONDS);

  // นับถอยหลังปุ่มขอรหัสใหม่
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(t);
  }, [left]);

  // เข้าหน้านี้ตรง ๆ โดยไม่มีเบอร์ (เช่นเปิดจากลิงก์) — กลับไปขั้นตอนแรก
  useEffect(() => {
    if (!e164) router.replace("/register" as any);
  }, [e164, router]);

  const handleVerify = () => {
    if (!e164) return;
    const res = verifyOtp(e164, code);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError("");
    router.replace({ pathname: "/register-details", params: { phone } } as any);
  };

  const handleResend = () => {
    if (!e164 || left > 0) return;
    issueOtp(e164);
    setCode("");
    setError("");
    setLeft(OTP_RESEND_SECONDS);
    inputRef.current?.focus();
  };

  const onChangeCode = (t: string) => {
    setCode(t.replace(/\D/g, "").slice(0, OTP_LENGTH));
    if (error) setError("");
  };

  const changePhone = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/register" as any);
  };

  // ไม่โชว์เบอร์เต็มบนหน้ายืนยัน — 062-999-9999 → 062-XXX-9999 (lib/phone.ts)
  const masked = maskThaiPhone(e164) || phone;

  const minutes = Math.round(OTP_TTL_MS / 60000);
  const filled = code.length === OTP_LENGTH;
  const textMain = V2 ? "text-[#292A32]" : "text-brand";
  const textSub = V2 ? "text-[#858891]" : "text-sub";
  const textError = V2 ? "text-[#DC2626]" : "text-danger";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className={`flex-1 ${V2 ? V2C.page : "bg-white"}`}
    >
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ยืนยันเบอร์โทร" onBack={changePhone} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={`text-base ${textSub} leading-6`}>ระบุ OTP ที่ได้รับทาง SMS ที่</Text>
        <Text className={`text-xl font-bold ${textMain} mt-1`}>{masked}</Text>
        <Text className={`text-sm ${textSub} mt-2`}>OTP มีอายุการใช้งาน {minutes} นาที</Text>

        {/* ช่องกรอกจริงซ้อนอยู่ใต้ช่องตัวเลข — แตะตรงไหนของแถวก็พิมพ์ได้ */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          className="mt-8"
          accessibilityRole="none"
        >
          <View className="flex-row justify-center">
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const active = i === Math.min(code.length, OTP_LENGTH - 1);
              return (
                <View
                  key={i}
                  className={`w-12 mx-1.5 pb-2 items-center border-b-2 ${
                    error
                      ? "border-[#DC2626]"
                      : active
                        ? V2
                          ? "border-[#292A32]"
                          : "border-brand"
                        : "border-[#E5E6E9]"
                  }`}
                >
                  <Text className={`text-2xl font-semibold ${textMain}`}>{code[i] ?? " "}</Text>
                </View>
              );
            })}
          </View>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onChangeCode}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
            caretHidden
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            returnKeyType="go"
            onSubmitEditing={handleVerify}
            accessibilityLabel={`รหัสยืนยัน ${OTP_LENGTH} หลัก`}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
          />
        </Pressable>

        {error ? (
          <Text className={`text-sm ${textError} text-center mt-4 leading-5`} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          className={`h-[54px] justify-center items-center mt-8 ${
            V2 ? `rounded-2xl ${V2C.dark}` : `rounded-[28px] ${filled ? BTN.solid : BTN.solidMuted}`
          }`}
          onPress={handleVerify}
          disabled={!V2 && !filled}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text className="text-base font-semibold text-white">ตกลง</Text>
        </TouchableOpacity>

        <View className="items-center mt-6">
          {left > 0 ? (
            <Text className={`text-sm ${textSub}`}>ไม่ได้รับรหัส OTP? ขออีกครั้งใน {left} วินาที</Text>
          ) : (
            <View className="flex-row items-center">
              <Text className={`text-sm ${textSub}`}>ไม่ได้รับรหัส OTP? </Text>
              <TouchableOpacity onPress={handleResend} hitSlop={10}>
                <Text className={`text-sm font-semibold ${textMain} underline`}>ขอรหัสใหม่</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={changePhone} hitSlop={10} className="mt-3">
            <Text className={`text-sm font-semibold ${textMain} underline`}>เปลี่ยนเบอร์โทร</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
