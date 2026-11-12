import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SettingItem from "../components/SettingItem";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, displayName, phoneDisplay, signOut } = useAuth();
  const [logoutModal, setLogoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="ตั้งค่า" onBack={() => router.back()} centered />

      {/* บัญชี */}
      <View className="rounded-2xl bg-white mx-5 mt-5 px-5 py-4 flex-row items-center">
        <View className="w-11 h-11 rounded-full bg-[#FFE3E8] items-center justify-center">
          <Ionicons name="person" size={20} color="#FF3055" />
        </View>
        <View className="ml-3 flex-1">
          {user ? (
            <>
              <Text className="text-sm font-semibold text-[#1A1A1A]" numberOfLines={1}>
                {displayName}
              </Text>
              {phoneDisplay ? (
                <Text className="text-xs text-[#888888] mt-0.5">{phoneDisplay}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text className="text-sm font-semibold text-[#1A1A1A]">ยังไม่ได้เข้าสู่ระบบ</Text>
              <Text className="text-xs text-[#888888] mt-0.5 leading-[18px]">
                เข้าสู่ระบบเพื่อให้สมาชิกในบ้านเห็นว่าใครกดรับทราบ
              </Text>
            </>
          )}
        </View>
        {!user && (
          <Pressable onPress={() => router.push("/welcome" as any)} hitSlop={10} className="ml-2">
            <Text className="text-sm font-semibold text-[#FF3055]">เข้าสู่ระบบ</Text>
          </Pressable>
        )}
      </View>

      {/* Clear all pill */}
      <Pressable
        onPress={handleClearAll}
        className="rounded-full bg-white mx-5 mt-4 py-3"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
      >
        <Text className="text-sm font-semibold text-[#1A1A1A] text-center">
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
            label="ประวัติการเปลี่ยนแปลง"
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
            <Ionicons name="log-out-outline" size={18} color="#FF3055" />
            <Text className="text-sm font-semibold text-[#FF3055] ml-3">ออกจากระบบ</Text>
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
