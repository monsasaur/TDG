import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CountdownTimerProps {
  seconds: number;
  resetKey: number;
  onRefresh: () => void;
  onExpire?: () => void;
}

export default function CountdownTimer({
  seconds,
  resetKey,
  onRefresh,
  onExpire,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [seconds, resetKey, onExpire]);

  if (remaining === 0) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onRefresh}
        hitSlop={12}
        className="items-center"
      >
        <Ionicons name="refresh" size={22} color="#1A1A1A" />
      </TouchableOpacity>
    );
  }

  return (
    <View className="items-center">
      <Text className="text-sm text-[#1A1A1A]">( {remaining}s )</Text>
    </View>
  );
}
