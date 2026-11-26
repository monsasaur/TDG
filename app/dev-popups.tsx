import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import ConfirmModal from "../components/ConfirmModal";
import InfoRows from "../components/InfoRows";
import PageHeader from "../components/PageHeader";
import PermissionModal from "../components/PermissionModal";
import { OfflineIcon, OFFLINE_MESSAGE, OFFLINE_TITLE } from "../components/OfflineGate";
import { V2C } from "../components/designVersion";
import { DEFAULT_HOUSE_NAME } from "../data/defaultHouse";

/**
 * หน้ารวมป๊อปอัปทั้งแอป — ไว้ตรวจ UI ทีเดียวจบ ไม่ต้องไล่กดทีละหน้า
 *
 * ไม่มีลิงก์ไปหน้านี้จากในแอป เปิดด้วย deep link:
 *   adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081/--/dev-popups" host.exp.exponent
 * หรือเก็บภาพทั้งหมดอัตโนมัติด้วย  python scripts/shoot_popups.py
 *
 * ข้อความในนี้คัดลอกมาจากหน้าจริง — แก้ของจริงแล้วอย่าลืมแก้ที่นี่ด้วย
 */

type Key =
  | "leave-house"
  | "leave-house-last"
  | "delete-house"
  | "delete-house-last"
  | "delete-device"
  | "remove-member"
  | "clear-alerts"
  | "logout"
  | "house-limit"
  | "joined"
  | "offline"
  | "perm-camera-invite"
  | "perm-camera-pairing"
  | "perm-ble"
  | "perm-noti"
  | "noti-off";

const ITEMS: { key: Key; label: string; note: string }[] = [
  { key: "leave-house", label: "ออกจากบ้าน (ผู้ดูแล)", note: "หน้าบ้าน · กากบาทบ้านที่เราเป็นผู้ดูแล" },
  { key: "leave-house-last", label: "ออกจากบ้าน — บ้านสุดท้าย", note: "มีบรรทัดบอกว่าระบบจะสร้างบ้านใหม่ให้" },
  { key: "delete-house", label: "ลบบ้าน (เจ้าของบ้าน)", note: "หน้าบ้าน · กากบาทบ้านที่เราเป็นเจ้าของ" },
  { key: "delete-house-last", label: "ลบบ้าน — บ้านสุดท้าย", note: "มีบรรทัดบอกว่าระบบจะสร้างบ้านใหม่ให้" },
  { key: "delete-device", label: "ลบอุปกรณ์", note: "หน้ารายละเอียดอุปกรณ์" },
  { key: "remove-member", label: "นำสมาชิกออกจากบ้าน", note: "หน้ารายละเอียดสมาชิก" },
  { key: "clear-alerts", label: "ลบการแจ้งเตือนทั้งหมด", note: "ตั้งค่า → ลบการแจ้งเตือน" },
  { key: "logout", label: "ออกจากระบบ", note: "ตั้งค่า / โปรไฟล์" },
  { key: "house-limit", label: "มีบ้านเยอะเกินไป", note: "กดเพิ่มบ้านครบ 5 หลัง" },
  { key: "joined", label: "เข้าร่วมบ้านแล้ว", note: "กรอกรหัสบ้าน / สแกน QR สำเร็จ" },
  { key: "offline", label: "เน็ตหลุด", note: "แตะที่ไหนก็ขึ้น จนกว่าเน็ตจะกลับมา" },
  { key: "perm-camera-invite", label: "ขอสิทธิ์: กล้อง (QR เชิญเข้าบ้าน)", note: "หน้าสแกน QR" },
  { key: "perm-camera-pairing", label: "ขอสิทธิ์: กล้อง (QR รหัสจับคู่)", note: "หน้ารหัสจับคู่อุปกรณ์" },
  { key: "perm-ble", label: "ขอสิทธิ์: ตำแหน่ง + บลูทูธ", note: "หน้าค้นหาอุปกรณ์" },
  { key: "perm-noti", label: "ขอสิทธิ์: การแจ้งเตือน", note: "ตั้งค่า · เปิดสวิตช์แจ้งเตือน" },
  { key: "noti-off", label: "ปิดการแจ้งเตือน", note: "ตั้งค่า · ปิดสวิตช์แจ้งเตือน" },
];

const HOUSE = "บ้านแม่";

