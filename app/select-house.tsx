import { useState } from "react";
import { View, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { MAX_HOUSES } from "../data/mockDevices";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import PrimaryButton from "../components/PrimaryButton";
import HousePicker from "../components/HousePicker";

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
        <HousePicker
          houses={houses}
          selected={selected}
          onSelect={setSelected}
          onAddHouse={handleAddHouse}
        />
      </ScrollView>

      <View className="px-5 pb-8">
        <PrimaryButton
          label="ถัดไป"
          onPress={() => router.push("/scan-devices" as never)}
        />
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
