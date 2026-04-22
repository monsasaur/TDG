/**
 * useLiveAlerts — poll backend fall events + merge เข้ากับ mockAlerts
 *
 * - poll ทุก POLL_INTERVAL_MS
 * - event ใหม่ (ไม่เคยเจอ) → เพิ่มเข้า AlertsContext เป็น "active"
 *   + ยิง local notification ให้มือถือเด้ง
 * - mock data เดิมยังอยู่ครบ
 */

import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useAlerts } from "../contexts/AlertsContext";
import { fetchFallEvents, BackendFallEvent } from "../lib/api";
import type { Alert } from "../types/alert";

const POLL_INTERVAL_MS = 4000;

function toAlert(e: BackendFallEvent): Alert {
  const d = new Date(e.timestamp || Date.now());
  const time = d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const acknowledged = Boolean(e.acknowledged);
  const escalated = Boolean(e.escalated);

  const status: Alert["status"] = acknowledged
    ? "completed"
    : escalated
      ? "no_response"
      : "active";

  return {
    id: e.id,
    title: "Emergency",
    houseName: "บ้านแม่",
    description: `ตรวจพบการล้มที่ ${e.location || "ไม่ทราบตำแหน่ง"} กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว`,
    location: e.location || "ไม่ทราบ",
    time,
    date: "วันนี้",
    status,
    countdown: status === "active" ? 60 : undefined,
    answeredBy: e.acknowledged_by || undefined,
    timeline: [
      { label: "ตรวจพบการล้ม", detail: "", status: "error" },
      escalated
        ? { label: "ไม่มีการตอบรับ", detail: "ระบบโทรหาเบอร์ฉุกเฉิน", status: "error" }
        : acknowledged
          ? { label: "ยืนยันการตรวจสอบ", detail: `โดย : ${e.acknowledged_by || "ไม่ระบุ"}`, status: "success" }
          : { label: "รอการตอบรับ", detail: "", status: "pending" },
      { label: "ติดต่อเบอร์ 1669", detail: "", status: "pending" },
    ],
  };
}

export function useLiveAlerts() {
  const { setAlerts } = useAlerts();
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const events = await fetchFallEvents(20);
        if (cancelled) return;

        setAlerts((prev) => {
          const prevIds = new Set(prev.map((a) => a.id));
          const newAlerts: Alert[] = [];

          for (const e of events) {
            if (prevIds.has(e.id)) continue; // อัพเดตของเก่าข้าม (อนาคตอาจเพิ่ม merge)
            const alert = toAlert(e);
            newAlerts.push(alert);

            // ยิง local notification เฉพาะ event ใหม่ที่ยังไม่ ack และยังไม่เคย notify
            if (!seenIds.current.has(e.id) && alert.status === "active") {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "🚨 ตรวจพบการล้ม!",
                  body: `${alert.location} — กรุณาตรวจสอบภายใน 60 วินาที`,
                  sound: "default",
                  data: { eventId: e.id },
                },
                trigger: null,
              }).catch(() => {});
            }
            seenIds.current.add(e.id);
          }

          if (newAlerts.length === 0) return prev;
          return [...newAlerts, ...prev];
        });
      } catch {
        // backend ยังไม่ได้เปิด — เงียบ ไม่ spam log
      }
    };

    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setAlerts]);
}
