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
import { useHouses } from "../data/useHouses";
import { supabase } from "../data/supabaseClient";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import PrimaryButton from "../components/PrimaryButton";
import DeviceSuccessCard from "../components/DeviceSuccessCard";

export default function DeviceSetupScreen() {
  const router = useRouter();
  const { devices, setDevices, updateDevice } = useDevices();
  const { setSystemAlerts } = useAlerts();
  const { houses } = useHouses();
  const { device, ssid, deviceId, houseId } = useLocalSearchParams<{
    device?: string;
    ssid?: string;
    deviceId?: string;
    houseId?: string;
  }>();

  const existingDevice = useMemo(
    () => (deviceId ? devices.find((d) => d.id === deviceId) : undefined),
    [devices, deviceId]
  );

  // ค่าจากขั้นตอนจับคู่ BLE — ไม่มีค่าสำรอง ถ้าขาดแปลว่าเข้าหน้านี้ผิดทาง
  // (เดิมเติม "ESP-BT001" / "MyHome_2.4G" ให้ ทำให้บันทึกอุปกรณ์ที่ไม่มีอยู่จริงลงฐานข้อมูลได้)
  const deviceCode = device && device.length > 0 ? device : undefined;
  const network = ssid && ssid.length > 0 ? ssid : undefined; // ชื่อ WiFi มีช่องว่างได้ ห้าม trim
  const shownCode = deviceCode ?? existingDevice?.code;

  // ปัญหาที่ทำให้บันทึกไม่ได้ตั้งแต่ก่อนกดปุ่ม
  const setupProblem = (() => {
    if (deviceId) {
      // อุปกรณ์เดิม: เครื่องที่เพิ่งจับคู่ต้องเป็นเครื่องเดียวกับที่กดมาจากหน้ารายละเอียด
      if (existingDevice && deviceCode && deviceCode !== existingDevice.code) {
        return `เครื่องที่เพิ่งเชื่อมต่อคือ ${deviceCode} ไม่ใช่ ${existingDevice.code} กรุณากลับไปเลือกเครื่องให้ถูก`;
      }
      return undefined;
    }
    if (!deviceCode || !network) {
      return "ไม่ได้รับรหัสอุปกรณ์หรือชื่อ WiFi จากขั้นตอนจับคู่ กรุณาเริ่มใหม่จากหน้าเลือกบ้าน อุปกรณ์จะยังไม่ถูกบันทึก";
    }
    return undefined;
  })();

  const [name, setName] = useState(existingDevice?.name ?? deviceCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const shownError = setupProblem ?? error;

  const canSubmit = name.trim().length > 0 && !saving && !setupProblem;

  const handleSave = async () => {
    if (!canSubmit) return;
    setError(undefined);

    // ── อุปกรณ์เดิม: แก้ชื่อแล้วปิด system alert ที่ค้างอยู่
    if (deviceId) {
      setSaving(true);
      try {
        await updateDevice(deviceId, {
          name: name.trim(),
          status: "connected",
          // เปลี่ยน WiFi ผ่าน flow นี้ได้ — เดิมไม่บันทึก หน้ารายละเอียดจึงโชว์ชื่อเครือข่ายเก่า
          ...(network ? { wifi_ssid: network } : {}),
        });
        setSystemAlerts((prev) => prev.filter((a) => a.deviceId !== deviceId));
        // Pop scan-devices + device-pairing-code + connect-device
        //     + (wifi-password|add-network replaced by device-setup)
        router.dismiss(4);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง"
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    // ── อุปกรณ์ใหม่: ต้อง insert ลง Supabase
    //
    // devices.house_id เป็น FK บังคับ ถ้าไม่มี houseId ส่งมาก็ insert ไม่ได้
    // เกิดได้เมื่อเข้าหน้านี้โดยไม่ผ่าน select-house — กันไว้ไม่ให้เงียบ
    if (!houseId) {
      setError(
        "ไม่พบบ้านที่เลือกไว้ กรุณาเริ่มใหม่จากหน้าเลือกบ้าน อุปกรณ์จะยังไม่ถูกบันทึก"
      );
      return;
    }

    if (!deviceCode || !network) return; // กันอีกชั้น — setupProblem ปิดปุ่มไว้แล้ว

    setSaving(true);
    try {
      // id เป็น TEXT ในฐานข้อมูล ใช้แพตเทิร์นเดียวกับที่ add-house ใช้ (h<timestamp>)
      const newId = `d${Date.now()}`;

      const { error: insertError } = await supabase.from("devices").insert([
        {
          id: newId,
          house_id: houseId,
          name: name.trim(),
          code: deviceCode,
          wifi_ssid: network,
          status: "connected",
        },
      ]);

      if (insertError) {
        // รหัสที่ยืนยันจาก Supabase จริงแล้ว (ทดสอบ 13 ต.ค. 2026)
        // 23505 = unique violation บน devices_code_key
        if (insertError.code === "23505") {
          throw new Error(
            `อุปกรณ์รหัส ${deviceCode} ลงทะเบียนไว้แล้ว ตรวจดูในหน้าอุปกรณ์`
          );
        }
        // 23503 = FK violation บน devices_house_id_fkey — บ้านถูกลบไปหลังเลือก
        if (insertError.code === "23503") {
          throw new Error(
            "บ้านที่เลือกไว้ไม่มีอยู่แล้ว กรุณาเริ่มใหม่จากหน้าเลือกบ้าน"
          );
        }
        throw new Error(insertError.message);
      }

      // เพิ่มเข้า state ให้โผล่ในหน้าอุปกรณ์ทันที ไม่ต้องรอโหลดรอบใหม่
      setDevices((prev) => [
        ...prev,
        {
          id: newId,
          name: name.trim(),
          code: deviceCode,
          wifi_ssid: network,
          status: "connected",
          houseName: houses.find((h) => h.id === houseId)?.name ?? "ไม่ระบุ",
        },
      ]);

      // New device flow: pop select-house + scan-devices + device-pairing-code
      //     + connect-device + current
      router.dismiss(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
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

          {shownCode && !setupProblem && (
            <View className="px-5 mt-3">
              <DeviceSuccessCard
                title={`เชื่อมต่อ ${shownCode} สำเร็จ`}
                subtitle={network ? `${shownCode} → ${network}` : shownCode}
              />
            </View>
          )}

          <LabeledTextField
            label="ชื่ออุปกรณ์"
            value={name}
            onChangeText={setName}
            containerClassName="px-5 mt-5"
          />

          {shownError ? (
            <Text className="text-sm text-[#D14343] px-5 mt-3">
              {shownError}
            </Text>
          ) : null}
        </ScrollView>

        <View className="px-5 pb-8">
          <PrimaryButton
            label={saving ? "กำลังบันทึก..." : "บันทึก"}
            onPress={handleSave}
            disabled={!canSubmit}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
