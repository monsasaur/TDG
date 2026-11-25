import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { Alert } from "../types/alert";
import { remainingSeconds } from "./AlertCardActive";
import { STATUS_LOOK } from "./alertStatusStyle";

const URGENT = STATUS_LOOK.active;
/** วินาทีสุดท้ายที่วงนับถอยหลังเปลี่ยนเป็นสีแดง */
const LAST_SECONDS = 15;

/**
 * การ์ดแจ้งเตือนที่ยังรอรับทราบ — ดีไซน์ใหม่ (HOME_DESIGN = "v2" ใน app/home.tsx)
 * วงนับถอยหลังใหญ่ + ปุ่มยืนยันสีเข้ม · ตรรกะการนับเหมือน AlertCardActive ทุกอย่าง
 * (คิดจาก created_at ของเหตุการณ์จริง · จำเส้นตายแล้วคำนวณใหม่ทุกวินาที)
 */
interface Props {
  alert: Alert;
  onConfirm: (id: string) => void;
  onTimeout?: (id: string) => void;
}

const RING = 132;
const STROKE = 10;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

function mmss(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function AlertCardActiveV2({ alert, onConfirm, onTimeout }: Props) {
  const total = alert.countdown ?? 60;
  const [deadline] = useState(() => Date.now() + remainingSeconds(alert) * 1000);
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [seconds, deadline]);

  useEffect(() => {
    if (seconds === 0 && !confirmed) onTimeout?.(alert.id);
  }, [seconds, confirmed, alert.id, onTimeout]);

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm(alert.id);
  };

  const progress = total > 0 ? seconds / total : 0;
  const urgent = seconds <= LAST_SECONDS;

  return (
    <View className="bg-white rounded-3xl mx-5 mt-4 p-5 border-[1.5px] border-[#F3B4B4]" style={{ shadowColor: "#DC2626", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
      {/* หัวการ์ด — ชื่อบ้านได้พื้นที่เต็ม ป้ายสถานะย้ายไปอยู่ข้างหัวข้อเหตุการณ์ */}
      <View className="flex-row items-center">
        <View style={{ backgroundColor: URGENT.bg }} className="w-8 h-8 rounded-full items-center justify-center">
          <Ionicons name="notifications" size={16} color={URGENT.fg} />
        </View>
        <Text className="flex-1 text-base font-semibold text-[#292A32] ml-2" numberOfLines={1}>
          แจ้งเตือนจาก{alert.houseName}
        </Text>
        <Text className="text-xs text-[#858891] ml-2">{alert.time}</Text>
      </View>

      <View className="flex-row items-center mt-4">
        {/* วงนับถอยหลัง — สีแดงตลอด (เหตุที่ยังรอรับทราบ) */}
        <View style={{ width: RING, height: RING }} className="items-center justify-center">
          <Svg width={RING} height={RING} style={{ position: "absolute" }}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke="#F6D5D5" strokeWidth={STROKE} fill="none" />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={URGENT.fg}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C} ${C}`}
              strokeDashoffset={C * (1 - progress)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <Text style={{ color: urgent ? URGENT.fg : "#292A32" }} className="text-[28px] font-bold">
            {mmss(seconds)}
          </Text>
          <Text className="text-xs text-[#858891]">นาที</Text>
        </View>

        {/* ข้อความ */}
        <View className="flex-1 ml-4">
          <View style={{ backgroundColor: URGENT.bg }} className="self-start rounded-full px-2.5 py-1 mb-1.5">
            <Text style={{ color: URGENT.fg }} className="text-[11px] font-semibold">
              {URGENT.label}
            </Text>
          </View>
          <Text className="text-base font-bold text-[#292A32] leading-6">{alert.title}</Text>
          <Text className="text-xs text-[#858891] mt-1 leading-[18px]">{alert.location}</Text>
          <Text className="text-xs text-[#858891] leading-[18px]">กรุณากดยืนยันภายใน {seconds} วินาที</Text>
        </View>
      </View>

      {/* ปุ่มเต็มความกว้างการ์ด — ข้อความไม่เบียดบนจอแคบ */}
      <TouchableOpacity
        onPress={handleConfirm}
        disabled={confirmed}
        activeOpacity={0.85}
        accessibilityRole="button"
        className={`mt-4 h-[52px] rounded-2xl items-center justify-center ${confirmed ? "bg-[#F0A8A8]" : "bg-[#DC2626]"}`}
      >
        <Text className="text-base font-semibold text-white">{confirmed ? "กำลังส่ง..." : "ยืนยันการตรวจสอบ"}</Text>
      </TouchableOpacity>
    </View>
  );
}
