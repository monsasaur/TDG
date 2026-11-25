import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, Switch, Text, View } from "react-native";
import ConfirmModal from "./ConfirmModal";
import { getNotificationPermissions, requestNotificationPermissions } from "../lib/notifications";

type Permission = "undetermined" | "granted" | "denied";

/**
 * สวิตช์ "รับการแจ้งเตือนเมื่อมีคนล้ม" ดีไซน์ v2 (อยู่ในหน้าตั้งค่า)
 * สวิตช์ = สิทธิ์แจ้งเตือนของเครื่องจริง — แอปปิดสิทธิ์เองไม่ได้ จึงพาไปหน้าตั้งค่าของเครื่อง
 * ตรรกะเดียวกับหน้า notifications แบบ v1
 */
export default function PushPermissionCard() {
  const [permission, setPermission] = useState<Permission>("undetermined");
  const [settingsPrompt, setSettingsPrompt] = useState(false);
  const [offPrompt, setOffPrompt] = useState(false);

  // สวิตช์ = สิทธิ์แจ้งเตือนของเครื่องจริง ไม่ใช่ค่าในแอป
  // (เดิมกดปิดแล้วเปลี่ยนแค่บนจอ push ยังเด้ง และเปิดหน้าใหม่ก็กลับมาเปิด)
  const refresh = useCallback(() => {
    if (Platform.OS === "web") return;
    getNotificationPermissions().then(({ status }) => {
      setPermission(status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined");
    });
  }, []);

  // กลับมาจากหน้าตั้งค่าของเครื่อง → อ่านสิทธิ์ใหม่
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handleToggle = async () => {
    if (Platform.OS === "web") {
      setSettingsPrompt(true);
      return;
    }

    if (permission === "granted") {
      // แอปปิดสิทธิ์ของเครื่องเองไม่ได้ — บอกผลให้ชัด แล้วพาไปปิดที่ตั้งค่าของเครื่อง
      setOffPrompt(true);
      return;
    }
    if (permission === "undetermined") {
      const { status, canAskAgain } = await requestNotificationPermissions();
      if (status === "granted") {
        setPermission("granted");
      } else {
        setPermission("denied");
        if (!canAskAgain) setSettingsPrompt(true);
      }
      return;
    }
    setSettingsPrompt(true);
  };

  const handleOpenSettings = () => {
    setSettingsPrompt(false);
    setOffPrompt(false);
    if (Platform.OS !== "web") Linking.openSettings();
  };

  const modals = (
    <>
      <ConfirmModal
        visible={offPrompt}
        onClose={() => setOffPrompt(false)}
        onConfirm={handleOpenSettings}
        confirmLabel="ไปที่การตั้งค่า"
        title="ปิดการแจ้งเตือน"
        titleAlign="left"
        messageAlign="left"
        message={
          "ปิดได้ที่การตั้งค่าของเครื่อง\n\n" +
          "ถ้าปิด เครื่องนี้จะไม่เด้งเตือนเมื่อตรวจพบการล้ม — ระบบยังโทรหาเบอร์ติดต่อฉุกเฉินเมื่อไม่มีใครกดรับทราบในเวลาที่กำหนด"
        }
      />

      <ConfirmModal
        visible={settingsPrompt}
        onClose={() => setSettingsPrompt(false)}
        onConfirm={handleOpenSettings}
        confirmLabel="ไปที่การตั้งค่า"
        titleAlign="left"
        messageAlign="left"
      >
        <Text className="text-sm text-ink leading-5">
          หากต้องการใช้คุณสมบัตินี้ คุณต้องให้การอนุญาติต่อไปในการตั้งค่า
        </Text>
        <View className="mt-3">
          <Text className="text-sm text-ink">• การแจ้งเตือน</Text>
          <Text className="text-xs text-sub ml-3 mt-0.5">
            ใช้เพื่อรับการแจ้งเตือนของแอปพลิเคชัน
          </Text>
        </View>
        <Text className="text-sm text-ink mt-4 leading-5">
          หากต้องการใช้คุณสมบัติต่อ ให้เปิดการตั้งค่า
          จากนั้นเลือกให้สิทธิ์ในการใช้งาน
        </Text>
      </ConfirmModal>
    </>
  );

  return (
    <>
      <View className="bg-white rounded-2xl px-4 py-3 mb-3 flex-row items-center justify-between min-h-[64px]">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-[#292A32]">รับการแจ้งเตือนเมื่อมีคนล้ม</Text>
          <Text className="text-xs text-[#858891] mt-0.5">
            {Platform.OS === "web" ? "ใช้ได้บนแอปมือถือเท่านั้น" : permission === "granted" ? "เปิดอยู่บนเครื่องนี้" : "ปิดอยู่ — แตะเพื่อเปิด"}
          </Text>
        </View>
        <Switch
          value={permission === "granted"}
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
