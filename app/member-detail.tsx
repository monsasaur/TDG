import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ConfirmModal from "../components/ConfirmModal";
import PageHeader from "../components/PageHeader";

// 1. Import Hooks และ Supabase Client
import { supabase } from "../data/supabaseClient";
import { useContacts } from "../data/useContacts";
import { House, useHouses } from "../data/useHouses";

export default function MemberDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  // 2. ดึงข้อมูลจากฐานข้อมูล
  const { contacts, isLoading: loadingContacts } = useContacts();
  const { houses, isLoading: loadingHouses } = useHouses();

  const isLoading = loadingContacts || loadingHouses;

  // 3. หาข้อมูลสมาชิกจาก ID ที่ส่งมา (ดัก undefined ไว้ด้วยเพื่อกันแครช)
  const member = useMemo(() => {
    if (!contacts) return undefined;
    return contacts.find((c) => c.id === id);
  }, [contacts, id]);

  // 4. จัดการ State ของบ้านที่เป็นสมาชิกอยู่ (เปลี่ยนมาเก็บ Object ของบ้าน เพื่อให้มี ID ไปใช้ตอนสั่งลบ)
  const [sharedHouses, setSharedHouses] = useState<House[]>([]);
  const [pendingHouse, setPendingHouse] = useState<House | undefined>();
  const [isDeleting, setIsDeleting] = useState(false);

  // อัปเดตรายชื่อบ้านที่ใช้ร่วมกัน เมื่อโหลดข้อมูลเสร็จ
  useEffect(() => {
    if (member && houses.length > 0) {
      // เทียบชื่อบ้านที่คนนี้อยู่ กับ ข้อมูลบ้านทั้งหมดที่เรามี เพื่อดึง Object บ้านนั้นออกมา
      const memberHousesObjects = houses.filter((h) =>
        member.houses.includes(h.name),
      );
      setSharedHouses(memberHousesObjects);
    }
  }, [member, houses]);

  // แสดงตัวโหลดระหว่างรอข้อมูล
  if (isLoading) {
    return (
      <View className="flex-1 bg-[#F5F5F5]">
        <Stack.Screen options={{ animation: "slide_from_right" }} />
        <PageHeader title="" onBack={() => router.back()} />
        <ActivityIndicator className="mt-10" color="#FF3055" />
      </View>
    );
  }

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

  // 5. ฟังก์ชันสำหรับเตะสมาชิกออกจากบ้านผ่าน Supabase API
  const confirmRemove = async () => {
    if (!pendingHouse || !member) return;
    setIsDeleting(true);

    try {
      // ยิงคำสั่งลบข้อมูลในตารางเชื่อม (house_contacts)
      const { error } = await supabase
        .from("house_contacts")
        .delete()
        .match({ house_id: pendingHouse.id, contact_id: member.id });

      if (error) throw error;

      // อัปเดตหน้าจอทันที (Optimistic update)
      const nextHouses = sharedHouses.filter((h) => h.id !== pendingHouse.id);
      setSharedHouses(nextHouses);

      // ถ้าเตะออกจนไม่เหลือบ้านไหนแล้ว ให้เด้งกลับหน้าเดิมอัตโนมัติ
      if (nextHouses.length === 0) {
        setTimeout(() => router.back(), 150);
      }
    } catch (error) {
      console.error("Error removing member from house:", error);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        "ไม่สามารถนำสมาชิกออกได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsDeleting(false);
      setPendingHouse(undefined);
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

        {sharedHouses.length === 0 ? (
          <Text className="text-xs text-gray-400 px-5 mt-2">
            ไม่ได้เป็นสมาชิกในบ้านใดๆ
          </Text>
        ) : (
          sharedHouses.map((h) => (
            <View
              key={h.id}
              className="bg-white mx-5 mb-2 rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-sm text-[#1A1A1A]">{h.name}</Text>
              <TouchableOpacity hitSlop={12} onPress={() => setPendingHouse(h)}>
                <Ionicons name="close" size={18} color="#888" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!pendingHouse}
        onClose={() => !isDeleting && setPendingHouse(undefined)}
        onConfirm={confirmRemove}
        title={`นำ ${member.name} ออกจาก${pendingHouse?.name ?? ""} ใช่ไหม`}
        confirmLabel={isDeleting ? "กำลังนำออก..." : "นำบุคคลออก"}
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
