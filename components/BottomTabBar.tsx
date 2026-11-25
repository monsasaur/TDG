import { useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlerts } from "../contexts/AlertsContext";
import { ALL_HOUSES, useHouseFilter } from "../contexts/HouseFilterContext";
import { useReadState } from "../contexts/ReadStateContext";
import { useUnreadAuditCount } from "../data/useAuditBadge";

/**
 * แถบเมนูล่าง ดีไซน์ v2 — หน้าหลัก (เหตุการณ์ล้ม) · แจ้งเตือนระบบ (สถานะอุปกรณ์) · ตั้งค่า · โปรไฟล์
 * สลับด้วย router.replace (ไม่ซ้อนหน้าใน stack) · หน้าย่อยที่เปิดจากแต่ละแท็บยังกดย้อนกลับมาได้ตามปกติ
 */
export type TabKey = "home" | "notifications" | "settings" | "profile";

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; path: string }[] = [
  { key: "home", label: "หน้าหลัก", icon: "home-outline", iconActive: "home", path: "/home" },
  { key: "notifications", label: "แจ้งเตือนระบบ", icon: "notifications-outline", iconActive: "notifications", path: "/notifications" },
  { key: "settings", label: "ตั้งค่า", icon: "settings-outline", iconActive: "settings", path: "/settings" },
  { key: "profile", label: "โปรไฟล์", icon: "person-outline", iconActive: "person", path: "/profile" },
];

/**
 * จุดแดงคิดในนี้ที่เดียว ทุกแท็บจึงเห็นเท่ากัน — เดิมแต่ละหน้าส่งเลขมาเอง
 * หน้าตั้งค่า/โปรไฟล์ไม่ได้ส่ง เลยไม่ขึ้นจุดแดงทั้งที่มีเหตุการณ์ค้างอยู่
 * นับเฉพาะ "ยังไม่อ่าน" ของบ้านที่กรองอยู่ — กดดูการ์ดแล้วเลขลดลงทันที
 */
export default function BottomTabBar({ active }: { active: TabKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { systemAlerts } = useAlerts();
  const { selected } = useHouseFilter();
  const { unreadCount, prune } = useReadState();

  const visible = useMemo(
    () => (selected === ALL_HOUSES ? systemAlerts : systemAlerts.filter((a) => a.houseName === selected)),
    [systemAlerts, selected],
  );
  const ids = useMemo(() => visible.map((a) => a.id), [visible]);

  // อุปกรณ์กลับมาออนไลน์แล้วหลุดใหม่ ต้องนับเป็นของใหม่ที่ยังไม่อ่าน
  const allIds = useMemo(() => systemAlerts.map((a) => a.id).join("|"), [systemAlerts]);
  useEffect(() => {
    prune("sa-", allIds ? allIds.split("|") : []);
  }, [allIds, prune]);

  // ประวัติการเปลี่ยนแปลงมีเรื่องใหม่ → จุดแดงที่แท็บตั้งค่า (เมนูข้างในก็ขึ้นจุดเดียวกัน)
  const newAuditCount = useUnreadAuditCount();

  const badge: Partial<Record<TabKey, number>> = {
    notifications: unreadCount(ids),
    settings: newAuditCount,
  };
  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className="flex-row bg-white border-t border-[#E5E6E9] pt-2"
      accessibilityRole="tablist"
    >
      {TABS.map((t) => {
        const on = t.key === active;
        const n = badge?.[t.key] ?? 0;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={n > 0 ? `${t.label} ${n} รายการ` : t.label}
            onPress={() => !on && router.replace(t.path as never)}
            className="flex-1 items-center justify-center min-h-[48px]"
          >
            <View>
              <Ionicons name={on ? t.iconActive : t.icon} size={24} color={on ? "#292A32" : "#9CA3AF"} />
              {n > 0 && (
                <View className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] items-center justify-center">
                  <Text className="text-[10px] font-bold text-white">{n}</Text>
                </View>
              )}
            </View>
            <Text className={`text-[11px] mt-1 ${on ? "font-semibold text-[#292A32]" : "text-[#9CA3AF]"}`}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
