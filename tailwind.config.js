/** @type {import('tailwindcss').Config} */
// สีกลาง (brand / danger / ink / sub / page / line) อ่านจาก components/palette.json ตาม DESIGN ใน components/designVersion.ts
// เปลี่ยน DESIGN แล้วต้องรีสตาร์ท Metro แบบล้าง cache (`npx expo start -c`) คลาสพวกนี้ถึงจะเปลี่ยนสี
const fs = require("fs");
const path = require("path");
const palette = require("./components/palette.json");
const design = fs.readFileSync(path.join(__dirname, "components/designVersion.ts"), "utf8");
const v2 = /DESIGN\s*=\s*"v2"/.test(design);

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: v2 ? palette.v2 : palette.v1,
    },
  },
  plugins: [],
}
