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
import { BTN } from "../components/buttonTheme";
import { PHONE_EXISTS_MESSAGE } from "../lib/authErrors";
import FormRow from "../components/FormRow";
import { V2, V2C } from "../components/designVersion";

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
    if (!phone) e.phone = "กรุณากรอกเบอร์โทรศัพท์";
    else if (!toE164TH(phone)) e.phone = V2 ? "กรุณาตรวจสอบเบอร์โทรศัพท์" : "เบอร์โทรศัพท์ไม่ถูกต้อง";
    if (V2 && !password) e.password = "กรุณากรอกรหัสผ่าน";
    else if (password.length < MIN_PASSWORD) e.password = `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัว`;
    if (confirm !== password) e.confirm = "รหัสผ่านไม่ตรงกัน";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    // v2 กดได้ตลอดแล้วบอกว่าขาดอะไร · v1 ปุ่มเปิดเมื่อกรอกครบ
    if (busy || (!V2 && !filled) || !validate()) return;
    setBusy(true);
    setFormError("");
    const res = await signUp(phone, password, name);
    if (!res.ok) {
      setBusy(false);
      setFormError(res.message);
      return;
    }
    rememberPhone(phone);
    // บัญชีใหม่ยังไม่มีบ้าน — พาไปสร้างบ้านหรือเข้าร่วมบ้านก่อน แทนหน้า home ที่ว่างเปล่า
    if (router.canDismiss()) router.dismissAll();
    router.replace("/get-started" as any);
  };

  const goLogin = () => {
    rememberPhone(phone);
    if (router.canGoBack()) router.back();
    else router.replace("/welcome" as any);
  };

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
          <View className="bg-white rounded-2xl overflow-hidden">
            <FormRow
              icon="person-outline"
              label="ชื่อที่แสดง"
              placeholder="เช่น สมชาย (ลูกชาย)"
              value={name}
              error={errors.name}
              autoFocus
              maxLength={40}
              textContentType="name"
              autoComplete="name"
              onChangeText={(t) => {
                setName(t);
                clear("name");
              }}
            />
            <FormRow
              icon="call-outline"
              label="เบอร์โทรศัพท์"
              placeholder="08x-xxx-xxxx"
              value={phone}
              error={errors.phone}
              keyboardType="number-pad"
              maxLength={10}
              onChangeText={(t) => {
                setPhone(sanitizePhoneInput(t, phone));
                clear("phone");
              }}
            />
            <FormRow
              icon="lock-closed-outline"
              label={`รหัสผ่าน (อย่างน้อย ${MIN_PASSWORD} ตัว)`}
              value={password}
              error={errors.password}
              secure
              textContentType="newPassword"
              autoComplete="new-password"
              onChangeText={(t) => {
                setPassword(t);
                clear("password");
              }}
            />
            <FormRow
              icon="lock-closed-outline"
              label="ยืนยันรหัสผ่าน"
              value={confirm}
              error={errors.confirm}
              secure
              last
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              onChangeText={(t) => {
                setConfirm(t);
                clear("confirm");
              }}
            />
          </View>
          <Text className="text-xs text-[#858891] mt-2 mx-1 leading-[18px]">
            สมาชิกในบ้านจะเห็นชื่อที่แสดงเป็น &quot;รับทราบโดย&quot; เมื่อคุณกดรับทราบการแจ้งเตือน
          </Text>

          {formError ? (
            <View className="items-center mt-4" accessibilityLiveRegion="polite">
              <Text className="text-sm text-[#DC2626] text-center leading-5">{formError}</Text>
              {formError === PHONE_EXISTS_MESSAGE && (
                <TouchableOpacity onPress={goLogin} hitSlop={10} className="mt-2" accessibilityRole="button">
                  <Text className="text-sm font-semibold text-[#292A32] underline">ไปหน้าเข้าสู่ระบบ</Text>
                </TouchableOpacity>
              )}
            </View>
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
              <Text className="text-base font-semibold text-white">สมัครใช้งาน</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-[#858891]">มีบัญชีแล้ว? </Text>
            <TouchableOpacity onPress={goLogin} hitSlop={10} disabled={busy}>
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
            <Text className="text-base font-semibold text-white">สมัครใช้งาน</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-sm text-sub">มีบัญชีแล้ว? </Text>
          <TouchableOpacity onPress={goLogin} hitSlop={10} disabled={busy}>
            <Text className="text-sm font-semibold text-brand">เข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
