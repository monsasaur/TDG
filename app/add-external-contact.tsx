import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ConfirmModal from "../components/ConfirmModal";
import HousePillGroup from "../components/HousePillGroup";
import LabeledTextField from "../components/LabeledTextField";
import PageHeader from "../components/PageHeader";

// 1. Import Hooks และ Supabase Client
import { supabase } from "../data/supabaseClient";
import { CONTACT_PHONE_ERROR, normalizeContactPhone, sanitizeContactPhoneInput } from "../lib/phone";
import { MAX_EXTERNAL_PER_HOUSE, useContacts } from "../data/useContacts";
import { useHouses } from "../data/useHouses";
import { useOwnerAccess } from "../data/useOwnerAccess";
import { BTN } from "../components/buttonTheme";
import { C } from "../components/theme";

const NAME_MAX = 20;
// ยาวพอให้วาง "+66 81-234-5678" ได้ทั้งก้อน — sanitizeContactPhoneInput ตัดเหลือ ≤ 10 หลักเอง
const PHONE_MAX = 16;

const sanitizeName = (raw: string) =>
  raw
    .replace(/[\p{Extended_Pictographic}\u200d]/gu, "")
    .replace(/[\/*]/g, "")
    .slice(0, NAME_MAX);

export default function AddExternalContactScreen() {
  const router = useRouter();

  // 2. ดึงข้อมูลจากฐานข้อมูลจริง
  const { houses: dbHouses, isLoading: loadingHouses } = useHouses();
  const { contacts, isLoading: loadingContacts } = useContacts();

  // สร้าง Array รายชื่อบ้านแบบ Dynamic
  // ผูกผู้ติดต่อกับบ้านได้เฉพาะบ้านที่เราเป็นเจ้าของ (RLS house_contacts_insert)
  // ไม่กรอง = ผู้ดูแลเพิ่มแล้วผูกบ้านไม่ผ่าน เหลือผู้ติดต่อค้างที่ไม่อยู่บ้านไหน
  const { enforced, isOwner } = useOwnerAccess();
  const HOUSES = useMemo(
    () => dbHouses.filter((h) => isOwner(h.id)).map((h) => h.name),
    [dbHouses, isOwner],
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [house, setHouse] = useState<string | null>(null);
  const [limitModal, setLimitModal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isLoading = loadingHouses || loadingContacts;

  const canSubmit =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    house !== null &&
    !isSaving &&
    !isLoading;

  // 3. เช็คโควต้าโดยใช้ข้อมูลจริงจาก Database (ดัก undefined ไว้แล้ว)
  const externalCounts = useMemo(() => {
    const map: Record<string, number> = {};
    const safeContacts = contacts || []; // ป้องกันแครช filter of undefined
    for (const h of HOUSES) {
      map[h] = safeContacts.filter(
        (c) => c.type === "external" && (c.houses || []).includes(h),
      ).length;
    }
    return map;
  }, [HOUSES, contacts]);

  // 4. ฟังก์ชันบันทึกข้อมูลลง Supabase
  const handleSubmit = async () => {
    if (!canSubmit || !house) return;

    const savedPhone = normalizeContactPhone(phone);
    if (!savedPhone) {
      setPhoneError(CONTACT_PHONE_ERROR);
      return;
    }

    if (externalCounts[house] >= MAX_EXTERNAL_PER_HOUSE) {
      setLimitModal(house);
      return;
    }

    setIsSaving(true);

    try {
      // หา ID ของบ้านที่ผู้ใช้เลือก
      const selectedHouseObj = dbHouses.find((h) => h.name === house);
      if (!selectedHouseObj) throw new Error("ไม่พบข้อมูลบ้านที่เลือก");

      // สร้าง ID ให้ผู้ติดต่อใหม่ (เช่น c172837283)
      const newContactId = `c${Date.now()}`;

      // Insert ลงตาราง emergency_contacts
      const { error: contactError } = await supabase
        .from("emergency_contacts")
        .insert({
          id: newContactId,
          name: name.trim(),
          phone: savedPhone,
          contact_type: "external",
        });

      if (contactError) throw contactError;

      // Insert ลงตารางเชื่อม house_contacts เพื่อผูกคนเข้ากับบ้าน
      const { error: mappingError } = await supabase
        .from("house_contacts")
        .insert({
          house_id: selectedHouseObj.id,
          contact_id: newContactId,
        });

      if (mappingError) throw mappingError;

      // บันทึกสำเร็จ
      router.back();
    } catch (error) {
      console.error("Error adding external contact:", error);
      Alert.alert(
        "เกิดข้อผิดพลาด",
        "ไม่สามารถเพิ่มผู้ติดต่อได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader
        title="เพิ่มผู้ติดต่อฉุกเฉินภายนอก"
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {isLoading && <ActivityIndicator className="mt-5" color={C.brand} />}

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
            onChangeText={(t) => {
              setPhone(sanitizeContactPhoneInput(t));
              setPhoneError("");
            }}
            keyboardType="number-pad"
            maxLength={PHONE_MAX}
            error={phoneError}
          />

          <View className="px-5 mt-4">
            <Text className="text-sm text-ink mb-2">
              กลุ่มบ้านที่ดูแล
            </Text>
            {HOUSES.length > 0 ? (
              <HousePillGroup
                houses={HOUSES}
                selected={house}
                onSelect={setHouse}
              />
            ) : (
              <Text className="text-xs text-sub">
                {enforced && dbHouses.length > 0
                  ? "เฉพาะเจ้าของบ้านที่เพิ่มผู้ติดต่อฉุกเฉินของบ้านได้"
                  : "ยังไม่มีบ้านในระบบ"}
              </Text>
            )}
            <Text className="text-xs text-sub mt-1">
              เลือกกลุ่มบ้านที่ใช้อยากให้คนนี้ได้รับการแจ้งเตือนเมื่อตรวจพบการล้ม
            </Text>
          </View>
        </ScrollView>

        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-full py-4 items-center flex-row justify-center ${
              canSubmit ? BTN.solid : BTN.solidSoft
            }`}
          >
            {isSaving && (
              <ActivityIndicator color="#FFF" size="small" className="mr-2" />
            )}
            <Text
              className={`text-base font-semibold ${
                canSubmit ? "text-white" : "text-[#FFF6F8]"
              }`}
            >
              {isSaving ? "กำลังบันทึก..." : "เพิ่มผู้ติดต่อ"}
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
