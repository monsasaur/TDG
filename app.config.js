// Extends app.json. Expo passes the parsed app.json as `config`. We add
// build-time overrides (e.g. paths materialized from EAS file env vars).

const { Buffer } = require("buffer");

// ── Supabase ที่แอปคุยด้วย ────────────────────────────────────────
// ค่าเริ่มต้น = ฐานจริงของทีม (anon key เป็นคีย์สาธารณะ อยู่ใน APK ทุกตัวอยู่แล้ว · RLS เป็นตัวกันข้อมูล)
// ทดสอบกับโปรเจกต์อื่น (ฐานทดสอบของ QA ฯลฯ) ให้ตั้งทั้งสองค่าใน .env.local แล้วเปิด Expo ใหม่ — ดู .env.example
const LIVE_SUPABASE_URL = "https://uszsloljezycwqebultu.supabase.co";
const LIVE_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzenNsb2xqZXp5Y3dxZWJ1bHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTI1ODcsImV4cCI6MjA4ODY4ODU4N30.HRt07mguyz1Is-0PaCVcw-qtdIQYleolbBckFv4cpYM";

// ref ของโปรเจกต์จาก URL แบบ https://<ref>.supabase.co
function projectRef(url) {
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i.exec(url);
  return m ? m[1] : null;
}

// payload ของ JWT แบบเก่า (eyJ...) · คีย์แบบใหม่ sb_publishable_ ไม่ใช่ JWT → null
function jwtPayload(key) {
  const part = key.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * อ่าน EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY แล้วตรวจก่อนใช้
 * ผิดแบบไหนก็หยุด build ทันที ดีกว่าแอปเปิดได้แล้วไปคุยกับฐานผิดตัวแบบเงียบ ๆ
 */
function resolveSupabase(env) {
  const url = (env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const key = (env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!url && !key) {
    return { supabaseUrl: LIVE_SUPABASE_URL, supabaseAnonKey: LIVE_SUPABASE_ANON_KEY };
  }

  // ตั้งค่าเดียว = URL ฐานทดสอบ + คีย์ฐานจริง (หรือกลับกัน) ทุก request จะ 401 แบบงง ๆ
  if (!url || !key) {
    throw new Error(
      "[app.config] ตั้ง EXPO_PUBLIC_SUPABASE_URL กับ EXPO_PUBLIC_SUPABASE_ANON_KEY ต้องตั้งคู่กัน " +
        `(ตอนนี้มีแค่ ${url ? "URL" : "ANON_KEY"})`,
    );
  }

  const ref = projectRef(url);
  if (!ref) {
    throw new Error(`[app.config] EXPO_PUBLIC_SUPABASE_URL ต้องเป็นแบบ https://<ref>.supabase.co (ได้ "${url}")`);
  }

  // คีย์ service_role ข้าม RLS ทุกตาราง — ใส่ในแอปเท่ากับแจกสิทธิ์ทั้งฐานให้ทุกคนที่แกะ APK/เว็บได้
  const payload = jwtPayload(key);
  if (key.startsWith("sb_secret_") || payload?.role === "service_role") {
    throw new Error(
      "[app.config] EXPO_PUBLIC_SUPABASE_ANON_KEY เป็นคีย์ service_role/secret — ห้ามใส่ในแอป " +
        "ใช้ anon (publishable) key เท่านั้น · service_role ใช้กับ Express (SUPABASE_KEY) อย่างเดียว",
    );
  }

  // คีย์ของอีกโปรเจกต์ — เช่นวาง URL ฐานทดสอบแต่ลืมเปลี่ยนคีย์
  if (payload?.ref && payload.ref !== ref) {
    throw new Error(
      `[app.config] คีย์เป็นของโปรเจกต์ ${payload.ref} แต่ URL เป็นของ ${ref} — คัดลอกคีย์จากโปรเจกต์เดียวกัน`,
    );
  }

  return { supabaseUrl: url.replace(/\/$/, ""), supabaseAnonKey: key };
}

/**
 * คีย์ x-api-key ของแอป (= APP_API_KEY ของ Express) — ไม่มีค่าสำรองแล้ว
 * เดิมถอยไปใช้ "dev-secret-key-123" ถ้าลืมตั้ง คีย์ที่อยู่ในรีโปสาธารณะจึงติดไปกับแอปที่ build แบบเงียบ ๆ (SEC-008)
 * ตอน dev ใส่ใน .env.local · EAS ตั้งเป็น environment variable ของแต่ละ profile
 */
function resolveApiKey(env) {
  const key = (env.EXPO_PUBLIC_API_KEY || "").trim();
  if (!key) {
    throw new Error(
      "[app.config] ยังไม่ได้ตั้ง EXPO_PUBLIC_API_KEY — ใส่ค่าเดียวกับ APP_API_KEY ของ Express " +
        "ใน .env.local (ดู .env.example) หรือใน environment variable ของ EAS แล้วเปิด Expo ใหม่",
    );
  }
  return key;
}

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
  const apiKey = resolveApiKey(process.env);

  const { supabaseUrl, supabaseAnonKey } = resolveSupabase(process.env);

  return {
    ...config,
    android,
    extra: {
      ...(config.extra || {}),
      apiBaseUrl,
      apiKey,
      supabaseUrl,
      supabaseAnonKey,
    },
  };
};

// ให้ตรวจ resolveSupabase แยกได้ (node -e) โดยไม่ต้องเปิด Expo
module.exports.resolveSupabase = resolveSupabase;
module.exports.resolveApiKey = resolveApiKey;
module.exports.LIVE_SUPABASE_URL = LIVE_SUPABASE_URL;
