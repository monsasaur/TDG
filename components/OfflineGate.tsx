import { ReactNode, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlerts } from "../contexts/AlertsContext";
import { useDevices } from "../contexts/DevicesContext";
import { useNetwork } from "../contexts/NetworkContext";
import { notifyHousesChanged } from "../data/useHouses";
import ConfirmModal from "./ConfirmModal";

export const OFFLINE_TITLE = "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้";
export const OFFLINE_MESSAGE = "กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ แล้วลองใหม่อีกครั้ง";

/** กดตกลงแล้วยังไม่มีเน็ต — เด้งขึ้นมาใหม่ในกี่มิลลิวินาที */
const REOPEN_MS = 1200;

/** ไอคอน Wi-Fi ขาดพร้อมป้ายเครื่องหมายตกใจ (ตามแบบที่ออกแบบไว้) */
export function OfflineIcon() {
  return (
    <View className="w-[88px] h-[88px] items-center justify-center">
      <View className="w-[76px] h-[76px] rounded-full bg-[#FDECEC] items-center justify-center">
        <Ionicons name="wifi" size={38} color="#F87171" />
      </View>
      <View className="absolute right-0 bottom-1 w-9 h-9 rounded-full bg-[#DC2626] items-center justify-center border-2 border-white">
        <Text className="text-lg font-bold text-white">!</Text>
      </View>
    </View>
  );
}

/**
 * เน็ตหลุด → แตะตรงไหนของแอปก็เด้งป๊อปอัปเตือน และกดตกลงแล้วเด้งซ้ำจนกว่าเน็ตจะกลับมา
 * (สเปคข้อ 1.1: ไม่ว่าอยู่หน้าไหน ต้องขึ้น กดตกลงไปเรื่อย ๆ จนกว่าจะเชื่อมได้)
 *
 * ครอบทั้งแอปใน app/_layout.tsx — ตอนออฟไลน์จะ "ดัก" การแตะไว้ก่อน (ไม่ส่งต่อให้ปุ่มข้างใน)
 * เน็ตกลับมาเมื่อไร ป๊อปอัปปิดเองทันที
 */
export default function OfflineGate({ children }: { children: ReactNode }) {
  const { online, recheck } = useNetwork();
  const { refresh: refreshAlerts } = useAlerts();
  const { refresh: refreshDevices } = useDevices();
  const [visible, setVisible] = useState(false);
  const reopen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);

  const clearReopen = () => {
    if (reopen.current) {
      clearTimeout(reopen.current);
      reopen.current = null;
    }
  };

  // ออฟไลน์เมื่อไรก็แสดงทันทีโดยไม่ต้องรอให้แตะ · กลับมาออนไลน์แล้วปิดเอง
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setVisible(true);
      return clearReopen;
    }
    clearReopen();
    setVisible(false);
    // เน็ตกลับมา → ดึงข้อมูลใหม่ทันที ไม่ให้ค้างเป็นจอว่าง "ยังไม่มีบ้าน" จากตอนที่โหลดไม่ได้
    if (wasOffline.current) {
      wasOffline.current = false;
      notifyHousesChanged();
      void refreshAlerts();
      void refreshDevices();
    }
    return clearReopen;
  }, [online, refreshAlerts, refreshDevices]);

  const handleClose = () => {
    setVisible(false);
    recheck();
    // ยังไม่มีเน็ต = เด้งใหม่ (ถ้าเน็ตกลับมา effect ด้านบนจะล้าง timer ให้)
    clearReopen();
    reopen.current = setTimeout(() => setVisible(true), REOPEN_MS);
  };

  return (
    <View
      className="flex-1"
      // ดักเฉพาะตอนออฟไลน์และป๊อปอัปยังไม่ขึ้น — ไม่งั้นจะกดปุ่มในป๊อปอัปไม่ได้
      onStartShouldSetResponderCapture={() => {
        if (online || visible) return false;
        clearReopen();
        setVisible(true);
        recheck();
        return true;
      }}
    >
      {children}
      <ConfirmModal
        visible={visible && !online}
        onClose={handleClose}
        iconNode={<OfflineIcon />}
        title={OFFLINE_TITLE}
        message={OFFLINE_MESSAGE}
        closeLabel="ตกลง"
        tone="danger"
      />
    </View>
  );
}
