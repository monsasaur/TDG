// Extends app.json. Expo passes the parsed app.json as `config`. We add
// build-time overrides (e.g. paths materialized from EAS file env vars).

module.exports = ({ config }) => {
  const android = { ...(config.android || {}) };

  // EAS file env var: at build time, GOOGLE_SERVICES_JSON resolves to the
  // absolute path of the materialized google-services.json. Locally we
  // fall back to ./google-services.json (gitignored).
  if (process.env.GOOGLE_SERVICES_JSON) {
    android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }

  // ── ปลายทาง backend ──────────────────────────────────────────────
  // ห้าม hardcode URL/คีย์ในซอร์สอีก — อ่านจาก env ตอน build แทน
  // EAS ตั้งค่าต่อ profile ได้ (development / preview / production) ดู eas.json
  //
  // ค่า default ด้านล่างใช้ได้เฉพาะตอน dev บนเครื่องตัวเอง:
  //   10.0.2.2 = alias ของ Android emulator ที่ชี้กลับมาที่ host
  //   มือถือจริงบน LAN ให้ตั้ง EXPO_PUBLIC_API_BASE_URL เป็น IP ของเครื่อง
  //   (`ipconfig getifaddr en0`) หรือ URL ของ Render ตอน deploy แล้ว
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000";
  const apiKey = process.env.EXPO_PUBLIC_API_KEY || "dev-secret-key-123";

  return {
    ...config,
    android,
    extra: {
      ...(config.extra || {}),
      apiBaseUrl,
      apiKey,
    },
  };
};
