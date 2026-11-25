import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import PageHeader from "../components/PageHeader";
import PhoneInput from "../components/PhoneInput";
import { rememberedPhone, rememberPhone, sanitizePhoneInput, toE164TH } from "../lib/phone";
import { BTN } from "../components/buttonTheme";
import FormRow from "../components/FormRow";
import { V2, V2C } from "../components/designVersion";
import { clearOtp, issueOtp } from "../lib/devOtp";

/**
 * สมัครใช้งาน ขั้นที่ 1 จาก 3 — กรอกเบอร์โทรเพื่อรับรหัสยืนยัน
 *
 *   register (เบอร์)  →  register-otp (รหัส 6 หลัก)  →  register-details (ชื่อ · รหัสผ่าน)
 *
 * บัญชีถูกสร้างจริงที่หน้าสุดท้ายหน้าเดียว — สองหน้าแรกยังไม่แตะ Supabase
 * (เบอร์ซ้ำจึงรู้ตอนหน้าสุดท้าย เพราะไม่มีทางถามว่าเบอร์นี้สมัครแล้วหรือยังโดยไม่ login)
 */
export default function RegisterScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(rememberedPhone);
  const [error, setError] = useState("");

  const filled = phone.length > 0;

  const handleNext = () => {
    // v2 กดได้ตลอดแล้วบอกว่าขาดอะไร · v1 ปุ่มเปิดเมื่อกรอกครบ
    if (!V2 && !filled) return;
    if (!phone) {
      setError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }
    const e164 = toE164TH(phone);
    if (!e164) {
      setError(V2 ? "กรุณาตรวจสอบเบอร์โทรศัพท์" : "เบอร์โทรศัพท์ไม่ถูกต้อง");
      return;
    }
    setError("");
    rememberPhone(phone);
    clearOtp();
    issueOtp(e164);
    router.push({ pathname: "/register-otp", params: { phone } } as any);
  };

  const goLogin = () => {
    rememberPhone(phone);
    if (router.canGoBack()) router.back();
    else router.replace("/welcome" as any);
  };

  const onChangePhone = (t: string) => {
    setPhone(sanitizePhoneInput(t, phone));
    if (error) setError("");
  };

  const hint = "เราจะส่งรหัสยืนยัน 6 หลักไปที่เบอร์นี้";

  // ดีไซน์ v2 (components/designVersion.ts) — ตรรกะเดียวกับด้านล่างทุกอย่าง ต่างแค่หน้าตา
  if (V2) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className={`flex-1 ${V2C.page}`}>
        <Stack.Screen options={{ animation: "slide_from_right" }} />
        <PageHeader title="สมัครใช้งาน" onBack={() => router.back()} />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-sm text-[#858891] mb-3 mx-1 leading-5">{hint}</Text>

          <View className="bg-white rounded-2xl overflow-hidden">
            <FormRow
              icon="call-outline"
              label="เบอร์โทรศัพท์"
              placeholder="08x-xxx-xxxx"
              value={phone}
              error={error}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
              last
              returnKeyType="next"
              onSubmitEditing={handleNext}
              onChangeText={onChangePhone}
            />
          </View>

          <TouchableOpacity
            className={`h-[54px] rounded-2xl justify-center items-center mt-6 ${V2C.dark}`}
            onPress={handleNext}
            accessibilityRole="button"
            activeOpacity={0.85}
          >
            <Text className="text-base font-semibold text-white">ถัดไป</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-[#858891]">มีบัญชีแล้ว? </Text>
            <TouchableOpacity onPress={goLogin} hitSlop={10}>
              <Text className="text-sm font-semibold text-[#292A32] underline">เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="สมัครใช้งาน" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-sm text-sub mb-5 leading-5">{hint}</Text>

        <PhoneInput
          value={phone}
          error={error}
          onChangeText={onChangePhone}
        />

        <TouchableOpacity
          className={`h-[52px] rounded-[28px] justify-center items-center mt-8 ${
            filled ? BTN.solid : BTN.solidMuted
          }`}
          onPress={handleNext}
          disabled={!filled}
          activeOpacity={0.8}
        >
          <Text className="text-base font-semibold text-white">ถัดไป</Text>
        </TouchableOpacity>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-sm text-sub">มีบัญชีแล้ว? </Text>
          <TouchableOpacity onPress={goLogin} hitSlop={10}>
            <Text className="text-sm font-semibold text-brand">เข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
