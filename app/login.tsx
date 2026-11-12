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
import { Stack, useRouter } from "expo-router";
import AuthField from "../components/AuthField";
import PageHeader from "../components/PageHeader";
import PhoneInput from "../components/PhoneInput";
import { useAuth } from "../contexts/AuthContext";
import { rememberedPhone, rememberPhone, sanitizePhoneInput, toE164TH } from "../lib/phone";

/** เข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่าน — มาจากหน้า welcome (เบอร์ส่งต่อผ่าน rememberPhone) */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState(rememberedPhone);
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

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
    // ล้างหน้า welcome / login ออกจาก stack — กดย้อนจากหน้า home แล้วไม่วนกลับมาหน้านี้
    if (router.canDismiss()) router.dismissAll();
    router.replace("/home" as any);
  };

  const goRegister = () => {
    rememberPhone(phone);
    router.push("/register" as any);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="เข้าสู่ระบบ" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-sm text-[#888888] leading-[22px] mb-6">
          กรอกรหัสผ่านของบัญชีที่ผูกกับเบอร์นี้
        </Text>

        <PhoneInput
          value={phone}
          error={phoneError}
          onChangeText={(t) => {
            setPhone(sanitizePhoneInput(t, phone));
            setPhoneError("");
            setFormError("");
          }}
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
            autoFocus={phone.length > 0}
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

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-sm text-[#888888]">ยังไม่มีบัญชี? </Text>
          <TouchableOpacity onPress={goRegister} hitSlop={10} disabled={busy}>
            <Text className="text-sm font-semibold text-[#FF3055]">สมัครใช้งาน</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
