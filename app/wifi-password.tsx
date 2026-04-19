import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import PrimaryButton from "../components/PrimaryButton";

const MIN_PASSWORD = 8;
const CONNECT_MS = 2000;
const WRONG_PASSWORD = "wrong";

export default function WifiPasswordScreen() {
  const router = useRouter();
  const { ssid, device, deviceId } = useLocalSearchParams<{
    ssid?: string;
    device?: string;
    deviceId?: string;
  }>();

  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const canSubmit = password.length >= MIN_PASSWORD && !connecting;
  const wifiName = ssid && ssid.length > 0 ? ssid : "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(undefined);
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      if (password === WRONG_PASSWORD) {
        setError("รหัสผ่านไม่ถูกต้อง");
        return;
      }
      router.replace(
        `/device-setup?device=${encodeURIComponent(
          device ?? ""
        )}&ssid=${encodeURIComponent(wifiName)}${
          deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""
        }` as never
      );
    }, CONNECT_MS);
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เชื่อมต่ออุปกรณ์" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1">
          <Text className="text-base font-semibold text-[#1A1A1A] px-5 mt-5">
            กรอกรหัส WiFi
          </Text>

          <LabeledTextField
            label="ชื่อ WiFi"
            value={wifiName}
            readOnly
            containerClassName="px-5 mt-4"
          />

          <LabeledTextField
            label="รหัสผ่าน Wi-Fi"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(undefined);
            }}
            secureTextEntry
            autoCapitalize="none"
            error={error}
            containerClassName="px-5 mt-4"
          />

          {connecting && (
            <View className="mx-5 mt-4 bg-white rounded-xl px-4 py-3 flex-row items-center border border-[#E8E8E8]">
              <ActivityIndicator size="small" color="#FF3055" />
              <Text className="text-sm text-[#1A1A1A] ml-3">
                กำลังเชื่อมต่ออุปกรณ์...
              </Text>
            </View>
          )}
        </View>

        <View className="px-5 pb-8">
          <PrimaryButton
            label="เชื่อมต่อ WiFi"
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
          <TouchableOpacity
            onPress={() => router.back()}
            className="items-center mt-3"
          >
            <Text className="text-sm text-[#1A1A1A]">ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
