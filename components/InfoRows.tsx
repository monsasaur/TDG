import { Text, View } from "react-native";

export interface InfoRow {
  label: string;
  /** บรรทัดอธิบายใต้หัวข้อ — ไม่ใส่ก็ได้ */
  detail?: string;
}

interface Props {
  rows: InfoRow[];
  className?: string;
}

/**
 * รายการหัวข้อในป๊อปอัป — หัวข้อตัวหนา + คำอธิบายใต้หัวข้อ อยู่ในกล่องเทาอ่อน
 * ใช้แทนการเขียน "•" ต่อกันในข้อความยาว ๆ (อ่านยากและแต่ละหน้าเขียนไม่เหมือนกัน)
 * ที่ใช้อยู่: ป๊อปอัปขอสิทธิ์ และป๊อปอัปออกจากบ้าน / ลบบ้าน
 */
export default function InfoRows({ rows, className = "mt-4" }: Props) {
  return (
    <View className={`rounded-2xl bg-[#F7F7F8] px-4 py-3 ${className}`}>
      {rows.map((r, i) => (
        <View key={r.label} className={i === 0 ? "" : "mt-3"}>
          <Text className="text-sm font-semibold text-[#292A32]">{r.label}</Text>
          {r.detail ? (
            <Text className="text-xs text-[#858891] leading-[18px] mt-0.5">{r.detail}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
