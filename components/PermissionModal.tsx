import { Text } from "react-native";
import ConfirmModal from "./ConfirmModal";
import InfoRows from "./InfoRows";

export interface PermissionItem {
  /** ชื่อสิทธิ์อย่างที่ผู้ใช้เห็นในหน้าตั้งค่าของเครื่อง */
  label: string;
  /** ขอไปทำอะไร — บอกเหตุผลเสมอ ไม่ใช่แค่ชื่อสิทธิ์ */
  reason: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  title?: string;
  /** ประโยคนำก่อนรายการสิทธิ์ */
  intro?: string;
  items: PermissionItem[];
  cancelLabel?: string;
  confirmLabel?: string;
  /** บรรทัดปิดท้าย — ไม่ใส่ก็ได้ */
  footer?: string;
}

/**
 * ป๊อปอัปขอสิทธิ์ของเครื่อง (กล้อง · ตำแหน่ง · บลูทูธ · การแจ้งเตือน)
 *
 * เดิมแต่ละหน้าเขียนเนื้อหาเองเป็นข้อความยาว ๆ ขึ้นต้นด้วย "•" หน้าตาไม่เหมือนกันสักที่
 * รวมมาไว้ที่เดียว: ไอคอนวงกลมด้านบน · รายการสิทธิ์เป็นแถวมีไอคอนและเหตุผล · ปุ่มเต็มความกว้าง
 *
 * สีใช้โทนเดียวกับทั้งแอป (ตัวหนังสือ #292A32 · คำอธิบาย #858891 · เน้นด้วย accent #D8C5B5)
 * ไม่ใช้สีแดง เพราะการขอสิทธิ์ไม่ใช่เรื่องอันตราย แค่ยังทำต่อไม่ได้
 */
export default function PermissionModal({
  visible,
  onClose,
  onOpenSettings,
  title = "ต้องการสิทธิ์เพิ่มเติม",
  intro = "เปิดสิทธิ์ต่อไปนี้ในการตั้งค่าของเครื่อง แล้วกลับมาที่แอปอีกครั้ง",
  items,
  cancelLabel = "ยกเลิก",
  confirmLabel = "ไปที่การตั้งค่า",
  footer,
}: Props) {
  return (
    <ConfirmModal
      visible={visible}
      onClose={onClose}
      onConfirm={onOpenSettings}
      title={title}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      message={<Text className="text-sm text-[#858891] leading-[22px] mt-2 text-center">{intro}</Text>}
    >
      <InfoRows rows={items.map((it) => ({ label: it.label, detail: it.reason }))} />

      {footer ? <Text className="text-xs text-[#858891] leading-[18px] mt-3 text-center">{footer}</Text> : null}
    </ConfirmModal>
  );
}
