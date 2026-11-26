import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Switch, Linking, Platform, AppState, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import PageHeader from "../components/PageHeader";
import BottomTabBar from "../components/BottomTabBar";
import EmptyState from "../components/EmptyState";
import SystemAlertCard from "../components/SystemAlertCard";
import TabHeader from "../components/TabHeader";
import { V2, V2C } from "../components/designVersion";
import HouseDropdown from "../components/HouseDropdown";
import { useAlerts } from "../contexts/AlertsContext";
import { SkeletonList } from "../components/Skeleton";
import { ALL_HOUSES, useHouseFilter } from "../contexts/HouseFilterContext";
import { useHouses } from "../data/useHouses";
import ConfirmModal from "../components/ConfirmModal";
import PermissionModal from "../components/PermissionModal";
import {
  getNotificationPermissions,
  requestNotificationPermissions,
} from "../lib/notifications";
import { C } from "../components/theme";
import { safeBack } from "../lib/navigation";

type Permission = "undetermined" | "granted" | "denied";

export default function NotificationsScreen() {
  const router = useRouter();
  const { systemAlerts, isLoading: alertsLoading } = useAlerts();
  // ตัวกรองบ้านตัวเดียวกับหน้าหลัก (contexts/HouseFilterContext)
  const { selected: selectedHouse, setSelected: setSelectedHouse } = useHouseFilter();
  const { houses: dbHouses } = useHouses();
  const HOUSES = useMemo(() => dbHouses.map((h) => h.name), [dbHouses]);
  const visibleSystemAlerts = useMemo(
    () => (selectedHouse === ALL_HOUSES ? systemAlerts : systemAlerts.filter((a) => a.houseName === selectedHouse)),
    [systemAlerts, selectedHouse],
  );

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

      <PermissionModal
        visible={settingsPrompt}
        onClose={() => setSettingsPrompt(false)}
        onOpenSettings={handleOpenSettings}
        items={[
          {
            label: "การแจ้งเตือน",
            reason: "ใช้เด้งเตือนบนเครื่องนี้ทันทีที่ตรวจพบการล้ม",
          },
        ]}
        footer="ไม่เปิดก็ยังใช้แอปได้ แต่จะเห็นการแจ้งเตือนเฉพาะตอนเปิดแอปอยู่"
      />
    </>
  );

  // ดีไซน์ v2 — แท็บล่าง "แจ้งเตือนระบบ": สถานะอุปกรณ์ · สวิตช์แจ้งเตือนของเครื่องย้ายไปหน้าตั้งค่า (PushPermissionCard)
  if (V2) {
    return (
      <View className={`flex-1 ${V2C.page}`}>
        <Stack.Screen options={{ animation: "none" }} />
        <TabHeader title="แจ้งเตือนระบบ">
          {HOUSES.length > 0 && (
            <View className="mt-3">
              <HouseDropdown variant="chip" houses={HOUSES} selected={selectedHouse} onSelect={setSelectedHouse} />
            </View>
          )}
        </TabHeader>
        <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 20 }}>
          <Text className="text-sm text-[#858891] mb-1 mx-6">สถานะอุปกรณ์</Text>
          {alertsLoading ? (
            <SkeletonList count={2} />
          ) : visibleSystemAlerts.length === 0 ? (
            <EmptyState compact icon="hardware-chip-outline" title="อุปกรณ์ทำงานปกติ" description="ถ้าอุปกรณ์ขาดการเชื่อมต่อ จะแจ้งที่นี่" />
          ) : (
            visibleSystemAlerts.map((a) => <SystemAlertCard key={a.id} alert={a} />)
          )}
        </ScrollView>
        <BottomTabBar active="notifications" />
        {modals}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="การแจ้งเตือน" onBack={() => safeBack(router)} />

      <View className="bg-white mx-5 mt-5 rounded-2xl px-4 py-3 flex-row items-center justify-between">
        <Text className="text-sm text-ink">การแจ้งเตือนทั้งหมด</Text>
        <Switch
          value={permission === "granted"}
          onValueChange={handleToggle}
          trackColor={{ false: "#E8E8E8", true: C.brand }}
          thumbColor="#FFFFFF"
        />
      </View>

      {modals}
    </View>
  );
}
