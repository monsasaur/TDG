import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, Stack } from "expo-router";
import { mockHouses, MAX_HOUSES } from "../data/mockHouses";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import PrimaryButton from "../components/PrimaryButton";
import ConfirmModal from "../components/ConfirmModal";

export default function AddHouseScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [limitModal, setLimitModal] = useState(false);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (mockHouses.list().length >= MAX_HOUSES) {
      setLimitModal(true);
      return;
    }
    mockHouses.add(trimmed);
    router.back();
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="เพิ่มบ้าน" onBack={() => router.back()} />

      <View className="flex-1">
        <LabeledTextField
          label="ตั้งชื่อบ้าน"
          value={name}
          onChangeText={setName}
          autoFocus
        />
      </View>

      <View className="px-5 pb-8">
        <PrimaryButton
          label="บันทึก"
          onPress={handleSave}
          disabled={!canSave}
        />
        <TouchableOpacity
          onPress={() => router.back()}
          className="items-center mt-4"
        >
          <Text className="text-sm font-semibold text-[#1A1A1A]">ยกเลิก</Text>
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
