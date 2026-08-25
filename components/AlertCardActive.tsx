import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "../types/alert";

interface AlertCardActiveProps {
  alert: Alert;
  onConfirm: (id: string) => void;
  onTimeout?: (id: string) => void;
}

export default function AlertCardActive({ alert, onConfirm, onTimeout }: AlertCardActiveProps) {
  const [seconds, setSeconds] = useState(alert.countdown ?? 60);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  useEffect(() => {
    if (seconds === 0 && !confirmed) {
      onTimeout?.(alert.id);
    }
  }, [seconds, confirmed, alert.id, onTimeout]);

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm(alert.id);
  };

  return (
    <View className="bg-white rounded-xl border border-[#E8E8E8] mx-5 mt-4 overflow-hidden">
      <View className="flex-row">
        <View className="w-1 bg-[#FF3055] rounded-l-xl" />
        <View className="flex-1 p-4">
          {/* Countdown */}
          <Text className="text-xs text-[#888] text-right mb-1">{seconds} วินาที</Text>

          {/* Title */}
          <Text className="text-base font-bold text-[#FF3055] mb-1">
            {alert.title} - {alert.houseName}
          </Text>

          {/* Description */}
          <Text className="text-xs text-[#555] leading-[18px] mb-3">{alert.description}</Text>

          {/* Location */}
          <View className="flex-row items-center mb-3">
            <Ionicons name="location-sharp" size={14} color="#FF3055" />
            <Text className="text-xs text-[#1A1A1A] ml-1">
              {alert.location} - {alert.time}
            </Text>
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            className={`rounded-full py-2.5 px-6 self-start ${
              confirmed ? "bg-[#F58A95]" : "bg-[#FF3055]"
            }`}
            onPress={handleConfirm}
            disabled={confirmed}
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-semibold">ยืนยันการตรวจสอบ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
