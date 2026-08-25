import { useMemo, useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { useDevices } from "../contexts/DevicesContext";
import { useAlerts } from "../contexts/AlertsContext";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import PrimaryButton from "../components/PrimaryButton";
import DeviceSuccessCard from "../components/DeviceSuccessCard";

export default function DeviceSetupScreen() {
  const router = useRouter();
  const { devices, updateDevice } = useDevices();
  const { setSystemAlerts } = useAlerts();
  const { device, ssid, deviceId } = useLocalSearchParams<{
    device?: string;
    ssid?: string;
    deviceId?: string;
  }>();

  const existingDevice = useMemo(
    () => (deviceId ? devices.find((d) => d.id === deviceId) : undefined),
    [devices, deviceId]
  );

  const deviceCode = device && device.length > 0 ? device : "ESP-BT001";
  const network = ssid && ssid.length > 0 ? ssid : "MyHome_2.4G";

  const [name, setName] = useState(existingDevice?.name ?? deviceCode);

  const canSubmit = name.trim().length > 0;

  const handleSave = () => {
    if (!canSubmit) return;
    if (deviceId) {
      updateDevice(deviceId, { name: name.trim(), status: "connected" });
      setSystemAlerts((prev) => prev.filter((a) => a.deviceId !== deviceId));
      // Pop scan-devices + connect-device + (wifi-password|add-network replaced by device-setup)
      router.dismiss(3);
      return;
    }
    // New device flow: pop select-house + scan-devices + connect-device + current
    router.dismiss(4);
  };

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ตั้งค่าอุปกรณ์" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-base font-semibold text-[#1A1A1A] px-5 mt-5">
            ตั้งค่าอุปกรณ์
          </Text>

          <View className="px-5 mt-3">
            <DeviceSuccessCard
              title={`เชื่อมต่อ ${deviceCode} สำเร็จ`}
              subtitle={`${deviceCode} → ${network}`}
            />
          </View>

          <LabeledTextField
            label="ชื่ออุปกรณ์"
            value={name}
            onChangeText={setName}
            containerClassName="px-5 mt-5"
          />
        </ScrollView>

        <View className="px-5 pb-8">
          <PrimaryButton
            label="บันทึก"
            onPress={handleSave}
            disabled={!canSubmit}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
