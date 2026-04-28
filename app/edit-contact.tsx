import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import HousePillGroup from "../components/HousePillGroup";
import LabeledTextField from "../components/LabeledTextField";
import PageHeader from "../components/PageHeader";

import { useContacts } from "../data/useContacts";
import { useHouses } from "../data/useHouses";
import { supabase } from "../data/supabaseClient";

const NAME_MAX = 20;
const PHONE_MAX = 20;

const sanitizeName = (raw: string) =>
  raw
    .replace(/[\p{Extended_Pictographic}\u200d]/gu, "")
    .replace(/[\/*]/g, "")
    .slice(0, NAME_MAX);

const sanitizePhone = (raw: string) =>
  raw.replace(/[^0-9]/g, "").slice(0, PHONE_MAX);

export default function EditContactScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { contacts } = useContacts();
  const { houses: dbHouses } = useHouses();
  const HOUSES = useMemo(() => dbHouses.map((h) => h.name), [dbHouses]);

  const contact = useMemo(() => contacts?.find((c) => c.id === id), [id, contacts]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [houses, setHouses] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setPhone(contact.phone);
      setHouses(contact.houses);
    }
  }, [contact]);

  const isSelf = contact?.type === "self";
  const canDelete = contact?.type === "external";

  const canSave =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    (isSelf || houses.length > 0) &&
    !isSaving &&
    !isDeleting;

  const toggleHouse = (h: string) =>
    setHouses((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h],
    );

  const goBack = () => router.back();

  const handleSave = async () => {
    if (!canSave || !contact) return;
    setIsSaving(true);
    try {
      // 1. อัปเดตข้อมูลส่วนตัว
      const { error: updateError } = await supabase
        .from("emergency_contacts")
        .update({ name: name.trim(), phone: phone.trim() })
        .eq("id", contact.id);

      if (updateError) throw updateError;

      // 2. ถ้าไม่ใช่ self ต้องอัปเดตบ้านด้วย
      if (!isSelf) {
        // ลบความสัมพันธ์เดิมออกให้หมด
        await supabase.from("house_contacts").delete().eq("contact_id", contact.id);

        // หา ID ของบ้านใหม่ที่ถูกเลือก
        const selectedHouseIds = dbHouses
          .filter((h) => houses.includes(h.name))
          .map((h) => ({ house_id: h.id, contact_id: contact.id }));

        // Insert เข้าไปใหม่
        if (selectedHouseIds.length > 0) {
          const { error: insertError } = await supabase
            .from("house_contacts")
            .insert(selectedHouseIds);
          if (insertError) throw insertError;
        }
      }
      goBack();
    } catch (error) {
      console.error("Error updating contact:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกได้");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contact) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("emergency_contacts")
        .delete()
        .eq("id", contact.id);
      
      if (error) throw error;
      goBack();
    } catch (error) {
      console.error("Error deleting contact:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถลบได้");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!contact) {
    return (
      <View className="flex-1 bg-[#F2F2F2] items-center justify-center px-8">
        <Text className="text-sm text-[#888]">ไม่พบผู้ติดต่อ</Text>
        <TouchableOpacity onPress={goBack} className="mt-4">
          <Text className="text-sm font-semibold text-[#FF3055]">กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="แก้ไขผู้ติดต่อ" onBack={goBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <LabeledTextField
            label="ชื่อผู้ติดต่อ"
            value={name}
            onChangeText={(t) => setName(sanitizeName(t))}
            maxLength={NAME_MAX}
            containerClassName="px-5 mt-5"
          />

          <LabeledTextField
            label="เบอร์โทรศัพท์"
            value={phone}
            onChangeText={(t) => setPhone(sanitizePhone(t))}
            keyboardType="number-pad"
            maxLength={PHONE_MAX}
          />

          {!isSelf && (
            <View className="px-5 mt-4">
              <Text className="text-sm text-[#1A1A1A] mb-2">กลุ่มบ้านที่ดูแล</Text>
              <HousePillGroup
                houses={HOUSES}
                selected={houses}
                onSelect={toggleHouse}
                multi
              />
              <Text className="text-xs text-[#888] mt-1">
                เลือกกลุ่มบ้านที่ใช้อยากให้คนนี้ได้รับการแจ้งเตือนเมื่อตรวจพบการล้ม
              </Text>
            </View>
          )}
        </ScrollView>

        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={!canSave}
            className={`rounded-full py-4 items-center flex-row justify-center ${
              canSave ? "bg-[#FF3055]" : "bg-[#C56E76]"
            }`}
          >
            {isSaving && <ActivityIndicator color="#FFF" size="small" className="mr-2" />}
            <Text className="text-base font-semibold text-white">
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </Text>
          </TouchableOpacity>

          {canDelete && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDelete}
              disabled={isDeleting || isSaving}
              className="rounded-full py-4 items-center mt-3 bg-white border border-[#FF3055] flex-row justify-center"
            >
              {isDeleting && <ActivityIndicator color="#FF3055" size="small" className="mr-2" />}
              <Text className="text-base font-semibold text-[#FF3055]">
                {isDeleting ? "กำลังลบ..." : "ลบ"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}