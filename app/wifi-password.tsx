import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import ConfirmModal from "../components/ConfirmModal";

export default function WifiPasswordScreen() {
  const router = useRouter();
  const { ssid } = useLocalSearchParams<{ ssid?: string }>();

  const [password, setPassword] = useState("");
  const [failModal, setFailModal] = useState(false);

  const canSubmit = password.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (password.length < 8) {
      setFailModal(true);
      return;
    }
    router.replace("/devices" as never);
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader
        title={ssid && ssid.length > 0 ? ssid : "ชื่อ Wi-Fi"}
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1">
          <LabeledTextField
            label="รหัสผ่าน Wi-Fi"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            containerClassName="px-5 mt-5"
          />
        </View>

        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-full py-4 items-center ${
              canSubmit ? "bg-[#FF3055]" : "bg-[#FFD4DC]"
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                canSubmit ? "text-white" : "text-[#FFF6F8]"
              }`}
            >
              ถัดไป
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            className="items-center mt-3"
          >
            <Text className="text-sm text-[#1A1A1A]">ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={failModal}
        onClose={() => setFailModal(false)}
        title="เชื่อมต่ออุปกรณ์ไม่ได้"
        message="ตรวจสอบให้แน่ใจว่าคุณอยู่ในระยะอุปกรณ์ แล้วลองเชื่อมต่ออีกครั้ง"
        titleAlign="left"
        messageAlign="left"
      />
    </View>
  );
}
