import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Platform, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import PageHeader from "../components/PageHeader";
import QrScannerFrame from "../components/QrScannerFrame";
import ConfirmModal from "../components/ConfirmModal";
import { useAlerts } from "../contexts/AlertsContext";
import { useDevices } from "../contexts/DevicesContext";
import { joinHouse, parseInviteQr } from "../data/houseInvites";

const NOT_INVITE = "QR Code นี้ไม่ใช่คำเชิญเข้าบ้าน ลองใช้คิวอาร์โค้ดอื่นหรือเพิ่มด้วยวิธีอื่น";

export default function ScanQrScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const { refresh: refreshAlerts } = useAlerts();
  const { refresh: refreshDevices } = useDevices();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** ชื่อบ้านที่เพิ่งเข้าร่วม · "" = อ่านชื่อไม่ได้ · null = ยังไม่ได้เข้าร่วม */
  const [joined, setJoined] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    } else if (!permission.granted && !permission.canAskAgain) {
      setSettingsModal(true);
    }
  }, [permission, requestPermission]);

  /** QR จากหน้า invite-qr ของเจ้าของบ้าน → เข้าร่วมบ้าน */
  const tryJoin = async (raw: string) => {
    const code = parseInviteQr(raw);
    if (!code) {
      setErrorMessage(NOT_INVITE);
      return;
    }
    setBusy(true);
    const res = await joinHouse(code);
    setBusy(false);
    if (!res.ok) {
      setErrorMessage(res.message);
      return;
    }
    void refreshDevices();
    void refreshAlerts();
    setJoined(res.houseName ?? "");
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    void tryJoin(data);
  };

  const handleCloseError = () => {
    setErrorMessage(null);
    scannedRef.current = false;
  };

  const closeJoined = () => {
    setJoined(null);
    router.back();
  };

  const handlePickImage = async () => {
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!media.granted) {
      if (!media.canAskAgain) setSettingsModal(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled) return;
    scannedRef.current = true; // กันกล้องสแกนซ้อนระหว่างอ่านรูป
    try {
      const uri = result.assets[0]?.uri;
      const found = uri ? await scanFromURLAsync(uri, ["qr"]) : [];
      if (found.length === 0) {
        setErrorMessage("ไม่พบ QR Code ในรูปนี้ ลองใช้รูปอื่นหรือเพิ่มด้วยวิธีอื่น");
        return;
      }
      await tryJoin(found[0].data);
    } catch (err) {
      console.error("scan QR from image failed:", err);
      setErrorMessage("อ่าน QR Code จากรูปนี้ไม่ได้ ลองสแกนด้วยกล้องหรือกรอกรหัสแทน");
    }
  };

  const openSettings = () => {
    setSettingsModal(false);
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  const cameraReady = permission?.granted ?? false;

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      {cameraReady && (
        <CameraView
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={errorMessage !== null || joined !== null || busy ? undefined : handleBarcode}
        />
      )}

      <View className="bg-white/95">
        <PageHeader title="สแกน QR code" onBack={() => router.back()} />
      </View>

      <View className="flex-1 items-center justify-center">
        <QrScannerFrame />
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePickImage}
        className="absolute right-6 bottom-24 items-center"
        hitSlop={12}
      >
        <View className="w-12 h-12 rounded-full bg-white/90 items-center justify-center">
          <Ionicons name="image-outline" size={22} color="#1A1A1A" />
        </View>
        <Text className="text-xs text-white mt-1">เลือกรูปภาพ</Text>
      </TouchableOpacity>

      {busy && (
        <View className="absolute inset-0 items-center justify-center bg-black/40">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text className="text-sm text-white mt-3">กำลังเข้าร่วมบ้าน...</Text>
        </View>
      )}

      <ConfirmModal
        visible={errorMessage !== null}
        onClose={handleCloseError}
        title="เข้าร่วมบ้านไม่ได้"
        message={errorMessage ?? ""}
      />

      <ConfirmModal
        visible={joined !== null}
        onClose={closeJoined}
        title="เข้าร่วมบ้านแล้ว"
        message={
          joined
            ? `ตอนนี้คุณเห็นการแจ้งเตือนและอุปกรณ์ของบ้าน ${joined} แล้ว`
            : "ตอนนี้คุณเห็นการแจ้งเตือนและอุปกรณ์ของบ้านนี้แล้ว"
        }
      />

      <ConfirmModal
        visible={settingsModal}
        onClose={() => setSettingsModal(false)}
        onConfirm={openSettings}
        title="ต้องการสิทธิ์เพิ่มเติม"
        titleAlign="left"
        messageAlign="left"
        cancelLabel="ยกเลิก"
        confirmLabel="ไปที่การตั้งค่า"
        message={
          "หากต้องการใช้คุณสมบัตินี้ คุณต้องให้การอนุญาตต่อไปนี้ในการตั้งค่า\n\n• สิทธิ์เข้าถึงกล้อง\n  ใช้เพื่อสแกน QR Code\n\nหากต้องการใช้คุณสมบัตินี้ต่อ ให้เปิดการตั้งค่า จากนั้นเลือกให้สิทธิ์ในการใช้งาน"
        }
      />
    </View>
  );
}
