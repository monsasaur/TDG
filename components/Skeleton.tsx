import { useEffect, useRef } from "react";
import { Animated, Easing, View, ViewStyle } from "react-native";

/**
 * โครงร่างระหว่างรอข้อมูล (skeleton loading)
 *
 * ใช้แทนวงกลมหมุน ๆ ตรงที่รู้อยู่แล้วว่ากำลังจะมีการ์ดอะไรโผล่มา — ผู้ใช้เห็นว่า
 * หน้าจอจะหน้าตาแบบไหนตั้งแต่ยังโหลดไม่เสร็จ และไม่รู้สึกว่าแอปค้าง
 *
 * สีเทาอ่อนตามโทนแอป (#E9EAEC บนพื้นขาว) กะพริบช้า ๆ ด้วย opacity
 */

function usePulse() {
  const value = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

/** แท่งสีเทาหนึ่งอัน — กำหนดขนาดด้วย className เช่น "w-32 h-4" */
export function SkeletonBar({ className = "h-4 w-24", style }: { className?: string; style?: ViewStyle }) {
  const opacity = usePulse();
  return <Animated.View style={[{ opacity }, style]} className={`bg-[#E9EAEC] rounded-md ${className}`} />;
}

/** การ์ดแจ้งเตือน / อุปกรณ์ แบบโครงร่าง */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View className="bg-white rounded-2xl px-4 py-4 mb-2 flex-row items-center">
      <SkeletonBar className="w-10 h-10 rounded-full" />
      <View className="flex-1 ml-3">
        <SkeletonBar className="h-4 w-1/2" />
        {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
          <SkeletonBar key={i} className={`h-3 ${i % 2 ? "w-2/5" : "w-3/4"} mt-2`} />
        ))}
      </View>
    </View>
  );
}

/** หลายการ์ดต่อกัน — ใช้ตอนรอรายการทั้งหน้า */
export function SkeletonList({
  count = 3,
  lines = 2,
  className = "px-5 pt-4",
}: {
  count?: number;
  lines?: number;
  className?: string;
}) {
  return (
    <View className={className} accessibilityLabel="กำลังโหลด">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </View>
  );
}
