import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import Dropdown from "../components/Dropdown";
import PrimaryButton from "../components/PrimaryButton";
import DeviceSuccessCard from "../components/DeviceSuccessCard";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function DeviceSetupScreen() {
  const router = useRouter();
  const { device, ssid } = useLocalSearchParams<{
    device?: string;
    ssid?: string;
  }>();

  const deviceCode = device && device.length > 0 ? device : "ESP-BT001";
  const network = ssid && ssid.length > 0 ? ssid : "MyHome_2.4G";

  const [name, setName] = useState(deviceCode);
  const [house, setHouse] = useState<string | undefined>(
    HOUSES.length === 1 ? HOUSES[0] : undefined
  );

  const canSubmit = name.trim().length > 0 && !!house;

  const handleSave = () => {
    if (!canSubmit) return;
    router.replace("/devices" as never);
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
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

          <Dropdown
            label="กลุ่มบ้าน"
            placeholder="-- เลือกบ้าน --"
            options={HOUSES}
            value={house}
            onChange={setHouse}
            containerClassName="px-5 mt-4"
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
