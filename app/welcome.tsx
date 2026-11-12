import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import SpinningLogo from "../components/SpinningLogo";
import PhoneInput from "../components/PhoneInput";
import { rememberedPhone, rememberPhone, sanitizePhoneInput, toE164TH } from "../lib/phone";

const RING_SIZE = 180;

export default function WelcomeScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(rememberedPhone);
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleChange = (text: string) => {
    setPhone(sanitizePhoneInput(text, phone));
    if (error) setError("");
  };

  const handleBlur = () => {
    if (phone.length === 0) setError("กรุณากรอกเบอร์โทรศัพท์");
  };

  const handleSubmit = () => {
    if (phone.length === 0) {
      setError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }
    if (!toE164TH(phone)) {
      setError("เบอร์โทรศัพท์ไม่ถูกต้อง");
      return;
    }
    setError("");
    rememberPhone(phone);
    router.push("/login" as any);
  };

  // ทางลัดตอนพัฒนา — เข้าแอปโดยไม่มีบัญชี (ใช้ได้จนกว่าจะรัน accounts.sql · หลังจากนั้นจะไม่เห็นข้อมูลอะไร)
  // ไม่มีในแอปที่ build ออกไปจริง (__DEV__ เป็น false)
  const skipLogin = () => router.replace("/home" as any);

  const isButtonActive = phone.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 px-8 pt-20">
        <View className="items-center mb-6">
          <SpinningLogo size={RING_SIZE} paused={dropdownOpen} />
        </View>

        <Text className="text-[28px] font-bold text-[#1A1A1A] text-center mb-3">
          ยินดีต้อนรับสู่ Middle
        </Text>
        <Text className="text-sm text-[#888888] text-center leading-[22px] mb-8">
          กรุณากรอกเบอร์โทรศัพท์เพื่อรับการแจ้งเตือนเหตุ{"\n"}
          ฉุกเฉินและระบบตรวจจับการล้ม
        </Text>

        <PhoneInput
          value={phone}
          error={error}
          onChangeText={handleChange}
          onBlur={handleBlur}
          onDropdownChange={setDropdownOpen}
        />

        <TouchableOpacity
          className={`h-[52px] rounded-[28px] justify-center items-center mt-8 ${
            isButtonActive ? "bg-[#FF3055]" : "bg-[#F0D9DD]"
          }`}
          onPress={handleSubmit}
          disabled={!isButtonActive}
          activeOpacity={0.8}
        >
          <Text className="text-base font-semibold text-white">ถัดไป</Text>
        </TouchableOpacity>

        {__DEV__ && (
          <TouchableOpacity onPress={skipLogin} hitSlop={12} className="items-center mt-6">
            <Text className="text-xs text-[#AAAAAA]">ข้ามการเข้าสู่ระบบ (เฉพาะตอนพัฒนา)</Text>
          </TouchableOpacity>
        )}
      </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
