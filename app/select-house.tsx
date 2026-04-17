import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MAX_HOUSES } from "../data/mockDevices";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function SelectHouseScreen() {
  const router = useRouter();

  const [selected, setSelected] = useState(HOUSES[0]);
  const [limitModal, setLimitModal] = useState(false);

  const handleAddHouse = () => {
    if (HOUSES.length >= MAX_HOUSES) {
      setLimitModal(true);
      return;
    }
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center h-7">
          <TouchableOpacity onPress={() => router.back()} hitSlop={20}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-[#1A1A1A] ml-2">
            เลือกบ้าน
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 mt-5">
          {HOUSES.map((h) => {
            const isSelected = selected === h;
            return (
              <TouchableOpacity
                key={h}
                activeOpacity={0.7}
                onPress={() => setSelected(h)}
                className={`rounded-full px-4 py-3 mb-2 flex-row items-center justify-between ${
                  isSelected ? "bg-[#FFE5E8]" : "bg-white border border-[#E8E8E8]"
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons name="home-outline" size={18} color="#1A1A1A" />
                  <Text className="text-sm text-[#1A1A1A] ml-3">{h}</Text>
                </View>
                <View
                  className={`w-5 h-5 rounded-full border items-center justify-center ${
                    isSelected ? "border-[#FF3055]" : "border-[#BBBBBB]"
                  }`}
                >
                  {isSelected && (
                    <View className="w-2.5 h-2.5 rounded-full bg-[#FF3055]" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleAddHouse}
            className="bg-[#FFE5E8] border border-[#FFB3BC] rounded-full mt-1 py-3 flex-row items-center justify-center"
          >
            <Ionicons name="add" size={18} color="#34A853" />
            <Text className="text-sm text-[#1A1A1A] ml-1">เพิ่มบ้าน</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Submit */}
      <View className="px-5 pb-8">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/connect-device" as never)}
          className="rounded-full py-4 items-center bg-[#FF3055]"
        >
          <Text className="text-base font-semibold text-white">ถัดไป</Text>
        </TouchableOpacity>
      </View>

      {/* Limit modal */}
      <Modal
        transparent
        animationType="fade"
        visible={limitModal}
        onRequestClose={() => setLimitModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setLimitModal(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-10">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-2xl px-5 py-5 w-full">
                <Text className="text-base font-semibold text-[#1A1A1A] text-center mb-2">
                  มีบ้านเยอะเกินไป
                </Text>
                <Text className="text-sm text-[#555] text-center leading-5">
                  คุณเป็นสมาชิกของบ้านต่างๆ ครบจำนวนสูงสุดที่อนุญาตแล้ว
                  หากคุณต้องการเพิ่มบ้านใหม่ ให้นำบ้านอื่นออกก่อน
                </Text>
                <View className="items-end mt-4">
                  <TouchableOpacity onPress={() => setLimitModal(false)}>
                    <Text className="text-sm font-semibold text-[#FF3055]">
                      ปิด
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
