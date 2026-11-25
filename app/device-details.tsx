import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Alert,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDevices } from "../contexts/DevicesContext";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import ConfirmModal from "../components/ConfirmModal";
import { useHouses } from "../data/useHouses";
import { useOwnerAccess } from "../data/useOwnerAccess";
import type { Device } from "../data/useDevices";
import { BTN } from "../components/buttonTheme";
import { C } from "../components/theme";

const NAME_MAX = 30;

export default function DeviceDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { devices, updateDevice, deleteDevice } = useDevices();
  const { houses } = useHouses();
  const { isOwner } = useOwnerAccess();

  // ย้ายอุปกรณ์ได้เฉพาะไปบ้านที่เราเป็นเจ้าของ (RLS: with check is_house_owner ของบ้านปลายทาง)
  const HOUSES = houses.filter((h) => isOwner(h.id)).map((h) => h.name);

  const device = useMemo(
    () => devices.find((d) => d.id === id),
    [devices, id]
  );

  const [name, setName] = useState("");
  const [house, setHouse] = useState<string>("");
  const [houseDropdown, setHouseDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (device) {
      setName(device.name);
      setHouse(device.houseName ?? "");
    }
  }, [device]);

  const goBack = () => router.back();

  if (!device) {
    return (
      <View className="flex-1 bg-page items-center justify-center">
        <Text className="text-sm text-sub">ไม่พบอุปกรณ์</Text>
        <TouchableOpacity onPress={goBack} className="mt-4">
          <Text className="text-sm font-semibold text-brand">กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isConnected = device.status === "connected";
  const canSave = name.trim().length > 0 && !isSaving;
  // ผู้ดูแล (caregiver) ดูได้อย่างเดียว — แก้/ลบ/เชื่อมต่อใหม่ได้เฉพาะเจ้าของบ้าน
  const canManage = isOwner(device.houseId);

  // เดิมปุ่มบันทึกแค่ย้อนกลับ — ชื่อและบ้านที่แก้ไม่เคยถูกบันทึก
  const handleSave = async () => {
    if (!canSave) return;
    const updates: Partial<Device> = {};
    if (name.trim() !== device.name) updates.name = name.trim();
    const target = houses.find((h) => h.name === house);
    if (target && target.id !== device.houseId) {
      updates.houseId = target.id;
      updates.houseName = target.name;
    }
    if (Object.keys(updates).length === 0) {
      goBack();
      return;
    }
    setIsSaving(true);
    try {
      await updateDevice(device.id, updates);
      goBack();
    } catch (err) {
      Alert.alert("บันทึกไม่ได้", err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSaving(false);
    }
  };

  // เดิมยืนยันลบแล้วแค่ย้อนกลับ — อุปกรณ์ไม่เคยถูกลบ
  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteDevice(device.id);
      goBack();
    } catch (err) {
      Alert.alert("ลบอุปกรณ์ไม่ได้", err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="รายละเอียดอุปกรณ์" onBack={goBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* รหัสอุปกรณ์ */}
          <View className="px-5 pt-5 pb-3 border-b border-[#E8E8E8]">
            <Text className="text-sm text-ink">
              รหัสอุปกรณ์ : <Text className="text-sub">{device.code}</Text>
            </Text>
          </View>

          {/* เครือข่ายปัจจุบัน */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-ink mb-2">เครือข่ายปัจจุบัน</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              // เปลี่ยน WiFi ต้องจับคู่ BLE ใหม่ — ไปทางเดียวกับปุ่มเชื่อมต่อใหม่
              // (เดิมไป /connect-device โดยไม่ส่งชื่อเครื่อง จับคู่ไม่ได้ แล้วหน้าตั้งค่าเติมค่าปลอมให้)
              onPress={() =>
                router.push(`/scan-devices?deviceId=${device.id}` as never)
              }
              disabled={!canManage}
              className={`rounded-xl px-4 py-3 flex-row items-center ${
                isConnected ? "bg-brand-soft" : "bg-[#EFEFEF]"
              }`}
            >
              <Ionicons
                name="wifi"
                size={18}
                color={isConnected ? C.ink : C.sub}
              />
              <View className="ml-3">
                <Text className="text-sm text-ink">{device.wifi_ssid}</Text>
                <Text
                  className={`text-xs mt-0.5 ${
                    isConnected ? "text-brand" : "text-sub"
                  }`}
                >
                  {isConnected ? "เชื่อมต่อ" : "ขาดการเชื่อมต่อ"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <LabeledTextField
            label="ชื่ออุปกรณ์"
            value={name}
            onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
            maxLength={NAME_MAX}
            readOnly={!canManage}
          />

          {/* กลุ่มบ้าน */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-ink mb-2">กลุ่มบ้าน</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setHouseDropdown(true)}
              disabled={!canManage}
              className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-[#E8E8E8]"
            >
              <Text className="text-sm text-ink">{house}</Text>
              {canManage && <Ionicons name="chevron-down" size={14} color={C.sub} />}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom buttons */}
        {!canManage ? (
          <View className="px-5 pb-8">
            <Text className="text-xs text-sub text-center leading-5">
              คุณเป็นผู้ดูแลของบ้านนี้ — เฉพาะเจ้าของบ้านที่แก้ไข ลบ หรือเชื่อมต่ออุปกรณ์ใหม่ได้
            </Text>
          </View>
        ) : (
        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={
              isConnected
                ? handleSave
                : () =>
                    router.push(
                      `/scan-devices?deviceId=${device.id}` as never
                    )
            }
            disabled={isConnected && !canSave}
            className={`rounded-full py-4 items-center ${
              isConnected
                ? canSave
                  ? BTN.solid
                  : BTN.solidDim
                : BTN.solid
            }`}
          >
            <Text className="text-base font-semibold text-white">
              {isConnected ? (isSaving ? "กำลังบันทึก..." : "บันทึก") : "เชื่อมต่อใหม่"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setConfirmDelete(true)}
            className="rounded-full py-4 items-center mt-3 bg-white border border-danger"
          >
            <Text className="text-base font-semibold text-danger">
              ลบอุปกรณ์นี้
            </Text>
          </TouchableOpacity>
        </View>
        )}
      </KeyboardAvoidingView>

      {/* House dropdown (centered modal — different from filter dropdown) */}
      <Modal transparent animationType="none" visible={houseDropdown}>
        <TouchableWithoutFeedback onPress={() => setHouseDropdown(false)}>
          <View className="flex-1 bg-black/20 items-center justify-center px-10">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-xl border border-[#E8E8E8] py-1 w-full">
                {HOUSES.map((h) => (
                  <TouchableOpacity
                    key={h}
                    className="flex-row items-center justify-between px-4 py-3"
                    onPress={() => {
                      setHouse(h);
                      setHouseDropdown(false);
                    }}
                  >
                    <Text
                      className={`text-sm ${
                        house === h
                          ? "text-brand font-medium"
                          : "text-ink"
                      }`}
                    >
                      {h}
                    </Text>
                    {house === h && (
                      <Ionicons name="checkmark" size={18} color={C.brand} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ConfirmModal
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="ลบอุปกรณ์นี้หรือไม่"
        message="อุปกรณ์นี้จะถูกลบออกจากบ้านของคุณ คุณแน่ใจหรือไม่ว่าคุณต้องการลบอุปกรณ์นี้"
      />
    </View>
  );
}
