import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import HousePicker from "../components/HousePicker";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

const INITIAL_HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function SelectHouseScreen() {
  const router = useRouter();

  const [selected, setSelected] = useState(INITIAL_HOUSES[0]);

  const handleAddHouse = () => {
    router.push("/houses" as never);
  };

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เลือกบ้าน" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <HousePicker
          houses={INITIAL_HOUSES}
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
    </View>
  );
}
