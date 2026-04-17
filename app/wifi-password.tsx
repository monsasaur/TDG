import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center h-7">
          <TouchableOpacity onPress={() => router.back()} hitSlop={20}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-[#1A1A1A] ml-2">
            {ssid && ssid.length > 0 ? ssid : "ชื่อ Wi-Fi"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 px-5">
          <Text className="text-sm text-[#1A1A1A] mt-5 mb-2">รหัสผ่าน Wi-Fi</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            className="bg-white rounded-xl px-4 py-3 text-sm text-[#1A1A1A] border border-[#E8E8E8]"
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

      {/* Fail modal */}
      <Modal
        transparent
        animationType="fade"
        visible={failModal}
        onRequestClose={() => setFailModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFailModal(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-10">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-2xl px-5 py-5 w-full">
                <Text className="text-base font-semibold text-[#1A1A1A] mb-2">
                  เชื่อมต่ออุปกรณ์ไม่ได้
                </Text>
                <Text className="text-sm text-[#555] leading-5">
                  ตรวจสอบให้แน่ใจว่าคุณอยู่ในระยะอุปกรณ์ แล้วลองเชื่อมต่ออีกครั้ง
                </Text>
                <View className="items-end mt-4">
                  <TouchableOpacity onPress={() => setFailModal(false)}>
                    <Text className="text-sm font-semibold text-[#FF3055]">
                      ปิด
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
