import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import ConfirmModal from "../components/ConfirmModal";
import HousePicker from "../components/HousePicker";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import { MAX_MEMBERS_PER_HOUSE, useContacts } from "../data/useContacts";
import { useHouses } from "../data/useHouses";
import { useOwnerAccess } from "../data/useOwnerAccess";
import { useHouseMembers } from "../data/useHouseMembers";
import { useAuth } from "../contexts/AuthContext";

export default function InviteSelectHouseScreen() {
  const router = useRouter();
  const { contacts } = useContacts();
  // สมาชิกจริง (บัญชีผู้ใช้) — null = ยังไม่เปิดระบบบัญชี → นับจากผู้ติดต่อแบบเดิม
  const { user } = useAuth();
  const { members: accountMembers } = useHouseMembers(user?.id);
  const { houses: allHouses, isLoading, refetch } = useHouses();
  // เชิญได้เฉพาะบ้านที่เราเป็นเจ้าของ (create_house_invite) — ยังไม่เปิดระบบบัญชี = ทุกบ้าน
  const { enforced, isOwner } = useOwnerAccess();
  const houses = allHouses.filter((h) => isOwner(h.id));
  const caregiverOnly = enforced && allHouses.length > 0 && houses.length === 0;

  // ปุ่มเพิ่มบ้านพาไปหน้า /houses — กลับมาแล้วดึงใหม่ให้เห็นบ้านที่เพิ่งเพิ่ม
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );

  const houseNames = houses.map((h) => h.name);
  const [selected, setSelected] = useState<string>("");

  // รอบ้านโหลดเสร็จก่อนค่อยเลือกตัวแรก ไม่ตั้งค่าตั้งต้นจากของปลอม
  useEffect(() => {
    if (!selected && houseNames.length > 0) setSelected(houseNames[0]);
  }, [houseNames, selected]);
  const [memberLimitModal, setMemberLimitModal] = useState(false);

  const handleAddHouse = () => {
    router.push("/houses" as never);
  };

  const handleNext = () => {
    if (!selected) return;
    // ส่ง id ไปด้วย — รหัสเชิญสร้างจาก id ของบ้าน (ชื่อซ้ำกันได้) · ชื่อใช้แสดงผลอย่างเดียว
    const houseId = houses.find((h) => h.name === selected)?.id ?? "";
    // เพดานเดียวกับ join_house() ใน accounts.sql (ฐานข้อมูลบังคับจริง ตรงนี้แค่เตือนก่อนสร้างรหัส)
    const memberCount = accountMembers
      ? accountMembers.filter((m) => m.houses.some((h) => h.id === houseId)).length
      : contacts.filter(
          (c) =>
            (c.type === "self" || c.type === "member") &&
            c.houses.includes(selected),
        ).length;
    if (memberCount >= MAX_MEMBERS_PER_HOUSE) {
      setMemberLimitModal(true);
      return;
    }
    router.push(
      `/invite-send?houseId=${encodeURIComponent(houseId)}&house=${encodeURIComponent(selected)}` as never,
    );
  };

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เลือกบ้าน" onBack={() => router.back()} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {caregiverOnly && (
          <Text className="text-sm text-[#6B6B6B] text-center px-8 mt-8 leading-5">
            คุณเป็นผู้ดูแลในทุกบ้านที่อยู่ — เฉพาะเจ้าของบ้านที่เชิญสมาชิกได้
          </Text>
        )}
        <HousePicker
          houses={houseNames}
          selected={selected}
          onSelect={setSelected}
          onAddHouse={handleAddHouse}
        />
      </ScrollView>

      <View className="px-5 pb-8">
        <PrimaryButton
          label="ถัดไป"
          onPress={handleNext}
          disabled={isLoading || !selected}
        />
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
