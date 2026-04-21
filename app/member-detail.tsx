import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mockContacts } from "../data/mockContacts";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";

const MY_HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function MemberDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const member = useMemo(() => mockContacts.find((c) => c.id === id), [id]);

  const [sharedHouses, setSharedHouses] = useState<string[]>(() =>
    member ? member.houses.filter((h) => MY_HOUSES.includes(h)) : []
  );
  const [pendingHouse, setPendingHouse] = useState<string | undefined>();

  if (!member) {
    return (
      <View className="flex-1 bg-[#F5F5F5]">
        <Stack.Screen options={{ animation: "slide_from_right" }} />
        <PageHeader title="" onBack={() => router.back()} />
        <Text className="text-sm text-[#888] px-5 mt-5">ไม่พบข้อมูลสมาชิก</Text>
      </View>
    );
  }

  const initial = member.name.trim().charAt(0);

  const confirmRemove = () => {
    if (!pendingHouse) return;
    const nextHouses = sharedHouses.filter((h) => h !== pendingHouse);
    setSharedHouses(nextHouses);
    setPendingHouse(undefined);
    if (nextHouses.length === 0) {
      setTimeout(() => router.back(), 150);
    }
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="bg-white mx-5 mt-2 rounded-2xl px-4 py-4 flex-row items-center">
          <View className="flex-1">
            <Text className="text-base font-semibold text-[#1A1A1A]">
              {member.name}
            </Text>
            <Text className="text-xs text-[#888] mt-1">
              เบอร์โทร : {member.phone}
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-[#FFE0E3] items-center justify-center ml-3">
            <Text className="text-base font-semibold text-[#C45A66]">
              {initial}
            </Text>
          </View>
        </View>

        <Text className="text-sm text-[#1A1A1A] px-5 mt-5 mb-2">
          บ้านที่เป็นสมาชิกอยู่
        </Text>

        {sharedHouses.map((h) => (
          <View
            key={h}
            className="bg-white mx-5 mb-2 rounded-xl px-4 py-3 flex-row items-center justify-between"
          >
            <Text className="text-sm text-[#1A1A1A]">{h}</Text>
            <TouchableOpacity hitSlop={12} onPress={() => setPendingHouse(h)}>
              <Ionicons name="close" size={18} color="#888" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <ConfirmModal
        visible={!!pendingHouse}
        onClose={() => setPendingHouse(undefined)}
        onConfirm={confirmRemove}
        title={`นำ ${member.name} ออกจาก${pendingHouse ?? ""} ใช่ไหม`}
        confirmLabel="นำบุคคลออก"
        cancelLabel="ยกเลิก"
        titleAlign="left"
        messageAlign="left"
      >
        <Text className="text-sm text-[#1A1A1A] mb-2">
          การดำเนินการนี้จะมีผลดังนี้
        </Text>
        <Text className="text-sm text-[#555] leading-5">
          คนที่ถูกลบออกจากบ้านนี้จะไม่สามารถเข้าถึงบริการของกลุ่มบ้านนี้อีกต่อไป
        </Text>
      </ConfirmModal>
    </View>
  );
}
