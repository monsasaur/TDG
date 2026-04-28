import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import ConfirmModal from "../components/ConfirmModal";
import HousePicker from "../components/HousePicker";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import { MAX_MEMBERS_PER_HOUSE, useContacts } from "../data/useContacts";

const INITIAL_HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function InviteSelectHouseScreen() {
  const router = useRouter();
  const { contacts } = useContacts();

  const [selected, setSelected] = useState(INITIAL_HOUSES[0]);
  const [memberLimitModal, setMemberLimitModal] = useState(false);

  const handleAddHouse = () => {
    router.push("/houses" as never);
  };

  const handleNext = () => {
    const memberCount = contacts.filter(
      (c) =>
        (c.type === "self" || c.type === "member") &&
        c.houses.includes(selected),
    ).length;
    if (memberCount >= MAX_MEMBERS_PER_HOUSE) {
      setMemberLimitModal(true);
      return;
    }
    router.push(`/invite-send?house=${encodeURIComponent(selected)}` as never);
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
        <PrimaryButton label="ถัดไป" onPress={handleNext} />
      </View>

      <ConfirmModal
        visible={memberLimitModal}
        onClose={() => setMemberLimitModal(false)}
        title="มีสมาชิกเยอะเกินไป"
        message="สมาชิกในบ้านนี้ครบจำนวนสูงสุดที่อนุญาตแล้ว หากคุณต้องการเพิ่มสมาชิกใหม่ ให้นำสมาชิกคนอื่นออกก่อน"
      />
    </View>
  );
}
