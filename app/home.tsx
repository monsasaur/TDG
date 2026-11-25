import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { requestNotificationPermissions } from "../lib/notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AlertCardActive from "../components/AlertCardActive";
import AlertCardActiveV2 from "../components/AlertCardActiveV2";
import AlertHistoryRow from "../components/AlertHistoryRow";
import { V2, V2C } from "../components/designVersion";
import BottomTabBar from "../components/BottomTabBar";
import EmptyState from "../components/EmptyState";
import TabHeader from "../components/TabHeader";
import AlertCardExpanded from "../components/AlertCardExpanded";
import AlertCardSmall from "../components/AlertCardSmall";
import HouseDropdown from "../components/HouseDropdown";
import SystemAlertCard from "../components/SystemAlertCard";
import { useAlerts } from "../contexts/AlertsContext";
import { Alert as AlertType, SystemAlert } from "../types/alert";

// Import Hook สำหรับดึงบ้านจริง
import { useHouses } from "../data/useHouses";
import { useHouseFilter } from "../contexts/HouseFilterContext";
import { BTN } from "../components/buttonTheme";
import { C } from "../components/theme";

const PAGE_SIZE = 5;

// ดีไซน์ v1 / v2 สลับที่ components/designVersion.ts (ตัวเดียวกับหน้า login สมัคร เริ่มต้นใช้งาน)

