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
import { BTN } from "../components/buttonTheme";
import IconField from "../components/IconField";
import { V2, V2C } from "../components/designVersion";

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
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filled = phone.length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (busy) return;
    if (V2) {
      // v2: กดได้ตลอด แล้วบอกว่าขาดอะไรใต้ช่องนั้น (สเปคหัวข้อ Screen 1)
      const pe = !phone ? "กรุณากรอกเบอร์โทรศัพท์" : !toE164TH(phone) ? "กรุณาตรวจสอบเบอร์โทรศัพท์" : "";
      const we = !password ? "กรุณากรอกรหัสผ่าน" : "";
      setPhoneError(pe);
      setPasswordError(we);
      if (pe || we) return;
    } else {
      if (!filled) return;
      if (!toE164TH(phone)) {
        setPhoneError("เบอร์โทรศัพท์ไม่ถูกต้อง");
        return;
      }
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

  // ดีไซน์ v2 (components/designVersion.ts) — ตรรกะเดียวกับด้านล่างทุกอย่าง ต่างแค่หน้าตา
  if (V2) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 72, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mb-4">
            <SpinningLogo size={120} />
          </View>
          <Text className="text-[26px] font-bold text-[#292A32] text-center">เข้าสู่ระบบ</Text>
          <Text className="text-sm text-[#858891] text-center mt-1.5 mb-8">
            รับการแจ้งเตือนเมื่อมีคนในบ้านล้ม
          </Text>

          <IconField
            icon="call-outline"
            placeholder="เบอร์โทรศัพท์"
            value={phone}
            error={phoneError}
            keyboardType="number-pad"
            maxLength={10}
            textContentType="telephoneNumber"
            onChangeText={(t) => {
              setPhone(sanitizePhoneInput(t, phone));
              setPhoneError("");
              setFormError("");
            }}
          />
          <View className="mt-3">
            <IconField
              icon="lock-closed-outline"
              placeholder="รหัสผ่าน"
              value={password}
              error={passwordError}
              secure
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordError("");
                setFormError("");
              }}
            />
          </View>

          {formError ? (
            <Text accessibilityLiveRegion="polite" className="text-sm text-[#DC2626] text-center mt-4 leading-5">{formError}</Text>
          ) : null}

          <TouchableOpacity
            className={`h-[54px] rounded-2xl justify-center items-center mt-6 ${busy ? V2C.darkDisabled : V2C.dark}`}
            onPress={handleSubmit}
            disabled={busy}
            accessibilityRole="button"
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-px bg-[#E5E6E9]" />
            <Text className="text-xs text-[#9CA3AF] mx-3">หรือ</Text>
            <View className="flex-1 h-px bg-[#E5E6E9]" />
          </View>

          <TouchableOpacity
            className="h-[54px] rounded-2xl justify-center items-center bg-white border border-[#E5E6E9]"
            onPress={goRegister}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text className="text-base font-semibold text-[#292A32]">สมัครใช้งาน</Text>
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity onPress={skipLogin} hitSlop={12} className="items-center mt-6">
              <Text className="text-xs text-[#9CA3AF]">ข้ามการเข้าสู่ระบบ (เฉพาะตอนพัฒนา)</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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

        <Text className="text-[28px] font-bold text-ink text-center mb-2">
          ยินดีต้อนรับสู่ Middle
        </Text>
        <Text className="text-sm text-sub text-center leading-[22px] mb-7">
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
          <Text className="text-sm text-danger text-center mt-5 leading-5">{formError}</Text>
        ) : null}

        <TouchableOpacity
          className={`h-[52px] rounded-[28px] justify-center items-center mt-8 ${
            filled ? BTN.solid : BTN.solidMuted
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
          <View className="flex-1 h-px bg-line" />
          <Text className="text-xs text-[#AAAAAA] mx-3">ยังไม่มีบัญชี</Text>
          <View className="flex-1 h-px bg-line" />
        </View>

        <TouchableOpacity
          className={`h-[52px] rounded-[28px] justify-center items-center border ${BTN.outline}`}
          onPress={goRegister}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text className={`text-base font-semibold ${BTN.outlineText}`}>สมัครใช้งาน</Text>
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
