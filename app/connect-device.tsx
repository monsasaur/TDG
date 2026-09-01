import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import AddActionPill from "../components/AddActionPill";
import DeviceStatusCard from "../components/DeviceStatusCard";
import NetworkRow from "../components/NetworkRow";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import {
  connect,
  scanWifi,
  disconnect,
  currentDeviceName,
  errorMessage,
} from "../lib/provisioning";

export default function ConnectDeviceScreen() {
  const router = useRouter();
  const { device, deviceId, pop } = useLocalSearchParams<{
    device?: string;
    deviceId?: string;
    pop?: string;   // Proof of Possession จาก QR / รหัสบนกล่อง
  }>();

  const [scanning, setScanning] = useState(true);
  const [networks, setNetworks] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();

  // เชื่อมต่ออุปกรณ์ก่อน แล้วค่อยให้อุปกรณ์สแกน WiFi รอบตัวมันเอง
  // (ไม่ใช่ WiFi ที่มือถือเห็น — อุปกรณ์อาจอยู่คนละมุมบ้าน เจอคนละเครือข่ายกัน)
  const run = useCallback(async () => {
    if (!device) {
      setError("ไม่พบอุปกรณ์ที่เลือก");
      setScanning(false);
      return;
    }
    setScanning(true);
    setError(undefined);
    try {
      if (currentDeviceName() !== device) await connect(device, pop);
      setNetworks(await scanWifi());
    } catch (err) {
      setError(errorMessage(err));
      setNetworks([]);
    } finally {
      setScanning(false);
    }
  }, [device, pop]);

  useEffect(() => {
    run();
  }, [run]);

  // ตัดการเชื่อมต่อ BLE เมื่อผู้ใช้ถอยออกจาก flow ไม่งั้นค้างเชื่อมต่อไว้
  const handleBack = () => {
    disconnect();
    router.back();
  };

  const selectNetwork = (ssid: string) =>
    router.push(
      `/wifi-password?ssid=${encodeURIComponent(ssid)}&device=${encodeURIComponent(
        device ?? "",
      )}${deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""}` as never,
    );

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เชื่อมต่ออุปกรณ์" onBack={handleBack} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 mt-5">
          <DeviceStatusCard status={`เชื่อมต่อ ${device ?? ""}`.trim()} />
        </View>

        <View className="px-5 mt-5">
          <View className="flex-row items-center mb-2">
            <Text className="text-sm font-semibold text-[#1A1A1A]">
              เครือข่ายที่พร้อมใช้งาน
            </Text>
            {scanning && (
              <ActivityIndicator
                size="small"
                color="#FF3055"
                className="ml-2"
              />
            )}
          </View>
          <Text className="text-xs text-[#888] leading-5 mb-3">
            เลือกเครือข่าย Wi-Fi ที่คุณต้องการเชื่อมต่อกับอุปกรณ์ตรวจจับการล้ม
          </Text>

          {!scanning && error && (
            <View className="bg-white rounded-xl p-4">
              <Text className="text-sm text-[#1A1A1A] mb-1">เชื่อมต่อไม่สำเร็จ</Text>
              <Text className="text-xs text-[#888] leading-5 mb-3">{error}</Text>
              <PrimaryButton label="ลองใหม่" onPress={run} />
            </View>
          )}

          {!scanning && !error && networks.length === 0 && (
            <View className="bg-white rounded-xl p-4">
              <Text className="text-xs text-[#888] leading-5">
                อุปกรณ์ไม่พบเครือข่าย Wi-Fi ลองขยับอุปกรณ์ให้ใกล้เราเตอร์แล้วกดลองใหม่
              </Text>
            </View>
          )}

          {!scanning && !error && networks.length > 0 && (
            <View className="bg-white rounded-xl overflow-hidden">
              {networks.map((ssid, i) => (
                <NetworkRow
                  key={ssid}
                  ssid={ssid}
                  showDivider={i > 0}
                  onPress={() => selectNetwork(ssid)}
                />
              ))}
            </View>
          )}

          <AddActionPill
            label="เพิ่มเครือข่าย"
            onPress={() =>
              router.push(
                `/add-network?device=${encodeURIComponent(device ?? "")}${
                  deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""
                }` as never,
              )
            }
            className="mt-3"
          />
        </View>
      </ScrollView>
    </View>
  );
}
