import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import AddActionPill from "../components/AddActionPill";
import ConfirmModal from "../components/ConfirmModal";
import HousePill from "../components/HousePill";
import JoinOptionCard from "../components/JoinOptionCard";
import PageHeader from "../components/PageHeader";

// Import สิ่งที่จำเป็นสำหรับ Supabase
import { supabase } from "../data/supabaseClient";
import { House, MAX_HOUSES, useHouses } from "../data/useHouses";

export default function HousesScreen() {
  const router = useRouter();

  // 1. ดึงข้อมูลจาก Hook จริง
  const { houses, isLoading } = useHouses();

  // สร้าง State ย่อยมาเก็บข้อมูลบ้านไว้แสดงผล
  // (เพื่อให้เวลาพอกดลบปุ๊บ เราสามารถอัปเดตเอาออกจากหน้าจอได้ทันทีโดยไม่ต้องรอโหลดใหม่)
  const [localHouses, setLocalHouses] = useState<House[]>([]);

  useEffect(() => {
    setLocalHouses(houses);
  }, [houses]);

  // 2. เปลี่ยน pendingRemove ให้เก็บ Object ของ House แทน string
  const [pendingRemove, setPendingRemove] = useState<House | null>(null);
  const [limitModal, setLimitModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAdd = () => {
    if (localHouses.length >= MAX_HOUSES) {
      setLimitModal(true);
      return;
    }
    router.push("/add-house" as never);
  };

  // 3. ยิง API ลบบ้านออกจากฐานข้อมูล
  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setIsDeleting(true);

    try {
      // ลบจาก Supabase (ใช้ ID อ้างอิง)
      const { error } = await supabase
        .from("houses")
        .delete()
        .eq("id", pendingRemove.id);

      if (error) throw error;

      // ลบออกจากหน้าจอทันที
      setLocalHouses((prev) => prev.filter((h) => h.id !== pendingRemove.id));
    } catch (error) {
      console.error("Error deleting house:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถลบบ้านได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDeleting(false);
      setPendingRemove(null);
    }
  };

  const isLast = localHouses.length === 1;

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="บ้าน" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-sm font-semibold text-[#1A1A1A] px-5 mt-5 mb-3">
          จัดการบ้าน
        </Text>
        <View className="px-5">
          {isLoading ? (
            // แสดงตัวหมุนโหลดข้อมูล
            <ActivityIndicator className="my-4" color="#000" />
          ) : (
            // เปลี่ยนจาก string มาใช้ object (h.id และ h.name)
            localHouses.map((h) => (
              <HousePill
                key={h.id}
                label={h.name}
                onRemove={() => setPendingRemove(h)}
              />
            ))
          )}
          <AddActionPill
            label="เพิ่มบ้าน"
            onPress={handleAdd}
            rounded="rounded-full"
          />
        </View>

        <Text className="text-sm font-semibold text-[#1A1A1A] px-5 mt-8 mb-3">
          รับเชิญสำหรับ
        </Text>
        <View className="px-5">
          <JoinOptionCard
            icon="qr-code-outline"
            title="สแกน QR code"
            description="หากคุณอยู่กับเจ้าของบ้านที่คุณต้องการเข้าร่วม ให้ขอให้เจ้าของบ้านสร้าง QR Code ที่คุณสแกนได้"
            onPress={() => router.push("/scan-qr" as never)}
          />
          <JoinOptionCard
            icon="create-outline"
            title="กรอกรหัสบ้าน"
            description="หากคุณอยู่คุยกันบนโทรศัพท์ ขอให้ที่เจ้าของบ้านสร้างรหัสบ้านแล้วให้คุณสามารถกรอกรหัสได้"
            onPress={() => router.push("/enter-code" as never)}
          />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={pendingRemove !== null}
        onClose={() => !isDeleting && setPendingRemove(null)}
        onConfirm={confirmRemove}
        title={`ลบ ${pendingRemove?.name ?? ""} ไหม`} // ดึงชื่อมาแสดง
        titleAlign="left"
        messageAlign="left"
        cancelLabel="ยกเลิก"
        confirmLabel={isDeleting ? "กำลังลบ..." : "ลบบ้าน"}
        message={
          isLast
            ? "การดำเนินการนี้จะมีผลดังนี้\n\nการแจ้งเตือนและบริการในกลุ่มบ้านนี้จะถูกลบออก\n\nนี่คือกลุ่มสุดท้ายที่เหลืออยู่ของคุณ หากคุณลบออก กลุ่มที่เรียกว่า บ้านของฉัน จะถูกสร้างขึ้น"
            : "การดำเนินการนี้จะมีผลดังนี้\n\nการแจ้งเตือนและบริการในกลุ่มบ้านนี้จะถูกลบออก"
        }
      />

      <ConfirmModal
        visible={limitModal}
        onClose={() => setLimitModal(false)}
        title="มีบ้านเยอะเกินไป"
        message="คุณเป็นสมาชิกของบ้านต่างๆ ครบจำนวนสูงสุดที่อนุญาตแล้ว หากคุณต้องการเพิ่มบ้านใหม่ ให้นำบ้านอื่นออกก่อน"
      />
    </View>
  );
}
