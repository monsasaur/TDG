import { useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { mockHouses, useMockHouses, MAX_HOUSES } from "../data/mockHouses";
import PageHeader from "../components/PageHeader";
import HousePill from "../components/HousePill";
import AddActionPill from "../components/AddActionPill";
import JoinOptionCard from "../components/JoinOptionCard";
import ConfirmModal from "../components/ConfirmModal";

export default function HousesScreen() {
  const router = useRouter();
  const houses = useMockHouses();

  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [limitModal, setLimitModal] = useState(false);

  const handleAdd = () => {
    if (houses.length >= MAX_HOUSES) {
      setLimitModal(true);
      return;
    }
    router.push("/add-house" as never);
  };

  const confirmRemove = () => {
    if (pendingRemove) mockHouses.remove(pendingRemove);
    setPendingRemove(null);
  };

  const isLast = houses.length === 1;

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="บ้าน" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-sm font-semibold text-[#1A1A1A] px-5 mt-5 mb-3">
          จัดการบ้าน
        </Text>
        <View className="px-5">
          {houses.map((h) => (
            <HousePill
              key={h}
              label={h}
              onRemove={() => setPendingRemove(h)}
            />
          ))}
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
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        title={`ลบ ${pendingRemove ?? ""} ไหม`}
        titleAlign="left"
        messageAlign="left"
        cancelLabel="ยกเลิก"
        confirmLabel="ลบบ้าน"
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
