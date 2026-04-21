import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Linking,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";

type Permission = "undetermined" | "granted" | "denied";
type ScanOutcome = "found" | "empty";

const FOUND_DEVICES = ["ESP-BT001", "ESP-BT002"];
const PARTIAL_MS = 1500;
const DONE_MS = 3000;

export default function ScanDevicesScreen() {
  const router = useRouter();
  const { deviceId } = useLocalSearchParams<{ deviceId?: string }>();

  const [locationPermission, setLocationPermission] =
    useState<Permission>("undetermined");
  const [btPermission, setBtPermission] = useState<Permission>("undetermined");
  const [settingsPrompt, setSettingsPrompt] = useState(false);
  const requestedRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<string[]>([]);
  const outcomeRef = useRef<ScanOutcome>("found");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const allowed =
    locationPermission === "granted" && btPermission === "granted";
  const missingLocation = locationPermission !== "granted";
  const missingBt = btPermission !== "granted";

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const runScan = useCallback(
    (outcome: ScanOutcome) => {
      clearTimers();
      outcomeRef.current = outcome;
      setScanning(true);
      setDevices([]);
      if (outcome === "found") {
        timers.current.push(
          setTimeout(() => setDevices(FOUND_DEVICES), PARTIAL_MS)
        );
      }
      timers.current.push(setTimeout(() => setScanning(false), DONE_MS));
    },
    [clearTimers]
  );

  const requestBluetooth = useCallback(async (): Promise<Permission> => {
    if (Platform.OS !== "android") return "granted";
    try {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      const values = Object.values(result);
      if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED))
        return "granted";
      if (values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN))
        return "denied";
      return "denied";
    } catch {
      return "denied";
    }
  }, []);

  const requestAll = useCallback(async () => {
    const loc = await Location.requestForegroundPermissionsAsync();
    const locStatus: Permission =
      loc.status === "granted"
        ? "granted"
        : loc.canAskAgain
        ? "undetermined"
        : "denied";
    setLocationPermission(locStatus);

    const btStatus = await requestBluetooth();
    setBtPermission(btStatus);

    if (locStatus !== "granted" || btStatus !== "granted") {
      setSettingsPrompt(true);
    }
  }, [requestBluetooth]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    requestAll();
  }, [requestAll]);

  useEffect(() => {
    if (allowed) runScan("found");
    return clearTimers;
  }, [allowed, runScan, clearTimers]);

  const handleReset = () => {
    const next: ScanOutcome =
      outcomeRef.current === "found" ? "empty" : "found";
    runScan(next);
  };

  const handleOpenSettings = () => {
    setSettingsPrompt(false);
    if (Platform.OS !== "web") Linking.openSettings();
  };

  const selectDevice = (code: string) =>
    router.push(
      `/connect-device?device=${encodeURIComponent(code)}${
        deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""
      }` as never
    );

  const hasDevices = devices.length > 0;
  const showEmpty = !scanning && !hasDevices && allowed;

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="ค้นหาอุปกรณ์ใกล้เคียง" onBack={() => router.back()} />

      <View className="bg-white px-5 py-4 flex-row items-center">
        {scanning ? (
          <>
            <Text className="text-sm text-[#888] flex-1">
              สแกนอุปกรณ์ใกล้เคียงด้วยโทรศัพท์...
            </Text>
            <ActivityIndicator size="small" color="#FF3055" />
          </>
        ) : (
          <>
            <Text className="text-sm text-[#1A1A1A] flex-1">
              การสแกนบริเวณเสร็จสิ้น
            </Text>
            <TouchableOpacity onPress={handleReset} hitSlop={12}>
              <Ionicons name="refresh" size={18} color="#1A1A1A" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="items-center my-8">
          <View className="w-[110px] h-[170px] border-2 border-[#FF3055] rounded-3xl items-center justify-center">
            <View className="w-8 h-[2px] bg-[#FF3055]" />
          </View>
        </View>

        {showEmpty ? (
          <View className="px-8 items-center">
            <Text className="text-base font-semibold text-[#1A1A1A] mb-2">
              ไม่พบอุปกรณ์
            </Text>
            <Text className="text-xs text-[#888] text-center leading-5">
              หากค้นหาอุปกรณ์ของคุณไม่พบ ให้ดูคู่มือที่มาพร้อมกับ
              อุปกรณ์เพื่อหาวิธีทำให้ค้นหาอุปกรณ์ได้
            </Text>
          </View>
        ) : (
          <>
            <Text className="text-sm text-[#1A1A1A] px-5 mb-2">
              อุปกรณ์ที่ใช้งานได้
            </Text>
            <View className="px-5">
              {devices.map((code) => (
                <TouchableOpacity
                  key={code}
                  activeOpacity={0.7}
                  onPress={() => selectDevice(code)}
                  className="bg-white rounded-xl px-4 py-3 mb-2 border border-[#E8E8E8]"
                >
                  <Text className="text-sm text-[#1A1A1A]">{code}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!scanning && hasDevices && (
              <Text className="text-xs text-[#888] text-center px-8 mt-3 leading-5">
                หากค้นหาอุปกรณ์ของคุณไม่พบ ให้ดูคู่มือที่มาพร้อมกับ
                อุปกรณ์เพื่อหาวิธีทำให้ค้นหาอุปกรณ์ได้
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={settingsPrompt}
        onClose={() => setSettingsPrompt(false)}
        onConfirm={handleOpenSettings}
        confirmLabel="ไปที่การตั้งค่า"
        titleAlign="left"
        messageAlign="left"
      >
        <Text className="text-sm text-[#1A1A1A] leading-5">
          หากต้องการใช้คุณสมบัตินี้ คุณต้องให้การอนุญาติต่อไปในการตั้งค่า
        </Text>
        <View className="mt-3">
          {missingLocation && (
            <View className="mb-2">
              <Text className="text-sm text-[#1A1A1A]">• ตำแหน่ง</Text>
              <Text className="text-xs text-[#888] ml-3 mt-0.5">
                ใช้เพื่อสแกนหาอุปกรณ์ใกล้เคียงโดยใช้ WiFi
              </Text>
            </View>
          )}
          {missingBt && (
            <View>
              <Text className="text-sm text-[#1A1A1A]">• อุปกรณ์ที่อยู่ใกล้เคียง</Text>
              <Text className="text-xs text-[#888] ml-3 mt-0.5">
                ใช้เพื่อสแกนหาและเชื่อมต่อกับอุปกรณ์ใกล้เคียงโดยใช้ Bluetooth
              </Text>
            </View>
          )}
        </View>
        <Text className="text-sm text-[#1A1A1A] mt-4 leading-5">
          หากต้องการใช้คุณสมบัติต่อ ให้เปิดการตั้งค่า
          จากนั้นเลือกให้สิทธิ์ในการใช้งาน
        </Text>
      </ConfirmModal>
    </View>
  );
}
