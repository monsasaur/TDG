import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, Switch, Text, View } from "react-native";
import PermissionModal from "./PermissionModal";
import {
  isPushEnabled,
  registerForPushNotifications,
  setPushEnabled,
  unregisterPushNotifications,
} from "../lib/pushNotifications";
import {
  getNotificationPermissions,
  requestNotificationPermissions,
  REMOTE_PUSH_UNSUPPORTED,
} from "../lib/notifications";

type Permission = "undetermined" | "granted" | "denied";

/**
 * สวิตช์ "รับการแจ้งเตือนเมื่อมีคนล้ม" ดีไซน์ v2 (อยู่ในหน้าตั้งค่า)
 * สวิตช์ = สิทธิ์แจ้งเตือนของเครื่องจริง — แอปปิดสิทธิ์เองไม่ได้ จึงพาไปหน้าตั้งค่าของเครื่อง
 * ตรรกะเดียวกับหน้า notifications แบบ v1
 */
export default function PushPermissionCard() {
  const [permission, setPermission] = useState<Permission>("undetermined");
  const [settingsPrompt, setSettingsPrompt] = useState(false);
  /** ค่าที่ผู้ใช้เลือกเองในแอป — ปิดได้โดยไม่ต้องไปปิดสิทธิ์ที่ตั้งค่าของเครื่อง */
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  // สวิตช์ = สิทธิ์แจ้งเตือนของเครื่องจริง ไม่ใช่ค่าในแอป
  // (เดิมกดปิดแล้วเปลี่ยนแค่บนจอ push ยังเด้ง และเปิดหน้าใหม่ก็กลับมาเปิด)
  const refresh = useCallback(() => {
    if (Platform.OS === "web") return;
    getNotificationPermissions().then(({ status }) => {
      setPermission(status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined");
    });
    isPushEnabled().then(setEnabled);
  }, []);

  // กลับมาจากหน้าตั้งค่าของเครื่อง → อ่านสิทธิ์ใหม่
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const on = permission === "granted" && enabled;

  const handleToggle = async () => {
    if (Platform.OS === "web" || busy) {
      if (Platform.OS === "web") setSettingsPrompt(true);
      return;
    }
    setBusy(true);
    try {
      // กำลังเปิดอยู่ → ปิดในแอปได้เลย ไม่ต้องไปตั้งค่าของเครื่อง (แค่ถอนเครื่องนี้ออกจากผู้รับ push)
      if (on) {
        setEnabled(false);
        await setPushEnabled(false);
        await unregisterPushNotifications();
        return;
      }

      // ยังไม่เคยถามสิทธิ์ → ถามก่อน
      let status = permission;
      if (status !== "granted") {
        const res = await requestNotificationPermissions();
        status = res.status === "granted" ? "granted" : res.status === "denied" ? "denied" : "undetermined";
        setPermission(status);
        // ปฏิเสธถาวรแล้ว แอปขอเองไม่ได้ ต้องไปเปิดที่ตั้งค่าของเครื่อง
        if (status !== "granted") {
          if (!res.canAskAgain) setSettingsPrompt(true);
          return;
        }
      }

      setEnabled(true);
      await setPushEnabled(true);
      await registerForPushNotifications({ force: true });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSettings = () => {
    setSettingsPrompt(false);
    if (Platform.OS !== "web") Linking.openSettings();
  };

  const modals = (
    <PermissionModal
      visible={settingsPrompt}
      onClose={() => setSettingsPrompt(false)}
      onOpenSettings={handleOpenSettings}
      items={[{ label: "การแจ้งเตือน", reason: "ใช้เด้งเตือนบนเครื่องนี้ทันทีที่ตรวจพบการล้ม" }]}
      footer="เครื่องนี้เคยปฏิเสธสิทธิ์ไว้ แอปขอใหม่เองไม่ได้ ต้องเปิดในการตั้งค่าของเครื่อง"
    />
  );

  return (
    <>
      <View className="bg-white rounded-2xl px-4 py-3 mb-3 flex-row items-center justify-between min-h-[64px]">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-[#292A32]">รับการแจ้งเตือนเมื่อมีคนล้ม</Text>
          <Text className="text-xs text-[#858891] mt-0.5">
            {Platform.OS === "web"
              ? "ใช้ได้บนแอปมือถือเท่านั้น"
              : !on
                ? "ปิดอยู่ — แตะเพื่อเปิด"
                : REMOTE_PUSH_UNSUPPORTED
                  ? "เปิดอยู่บนเครื่องนี้ · Expo Go ยังไม่เด้ง push จากเซิร์ฟเวอร์ ต้องใช้ dev build"
                  : "เปิดอยู่บนเครื่องนี้"}
          </Text>
        </View>
        <Switch
          value={on}
          disabled={busy}
          onValueChange={handleToggle}
          trackColor={{ false: "#E5E6E9", true: "#292A32" }}
          thumbColor="#FFFFFF"
          accessibilityLabel="รับการแจ้งเตือนเมื่อมีคนล้ม"
        />
      </View>
      {modals}
    </>
  );
}
