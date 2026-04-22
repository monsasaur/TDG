import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import StackedInputCard from "../components/StackedInputCard";

const MIN_SSID = 1;
const MIN_PASSWORD = 8;
const CONNECT_MS = 2000;
const WRONG_SSID = "wrong";

export default function AddNetworkScreen() {
  const router = useRouter();
  const { device, deviceId } = useLocalSearchParams<{
    device?: string;
    deviceId?: string;
  }>();
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const canSubmit =
    ssid.length >= MIN_SSID && password.length >= MIN_PASSWORD && !connecting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(undefined);
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      if (ssid === WRONG_SSID) {
        setError("ชื่อ WiFi หรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      router.replace(
        `/device-setup?device=${encodeURIComponent(
          device ?? "",
        )}&ssid=${encodeURIComponent(ssid)}${
          deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""
        }` as never,
      );
    }, CONNECT_MS);
  };

  const clearErrorOnChange =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      if (error) setError(undefined);
    };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="เพิ่มเครือข่าย" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1">
          <StackedInputCard
            className="px-5 mt-5"
            error={error}
            fields={[
              {
                label: "ชื่อ WiFi",
                value: ssid,
                onChangeText: clearErrorOnChange(setSsid),
                autoCapitalize: "none",
              },
              {
                label: "รหัสผ่าน Wi-Fi",
                value: password,
                onChangeText: clearErrorOnChange(setPassword),
                secureTextEntry: true,
                autoCapitalize: "none",
              },
            ]}
          />

          {connecting && (
            <View className="mx-5 mt-4 bg-white rounded-xl px-4 py-3 flex-row items-center border border-[#E8E8E8]">
              <ActivityIndicator size="small" color="#FF3055" />
              <Text className="text-sm text-[#1A1A1A] ml-3">
                กำลังเชื่อมต่อ...
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
