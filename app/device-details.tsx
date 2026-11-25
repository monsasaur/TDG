import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDevices } from "../contexts/DevicesContext";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useHouses } from "../data/useHouses";
import { useOwnerAccess } from "../data/useOwnerAccess";
import type { Device } from "../data/useDevices";
import { V2C } from "../components/designVersion";
import { safeBack } from "../lib/navigation";

const NAME_MAX = 30;

/**
 * รายละเอียดอุปกรณ์ — ชื่อ · บ้าน · เครือข่าย · เชื่อมต่อใหม่ · ลบ
 * จัดหน้าใหม่ตามสเปค v2: การ์ดขาวบนพื้นเทา ป้ายสถานะ และปุ่มหลักสี Charcoal
 */
export default function DeviceDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { devices, updateDevice, deleteDevice } = useDevices();
  const { houses } = useHouses();
  const { isOwner } = useOwnerAccess();

  // ย้ายอุปกรณ์ได้เฉพาะไปบ้านที่เราเป็นเจ้าของ (RLS: with check is_house_owner ของบ้านปลายทาง)
  const HOUSES = houses.filter((h) => isOwner(h.id)).map((h) => h.name);

  const device = useMemo(() => devices.find((d) => d.id === id), [devices, id]);

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

  const goBack = () => safeBack(router);

  if (!device) {
    return (
      <View className={`flex-1 ${V2C.page} items-center justify-center`}>
        <Text className="text-sm text-[#858891]">ไม่พบอุปกรณ์</Text>
        <TouchableOpacity onPress={goBack} className="mt-4">
          <Text className="text-sm font-semibold text-[#292A32] underline">กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isConnected = device.status === "connected";
  const dirty = name.trim() !== device.name || house !== (device.houseName ?? "");
  const canSave = name.trim().length > 0 && !isSaving;
  // ผู้ดูแล (caregiver) ดูได้อย่างเดียว — แก้/ลบ/เชื่อมต่อใหม่ได้เฉพาะเจ้าของบ้าน
  const canManage = isOwner(device.houseId);
  const reconnect = () => router.push(`/scan-devices?deviceId=${device.id}` as never);

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
    <View className={`flex-1 ${V2C.page}`}>
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="รายละเอียดอุปกรณ์" onBack={goBack} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* อุปกรณ์ตัวนี้คือเครื่องไหน + ใช้งานได้อยู่ไหม */}
          <View className="bg-white rounded-2xl p-4 flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-[#F2F3F5] items-center justify-center mr-3">
              <Ionicons name="hardware-chip-outline" size={24} color="#292A32" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-[#292A32]" numberOfLines={1}>
                {device.name}
              </Text>
              <Text className="text-xs text-[#858891] mt-0.5">รหัสอุปกรณ์ : {device.code}</Text>
            </View>
            <View className={`rounded-full px-3 py-1 ${isConnected ? "bg-[#E8F5EC]" : "bg-[#FDECEC]"}`}>
              <Text className={`text-xs font-semibold ${isConnected ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                {isConnected ? "เชื่อมต่อแล้ว" : "ขาดการเชื่อมต่อ"}
              </Text>
            </View>
          </View>

          {/* เครือข่ายที่อุปกรณ์เกาะอยู่ — กดเพื่อตั้ง WiFi ใหม่ผ่าน BLE */}
          <Text className="text-sm text-[#858891] mt-5 mb-2 mx-1">เครือข่าย Wi-Fi</Text>
          <Pressable
            onPress={reconnect}
            disabled={!canManage}
            accessibilityRole="button"
            accessibilityLabel={`เครือข่าย ${device.wifi_ssid || "ยังไม่ได้ตั้งค่า"} แตะเพื่อเชื่อมต่อใหม่`}
            style={({ pressed }) => (pressed && canManage ? { opacity: 0.7 } : undefined)}
            className="bg-white rounded-2xl px-4 py-4 flex-row items-center"
          >
            <Ionicons name={isConnected ? "wifi" : "wifi-outline"} size={22} color={isConnected ? "#292A32" : "#858891"} />
            <View className="flex-1 ml-3">
              <Text className="text-base text-[#292A32]" numberOfLines={1}>
                {device.wifi_ssid || "ยังไม่ได้ตั้งค่าเครือข่าย"}
              </Text>
              <Text className="text-xs text-[#858891] mt-0.5">
                {canManage ? "แตะเพื่อเปลี่ยนเครือข่ายของอุปกรณ์" : "เฉพาะเจ้าของบ้านที่เปลี่ยนได้"}
              </Text>
            </View>
            {canManage && <Ionicons name="chevron-forward" size={20} color="#858891" />}
          </Pressable>

          {/* ข้อมูลที่แก้ได้ */}
          <Text className="text-sm text-[#858891] mt-5 mb-2 mx-1">ข้อมูลอุปกรณ์</Text>
          <View className="bg-white rounded-2xl overflow-hidden">
            <View className="px-4 py-3 border-b border-[#F0F0F0]">
              <Text className="text-xs text-[#858891]">ชื่ออุปกรณ์</Text>
              <TextInput
                value={name}
                onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
                editable={canManage}
                maxLength={NAME_MAX}
                placeholder="เช่น Esp32 - ห้องนอน"
                placeholderTextColor="#9CA3AF"
                className="text-base text-[#292A32] py-1"
              />
            </View>
            <Pressable
              onPress={() => setHouseDropdown(true)}
              disabled={!canManage}
              accessibilityRole="button"
              accessibilityLabel={`กลุ่มบ้าน ตอนนี้: ${house}`}
              className="px-4 py-3 flex-row items-center"
            >
              <View className="flex-1">
                <Text className="text-xs text-[#858891]">กลุ่มบ้าน</Text>
                <Text className="text-base text-[#292A32] py-1">{house || "ยังไม่ได้ผูกกับบ้าน"}</Text>
              </View>
              {canManage && <Ionicons name="chevron-down" size={18} color="#858891" />}
            </Pressable>
          </View>
        </ScrollView>

        {/* ปุ่มล่าง */}
        {!canManage ? (
          <View className="px-5 pb-8">
            <Text className="text-xs text-[#858891] text-center leading-5">
              คุณเป็นผู้ดูแลของบ้านนี้ — เฉพาะเจ้าของบ้านที่แก้ไข ลบ หรือเชื่อมต่ออุปกรณ์ใหม่ได้
            </Text>
          </View>
        ) : (
          <View className="px-5 pb-8">
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={isConnected ? handleSave : reconnect}
              disabled={isConnected && (!canSave || !dirty)}
              accessibilityRole="button"
              className={`h-[54px] rounded-2xl justify-center items-center ${
                isConnected && (!canSave || !dirty) ? V2C.darkDisabled : V2C.dark
              }`}
            >
              <Text className="text-base font-semibold text-white">
                {isConnected ? (isSaving ? "กำลังบันทึก..." : "บันทึก") : "เชื่อมต่อใหม่"}
              </Text>
            </TouchableOpacity>

            {/* อุปกรณ์ที่ยังเชื่อมต่ออยู่ก็ตั้ง WiFi ใหม่ได้ ไม่ต้องรอให้หลุดก่อน */}
            {isConnected && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={reconnect}
                accessibilityRole="button"
                className="h-[54px] rounded-2xl justify-center items-center mt-3 bg-white border border-[#E5E6E9]"
              >
                <Text className="text-base font-semibold text-[#292A32]">เชื่อมต่อใหม่</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmDelete(true)}
              accessibilityRole="button"
              className="h-[48px] justify-center items-center mt-2"
            >
              <Text className="text-sm font-semibold text-[#DC2626]">ลบอุปกรณ์นี้</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* เลือกบ้าน */}
      <Modal transparent animationType="fade" visible={houseDropdown} onRequestClose={() => setHouseDropdown(false)}>
        <TouchableWithoutFeedback onPress={() => setHouseDropdown(false)}>
          <View className="flex-1 bg-black/25 items-center justify-center px-8">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-2xl w-full py-1">
                <Text className="text-xs text-[#858891] px-4 pt-3 pb-1">ย้ายอุปกรณ์ไปบ้าน</Text>
                {HOUSES.map((h, i) => (
                  <TouchableOpacity
                    key={h}
                    className={`flex-row items-center justify-between px-4 py-3 ${
                      i === HOUSES.length - 1 ? "" : "border-b border-[#F0F0F0]"
                    }`}
                    onPress={() => {
                      setHouse(h);
                      setHouseDropdown(false);
                    }}
                  >
                    <Text className={`text-sm ${house === h ? "font-semibold text-[#292A32]" : "text-[#292A32]"}`}>
                      {h}
                    </Text>
                    {house === h && <Ionicons name="checkmark" size={18} color="#292A32" />}
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
        tone="danger"
        message="อุปกรณ์นี้จะถูกลบออกจากบ้านของคุณ คุณแน่ใจหรือไม่ว่าคุณต้องการลบอุปกรณ์นี้"
      />
    </View>
  );
}
