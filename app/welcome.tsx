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

const RING_SIZE = 180;
const VALID_FIRST_DIGITS = ["0", "6", "8", "9"];

export default function WelcomeScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const formatPhone = (input: string): string => {
    const digits = input.replace(/\D/g, "");
    if (digits.length === 0) return "";
    if (!VALID_FIRST_DIGITS.includes(digits[0])) return phone;
    const maxLen = digits[0] === "0" ? 10 : 9;
    return digits.slice(0, maxLen);
  };

  const handleChange = (text: string) => {
    setPhone(formatPhone(text));
    if (error) setError("");
  };

  const handleBlur = () => {
    if (phone.length === 0) setError("กรุณากรอกเบอร์โทรศัพท์");
  };

  const validatePhone = (value: string): boolean => {
    const stripped = value.startsWith("0") ? value.slice(1) : value;
    if (stripped.length !== 9) return false;
    if (!["6", "8", "9"].includes(stripped[0])) return false;
    return true;
  };

  const handleSubmit = () => {
    if (phone.length === 0) {
      setError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }
    if (!validatePhone(phone)) {
      setError("เบอร์โทรศัพท์ไม่ถูกต้อง");
      return;
    }
    setError("");
    router.replace("/home" as any);
  };

  const isButtonActive = phone.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 px-8 pt-20">
        <View className="items-center mb-6">
          <SpinningLogo size={RING_SIZE} />
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
      </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
