import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mockDevices } from "../data/mockDevices";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];
const NAME_MAX = 30;

export default function DeviceDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const device = useMemo(
    () => mockDevices.find((d) => d.id === id),
    [id]
  );

  const [name, setName] = useState("");
  const [house, setHouse] = useState<string>(HOUSES[0]);
  const [houseDropdown, setHouseDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (device) {
      setName(device.name);
      setHouse(device.house);
    }
  }, [device]);

  const goBack = () => router.replace("/devices" as never);

  if (!device) {
    return (
      <View className="flex-1 bg-[#F5F5F5] items-center justify-center">
        <Text className="text-sm text-[#888]">ไม่พบอุปกรณ์</Text>
        <TouchableOpacity onPress={goBack} className="mt-4">
          <Text className="text-sm font-semibold text-[#FF3055]">กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isConnected = device.status === "connected";
  const canSave = name.trim().length > 0;

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center h-7">
          <TouchableOpacity onPress={goBack} hitSlop={20}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-[#1A1A1A] ml-2">
            รายละเอียดอุปกรณ์
          </Text>
        </View>
      </View>

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
            <Text className="text-sm text-[#1A1A1A]">
              รหัสอุปกรณ์ : <Text className="text-[#888]">{device.code}</Text>
            </Text>
          </View>

          {/* เครือข่ายปัจจุบัน */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-[#1A1A1A] mb-2">เครือข่ายปัจจุบัน</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/connect-device" as never)}
              className={`rounded-xl px-4 py-3 flex-row items-center ${
                isConnected ? "bg-[#FFE5E8]" : "bg-[#EFEFEF]"
              }`}
            >
              <Ionicons
                name="wifi"
                size={18}
                color={isConnected ? "#1A1A1A" : "#888"}
              />
              <View className="ml-3">
                <Text className="text-sm text-[#1A1A1A]">{device.wifi}</Text>
                <Text
                  className={`text-xs mt-0.5 ${
                    isConnected ? "text-[#FF3055]" : "text-[#888]"
                  }`}
                >
                  {isConnected ? "เชื่อมต่อ" : "ขาดการเชื่อมต่อ"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ชื่ออุปกรณ์ */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-[#1A1A1A] mb-2">ชื่ออุปกรณ์</Text>
            <TextInput
              value={name}
              onChangeText={(t) => setName(t.slice(0, NAME_MAX))}
              maxLength={NAME_MAX}
              className="bg-white rounded-xl px-4 py-3 text-sm text-[#1A1A1A] border border-[#E8E8E8]"
            />
          </View>

          {/* กลุ่มบ้าน */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-[#1A1A1A] mb-2">กลุ่มบ้าน</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setHouseDropdown(true)}
              className="bg-white rounded-xl px-4 py-3 flex-row items-center justify-between border border-[#E8E8E8]"
            >
              <Text className="text-sm text-[#1A1A1A]">{house}</Text>
              <Ionicons name="chevron-down" size={14} color="#888" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Bottom buttons */}
        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={
              isConnected
                ? goBack
                : () => router.push("/connect-device" as never)
            }
            disabled={isConnected && !canSave}
            className={`rounded-full py-4 items-center ${
              isConnected
                ? canSave
                  ? "bg-[#FF3055]"
                  : "bg-[#C56E76]"
                : "bg-[#FF3055]"
            }`}
          >
            <Text className="text-base font-semibold text-white">
              {isConnected ? "บันทึก" : "เชื่อมต่อใหม่"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setConfirmDelete(true)}
            className="rounded-full py-4 items-center mt-3 bg-white border border-[#FF3055]"
          >
            <Text className="text-base font-semibold text-[#FF3055]">
              ลบอุปกรณ์นี้
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* House dropdown */}
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
                          ? "text-[#FF3055] font-medium"
                          : "text-[#1A1A1A]"
                      }`}
                    >
                      {h}
                    </Text>
                    {house === h && (
                      <Ionicons name="checkmark" size={18} color="#FF3055" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Confirm delete modal */}
      <Modal
        transparent
        animationType="fade"
        visible={confirmDelete}
        onRequestClose={() => setConfirmDelete(false)}
      >
        <TouchableWithoutFeedback onPress={() => setConfirmDelete(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-10">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-2xl px-5 py-5 w-full">
                <Text className="text-base font-semibold text-[#1A1A1A] text-center mb-2">
                  ลบอุปกรณ์นี้หรือไม่
                </Text>
                <Text className="text-sm text-[#555] text-center leading-5">
                  อุปกรณ์นี้จะถูกลบออกจากบ้านของคุณ
                  คุณแน่ใจหรือไม่ว่าคุณต้องการลบอุปกรณ์นี้
                </Text>
                <View className="flex-row justify-between mt-5">
                  <TouchableOpacity onPress={() => setConfirmDelete(false)}>
                    <Text className="text-sm font-semibold text-[#FF3055]">
                      ยกเลิก
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setConfirmDelete(false);
                      goBack();
                    }}
                  >
                    <Text className="text-sm font-semibold text-[#FF3055]">
                      ตกลง
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
