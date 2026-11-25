import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import AuthField from "../components/AuthField";
import FormRow from "../components/FormRow";
import PageHeader from "../components/PageHeader";
import { BTN } from "../components/buttonTheme";
import { V2, V2C } from "../components/designVersion";
import { useAuth } from "../contexts/AuthContext";
import { PHONE_EXISTS_MESSAGE } from "../lib/authErrors";
import { clearOtp, isPhoneVerified } from "../lib/devOtp";
import { rememberPhone, toE164TH } from "../lib/phone";
import { safeBack } from "../lib/navigation";

/** ความยาวรหัสผ่านขั้นต่ำ — ค่าเริ่มต้นของ Supabase Auth (ถ้าแก้ใน dashboard ต้องแก้ตรงนี้ด้วย) */
const MIN_PASSWORD = 6;

type FieldErrors = { name?: string; password?: string; confirm?: string };

/**
 * สมัครใช้งาน ขั้นที่ 3 จาก 3 — ตั้งชื่อที่แสดงและรหัสผ่าน แล้วสร้างบัญชีจริง
 *
 * เข้าหน้านี้ได้เฉพาะเบอร์ที่เพิ่งยืนยัน OTP ผ่าน (lib/devOtp.isPhoneVerified)
 * ชื่อที่ตั้งตรงนี้คือ "รับทราบโดย" ที่สมาชิกในบ้านเห็นตอนกดรับทราบการแจ้งเตือน
 */
export default function RegisterDetailsScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = typeof params.phone === "string" ? params.phone : "";
  const e164 = toE164TH(phone);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  /** ยืนยัน OTP มาแล้วจริงไหม — เช็คครั้งเดียวตอนเปิดหน้า ไม่ให้หมดอายุกลางคันระหว่างพิมพ์ */
  const [verified] = useState(() => !!e164 && isPhoneVerified(e164));

  // ข้ามขั้นตอน OTP มา (หรือยืนยันไว้นานเกิน) — ส่งกลับไปเริ่มใหม่
  useEffect(() => {
    if (!verified) router.replace("/register" as any);
  }, [verified, router]);

  const filled = name.trim().length > 0 && password.length > 0 && confirm.length > 0;

  const clearField = (field: keyof FieldErrors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (formError) setFormError("");
  };

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = "กรุณากรอกชื่อ";
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
    clearOtp();
    // บ้านพื้นฐานชื่อ "บ้าน" ถูกสร้างให้เองที่ app/_layout.tsx (DefaultHouseSetup) จึงเข้าหน้าหลักได้เลย
    if (router.canDismiss()) router.dismissAll();
    router.replace("/home" as any);
  };

  const goLogin = () => {
    rememberPhone(phone);
    clearOtp();
    if (router.canDismiss()) router.dismissAll();
    router.replace("/welcome" as any);
  };

  // กันฟอร์มโผล่ค้างถ้า router.replace ข้างบนยังไม่ทำงาน (เช่นเปิดหน้านี้ตรง ๆ จากลิงก์)
  if (!verified) {
    return (
      <View className={`flex-1 ${V2 ? V2C.page : "bg-white"}`}>
        <Stack.Screen options={{ animation: "slide_from_right" }} />
        <PageHeader title="ตั้งชื่อและรหัสผ่าน" onBack={() => router.replace("/register" as any)} />
        <View className="flex-1 items-center justify-center px-8">
          <Text className={`text-base text-center leading-6 ${V2 ? "text-[#858891]" : "text-sub"}`}>
            ต้องยืนยันเบอร์โทรด้วยรหัส OTP ก่อน
          </Text>
          <TouchableOpacity onPress={() => router.replace("/register" as any)} hitSlop={10} className="mt-4">
            <Text className={`text-sm font-semibold underline ${V2 ? "text-[#292A32]" : "text-brand"}`}>
              กลับไปกรอกเบอร์โทร
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const nameHint = 'สมาชิกในบ้านจะเห็นชื่อที่แสดงเป็น "รับทราบโดย" เมื่อคุณกดรับทราบการแจ้งเตือน';

  const errorBlock = formError ? (
    <View className="items-center mt-4" accessibilityLiveRegion="polite">
      <Text className={`text-sm text-center leading-5 ${V2 ? "text-[#DC2626]" : "text-danger"}`}>{formError}</Text>
      {formError === PHONE_EXISTS_MESSAGE && (
        <TouchableOpacity onPress={goLogin} hitSlop={10} className="mt-2" accessibilityRole="button">
          <Text className={`text-sm font-semibold underline ${V2 ? "text-[#292A32]" : "text-brand"}`}>
            ไปหน้าเข้าสู่ระบบ
          </Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  // ดีไซน์ v2 (components/designVersion.ts) — ตรรกะเดียวกับด้านล่างทุกอย่าง ต่างแค่หน้าตา
  if (V2) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className={`flex-1 ${V2C.page}`}>
        <Stack.Screen options={{ animation: "slide_from_right" }} />
        <PageHeader title="ตั้งชื่อและรหัสผ่าน" onBack={() => safeBack(router)} />
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
                clearField("name");
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
                clearField("password");
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
                clearField("confirm");
              }}
            />
          </View>
          <Text className="text-xs text-[#858891] mt-2 mx-1 leading-[18px]">{nameHint}</Text>

          {errorBlock}

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
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ตั้งชื่อและรหัสผ่าน" onBack={() => safeBack(router)} />

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
            clearField("name");
          }}
          error={errors.name}
          hint={nameHint}
          placeholder="เช่น สมชาย (ลูกชาย)"
          autoFocus
          maxLength={40}
          textContentType="name"
          autoComplete="name"
          returnKeyType="next"
        />

        <View className="mt-5">
          <AuthField
            label="รหัสผ่าน"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearField("password");
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
              clearField("confirm");
            }}
            error={errors.confirm}
            secure
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {errorBlock}

        <TouchableOpacity
          className={`h-[52px] rounded-[28px] justify-center items-center mt-8 ${filled ? BTN.solid : BTN.solidMuted}`}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