export default function HomeScreen() {
  const router = useRouter();
  const { alerts, systemAlerts, setAlerts, acknowledgeAlert } = useAlerts();
  const { houses: dbHouses, isLoading: housesLoading, refetch: refetchHouses } = useHouses();

  // แปลงบ้านจาก Database ให้กลายเป็น Array
  const HOUSES = useMemo(() => dbHouses.map((h) => h.name), [dbHouses]);
  const noHouse = !housesLoading && dbHouses.length === 0;

  // กลับมาจากหน้าเริ่มต้นใช้งาน / สร้างบ้าน / เข้าร่วมบ้าน → ดึงบ้านใหม่ (เปิดหน้าครั้งแรก hook ดึงให้แล้ว)
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetchHouses();
    }, [refetchHouses]),
  );

  // v2 ใช้ "fall" = แท็บ "ทั้งหมด" · "history" = แท็บ "ประวัติ" (แจ้งเตือนระบบย้ายไปแท็บล่าง "การแจ้งเตือน")
  const [activeTab, setActiveTab] = useState<"fall" | "system" | "history">("fall");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ตัวกรองบ้านใช้ร่วมกันทั้งแอปและจำข้ามการเปิดแอป (contexts/HouseFilterContext)
  const { selected: selectedHouse, setSelected: setSelectedHouse } = useHouseFilter();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // แจ้งผู้ใช้เมื่อการกดรับทราบไปไม่ถึงระบบ — เดิมเงียบ ทั้งที่ระบบยังจะโทรฉุกเฉิน
  const [ackNotice, setAckNotice] = useState<string | null>(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  // ... นอกนั้นโค้ดด้านล่างปล่อยไว้เหมือนเดิมได้เลยครับ ...

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedHouse, activeTab]);

  const requestPermissions = async () => {
    await Location.requestForegroundPermissionsAsync();

    if (Platform.OS === "android") {
      const { PermissionsAndroid } = require("react-native");
      try {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          {
            title: "สิทธิ์การค้นหาอุปกรณ์",
            message: "Middle ต้องการค้นหาอุปกรณ์ใกล้เคียงเพื่อตรวจจับการล้ม",
            buttonPositive: "อนุญาต",
            buttonNegative: "ไม่อนุญาต",
          },
        );
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: "สิทธิ์การเชื่อมต่ออุปกรณ์",
            message:
              "Middle ต้องการเชื่อมต่อกับอุปกรณ์ใกล้เคียงเพื่อตรวจจับการล้ม",
            buttonPositive: "อนุญาต",
            buttonNegative: "ไม่อนุญาต",
          },
        );
      } catch {}
    }

    await requestNotificationPermissions();
  };

  // อัปเดตหน้าจอ + ส่งถึง backend อยู่ใน AlertsContext.acknowledgeAlert
  const handleConfirm = async (id: string) => {
    setExpandedId(id);
    setAckNotice(null);
    const result = await acknowledgeAlert(id);
    if (result === "failed") {
      setAckNotice(
        "ส่งการรับทราบไม่สำเร็จ ระบบจะยังโทรหาเบอร์ติดต่อฉุกเฉินเมื่อหมดเวลา กรุณากดรับทราบอีกครั้ง",
      );
    } else if (result === "not_allowed") {
      setAckNotice(
        "บัญชีนี้กดรับทราบเหตุการณ์นี้ไม่ได้ ต้องเข้าสู่ระบบด้วยบัญชีที่เป็นสมาชิกบ้านนี้ ระบบจะยังโทรหาเบอร์ติดต่อฉุกเฉินเมื่อหมดเวลา",
      );
    } else if (result === "already_escalated") {
      setAckNotice(
        "หมดเวลารอแล้ว ระบบโทรหาเบอร์ติดต่อฉุกเฉินไปก่อนที่การรับทราบจะมาถึง",
      );
    }
  };

  const handleSmallCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleTimeout = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== id || a.status !== "active") return a;
        return {
          ...a,
          status: "no_response" as const,
          countdown: 0,
          timeline: a.timeline.map((step, idx) => {
            if (idx === 1) {
              return {
                label: "ไม่มีการตอบรับ",
                detail: "ระบบโทรหาเบอร์ฉุกเฉิน",
                status: "error" as const,
              };
            }
            return { ...step, status: "error" as const };
          }),
        };
      }),
    );
    setExpandedId(id);
  };

  // Filter by house
  const filteredFallAlerts = useMemo(
    () =>
      selectedHouse === "ทั้งหมด"
        ? alerts
        : alerts.filter((a) => a.houseName === selectedHouse),
    [alerts, selectedHouse],
  );

  const filteredSystemAlerts = useMemo(
    () =>
      selectedHouse === "ทั้งหมด"
        ? systemAlerts
        : systemAlerts.filter((a) => a.houseName === selectedHouse),
    [systemAlerts, selectedHouse],
  );

  const fullFallList = useMemo(() => {
    const active = filteredFallAlerts.filter((a) => a.status === "active");
    const finished = filteredFallAlerts.filter((a) => a.status !== "active");
    return [...active, ...finished];
  }, [filteredFallAlerts]);

  const activeCount = filteredFallAlerts.filter((a) => a.status === "active").length;

  // Apply pagination to whichever tab is active
  const historyList = useMemo(() => filteredFallAlerts.filter((a) => a.status !== "active"), [filteredFallAlerts]);
  const fullList =
    activeTab === "fall" ? fullFallList : activeTab === "history" ? historyList : filteredSystemAlerts;
  const visibleData = fullList.slice(0, page * PAGE_SIZE);
  const hasMore = visibleData.length < fullList.length;

  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoading(false);
    }, 1500);
  }, [loading, hasMore]);

  // v2: แถวประวัติต่อกันเป็นกลุ่มเดียว มีหัวข้อ "ประวัติการแจ้งเตือน" ก่อนแถวแรก
  const firstFinishedIdx = (visibleData as AlertType[]).findIndex((a) => a.status !== "active");
  const lastIdx = visibleData.length - 1;

  const renderFallItem = useCallback(
    ({ item, index }: { item: AlertType; index: number }) => {
      if (V2) {
        if (item.status === "active") {
          return <AlertCardActiveV2 alert={item} onConfirm={handleConfirm} onTimeout={handleTimeout} />;
        }
        const header =
          index === firstFinishedIdx && activeTab === "fall" ? (
            <Text className="text-sm text-[#858891] mx-6 mt-6 mb-2">ประวัติเหตุการณ์</Text>
          ) : null;
        if (expandedId === item.id) {
          return (
            <View>
              {header}
              <TouchableOpacity onPress={() => setExpandedId(null)} activeOpacity={0.9}>
                <AlertCardExpanded alert={item} />
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <View>
            {header}
            <AlertHistoryRow
              alert={item}
              onPress={handleSmallCardPress}
              // การ์ดที่กางอยู่แบ่งกลุ่มแถวเป็นสองช่วง — แถวก่อน/หลังการ์ดได้มุมโค้งและช่องว่างของตัวเอง
              first={index === firstFinishedIdx || (visibleData as AlertType[])[index - 1]?.id === expandedId}
              last={index === lastIdx || (visibleData as AlertType[])[index + 1]?.id === expandedId}
            />
          </View>
        );
      }
      if (item.status === "active") {
        return (
          <AlertCardActive
            alert={item}
            onConfirm={handleConfirm}
            onTimeout={handleTimeout}
          />
        );
      }
      if (expandedId === item.id) {
        return (
          <TouchableOpacity
            onPress={() => setExpandedId(null)}
            activeOpacity={0.9}
          >
            <AlertCardExpanded alert={item} />
          </TouchableOpacity>
        );
      }
      return <AlertCardSmall alert={item} onPress={handleSmallCardPress} />;
    },
    [expandedId, firstFinishedIdx, lastIdx, activeTab, visibleData],
  );

  const renderSystemItem = useCallback(
    ({ item }: { item: SystemAlert }) => <SystemAlertCard alert={item} />,
    [],
  );

  const emptyText =
    activeTab === "fall" ? "ไม่มีการแจ้งเตือน" : "ไม่มีการแจ้งเตือนระบบ";

  // ดีไซน์ v2 ตามสเปค Screen 4 — หัว "การแจ้งเตือน" · แท็บ ทั้งหมด/ประวัติ · แถบเมนูล่าง
  if (V2) {
    return (
      <View className={`flex-1 ${V2C.page}`}>
        <TabHeader bordered title="เหตุการณ์ล้ม">
          {!noHouse && HOUSES.length > 0 && (
            <View className="mt-3">
              <HouseDropdown variant="chip" houses={HOUSES} selected={selectedHouse} onSelect={setSelectedHouse} />
            </View>
          )}
        </TabHeader>

        {/* รวมเป็นหน้าเดียว (ไม่มีแท็บ) — การ์ดที่รอรับทราบอยู่บน ประวัติต่อด้านล่าง */}

        {ackNotice && (
          <View className="mx-5 mt-3 rounded-xl bg-[#FEE2E2] px-4 py-3 flex-row items-start" accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text className="flex-1 text-xs text-[#DC2626] ml-2 leading-[18px]">{ackNotice}</Text>
            <TouchableOpacity onPress={() => setAckNotice(null)} hitSlop={8} accessibilityLabel="ปิดข้อความ">
              <Ionicons name="close" size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}

        <View className="flex-1">
          {housesLoading ? (
            <ActivityIndicator size="small" color="#292A32" style={{ marginTop: 48 }} />
          ) : noHouse ? (
            <EmptyState
              icon="home"
              badgeIcon="notifications"
              title="ยังไม่มีบ้านในระบบ"
              description={"เริ่มต้นด้วยการสร้างบ้าน หรือเข้าร่วมบ้าน\nเพื่อรับการแจ้งเตือน"}
              ctaLabel="เพิ่มบ้าน"
              ctaIcon="add"
              onPress={() => router.push("/get-started" as any)}
            />
          ) : visibleData.length === 0 ? (
            <EmptyState
              compact
              icon={activeTab === "history" ? "time-outline" : "notifications-outline"}
              title={activeTab === "history" ? "ยังไม่มีประวัติเหตุการณ์" : "ยังไม่มีเหตุการณ์ล้ม"}
              description={activeTab === "history" ? undefined : "เมื่อตรวจพบการล้ม จะขึ้นที่นี่ทันที"}
            />
          ) : (
            <FlatList
              data={visibleData as AlertType[]}
              keyExtractor={(item) => item.id}
              renderItem={renderFallItem}
              contentContainerStyle={{ paddingTop: activeTab === "history" ? 16 : 0, paddingBottom: 24 }}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loading ? <ActivityIndicator size="small" color="#292A32" style={{ marginTop: 16 }} /> : null
              }
            />
          )}
        </View>

        <BottomTabBar active="home" />
      </View>
    );
  }

  return (
    <View className={`flex-1 ${V2 ? "bg-[#F2F3F5]" : "bg-page"}`}>
      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-3">
        <View className="flex-row items-center justify-between">
          <HouseDropdown
            houses={HOUSES}
            selected={selectedHouse}
            onSelect={setSelectedHouse}
          />
          <View className="flex-row items-center">
            {V2 && (
              <View className="mr-4">
                <Ionicons name="notifications-outline" size={22} color="#292A32" />
                {activeCount > 0 && (
                  <View className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] items-center justify-center">
                    <Text className="text-[10px] font-bold text-white">{activeCount}</Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity onPress={() => router.push("/settings" as any)}>
              <Ionicons name="settings-outline" size={22} color={V2 ? "#292A32" : C.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-5 bg-white border-b border-[#E8E8E8]">
        <TouchableOpacity
          className={`pb-3 mr-6 ${activeTab === "fall" ? `border-b-2 ${V2 ? "border-[#292A32]" : "border-brand"}` : ""}`}
          onPress={() => setActiveTab("fall")}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === "fall" ? (V2 ? "text-[#292A32]" : "text-brand") : "text-[#AAAAAA]"
            }`}
          >
            ข้อความแจ้งเตือน
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`pb-3 ${activeTab === "system" ? `border-b-2 ${V2 ? "border-[#292A32]" : "border-brand"}` : ""}`}
          onPress={() => setActiveTab("system")}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === "system" ? (V2 ? "text-[#292A32]" : "text-brand") : "text-[#AAAAAA]"
            }`}
          >
            แจ้งเตือนระบบ
          </Text>
        </TouchableOpacity>
      </View>

      {noHouse && V2 && (
        <View className="items-center px-8 pt-16">
          <View className="w-[120px] h-[110px] items-center justify-center">
            <Ionicons name="home" size={96} color="#D1D5DB" />
            <View className="absolute right-0 bottom-1 w-10 h-10 rounded-full bg-[#292A32] items-center justify-center border-[3px] border-[#F2F3F5]">
              <Ionicons name="notifications" size={18} color="#FFFFFF" />
            </View>
          </View>
          <Text className="text-lg font-bold text-[#292A32] mt-5">ยังไม่มีบ้านในระบบ</Text>
          <Text className="text-sm text-[#858891] text-center leading-[22px] mt-1.5">
            เริ่มต้นด้วยการสร้างบ้าน หรือเข้าร่วมบ้าน{"\n"}เพื่อรับการแจ้งเตือน
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/get-started" as any)}
            activeOpacity={0.85}
            className={`mt-6 h-[52px] px-10 rounded-full ${V2C.dark} flex-row items-center justify-center`}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text className="text-base font-semibold text-white ml-1.5">เพิ่มบ้าน</Text>
          </TouchableOpacity>
        </View>
      )}

      {noHouse && !V2 && (
        <View className="mx-5 mt-3 rounded-2xl bg-white px-5 py-4">
          <Text className="text-sm font-semibold text-ink">ยังไม่มีบ้าน</Text>
          <Text className="text-xs text-sub mt-1 leading-[18px]">
            สร้างบ้านใหม่ หรือเข้าร่วมบ้านด้วยรหัสเชิญ เพื่อเริ่มรับการแจ้งเตือนเมื่อมีคนล้ม
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/get-started" as any)}
            activeOpacity={0.8}
            className={`mt-3 h-[40px] rounded-[20px] ${BTN.solid} items-center justify-center`}
          >
            <Text className="text-sm font-semibold text-white">เพิ่มบ้าน</Text>
          </TouchableOpacity>
        </View>
      )}

      {ackNotice && (
        <View className="mx-5 mt-3 rounded-xl bg-brand-soft px-4 py-3 flex-row items-start">
          <Ionicons name="alert-circle" size={18} color="#D14343" />
          <Text className="flex-1 text-xs text-[#D14343] ml-2 leading-[18px]">
            {ackNotice}
          </Text>
          <TouchableOpacity onPress={() => setAckNotice(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color="#D14343" />
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {noHouse && V2 ? null : visibleData.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-sm text-[#AAAAAA]">{emptyText}</Text>
        </View>
      ) : activeTab === "fall" ? (
        <FlatList
          data={visibleData as AlertType[]}
          keyExtractor={(item) => item.id}
          renderItem={renderFallItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loading ? (
              <ActivityIndicator
                size="small"
                color={C.brand}
                style={{ marginTop: 16 }}
              />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={visibleData as SystemAlert[]}
          keyExtractor={(item) => item.id}
          renderItem={renderSystemItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loading ? (
              <ActivityIndicator
                size="small"
                color={C.brand}
                style={{ marginTop: 16 }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}
