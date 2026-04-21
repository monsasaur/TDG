import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Platform } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import PageHeader from "../components/PageHeader";
import QrScannerFrame from "../components/QrScannerFrame";
import ConfirmModal from "../components/ConfirmModal";

export default function ScanQrScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [errorModal, setErrorModal] = useState(false);
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

  const handleBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    // Mock validation: any scanned QR is treated as invalid for now
    void data;
    setErrorModal(true);
  };

  const handleCloseError = () => {
    setErrorModal(false);
    scannedRef.current = false;
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
    if (!result.canceled) {
      // Mock: picked images fail QR decode in this flow
      setErrorModal(true);
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
          onBarcodeScanned={errorModal ? undefined : handleBarcode}
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

      <ConfirmModal
        visible={errorModal}
        onClose={handleCloseError}
        title="เข้าร่วมบ้านไม่ได้"
        message="QR Code ไม่ถูกต้อง ลองใช้คิวอาร์โค้ดอื่นหรือเพิ่มด้วยวิธีอื่น"
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
