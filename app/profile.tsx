import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ActionCard from "../components/ActionCard";
import BottomTabBar from "../components/BottomTabBar";
import ConfirmModal from "../components/ConfirmModal";
import EmptyState from "../components/EmptyState";
import FormRow from "../components/FormRow";
import TabHeader from "../components/TabHeader";
import { V2C } from "../components/designVersion";
import { useAuth } from "../contexts/AuthContext";

/**
 * โปรไฟล์ (แท็บล่าง ดีไซน์ v2) — ดูเบอร์ · แก้ชื่อที่แสดง · ออกจากระบบ
 * ชื่อที่แสดงคือ "รับทราบโดย" ที่สมาชิกในบ้านเห็นเมื่อกดรับทราบการแจ้งเตือน (สเปค Screen 2)
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, displayName, phoneDisplay, updateDisplayName, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const startEdit = () => {
    setName(displayName);
    setNameError("");
    setSaved(false);
    setEditing(true);
  };

  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      setNameError("กรุณากรอกชื่อ");
      return;
    }
    setSaving(true);
    const res = await updateDisplayName(name);
    setSaving(false);
    if (!res.ok) {
      setNameError(res.message);
      return;
    }
    // แสดงว่าบันทึกแล้วหลัง backend ยืนยันเท่านั้น
    setEditing(false);
    setSaved(true);
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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className={`flex-1 ${V2C.page}`}>
      <Stack.Screen options={{ animation: "none" }} />
      <TabHeader title="โปรไฟล์" />

      {!user ? (
        <View className="flex-1">
          <EmptyState
            compact
            icon="person-circle-outline"
            title="ยังไม่ได้เข้าสู่ระบบ"
            description="เข้าสู่ระบบเพื่อรับการแจ้งเตือนของบ้านที่คุณเป็นสมาชิก"
            ctaLabel="เข้าสู่ระบบ"
            onPress={() => router.replace("/welcome" as any)}
          />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View className="items-center mb-6">
            <View className="w-20 h-20 rounded-full bg-white items-center justify-center">
              <Ionicons name="person" size={36} color="#292A32" />
            </View>
            <Text className="text-xl font-bold text-[#292A32] mt-3" numberOfLines={1}>
              {displayName}
            </Text>
            {phoneDisplay ? <Text className="text-sm text-[#858891] mt-0.5">{phoneDisplay}</Text> : null}
          </View>

          {editing ? (
            <View>
              <View className="bg-white rounded-2xl overflow-hidden">
                <FormRow
                  icon="person-outline"
                  label="ชื่อที่แสดง"
                  value={name}
                  error={nameError}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={save}
                  onChangeText={(t) => {
                    setName(t);
                    setNameError("");
                  }}
                  last
                />
              </View>
              <Text className="text-xs text-[#858891] mt-2 mx-1 leading-[18px]">
                สมาชิกในบ้านจะเห็นชื่อนี้เป็น &quot;รับทราบโดย&quot; เมื่อคุณกดรับทราบการแจ้งเตือน
              </Text>
              <View className="flex-row mt-4">
                <TouchableOpacity
                  onPress={() => setEditing(false)}
                  disabled={saving}
                  accessibilityRole="button"
                  className="flex-1 h-[52px] rounded-2xl bg-white border border-[#E5E6E9] items-center justify-center mr-2"
                >
                  <Text className="text-base font-semibold text-[#292A32]">ยกเลิก</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={save}
                  disabled={saving}
                  accessibilityRole="button"
                  className={`flex-1 h-[52px] rounded-2xl items-center justify-center ml-2 ${saving ? V2C.darkDisabled : V2C.dark}`}
                >
                  {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-base font-semibold text-white">บันทึก</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <ActionCard surface="white" icon="create-outline" title="แก้ไขชื่อที่แสดง" description={displayName} onPress={startEdit} />
              {saved && (
                <Text accessibilityLiveRegion="polite" className="text-xs text-[#16A34A] -mt-1 mb-3 mx-1">
                  บันทึกชื่อแล้ว
                </Text>
              )}
              <View className="bg-white rounded-2xl px-4 py-4 mb-3 flex-row items-center min-h-[64px]">
                <Ionicons name="call-outline" size={24} color="#292A32" />
                <View className="flex-1 ml-4">
                  <Text className="text-base font-semibold text-[#292A32]">เบอร์โทรศัพท์</Text>
                  <Text className="text-xs text-[#858891] mt-0.5">{phoneDisplay || "-"} · ใช้เข้าสู่ระบบ เปลี่ยนไม่ได้</Text>
                </View>
              </View>
              <View className="mt-4">
                <ActionCard surface="white" tone="danger" chevron={false} icon="log-out-outline" title="ออกจากระบบ" onPress={() => setLogoutModal(true)} />
              </View>
            </>
          )}
        </ScrollView>
      )}

      <BottomTabBar active="profile" />

      <ConfirmModal
        visible={logoutModal}
        onClose={() => !signingOut && setLogoutModal(false)}
        onConfirm={handleLogout}
        title="ออกจากระบบไหม"
        tone="danger"
        message="ต้องเข้าสู่ระบบใหม่ถึงจะเห็นรายการแจ้งเตือนในแอป แต่เครื่องนี้ยังได้รับการแจ้งเตือนแบบ push อยู่"
        confirmLabel={signingOut ? "กำลังออก..." : "ออกจากระบบ"}
      />
    </KeyboardAvoidingView>
  );
}
