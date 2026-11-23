import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import AuthField from "../components/AuthField";
import PhoneInput from "../components/PhoneInput";
import SpinningLogo from "../components/SpinningLogo";
import { useAuth } from "../contexts/AuthContext";
import { hasAnyHouse } from "../data/useHouses";
import { rememberedPhone, rememberPhone, sanitizePhoneInput, toE164TH } from "../lib/phone";

const RING_SIZE = 140;

/**
 * หน้าแรกของคนที่ยังไม่ได้ login — เข้าสู่ระบบได้ในหน้านี้เลย (เบอร์ + รหัสผ่าน) และมีปุ่มสมัครใช้งานแยกชัด
 * เดิมแยกเป็นหน้า welcome (กรอกเบอร์) → หน้า login (กรอกเบอร์ซ้ำ + รหัสผ่าน) · /login ยังอยู่แต่ส่งกลับมาที่นี่
 * login แล้วยังไม่มีบ้าน → หน้าเริ่มต้นใช้งาน (สร้างบ้าน / เข้าร่วมบ้าน)
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState(rememberedPhone);
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filled = phone.length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (!filled || busy) return;
    if (!toE164TH(phone)) {
      setPhoneError("เบอร์โทรศัพท์ไม่ถูกต้อง");
      return;
    }
    setBusy(true);
    setFormError("");
    const res = await signIn(phone, password);
    if (!res.ok) {
      setBusy(false);
      setFormError(res.message);
      return;
    }
    rememberPhone(phone);
    // เช็คไม่ได้ (null) ให้ไปหน้า home ไว้ก่อน — หน้า home มีปุ่มเพิ่มบ้านให้อยู่แล้วถ้ายังไม่มีบ้าน
    const anyHouse = await hasAnyHouse();
    // ล้างหน้านี้ออกจาก stack — กดย้อนจากหน้าถัดไปแล้วไม่วนกลับมาหน้า login
    if (router.canDismiss()) router.dismissAll();
    router.replace((anyHouse === false ? "/get-started" : "/home") as any);
  };

  const goRegister = () => {
    rememberPhone(phone);
    router.push("/register" as any);
  };

  // ทางลัดตอนพัฒนา — เข้าแอปโดยไม่มีบัญชี (ใช้ได้จนกว่าจะรัน accounts.sql · หลังจากนั้นจะไม่เห็นข้อมูลอะไร)
  // ไม่มีในแอปที่ build ออกไปจริง (__DEV__ เป็น false)
  const skipLogin = () => router.replace("/home" as any);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 64, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-5">
          <SpinningLogo size={RING_SIZE} paused={dropdownOpen} />
        </View>

        <Text className="text-[28px] font-bold text-[#1A1A1A] text-center mb-2">
          ยินดีต้อนรับสู่ Middle
        </Text>
        <Text className="text-sm text-[#888888] text-center leading-[22px] mb-7">
          เข้าสู่ระบบเพื่อรับการแจ้งเตือนเหตุฉุกเฉิน{"\n"}และการล้มของคนในบ้าน
        </Text>

        <PhoneInput
          value={phone}
          error={phoneError}
          onChangeText={(t) => {
            setPhone(sanitizePhoneInput(t, phone));
            setPhoneError("");
            setFormError("");
          }}
          onDropdownChange={setDropdownOpen}
        />

        <View className="mt-5">
          <AuthField
            label="รหัสผ่าน"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setFormError("");
            }}
            secure
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {formError ? (
          <Text className="text-sm text-[#FF3055] text-center mt-5 leading-5">{formError}</Text>
        ) : null}

        <TouchableOpacity
          className={`h-[52px] rounded-[28px] justify-center items-center mt-8 ${
            filled ? "bg-[#FF3055]" : "bg-[#F0D9DD]"
          }`}
          onPress={handleSubmit}
          disabled={!filled || busy}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">เข้าสู่ระบบ</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row items-center my-5">
          <View className="flex-1 h-px bg-[#EEE4E4]" />
          <Text className="text-xs text-[#AAAAAA] mx-3">ยังไม่มีบัญชี</Text>
          <View className="flex-1 h-px bg-[#EEE4E4]" />
        </View>

        <TouchableOpacity
          className="h-[52px] rounded-[28px] justify-center items-center border border-[#FF3055]"
          onPress={goRegister}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text className="text-base font-semibold text-[#FF3055]">สมัครใช้งาน</Text>
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity onPress={skipLogin} hitSlop={12} className="items-center mt-6">
            <Text className="text-xs text-[#AAAAAA]">ข้ามการเข้าสู่ระบบ (เฉพาะตอนพัฒนา)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
