import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import ConfirmModal from "../components/ConfirmModal";
import HousePill from "../components/HousePill";
import JoinOptionCard from "../components/JoinOptionCard";
import PageHeader from "../components/PageHeader";

// Import สิ่งที่จำเป็นสำหรับ Supabase
import { supabase } from "../data/supabaseClient";
import { House, leaveHouse, MAX_HOUSES, useHouses, useMyHouseRoles } from "../data/useHouses";
import { useAlerts } from "../contexts/AlertsContext";
import { useAuth } from "../contexts/AuthContext";
import { useDevices } from "../contexts/DevicesContext";

const ROLE_LABEL: Record<string, string | undefined> = { owner: "เจ้าของบ้าน", caregiver: "ผู้ดูแล" };

export default function HousesScreen() {
  const router = useRouter();

  // 1. ดึงข้อมูลจาก Hook จริง
  const { houses, isLoading, refetch } = useHouses();

  // บทบาทของเราในแต่ละบ้าน — caregiver ได้ปุ่ม "ออกจากบ้าน" แทน "ลบบ้าน"
  // null = ยังไม่ login / ยังไม่รัน accounts.sql → ทุกบ้านเป็นปุ่มลบแบบเดิม
  const { user } = useAuth();
  const { roles, refetch: refetchRoles } = useMyHouseRoles(user?.id);
  const { refresh: refreshAlerts } = useAlerts();
  const { refresh: refreshDevices } = useDevices();

  // กลับมาจากหน้าเพิ่มบ้าน / กรอกรหัสบ้าน → ดึงใหม่ (เปิดหน้าครั้งแรก hook ดึงให้แล้ว)
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
      refetchRoles();
    }, [refetch, refetchRoles]),
  );

  // สร้าง State ย่อยมาเก็บข้อมูลบ้านไว้แสดงผล
  // (เพื่อให้เวลาพอกดลบปุ๊บ เราสามารถอัปเดตเอาออกจากหน้าจอได้ทันทีโดยไม่ต้องรอโหลดใหม่)
  const [localHouses, setLocalHouses] = useState<House[]>([]);

  useEffect(() => {
    setLocalHouses(houses);
  }, [houses]);

  // 2. เปลี่ยน pendingRemove ให้เก็บ Object ของ House แทน string
  const [pendingRemove, setPendingRemove] = useState<House | null>(null);
  const [pendingLeave, setPendingLeave] = useState<House | null>(null);
  const [limitModal, setLimitModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isCaregiver = (h: House) => roles?.get(h.id) === "caregiver";

  const confirmLeave = async () => {
    if (!pendingLeave || !user) return;
    setIsDeleting(true);
    const res = await leaveHouse(pendingLeave.id, user.id);
    setIsDeleting(false);
    const left = pendingLeave;
    setPendingLeave(null);
    if (!res.ok) {
      Alert.alert("ออกจากบ้านไม่ได้", res.message ?? "กรุณาลองใหม่อีกครั้ง");
      return;
    }
    setLocalHouses((prev) => prev.filter((h) => h.id !== left.id));
    // บ้านที่มองเห็นเปลี่ยน — ดึงอุปกรณ์และการแจ้งเตือนใหม่ ไม่ให้ของบ้านที่ออกแล้วค้างบนหน้าจอ
    void refreshDevices();
    void refreshAlerts();
    void refetchRoles();
  };

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
      const { data, error } = await supabase
        .from("houses")
        .delete()
        .eq("id", pendingRemove.id)
        .select("id");

      if (error) throw error;
      // RLS ปฏิเสธแบบเงียบได้ — ไม่มี error แต่ไม่มีแถวไหนถูกลบ (accounts.sql ให้ลบได้เฉพาะเจ้าของบ้าน)
      if (!data || data.length === 0) {
        Alert.alert("ลบบ้านไม่ได้", "เฉพาะเจ้าของบ้านที่ลบบ้านได้");
        return;
      }

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
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="บ้าน" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between px-5 mt-5 mb-3">
          <Text className="text-sm font-semibold text-[#1A1A1A]">
            จัดการบ้าน
          </Text>
          <Pressable onPress={handleAdd} hitSlop={12}>
            <Ionicons name="add" size={22} color="#1A1A1A" />
          </Pressable>
        </View>
        <View className="px-5">
          {isLoading ? (
            <ActivityIndicator className="my-4" color="#000" />
          ) : (
            localHouses.map((h) => (
              <HousePill
                key={h.id}
                label={h.name}
                caption={ROLE_LABEL[roles?.get(h.id) ?? ""]}
                onRemove={() => (isCaregiver(h) ? setPendingLeave(h) : setPendingRemove(h))}
              />
            ))
          )}
        </View>

        <Text className="text-sm font-semibold text-[#1A1A1A] px-5 mt-8 mb-3">
          ยอมรับคำเชิญ
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
        visible={pendingLeave !== null}
        onClose={() => !isDeleting && setPendingLeave(null)}
        onConfirm={confirmLeave}
        title={`ออกจาก ${pendingLeave?.name ?? ""} ไหม`}
        titleAlign="left"
        messageAlign="left"
        cancelLabel="ยกเลิก"
        confirmLabel={isDeleting ? "กำลังออก..." : "ออกจากบ้าน"}
        message={"คุณจะไม่เห็นการแจ้งเตือนและอุปกรณ์ของบ้านนี้อีก และเครื่องนี้จะไม่ได้รับ push ของบ้านนี้\n\nถ้าจะกลับเข้าบ้าน ต้องขอรหัสเชิญใหม่จากเจ้าของบ้าน"}
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
