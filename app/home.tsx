import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { Alert as AlertType } from "../types/alert";
import { mockAlerts } from "../data/mockAlerts";
import AlertCardActive from "../components/AlertCardActive";
import AlertCardSmall from "../components/AlertCardSmall";
import AlertCardExpanded from "../components/AlertCardExpanded";
import HouseDropdown from "../components/HouseDropdown";

const HOUSES = ["บ้านของฉัน"];

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<"fall" | "system">("fall");
  const [alerts, setAlerts] = useState<AlertType[]>(mockAlerts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedHouse, setSelectedHouse] = useState(HOUSES[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    // 1. Location (ทั้ง iOS และ Android)
    await Location.requestForegroundPermissionsAsync();

    // 2. Nearby Devices / Bluetooth
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
          }
        );
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: "สิทธิ์การเชื่อมต่ออุปกรณ์",
            message: "Middle ต้องการเชื่อมต่อกับอุปกรณ์ใกล้เคียงเพื่อตรวจจับการล้ม",
            buttonPositive: "อนุญาต",
            buttonNegative: "ไม่อนุญาต",
          }
        );
      } catch {}
    }
    // iOS: Bluetooth permission ขอผ่าน infoPlist (NSBluetoothAlwaysUsageDescription)
    // จะ popup อัตโนมัติเมื่อใช้ CoreBluetooth

    // 3. Notifications (ทั้ง iOS และ Android)
    try {
      await Notifications.requestPermissionsAsync();
    } catch {}
  };

  const handleConfirm = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "completed" as const, answeredBy: "ฉัน" } : a
      )
    );
  };

  const handleSmallCardPress = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter by house
  const filteredAlerts =
    selectedHouse === "ทั้งหมด"
      ? alerts
      : alerts.filter((a) => a.houseName === selectedHouse);

  const activeAlerts = filteredAlerts.filter((a) => a.status === "active");
  const finishedAlerts = filteredAlerts.filter((a) => a.status !== "active");

  // Simulate load more
  const handleLoadMore = useCallback(() => {
    if (loading) return;
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }, [loading]);

  const renderItem = useCallback(
    ({ item }: { item: AlertType }) => {
      if (item.status === "active") {
        return <AlertCardActive alert={item} onConfirm={handleConfirm} />;
      }
      if (expandedId === item.id) {
        return (
          <TouchableOpacity onPress={() => setExpandedId(null)} activeOpacity={0.9}>
            <AlertCardExpanded alert={item} />
          </TouchableOpacity>
        );
      }
      return <AlertCardSmall alert={item} onPress={handleSmallCardPress} />;
    },
    [expandedId]
  );

  const listData = [...activeAlerts, ...finishedAlerts];

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-3">
        <View className="flex-row items-center justify-between">
          <HouseDropdown
            houses={HOUSES}
            selected={selectedHouse}
            onSelect={setSelectedHouse}
          />
          <TouchableOpacity>
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
            แจ้งเตือนการล้ม
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
      {activeTab === "fall" ? (
        listData.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-sm text-[#AAAAAA]">ไม่มีการแจ้งเตือน</Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 32 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loading ? (
                <ActivityIndicator size="small" color="#FF3055" style={{ marginTop: 16 }} />
              ) : null
            }
          />
        )
      ) : (
        <View className="flex-1 justify-center items-center">
          <Text className="text-sm text-[#AAAAAA]">ไม่มีการแจ้งเตือนระบบ</Text>
        </View>
      )}
    </View>
  );
}