export default function DevPopupsScreen() {
  const router = useRouter();
  const [open, setOpen] = useState<Key | null>(null);
  const close = () => setOpen(null);
  const is = (k: Key) => open === k;

  return (
    <View className={`flex-1 ${V2C.page}`}>
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ป๊อปอัปทั้งหมด (dev)" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
        <Text className="text-xs text-[#858891] mb-3 leading-[18px]">
          หน้านี้มีไว้ตรวจหน้าตาป๊อปอัปอย่างเดียว กดแล้วไม่มีอะไรถูกลบหรือเปลี่ยนจริง
        </Text>

        {ITEMS.map((it) => (
          <Pressable
            key={it.key}
            onPress={() => setOpen(it.key)}
            accessibilityRole="button"
            accessibilityLabel={`popup:${it.key}`}
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            className="bg-white rounded-2xl px-4 py-3 mb-2"
          >
            <Text className="text-sm font-semibold text-[#292A32]">{it.label}</Text>
            <Text className="text-xs text-[#858891] mt-0.5">{it.note}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── ออกจากบ้าน ───────────────────────────────────────── */}
      <ConfirmModal
        visible={is("leave-house") || is("leave-house-last")}
        onClose={close}
        onConfirm={close}
        title={`ออกจาก ${HOUSE} ไหม`}
        tone="danger"
        cancelLabel="ยกเลิก"
        confirmLabel="ออกจากบ้าน"
        message="คุณจะออกจากบ้านนี้คนเดียว บ้านและสมาชิกคนอื่นยังอยู่เหมือนเดิม"
      >
        <InfoRows
          rows={[
            { label: "การแจ้งเตือนและอุปกรณ์", detail: "คุณจะไม่เห็นของบ้านนี้อีก" },
            { label: "การแจ้งเตือนเด้ง", detail: "เครื่องนี้จะไม่ได้รับ push ของบ้านนี้" },
            { label: "ถ้าจะกลับเข้าบ้าน", detail: "ต้องขอรหัสเชิญใหม่จากเจ้าของบ้าน" },
          ]}
        />
        {is("leave-house-last") ? (
          <Text className="text-xs text-[#858891] leading-[18px] mt-3 text-center">
            {`นี่เป็นบ้านสุดท้ายของคุณ ออกแล้วระบบจะสร้างบ้านใหม่ชื่อ "${DEFAULT_HOUSE_NAME}" ให้อัตโนมัติ`}
          </Text>
        ) : null}
      </ConfirmModal>

      {/* ── ลบบ้าน ──────────────────────────────────────────── */}
      <ConfirmModal
        visible={is("delete-house") || is("delete-house-last")}
        onClose={close}
        onConfirm={close}
        title={`ลบ ${HOUSE} ไหม`}
        tone="danger"
        cancelLabel="ยกเลิก"
        confirmLabel="ลบบ้าน"
        message="บ้านนี้จะถูกลบทั้งหมด ไม่ใช่แค่ของคุณ"
      >
        <InfoRows
          rows={[
            { label: "อุปกรณ์ในบ้านนี้", detail: "ถูกลบออกจากระบบไปด้วย" },
            { label: "เบอร์ติดต่อฉุกเฉินของบ้าน", detail: "ไม่มีใครถูกโทรหาเมื่อเกิดเหตุในบ้านนี้อีก" },
            { label: "ประวัติการแจ้งเตือน", detail: "หายไปทั้งหมด เรียกกลับไม่ได้" },
            { label: "สมาชิกคนอื่นในบ้าน", detail: "จะไม่เห็นบ้านนี้อีก" },
          ]}
        />
        {is("delete-house-last") ? (
          <Text className="text-xs text-[#858891] leading-[18px] mt-3 text-center">
            {`นี่เป็นบ้านสุดท้ายของคุณ ลบแล้วระบบจะสร้างบ้านใหม่ชื่อ "${DEFAULT_HOUSE_NAME}" ให้อัตโนมัติ`}
          </Text>
        ) : null}
      </ConfirmModal>

      {/* ── อื่น ๆ ที่เป็นข้อความล้วน ───────────────────────────── */}
      <ConfirmModal
        visible={is("delete-device")}
        onClose={close}
        onConfirm={close}
        tone="danger"
        title="ลบอุปกรณ์นี้หรือไม่"
        message="อุปกรณ์นี้จะถูกลบออกจากบ้านของคุณ คุณแน่ใจหรือไม่ว่าคุณต้องการลบอุปกรณ์นี้"
      />

      <ConfirmModal
        visible={is("remove-member")}
        onClose={close}
        onConfirm={close}
        tone="danger"
        title={`นำ สมชาย ออกจาก${HOUSE} ใช่ไหม`}
        confirmLabel="นำออก"
        message="คนนี้จะไม่เห็นการแจ้งเตือนและอุปกรณ์ของบ้านนี้อีก และจะกดรับทราบแทนไม่ได้"
      />

      <ConfirmModal
        visible={is("clear-alerts")}
        onClose={close}
        onConfirm={close}
        tone="danger"
        title="ยืนยันลบการแจ้งเตือนใช่ไหม"
        confirmLabel="ลบ"
        message="การแจ้งเตือนจะถูกซ่อนจากเครื่องนี้เท่านั้น สมาชิกคนอื่นยังเห็นตามปกติ"
      />

      <ConfirmModal
        visible={is("logout")}
        onClose={close}
        onConfirm={close}
        tone="danger"
        title="ออกจากระบบไหม"
        confirmLabel="ออกจากระบบ"
        message="เครื่องนี้จะไม่ได้รับการแจ้งเตือนของบ้านจนกว่าจะเข้าสู่ระบบใหม่"
      />

      <ConfirmModal
        visible={is("house-limit")}
        onClose={close}
        title="มีบ้านเยอะเกินไป"
        message="คุณเป็นสมาชิกของบ้านต่างๆ ครบจำนวนสูงสุดที่อนุญาตแล้ว หากคุณต้องการเพิ่มบ้านใหม่ ให้นำบ้านอื่นออกก่อน"
      />

      <ConfirmModal
        visible={is("joined")}
        onClose={close}
        title="เข้าร่วมบ้านแล้ว"
        message={`ตอนนี้คุณเห็นการแจ้งเตือนและอุปกรณ์ของบ้าน ${HOUSE} แล้ว`}
      />

      <ConfirmModal
        visible={is("offline")}
        onClose={close}
        tone="danger"
        iconNode={<OfflineIcon />}
        title={OFFLINE_TITLE}
        message={OFFLINE_MESSAGE}
        closeLabel="ตกลง"
      />

      <ConfirmModal
        visible={is("noti-off")}
        onClose={close}
        onConfirm={close}
        title="ปิดการแจ้งเตือน"
        confirmLabel="ไปที่การตั้งค่า"
        message={
          "ปิดได้ที่การตั้งค่าของเครื่อง\n\nถ้าปิด เครื่องนี้จะไม่เด้งเตือนเมื่อตรวจพบการล้ม — ระบบยังโทรหาเบอร์ติดต่อฉุกเฉินเมื่อไม่มีใครกดรับทราบในเวลาที่กำหนด"
        }
      />

      {/* ── ขอสิทธิ์ ─────────────────────────────────────────── */}
      <PermissionModal
        visible={is("perm-camera-invite")}
        onClose={close}
        onOpenSettings={close}
        items={[{ label: "กล้อง", reason: "ใช้สแกน QR Code ของรหัสเชิญเข้าบ้าน" }]}
        footer="ไม่อยากเปิดกล้องก็กรอกรหัสบ้าน 6 ตัวแทนได้"
      />

      <PermissionModal
        visible={is("perm-camera-pairing")}
        onClose={close}
        onOpenSettings={close}
        cancelLabel="พิมพ์รหัสเอง"
        items={[{ label: "กล้อง", reason: "ใช้สแกน QR รหัสจับคู่ที่อยู่บนกล่องอุปกรณ์" }]}
        footer="ไม่อยากเปิดกล้องก็พิมพ์รหัสจับคู่ในช่องแทนได้"
      />

      <PermissionModal
        visible={is("perm-ble")}
        onClose={close}
        onOpenSettings={close}
        items={[
          { label: "ตำแหน่ง", reason: "Android บังคับให้ขอสิทธิ์นี้ก่อนถึงจะค้นหาอุปกรณ์ด้วยบลูทูธได้" },
          { label: "อุปกรณ์ที่อยู่ใกล้เคียง", reason: "ใช้สแกนหาและเชื่อมต่อกับ ESP32 ผ่านบลูทูธ" },
        ]}
      />

      <PermissionModal
        visible={is("perm-noti")}
        onClose={close}
        onOpenSettings={close}
        items={[{ label: "การแจ้งเตือน", reason: "ใช้เด้งเตือนบนเครื่องนี้ทันทีที่ตรวจพบการล้ม" }]}
        footer="ไม่เปิดก็ยังใช้แอปได้ แต่จะเห็นการแจ้งเตือนเฉพาะตอนเปิดแอปอยู่"
      />
    </View>
  );
}
