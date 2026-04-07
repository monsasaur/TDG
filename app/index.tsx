import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import SpinningLogo from "../components/SpinningLogo";

const RING_SIZE = 280;

export default function SplashScreen() {
  const router = useRouter();

  const bgOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    bgOpacity.value = withDelay(
      600,
      withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
    );

    ringOpacity.value = withDelay(1100, withTiming(1, { duration: 400 }));
    ringScale.value = withDelay(
      1100,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.2)) })
    );

    const timeout = setTimeout(() => {
      router.replace("/welcome" as any);
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(249, 236, 237, ${bgOpacity.value})`,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View className="flex-1 bg-white">
      <Animated.View style={[StyleSheet.absoluteFillObject, bgStyle]} />
      <View className="flex-1 justify-center items-center">
        <Animated.View style={containerStyle}>
          <SpinningLogo size={RING_SIZE} delay={1400} />
        </Animated.View>
      </View>
    </View>
  );
}
