/**
 * provisioning.ts
 * ห่อ @orbital-systems/react-native-esp-idf-provisioning ให้หน้าจอเรียกใช้ง่าย
 *
 * ทำไมต้องมีไฟล์นี้แทนที่จะ import library ตรงในหน้าจอ
 * ------------------------------------------------------
 * 1. ESPDevice ที่ connect แล้วต้องส่งข้ามหน้าจอ (scan-devices → connect-device
 *    → wifi-password) แต่ router param ส่งได้แค่ string จึงเก็บไว้ที่ module level
 *
 * 2. library เป็น native module — ไม่มีใน Expo Go และไม่มีบนเว็บ
 *    ถ้า import ตรงแล้วเปิดใน Expo Go แอปจะ crash ทันที
 *    ไฟล์นี้จับ error ตอน require แล้วสลับไปโหมด mock ให้อัตโนมัติ
 *    UI จึงยังกดดูได้เหมือนเดิม (มี isMock ให้หน้าจอแสดงป้ายเตือน)
 *
 * 3. ตัวระบุอุปกรณ์คือ `devices.code` เช่น "ESP-0001A" (ตัดสินใจ 2026-09-01
 *    ดูเหตุผลใน fall_detection_backend/supabase/schema.sql)
 *    ค่านี้คือค่าเดียวกับที่ ESP32 ส่งมาใน POST /api/v1/predict
 *    และเป็นชื่อ BLE ที่ firmware ประกาศออกมาด้วย
 *
 * ── ต้องตรงกับ firmware ────────────────────────────────────────
 * ค่าพวกนี้ต้องตรงกับ `_components/provisioning_component.h` เป๊ะ ๆ
 * ถ้าฝั่งใดฝั่งหนึ่งเปลี่ยน ต้องแก้พร้อมกันทั้งคู่ ไม่งั้นจับคู่ไม่ติด
 * โดยไม่มี error ที่บอกสาเหตุชัด:
 *   - DEVICE_PREFIX  ต้องตรงกับชื่อ BLE ที่ firmware ประกาศ
 *   - ESPSecurity    ต้องตรงกับ WIFI_PROV_SECURITY_* ใน firmware
 */

import { Platform } from "react-native";

// ชื่อ BLE ที่ firmware ประกาศต้องขึ้นต้นด้วยคำนี้ ถึงจะถูกกรองมาแสดง
export const DEVICE_PREFIX = "ESP-";

/**
 * ต้องตรงกับ WIFI_PROV_SECURITY_1 ใน firmware
 *
 * เลือก secure1 เพราะ secure2 (SRP6a) ต้อง generate salt/verifier แยกต่อเครื่อง
 * ตอนผลิต เพิ่มขั้นตอนโดยไม่ได้ประโยชน์เพิ่ม ในเมื่อ PoP เป็นสตริงสุ่มยาวบนกล่อง
 *
 * ⚠️ ถ้าเปลี่ยนตรงนี้ ต้องแก้ firmware พร้อมกัน ไม่งั้นจับคู่ไม่ติด
 */
const SECURITY_LEVEL = 1;

type WifiNetwork = { ssid: string; rssi?: number; auth?: number };

type NativeModule = {
  ESPProvisionManager: {
    searchESPDevices(prefix: string, transport: any, security: any): Promise<any[]>;
  };
  ESPDevice: any;
  ESPTransport: { ble: any; softap: any };
  ESPSecurity: { unsecure: any; secure: any; secure2: any };
};

let native: NativeModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require("@orbital-systems/react-native-esp-idf-provisioning");
} catch {
  native = null;
}

/** true = ไม่มี native module (Expo Go / เว็บ / simulator) → ใช้ข้อมูลจำลอง */
export const isMock = native === null || Platform.OS === "web";

// ESPSecurity.secure = 1 — อ่านจาก enum ของ library ถ้าโหลดได้ กันค่าเพี้ยนเวลา library เปลี่ยน
const SECURITY = native ? native.ESPSecurity.secure : SECURITY_LEVEL;

const MOCK_DEVICES = ["ESP-0001A", "ESP-0002B"];
const MOCK_NETWORKS = ["MyHome_2.4G", "NeighborWifi_5G", "TrueNet-ABCD"];
const MOCK_DELAY_MS = 1200;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** อุปกรณ์ที่กำลัง connect อยู่ — ต้องอยู่ระดับ module เพื่อส่งข้ามหน้าจอ */
let current: { name: string; device: any | null } | null = null;

