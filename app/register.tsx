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

/** ความยาวรหัสผ่านขั้นต่ำ — ค่าเริ่มต้นของ Supabase Auth (ถ้าแก้ใน dashboard ต้องแก้ตรงนี้ด้วย) */
const MIN_PASSWORD = 6;

type FieldErrors = { name?: string; phone?: string; password?: string; confirm?: string };

/** สมัครบัญชี — ชื่อที่ตั้งตรงนี้คือ "รับทราบโดย" ที่สมาชิกในบ้านเห็นตอนกดรับทราบการแจ้งเตือน */
export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(rememberedPhone);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const filled = name.trim().length > 0 && phone.length > 0 && password.length > 0 && confirm.length > 0;

  const clear = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (formError) setFormError("");
  };

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อ";
    if (!toE164TH(phone)) e.phone = "เบอร์โทรศัพท์ไม่ถูกต้อง";
    if (password.length < MIN_PASSWORD) e.password = `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัว`;
    if (confirm !== password) e.confirm = "รหัสผ่านไม่ตรงกัน";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!filled || busy || !validate()) return;
    setBusy(true);
    setFormError("");
    const res = await signUp(phone, password, name);
    if (!res.ok) {
      setBusy(false);
      setFormError(res.message);
      return;
    }
    rememberPhone(phone);
    if (router.canDismiss()) router.dismissAll();
    router.replace("/home" as any);
  };

  const goLogin = () => {
    rememberPhone(phone);
    if (router.canGoBack()) router.back();
    else router.replace("/login" as any);
  };

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
        <AuthField
          label="ชื่อที่แสดง"
          value={name}
          onChangeText={(t) => {
            setName(t);
            clear("name");
          }}
          error={errors.name}
          hint='สมาชิกในบ้านจะเห็นชื่อนี้เป็น "รับทราบโดย" เมื่อคุณกดรับทราบการแจ้งเตือน'
          placeholder="เช่น สมชาย (ลูกชาย)"
          autoFocus
          maxLength={40}
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
        />

        <View className="mt-5">
          <PhoneInput
            value={phone}
            error={errors.phone}
            onChangeText={(t) => {
              setPhone(sanitizePhoneInput(t, phone));
              clear("phone");
            }}
          />
        </View>

        <View className="mt-5">
          <AuthField
            label="รหัสผ่าน"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clear("password");
            }}
            error={errors.password}
            hint={`อย่างน้อย ${MIN_PASSWORD} ตัว`}
            secure
            textContentType="newPassword"
            autoComplete="new-password"
          />
        </View>

        <View className="mt-5">
          <AuthField
            label="ยืนยันรหัสผ่าน"
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t);
              clear("confirm");
            }}
            error={errors.confirm}
            secure
            textContentType="newPassword"
            autoComplete="new-password"
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
            <Text className="text-base font-semibold text-white">สมัครใช้งาน</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-sm text-[#888888]">มีบัญชีแล้ว? </Text>
          <TouchableOpacity onPress={goLogin} hitSlop={10} disabled={busy}>
            <Text className="text-sm font-semibold text-[#FF3055]">เข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
