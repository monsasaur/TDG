import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SettingItem from "../components/SettingItem";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../contexts/AuthContext";
import ActionCard from "../components/ActionCard";
import PushPermissionCard from "../components/PushPermissionCard";
import BottomTabBar from "../components/BottomTabBar";
import { useReadState } from "../contexts/ReadStateContext";
import { useAuditLog } from "../data/useAuditLog";
import TabHeader from "../components/TabHeader";
import { V2, V2C } from "../components/designVersion";
import { C } from "../components/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, displayName, phoneDisplay, signOut } = useAuth();
  const [logoutModal, setLogoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // จุดแดงที่เมนูประวัติการเปลี่ยนแปลง — นับรายการที่ยังไม่ได้เปิดดู
  const { entries } = useAuditLog(user?.id);
  const { unreadCount, markRead, ready } = useReadState();
  const auditIds = useMemo(() => entries.map((e) => `audit-${e.id}`), [entries]);
  const newAuditCount = unreadCount(auditIds);

  // ครั้งแรกของเครื่อง/บัญชีนี้ ประวัติเก่าทั้งหมดไม่ใช่ "เรื่องใหม่" — ตั้งเป็นอ่านแล้วไว้ก่อน
  // ไม่งั้นจะขึ้นจุดแดง 100 ทั้งที่ผู้ใช้ยังไม่ได้ทำอะไร
  const baselined = useRef(false);
  useEffect(() => {
    if (!ready || baselined.current || auditIds.length === 0) return;
    baselined.current = true;
    if (unreadCount(auditIds) === auditIds.length) markRead(auditIds);
  }, [ready, auditIds, unreadCount, markRead]);

  const handleClearAll = () => {
    router.push("/clear-alerts" as any);
  };

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    setLogoutModal(false);
    setSigningOut(false);
    if (router.canDismiss()) router.dismissAll();
    router.replace("/welcome" as any);
  };

  // ดีไซน์ v2 — เป็นแท็บล่าง ไม่มีปุ่มย้อนกลับ · บัญชีและออกจากระบบย้ายไปแท็บโปรไฟล์ · สิทธิ์แจ้งเตือนอยู่แท็บการแจ้งเตือน
  if (V2) {
    return (
      <View className={`flex-1 ${V2C.page}`}>
        <Stack.Screen options={{ animation: "none" }} />
        <TabHeader title="ตั้งค่า" />
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
          <Text className="text-sm text-[#858891] mb-2 mx-1">การแจ้งเตือนบนเครื่องนี้</Text>
          <PushPermissionCard />
          <Text className="text-sm text-[#858891] mt-4 mb-2 mx-1">บ้านและผู้ติดต่อ</Text>
          <ActionCard surface="white" icon="home-outline" title="จัดการบ้าน" description="บ้าน สมาชิก และอุปกรณ์" onPress={() => router.push("/manage-home" as any)} />
          <ActionCard surface="white" icon="call-outline" title="เบอร์โทรฉุกเฉิน" description="ระบบโทรหาเมื่อไม่มีใครกดรับทราบ" onPress={() => router.push("/emergency-contacts" as any)} />
          {user && (
            <ActionCard
              surface="white"
              icon="time-outline"
              title="ประวัติการเปลี่ยนแปลง"
              description="ใครแก้อะไรในบ้านเมื่อไร"
              badge={newAuditCount}
              onPress={() => router.push("/activity-log" as any)}
            />
          )}
          <Text className="text-sm text-[#858891] mt-4 mb-2 mx-1">รายการแจ้งเตือน</Text>
          <ActionCard surface="white" icon="trash-outline" title="ลบการแจ้งเตือนทั้งหมด" description="ซ่อนจากเครื่องนี้ ไม่กระทบสมาชิกคนอื่น" onPress={handleClearAll} />
        </ScrollView>
        <BottomTabBar active="settings" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="ตั้งค่า" onBack={() => router.back()} centered />

      {/* บัญชี */}
      <View className="rounded-2xl bg-white mx-5 mt-5 px-5 py-4 flex-row items-center">
        <View className="w-11 h-11 rounded-full bg-brand-soft items-center justify-center">
          <Ionicons name="person" size={20} color={C.brand} />
        </View>
        <View className="ml-3 flex-1">
          {user ? (
            <>
              <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                {displayName}
              </Text>
              {phoneDisplay ? (
                <Text className="text-xs text-sub mt-0.5">{phoneDisplay}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text className="text-sm font-semibold text-ink">ยังไม่ได้เข้าสู่ระบบ</Text>
              <Text className="text-xs text-sub mt-0.5 leading-[18px]">
                เข้าสู่ระบบเพื่อให้สมาชิกในบ้านเห็นว่าใครกดรับทราบ
              </Text>
            </>
          )}
        </View>
        {!user && (
          <Pressable onPress={() => router.push("/welcome" as any)} hitSlop={10} className="ml-2">
            <Text className="text-sm font-semibold text-brand">เข้าสู่ระบบ</Text>
          </Pressable>
        )}
      </View>

      {/* Clear all pill */}
      <Pressable
        onPress={handleClearAll}
        className="rounded-full bg-white mx-5 mt-4 py-3"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
      >
        <Text className="text-sm font-semibold text-ink text-center">
          ลบการแจ้งเตือนทั้งหมด
        </Text>
      </Pressable>

      {/* Menu */}
      <View className="mt-4">
        <SettingItem
          icon="call-outline"
          label="เบอร์โทรฉุกเฉิน"
          onPress={() => router.push("/emergency-contacts" as any)}
        />
        <SettingItem
          icon="notifications-outline"
          label="การแจ้งเตือน"
          onPress={() => router.push("/notifications" as any)}
        />
        <SettingItem
          icon="add-circle-outline"
          label="จัดการบ้าน"
          onPress={() => router.push("/manage-home" as any)}
        />
        {user && (
          <SettingItem
            icon="time-outline"
            label={newAuditCount > 0 ? `ประวัติการเปลี่ยนแปลง (${newAuditCount} ใหม่)` : "ประวัติการเปลี่ยนแปลง"}
            onPress={() => router.push("/activity-log" as any)}
          />
        )}
      </View>

      {user && (
        <Pressable
          onPress={() => setLogoutModal(true)}
          className="rounded-2xl bg-white mx-5 mt-8 px-5 py-4"
          style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
        >
          <View className="flex-row items-center">
            <Ionicons name="log-out-outline" size={18} color={C.danger} />
            <Text className="text-sm font-semibold text-danger ml-3">ออกจากระบบ</Text>
          </View>
        </Pressable>
      )}

      <ConfirmModal
        visible={logoutModal}
        onClose={() => !signingOut && setLogoutModal(false)}
        onConfirm={handleLogout}
        title="ออกจากระบบไหม"
        message="ต้องเข้าสู่ระบบใหม่ถึงจะเห็นรายการแจ้งเตือนในแอป แต่เครื่องนี้ยังได้รับการแจ้งเตือนแบบ push อยู่"
        confirmLabel={signingOut ? "กำลังออก..." : "ออกจากระบบ"}
      />
    </View>
  );
}
