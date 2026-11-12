import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import PrimaryButton from "../components/PrimaryButton";
import QrScannerFrame from "../components/QrScannerFrame";
import ConfirmModal from "../components/ConfirmModal";
import { disconnect, isMock, parsePairingQr } from "../lib/provisioning";

/**
 * กรอกรหัสจับคู่อุปกรณ์ (Proof of Possession) — ระหว่าง scan-devices กับ connect-device
 *
 * firmware ใช้ Security 1 ซึ่งบังคับต้องมีรหัสนี้ ไม่งั้นอุปกรณ์ปฏิเสธทุกครั้ง
 * หน้านี้แค่รับรหัส (สแกน QR บนกล่อง หรือพิมพ์เอง) แล้วส่งต่อเป็น `pop`
 * ไม่ตรวจรหัสเอง — อุปกรณ์เป็นคนตัดสิน ถ้าผิด connect-device จะพากลับมาที่นี่
 *
 * ใบงาน: docs/reports/frontend_req_device_pairing_code.md
 * อย่าเอา enter-code.tsx / scan-qr.tsx มาใช้แทน — เป็นรหัสเชิญเข้าบ้าน คนละเรื่อง
 */
export default function DevicePairingCodeScreen() {
  const router = useRouter();
  const { device, deviceId, houseId } = useLocalSearchParams<{
    device?: string;
    deviceId?: string;
    houseId?: string;
  }>();

  const [code, setCode] = useState("");
  const [fromQr, setFromQr] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // ตัดเฉพาะช่องว่างหัวท้าย (คัดลอกมามักติดมา) — ห้ามแปลงตัวพิมพ์ รหัสแยกตัวเล็กตัวใหญ่
  const pop = code.trim();
  const canSubmit = pop.length > 0 && !!device;

  // ตัดการเชื่อมต่อ BLE ก่อนถอยออก — ถ้าเคยเชื่อมต่อจากรอบก่อน (กลับมาแก้รหัส) จะได้ไม่ค้าง
  const handleBack = () => {
    disconnect();
    router.back();
  };

  const openScanner = async () => {
    let granted = permission?.granted ?? false;
    if (!granted) {
      if (permission && !permission.canAskAgain) {
        setSettingsModal(true);
        return;
      }
      const res = await requestPermission();
      granted = res.granted;
      if (!granted) {
        if (!res.canAskAgain) setSettingsModal(true);
        return;
      }
    }
    scannedRef.current = false;
    setScanning(true);
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanning(false);

    const parsed = parsePairingQr(data);
    if (!parsed) {
      setNotice({
        title: "ไม่พบรหัสจับคู่ใน QR",
        message: "ลองสแกน QR บนกล่องอีกครั้ง หรือพิมพ์รหัสในช่องแทน",
      });
      return;
    }
    // QR แบบ Espressif บอกชื่ออุปกรณ์มาด้วย — กันสแกนกล่องผิดเครื่อง
    if (parsed.name && device && parsed.name !== device) {
      setNotice({
        title: "QR ไม่ตรงกับอุปกรณ์",
        message: `QR นี้เป็นของ ${parsed.name} แต่อุปกรณ์ที่เลือกคือ ${device} ตรวจดูว่าสแกนกล่องของเครื่องที่ถูกต้อง`,
      });
      return;
    }
    // ใส่ในช่องให้ผู้ใช้เห็นก่อน — ไม่ไปหน้าถัดไปเอง
    setCode(parsed.pop);
    setFromQr(true);
  };

  const handleCameraError = () => {
    setScanning(false);
    setNotice({
      title: "เปิดกล้องไม่ได้",
      message: "พิมพ์รหัสจับคู่ในช่องแทนได้ รหัสอยู่บนกล่องหรือใต้ตัวเครื่อง",
    });
  };

  const openSettings = () => {
    setSettingsModal(false);
    if (Platform.OS === "ios") Linking.openURL("app-settings:");
    else if (Platform.OS !== "web") Linking.openSettings();
  };

  const handleConfirm = () => {
    if (!canSubmit) return;
    router.push(
      `/connect-device?device=${encodeURIComponent(device!)}&pop=${encodeURIComponent(pop)}${
        deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""
      }${houseId ? `&houseId=${encodeURIComponent(houseId)}` : ""}` as never,
    );
  };

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="รหัสจับคู่อุปกรณ์" onBack={handleBack} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-5 mt-5">
            <View className="bg-white rounded-xl px-4 py-3 flex-row items-center">
              <Ionicons name="hardware-chip-outline" size={18} color="#FF3055" />
              <Text className="text-sm text-[#1A1A1A] ml-2">
                อุปกรณ์ : <Text className="text-[#888]">{device ?? "-"}</Text>
              </Text>
            </View>
          </View>

          <Text className="text-xs text-[#888] leading-5 px-5 mt-4">
            กรอกรหัสจับคู่เพื่อยืนยันว่าเป็นอุปกรณ์ของคุณ รหัสอยู่บนกล่องหรือใต้ตัวเครื่อง
          </Text>

          <View className="px-5 mt-4">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openScanner}
              className="bg-white rounded-xl px-4 py-4 flex-row items-center border border-[#E8E8E8]"
            >
              <Ionicons name="qr-code-outline" size={22} color="#FF3055" />
              <View className="flex-1 ml-3">
                <Text className="text-sm font-semibold text-[#1A1A1A]">
                  สแกน QR บนกล่อง
                </Text>
                <Text className="text-xs text-[#888] mt-0.5">
                  รหัสจะขึ้นในช่องด้านล่าง ตรวจดูก่อนกดยืนยัน
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#BBBBBB" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center px-5 mt-5">
            <View className="flex-1 h-[1px] bg-[#E0E0E0]" />
            <Text className="text-xs text-[#AAAAAA] mx-3">หรือพิมพ์เอง</Text>
            <View className="flex-1 h-[1px] bg-[#E0E0E0]" />
          </View>

          <LabeledTextField
            label="รหัสจับคู่"
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setFromQr(false);
            }}
            placeholder="พิมพ์ตามที่เห็นบนกล่อง"
            // รหัสแยกตัวพิมพ์เล็กใหญ่ — ห้าม autoCapitalize="characters" แบบ enter-code.tsx
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            containerClassName="px-5 mt-4"
          />
          <Text className="text-xs text-[#888] px-5 mt-2 leading-5">
            {fromQr
              ? "อ่านจาก QR แล้ว ตรวจให้ตรงกับบนกล่องก่อนกดยืนยัน"
              : "ตัวพิมพ์เล็ก–ใหญ่ต้องตรงกับบนกล่อง"}
          </Text>

          {!device && (
            <Text className="text-sm text-[#D14343] px-5 mt-3">
              ไม่พบอุปกรณ์ที่เลือก กรุณากลับไปค้นหาอุปกรณ์ใหม่
            </Text>
          )}

          {isMock && (
            <Text className="text-[10px] text-[#BBBBBB] text-center px-8 mt-6">
              โหมดจำลอง — ยังไม่ได้ใช้บลูทูธจริง · รหัสใดก็ผ่าน ยกเว้นพิมพ์ wrong
              เพื่อลองกรณีรหัสผิด
            </Text>
          )}
        </ScrollView>

        <View className="px-5 pb-8">
          <PrimaryButton
            label="ยืนยัน"
            onPress={handleConfirm}
            disabled={!canSubmit}
          />
        </View>
      </KeyboardAvoidingView>

      {scanning && (
        <View
          className="bg-black"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <CameraView
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcode}
            onMountError={handleCameraError}
          />
          <View className="bg-white/95">
            <PageHeader title="สแกน QR บนกล่อง" onBack={() => setScanning(false)} />
          </View>
          <View className="flex-1 items-center justify-center">
            <QrScannerFrame />
            <Text className="text-xs text-white text-center px-10 mt-6">
              วาง QR บนกล่องหรือใต้ตัวเครื่องให้อยู่ในกรอบ
            </Text>
          </View>
        </View>
      )}

      <ConfirmModal
        visible={notice !== null}
        onClose={() => setNotice(null)}
        title={notice?.title}
        message={notice?.message}
      />

      <ConfirmModal
        visible={settingsModal}
        onClose={() => setSettingsModal(false)}
        onConfirm={openSettings}
        title="ต้องการสิทธิ์เพิ่มเติม"
        titleAlign="left"
        messageAlign="left"
        cancelLabel="พิมพ์รหัสเอง"
        confirmLabel="ไปที่การตั้งค่า"
        message={
          "การสแกน QR ต้องใช้สิทธิ์เข้าถึงกล้อง เปิดได้ในการตั้งค่า\n\nหรือพิมพ์รหัสจับคู่ในช่องแทนก็ได้"
        }
      />
    </View>
  );
}
