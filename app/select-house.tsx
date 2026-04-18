import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MAX_HOUSES } from "../data/mockDevices";
import PageHeader from "../components/PageHeader";
import AddActionPill from "../components/AddActionPill";
import ConfirmModal from "../components/ConfirmModal";

const INITIAL_HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function SelectHouseScreen() {
  const router = useRouter();

  const [houses, setHouses] = useState<string[]>(INITIAL_HOUSES);
  const [selected, setSelected] = useState(INITIAL_HOUSES[0]);
  const [limitModal, setLimitModal] = useState(false);

  const handleAddHouse = () => {
    if (houses.length >= MAX_HOUSES) {
      setLimitModal(true);
      return;
    }
    const newHouse = `บ้านใหม่ ${houses.length - INITIAL_HOUSES.length + 1}`;
    setHouses((prev) => [...prev, newHouse]);
    setSelected(newHouse);
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เลือกบ้าน" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 mt-5">
          {houses.map((h) => {
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

          <AddActionPill
            label="เพิ่มบ้าน"
            onPress={handleAddHouse}
            rounded="rounded-full"
            className="mt-1"
          />
        </View>
      </ScrollView>

      <View className="px-5 pb-8">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/scan-devices" as never)}
          className="rounded-full py-4 items-center bg-[#FF3055]"
        >
          <Text className="text-base font-semibold text-white">ถัดไป</Text>
        </TouchableOpacity>
      </View>

      <ConfirmModal
        visible={limitModal}
        onClose={() => setLimitModal(false)}
        title="มีบ้านเยอะเกินไป"
        message="คุณเป็นสมาชิกของบ้านต่างๆ ครบจำนวนสูงสุดที่อนุญาตแล้ว หากคุณต้องการเพิ่มบ้านใหม่ ให้นำบ้านอื่นออกก่อน"
      />
    </View>
  );
}
