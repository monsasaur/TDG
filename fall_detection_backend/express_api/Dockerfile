# syntax=docker/dockerfile:1

# ---------- build deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# คัดลอกแค่ manifest ก่อน — layer นี้จะถูก cache ไว้จนกว่า dependency จะเปลี่ยนจริง
COPY package.json package-lock.json ./

# npm ci ใช้ lockfile ตรงตัว ไม่ resolve version ใหม่ — build ซ้ำได้ผลเดิมเสมอ
RUN npm ci --omit=dev && npm cache clean --force

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# tini เป็น PID 1 เพื่อให้ SIGTERM ส่งถึง node จริง
# ไม่งั้นตอน Render deploy ใหม่ container จะถูก kill แทนที่จะปิดตัวเอง
# แล้ว escalation timer ที่ค้างอยู่จะไม่มีโอกาสทำงานให้จบ
RUN apk add --no-cache tini wget

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts

# รันด้วย user ที่ไม่ใช่ root — image ของ node มี user `node` มาให้แล้ว
USER node

# Render กำหนด PORT มาเอง ค่านี้เป็นแค่ default ตอนรันเครื่องตัวเอง
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