export function currentDeviceName(): string | null {
  return current?.name ?? null;
}

/** ค้นหาอุปกรณ์ที่อยู่ในโหมด provisioning — คืนชื่อ BLE เช่น "ESP-0001A" */
export async function searchDevices(): Promise<string[]> {
  if (isMock) {
    await wait(MOCK_DELAY_MS);
    return MOCK_DEVICES;
  }
  const { ESPProvisionManager, ESPTransport, ESPSecurity } = native!;
  const found = await ESPProvisionManager.searchESPDevices(
    DEVICE_PREFIX,
    ESPTransport.ble,
    SECURITY
  );
  return found.map((d: any) => d.name);
}

/**
 * เชื่อมต่อกับอุปกรณ์
 * @param proofOfPossession รหัสจาก QR / กล่อง — กันคนอื่นมา provision อุปกรณ์เรา
 */
export async function connect(name: string, proofOfPossession?: string): Promise<void> {
  if (isMock) {
    await wait(MOCK_DELAY_MS);
    current = { name, device: null };
    return;
  }
  const { ESPDevice, ESPTransport } = native!;
  const device = new ESPDevice({
    name,
    transport: ESPTransport.ble,
    security: SECURITY,
  });
  await device.connect(proofOfPossession);
  current = { name, device };
}

/** ให้อุปกรณ์สแกน WiFi รอบตัวมันเอง — ไม่ใช่ WiFi ที่มือถือเห็น */
export async function scanWifi(): Promise<string[]> {
  if (isMock) {
    await wait(MOCK_DELAY_MS);
    return MOCK_NETWORKS;
  }
  if (!current?.device) throw new Error("ยังไม่ได้เชื่อมต่ออุปกรณ์");

  const list: WifiNetwork[] = await current.device.scanWifiList();
  // ตัด SSID ซ้ำ (AP หลายตัวชื่อเดียวกัน) และเรียงตามสัญญาณแรงสุดก่อน
  const seen = new Set<string>();
  return list
    .slice()
    .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
    .filter((n) => n.ssid && !seen.has(n.ssid) && seen.add(n.ssid))
    .map((n) => n.ssid);
}

/** ส่ง SSID + รหัสผ่านให้อุปกรณ์ไปเชื่อมต่อเอง แล้วเก็บลง NVS */
export async function provision(ssid: string, password: string): Promise<void> {
  if (isMock) {
    await wait(MOCK_DELAY_MS);
    // ให้ทดสอบเคส error ได้โดยไม่ต้องมีฮาร์ดแวร์
    if (password === "wrong") throw new Error("รหัสผ่านไม่ถูกต้อง");
    return;
  }
  if (!current?.device) throw new Error("ยังไม่ได้เชื่อมต่ออุปกรณ์");
  await current.device.provision(ssid, password);
}

/** ต้องเรียกเมื่อออกจาก flow ไม่งั้น BLE ค้างเชื่อมต่อไว้ */
export function disconnect(): void {
  if (!isMock && current?.device) {
    try {
      current.device.disconnect();
    } catch {
      // ตัดการเชื่อมต่อไม่สำเร็จไม่ใช่เรื่องที่ผู้ใช้ต้องรับรู้
    }
  }
  current = null;
}

/** แปลง error จาก native ให้เป็นข้อความไทยที่ผู้ใช้ทำอะไรต่อได้ */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("proof") || lower.includes("pop") || lower.includes("auth"))
    return "รหัสอุปกรณ์ไม่ถูกต้อง ลองสแกน QR บนกล่องอีกครั้ง";
  if (lower.includes("password") || lower.includes("passphrase"))
    return "รหัสผ่าน Wi-Fi ไม่ถูกต้อง";
  if (lower.includes("not found") || lower.includes("ssid"))
    return "อุปกรณ์หาเครือข่ายนี้ไม่เจอ ลองขยับอุปกรณ์ให้ใกล้เราเตอร์";
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "หมดเวลาเชื่อมต่อ ลองใหม่อีกครั้งโดยให้มือถืออยู่ใกล้อุปกรณ์";
  if (lower.includes("bluetooth") || lower.includes("ble"))
    return "เชื่อมต่อบลูทูธไม่ได้ ตรวจสอบว่าเปิดบลูทูธอยู่";
  return raw || "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง";
}
