import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import JoinOptionCard from "../components/JoinOptionCard";
import { useAuth } from "../contexts/AuthContext";
import { hasAnyHouse } from "../data/useHouses";

/**
 * เริ่มต้นใช้งาน — บัญชีที่ยังไม่มีบ้าน (เพิ่งสมัคร หรือ login แล้วไม่เห็นบ้านไหนเลย)
 * เลือกสร้างบ้านใหม่ (เป็นเจ้าของบ้าน) หรือเข้าร่วมบ้านที่มีอยู่ด้วย QR / รหัสเชิญ (เป็นผู้ดูแล) หรือข้ามไปก่อน
 *
 * หน้าสร้างบ้าน / กรอกรหัส / สแกน QR ทำเสร็จแล้ว router.back() กลับมาที่นี่ → เช็คอีกครั้ง มีบ้านแล้วไปหน้า home เอง
 * มาจากหน้า home (ปุ่ม "เพิ่มบ้าน") → ย้อนกลับไปหน้า home เดิม ไม่ซ้อนหน้า home ใหม่
 */
export default function GetStartedScreen() {
  const router = useRouter();
  const { displayName } = useAuth();

  const goHome = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/home" as any);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      hasAnyHouse().then((any) => {
        if (alive && any) goHome();
      });
      return () => {
        alive = false;
      };
    }, [goHome]),
  );

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 72, paddingBottom: 32 }}>
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-full bg-[#FFE3E8] items-center justify-center mb-4">
            <Ionicons name="home" size={30} color="#FF3055" />
          </View>
          <Text className="text-[22px] font-bold text-[#1A1A1A] text-center">
            สวัสดี {displayName}
          </Text>
          <Text className="text-sm text-[#888888] text-center leading-[22px] mt-2">
            เพิ่มบ้านเพื่อเริ่มรับการแจ้งเตือน{"\n"}เมื่อมีคนในบ้านล้ม
          </Text>
        </View>

        <Text className="text-sm font-semibold text-[#1A1A1A] mb-3">ติดตั้งอุปกรณ์เอง</Text>
        <JoinOptionCard
          icon="add-circle-outline"
          title="สร้างบ้านใหม่"
          description="สำหรับบ้านของคุณ หรือบ้านคนที่คุณดูแล · คุณจะเป็นเจ้าของบ้าน และเชิญคนอื่นเข้ามาดูแลด้วยกันได้"
          onPress={() => router.push("/add-house" as never)}
          highlighted
        />

        <Text className="text-sm font-semibold text-[#1A1A1A] mt-5 mb-3">มีคนติดตั้งไว้แล้ว</Text>
        <JoinOptionCard
          icon="qr-code-outline"
          title="สแกน QR code"
          description="อยู่กับเจ้าของบ้าน ขอให้เขาเปิด QR เชิญเข้าบ้านแล้วสแกน · คุณจะเป็นผู้ดูแล"
          onPress={() => router.push("/scan-qr" as never)}
        />
        <JoinOptionCard
          icon="create-outline"
          title="กรอกรหัสบ้าน"
          description="ขอรหัสเชิญ 6 ตัวจากเจ้าของบ้าน · คุณจะเป็นผู้ดูแล"
          onPress={() => router.push("/enter-code" as never)}
        />

        <TouchableOpacity onPress={goHome} hitSlop={12} className="items-center mt-6">
          <Text className="text-sm font-semibold text-[#1A1A1A]">ข้ามไปก่อน</Text>
          <Text className="text-xs text-[#AAAAAA] mt-1">เพิ่มบ้านทีหลังได้จากหน้าหลัก</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
