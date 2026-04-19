import { View } from "react-native";

interface QrCodePlaceholderProps {
  expired?: boolean;
  size?: number;
}

const GRID = 12;

export default function QrCodePlaceholder({
  expired,
  size = 220,
}: QrCodePlaceholderProps) {
  const bg = expired ? "#E5E5E5" : "#FFFFFF";
  const cell = expired ? "#C8C8C8" : "#1A1A1A";

  return (
    <View
      style={{ width: size, height: size, backgroundColor: bg }}
      className="p-3 rounded-md"
    >
      <View className="flex-1 flex-row flex-wrap">
        {Array.from({ length: GRID * GRID }).map((_, i) => {
          const filled = pattern(i);
          return (
            <View
              key={i}
              style={{
                width: `${100 / GRID}%`,
                height: `${100 / GRID}%`,
                backgroundColor: filled ? cell : "transparent",
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// Deterministic pseudo-QR pattern: finder squares in 3 corners + scattered cells.
function pattern(i: number): boolean {
  const row = Math.floor(i / GRID);
  const col = i % GRID;

  const inFinder = (r0: number, c0: number) => {
    const dr = row - r0;
    const dc = col - c0;
    if (dr < 0 || dr > 6 || dc < 0 || dc > 6) return false;
    const outer = dr === 0 || dr === 6 || dc === 0 || dc === 6;
    const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
    return outer || inner;
  };

  if (inFinder(0, 0) || inFinder(0, GRID - 7) || inFinder(GRID - 7, 0)) {
    return true;
  }

  return ((row * 7 + col * 13 + row * col) % 5) < 2;
}
