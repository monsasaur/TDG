import { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { mockContacts, MAX_EXTERNAL_PER_HOUSE } from "../data/mockContacts";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import HousePillGroup from "../components/HousePillGroup";
import ConfirmModal from "../components/ConfirmModal";

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

export default function AddExternalContactScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [house, setHouse] = useState<string | null>(null);
  const [limitModal, setLimitModal] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && phone.trim().length > 0 && house !== null;

  const externalCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of HOUSES) {
      map[h] = mockContacts.filter(
        (c) => c.type === "external" && c.houses.includes(h)
      ).length;
    }
    return map;
  }, []);

  const handleSubmit = () => {
    if (!canSubmit || !house) return;
    if (externalCounts[house] >= MAX_EXTERNAL_PER_HOUSE) {
      setLimitModal(house);
      return;
    }
    router.back();
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เพิ่มผู้ติดต่อฉุกเฉินภายนอก" onBack={() => router.back()} />

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

          <View className="px-5 mt-4">
            <Text className="text-sm text-[#1A1A1A] mb-2">กลุ่มบ้านที่ดูแล</Text>
            <HousePillGroup
              houses={HOUSES}
              selected={house}
              onSelect={setHouse}
            />
            <Text className="text-xs text-[#888] mt-1">
              เลือกกลุ่มบ้านที่ใช้อยากให้คนนี้ได้รับการแจ้งเตือนเมื่อตรวจพบการล้ม
            </Text>
          </View>
        </ScrollView>

        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-full py-4 items-center ${
              canSubmit ? "bg-[#FF3055]" : "bg-[#FFD4DC]"
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                canSubmit ? "text-white" : "text-[#FFF6F8]"
              }`}
            >
              เพิ่มผู้ติดต่อ
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={limitModal !== null}
        onClose={() => setLimitModal(null)}
        title="มีเบอร์ติดต่อเยอะเกินไป"
        message={`${limitModal ?? ""} มีจำนวนเบอร์ติดต่อฉุกเฉินครบจำนวนสูงสุดที่อนุญาตแล้ว หากคุณต้องการเพิ่มเบอร์สมาชิกอื่น ให้นำเบอร์ติดต่อฉุกเฉินอื่นออกก่อน`}
      />
    </View>
  );
}
