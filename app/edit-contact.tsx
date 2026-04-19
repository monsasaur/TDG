import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { mockContacts } from "../data/mockContacts";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import HousePillGroup from "../components/HousePillGroup";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];
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

  const contact = useMemo(
    () => mockContacts.find((c) => c.id === id),
    [id]
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [houses, setHouses] = useState<string[]>([]);

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
    (isSelf || houses.length > 0);

  const toggleHouse = (h: string) =>
    setHouses((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
    );

  const goBack = () => router.back();

  if (!contact) {
    return (
      <View className="flex-1 bg-[#F5F5F5] items-center justify-center px-8">
        <Text className="text-sm text-[#888]">ไม่พบผู้ติดต่อ</Text>
        <TouchableOpacity onPress={goBack} className="mt-4">
          <Text className="text-sm font-semibold text-[#FF3055]">กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F5F5]">
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
            onPress={goBack}
            disabled={!canSave}
            className={`rounded-full py-4 items-center ${
              canSave ? "bg-[#FF3055]" : "bg-[#C56E76]"
            }`}
          >
            <Text className="text-base font-semibold text-white">บันทึก</Text>
          </TouchableOpacity>

          {canDelete && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={goBack}
              className="rounded-full py-4 items-center mt-3 bg-white border border-[#FF3055]"
            >
              <Text className="text-base font-semibold text-[#FF3055]">ลบ</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
