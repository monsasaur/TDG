import { useEffect, useRef } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { RingOuter, RingMiddle, RingInner } from "./SplashRing";

interface SpinningLogoProps {
  size?: number;
  delay?: number;
  paused?: boolean;
}

export default function SpinningLogo({ size = 180, delay = 0, paused = false }: SpinningLogoProps) {
  const rotateOuter = useSharedValue(0);
  const rotateMiddle = useSharedValue(0);
  const rotateInner = useSharedValue(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (paused) {
      cancelAnimation(rotateOuter);
      cancelAnimation(rotateMiddle);
      cancelAnimation(rotateInner);
      return;
    }

    const startSpin = () => {
      rotateOuter.value = withRepeat(
        withTiming(rotateOuter.value + 360, { duration: 8000, easing: Easing.linear }),
        -1,
        false,
      );
      rotateMiddle.value = withRepeat(
        withTiming(rotateMiddle.value - 360, { duration: 6000, easing: Easing.linear }),
        -1,
        false,
      );
      rotateInner.value = withRepeat(
        withTiming(rotateInner.value + 360, { duration: 4000, easing: Easing.linear }),
        -1,
        false,
      );
    };

    if (!hasStarted.current && delay > 0) {
      rotateOuter.value = withDelay(delay, withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1, false));
      rotateMiddle.value = withDelay(delay, withRepeat(withTiming(-360, { duration: 6000, easing: Easing.linear }), -1, false));
      rotateInner.value = withDelay(delay, withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false));
    } else {
      startSpin();
    }
    hasStarted.current = true;
  }, [paused]);

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
