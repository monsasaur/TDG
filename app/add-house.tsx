import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import ConfirmModal from "../components/ConfirmModal";
import LabeledTextField from "../components/LabeledTextField";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";

// Import Hook และ MAX_HOUSES ที่เราเขียนไว้ใหม่
import { MAX_HOUSES, useHouses } from "../data/useHouses";
// อย่าลืม Import supabase client (ปรับ path ให้ตรงกับโปรเจกต์ของคุณ)
import { supabase } from "../data/supabaseClient";

export default function AddHouseScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [limitModal, setLimitModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // เพิ่ม State สำหรับตอนกด Save

  // ดึงข้อมูลบ้านปัจจุบันมาเพื่อนับจำนวน
  const { houses, isLoading } = useHouses();

  const trimmed = name.trim();
  // จะกด Save ได้ก็ต่อเมื่อ พิมพ์ชื่อแล้ว + ไม่ได้กำลังโหลดข้อมูล + ไม่ได้กำลังเซฟอยู่
  const canSave = trimmed.length > 0 && !isLoading && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;

    // เช็ค Limit จากจำนวน houses ที่ดึงมาจาก Supabase
    if (houses.length >= MAX_HOUSES) {
      setLimitModal(true);
      return;
    }

    setIsSaving(true);
    try {
      // สร้าง ID สั้นๆ ไม่ซ้ำกัน (เช่น h1713829382) เพราะฐานข้อมูลเราใช้ TEXT
      const newId = `h${Date.now()}`;

      // Insert ลง Supabase ตาราง houses
      const { error } = await supabase
        .from("houses")
        .insert([{ id: newId, name: trimmed }]);

      if (error) throw error;

      // บันทึกสำเร็จ กลับไปหน้าเดิม
      router.back();
    } catch (error) {
      console.error("Error adding house:", error);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        "ไม่สามารถเพิ่มบ้านได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSaving(false);
    }
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
          label={isSaving ? "กำลังบันทึก..." : "บันทึก"} // เปลี่ยนข้อความตอนเซฟ
          onPress={handleSave}
          disabled={!canSave}
        />
        <TouchableOpacity
          onPress={() => router.back()}
          className="items-center mt-4"
          disabled={isSaving}
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
