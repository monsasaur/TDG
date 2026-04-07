import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { RingOuter, RingMiddle, RingInner } from "./SplashRing";

interface SpinningLogoProps {
  size?: number;
  delay?: number;
}

export default function SpinningLogo({ size = 180, delay = 0 }: SpinningLogoProps) {
  const rotateOuter = useSharedValue(0);
  const rotateMiddle = useSharedValue(0);
  const rotateInner = useSharedValue(0);

  useEffect(() => {
    if (delay > 0) {
      rotateOuter.value = withDelay(delay, withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1, false));
      rotateMiddle.value = withDelay(delay, withRepeat(withTiming(-360, { duration: 6000, easing: Easing.linear }), -1, false));
      rotateInner.value = withDelay(delay, withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false));
    } else {
      rotateOuter.value = withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1, false);
      rotateMiddle.value = withRepeat(withTiming(-360, { duration: 6000, easing: Easing.linear }), -1, false);
      rotateInner.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false);
    }
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateOuter.value}deg` }],
  }));
  const middleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateMiddle.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateInner.value}deg` }],
  }));

  const ringStyle = { position: "absolute" as const, width: size, height: size };

  return (
    <Animated.View style={{ width: size, height: size }}>
      <Animated.View style={[ringStyle, outerStyle]}>
        <RingOuter size={size} />
      </Animated.View>
      <Animated.View style={[ringStyle, middleStyle]}>
        <RingMiddle size={size} />
      </Animated.View>
      <Animated.View style={[ringStyle, innerStyle]}>
        <RingInner size={size} />
      </Animated.View>
    </Animated.View>
  );
}
