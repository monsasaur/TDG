import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import HousePicker from "../components/HousePicker";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import { useHouses } from "../data/useHouses";

export default function SelectHouseScreen() {
  const router = useRouter();
  const { houses, isLoading } = useHouses();

  // เก็บเป็น id ไม่ใช่ชื่อ เพราะ id คือสิ่งที่ต้องส่งต่อไปลงทะเบียนอุปกรณ์
  // (devices.house_id เป็น FK บังคับ — ไม่มี id ก็ insert ไม่ได้)
  const [selectedId, setSelectedId] = useState<string | undefined>();

  // บ้านโหลดเสร็จแล้วค่อยเลือกตัวแรกให้ ไม่ใช่ตั้งค่าตั้งต้นจากของปลอม
  useEffect(() => {
    if (!selectedId && houses.length > 0) setSelectedId(houses[0].id);
  }, [houses, selectedId]);

  const selectedName = houses.find((h) => h.id === selectedId)?.name ?? "";

  // HousePicker รับ/คืนเป็นชื่อ จึงต้องแปลงกลับเป็น id
  // ชื่อซ้ำกันจะได้ตัวแรก — ยอมรับได้เพราะชื่อซ้ำเป็นสิ่งที่ผู้ใช้ตั้งเอง
  const handleSelect = (name: string) => {
    const match = houses.find((h) => h.name === name);
    if (match) setSelectedId(match.id);
  };

  const handleAddHouse = () => {
    router.push("/houses" as never);
  };

  const handleNext = () => {
    if (!selectedId) return;
    router.push(
      `/scan-devices?houseId=${encodeURIComponent(selectedId)}` as never,
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
        {isLoading ? (
          <View className="mt-10 items-center">
            <ActivityIndicator />
          </View>
        ) : houses.length === 0 ? (
          <View className="px-5 mt-10">
            <Text className="text-base text-[#6B6B6B] text-center">
              ยังไม่มีบ้านในระบบ ต้องเพิ่มบ้านก่อนจึงจะลงทะเบียนอุปกรณ์ได้
            </Text>
          </View>
        ) : (
          <HousePicker
            houses={houses.map((h) => h.name)}
            selected={selectedName}
            onSelect={handleSelect}
            onAddHouse={handleAddHouse}
          />
        )}
      </ScrollView>

      <View className="px-5 pb-8">
        <PrimaryButton
          label={houses.length === 0 ? "เพิ่มบ้าน" : "ถัดไป"}
          onPress={houses.length === 0 ? handleAddHouse : handleNext}
          disabled={isLoading || (houses.length > 0 && !selectedId)}
        />
      </View>
    </View>
  );
}
