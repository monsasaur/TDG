import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { requestNotificationPermissions } from "../lib/notifications";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AlertCardActive from "../components/AlertCardActive";
import AlertCardExpanded from "../components/AlertCardExpanded";
import AlertCardSmall from "../components/AlertCardSmall";
import HouseDropdown from "../components/HouseDropdown";
import SystemAlertCard from "../components/SystemAlertCard";
import { useAlerts } from "../contexts/AlertsContext";
import { acknowledgeEvent } from "../lib/api";
import { Alert as AlertType, SystemAlert } from "../types/alert";

// Import Hook สำหรับดึงบ้านจริง
import { useHouses } from "../data/useHouses";

const PAGE_SIZE = 5;

export default function HomeScreen() {
  const router = useRouter();
  const { alerts, systemAlerts, setAlerts } = useAlerts();
  const { houses: dbHouses } = useHouses();

  // แปลงบ้านจาก Database ให้กลายเป็น Array
  const HOUSES = useMemo(() => dbHouses.map((h) => h.name), [dbHouses]);

  const [activeTab, setActiveTab] = useState<"fall" | "system">("fall");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ให้ค่าเริ่มต้นเป็น "ทั้งหมด" ไว้ก่อน
  const [selectedHouse, setSelectedHouse] = useState("ทั้งหมด");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // อัปเดต SelectedHouse เมื่อดึงข้อมูลบ้านเสร็จ
  useEffect(() => {
    if (HOUSES.length > 0) {
      setSelectedHouse(HOUSES.length > 1 ? "ทั้งหมด" : HOUSES[0]);
    }
  }, [dbHouses]);

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

  const handleConfirm = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const newTimeline = [
          a.timeline[0],
          {
            label: "ยืนยันการตรวจสอบ",
            detail: "โดย : ฉัน",
            status: "success" as const,
          },
          ...a.timeline.slice(1),
        ];
        return {
          ...a,
          status: "completed" as const,
          answeredBy: "ฉัน",
          timeline: newTimeline,
        };
      }),
    );
    setExpandedId(id);

    // ถ้า id มาจาก backend (ไม่ใช่ mock ที่เป็น "1","2","3"...) ยิง ack ไปด้วย
    if (id.length > 5) {
      acknowledgeEvent(id, "caregiver").catch(() => {
        // backend offline — ไม่เป็นไร UI อัปเดตแล้ว
      });
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

  // Apply pagination to whichever tab is active
  const fullList = activeTab === "fall" ? fullFallList : filteredSystemAlerts;
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

  const renderFallItem = useCallback(
    ({ item }: { item: AlertType }) => {
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
    [expandedId],
  );

  const renderSystemItem = useCallback(
    ({ item }: { item: SystemAlert }) => <SystemAlertCard alert={item} />,
    [],
  );

  const emptyText =
    activeTab === "fall" ? "ไม่มีการแจ้งเตือน" : "ไม่มีการแจ้งเตือนระบบ";

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-3">
        <View className="flex-row items-center justify-between">
          <HouseDropdown
            houses={HOUSES}
            selected={selectedHouse}
            onSelect={setSelectedHouse}
          />
          <TouchableOpacity onPress={() => router.push("/settings" as any)}>
            <Ionicons name="settings-outline" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-5 bg-white border-b border-[#E8E8E8]">
        <TouchableOpacity
          className={`pb-3 mr-6 ${activeTab === "fall" ? "border-b-2 border-[#FF3055]" : ""}`}
          onPress={() => setActiveTab("fall")}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === "fall" ? "text-[#FF3055]" : "text-[#AAAAAA]"
            }`}
          >
            ข้อความแจ้งเตือน
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`pb-3 ${activeTab === "system" ? "border-b-2 border-[#FF3055]" : ""}`}
          onPress={() => setActiveTab("system")}
        >
          <Text
            className={`text-sm font-medium ${
              activeTab === "system" ? "text-[#FF3055]" : "text-[#AAAAAA]"
            }`}
          >
            แจ้งเตือนระบบ
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {visibleData.length === 0 ? (
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
                color="#FF3055"
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
                color="#FF3055"
                style={{ marginTop: 16 }}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}
