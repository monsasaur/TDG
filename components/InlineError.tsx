import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/** กล่องข้อความผิดพลาดกลางหน้า พร้อมปุ่มลองใหม่ (ไม่ใส่ onRetry = ไม่มีปุ่ม) */
export default function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="bg-white rounded-2xl px-5 py-6 items-center">
      <Ionicons name="alert-circle-outline" size={28} color="#FF3055" />
      <Text className="text-sm text-[#1A1A1A] text-center leading-5 mt-2">{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} hitSlop={10} className="mt-4">
          <Text className="text-sm font-semibold text-[#FF3055]">ลองใหม่</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
