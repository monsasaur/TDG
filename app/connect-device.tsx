import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { mockAvailableNetworks } from "../data/mockDevices";
import PageHeader from "../components/PageHeader";
import AddActionPill from "../components/AddActionPill";
import DeviceStatusCard from "../components/DeviceStatusCard";
import NetworkRow from "../components/NetworkRow";

const SCAN_MS = 1500;

export default function ConnectDeviceScreen() {
  const router = useRouter();
  const { device } = useLocalSearchParams<{ device?: string }>();

  const [scanning, setScanning] = useState(true);
  const [networks, setNetworks] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setNetworks(mockAvailableNetworks);
      setScanning(false);
    }, SCAN_MS);
    return () => clearTimeout(t);
  }, []);

  const selectNetwork = (ssid: string) =>
    router.push(
      `/wifi-password?ssid=${encodeURIComponent(ssid)}&device=${encodeURIComponent(
        device ?? ""
      )}` as never
    );

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เชื่อมต่ออุปกรณ์" onBack={() => router.back()} />

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
              <ActivityIndicator size="small" color="#FF3055" className="ml-2" />
            )}
          </View>
          <Text className="text-xs text-[#888] leading-5 mb-3">
            เลือกเครือข่าย Wi-Fi ที่คุณต้องการเชื่อมต่อกับอุปกรณ์ตรวจจับการล้ม
          </Text>

          {!scanning && networks.length > 0 && (
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
                `/add-network?device=${encodeURIComponent(
                  device ?? ""
                )}` as never
              )
            }
            className="mt-3"
          />
        </View>
      </ScrollView>
    </View>
  );
}
