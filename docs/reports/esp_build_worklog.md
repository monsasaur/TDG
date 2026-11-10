# บันทึกงาน — build/flash firmware BLE provisioning

ไฟล์นี้บันทึกว่าทำอะไรไปแล้ว ผลเป็นอย่างไร และเหลืออะไร
**เพิ่มรายการใหม่ต่อท้ายเสมอ ห้ามลบของเก่า** — จะได้ย้อนดูได้ว่าอะไรเคยพังเพราะอะไร

**ตัดสินใจแล้ว:** ใช้ **ESP-IDF v5.4** (ทางเลือก A) เหตุผลและทางเลือก B อยู่ใน
[`esp_idf_version_decision.md`](esp_idf_version_decision.md)

---

## สถานะรวม

| ขั้น | สถานะ | หมายเหตุ |
|---|:---:|---|
| 1. clone ESP-IDF v5.4 | ✅ | 586M · `~/esp/esp-idf-v5.4` |
| 2. `install.sh esp32` | ✅ | ติดดิสก์เต็มรอบแรก · แก้แล้วผ่าน |
| 3. สำรอง sdkconfig โหมดเก็บข้อมูล | ✅ | `sdkconfig.datacollect.keep` |
| 4. `set-target` + เปิด BLE | ✅ | `CONFIG_ENABLE_BLE_PROVISIONING=y` |
| 5. **`idf.py build` ผ่าน** | ✅ | **1,200 KB · เหลือที่ 41%** ครั้งแรกที่สำเร็จ |
| 6. `esptool.py flash_id` เช็คขนาด flash | ✅ | **4MB ยืนยันแล้ว** · ESP32-D0WD-V3 |
| 7. flash ลงบอร์ดจริง | ✅ | **1,229,328 bytes · hash verified** · boot ผ่าน |
| 8a. **BLE เปิดและ advertise ได้** | ✅ | `Provisioning started : ESP-B96AB8` · NimBLE advertising |
| 8b. จับคู่จากแอปเราเอง | 🔴 | **แอปส่ง PoP ไม่ได้** ต้องใช้แอป Espressif ทดสอบก่อน |
| 9. บันทึกอุปกรณ์ลง Supabase | 🔲 | ยังไม่มีโค้ด insert เลย |

⏳ = กำลังทำ/ทำได้เลย · 🔲 = ติดที่ฮาร์ดแวร์หรือขั้นก่อนหน้า · ✅ = เสร็จ · ❌ = พัง

---

## บันทึกรายการ

### 2026-09-29 — เริ่ม

**ตรวจสภาพเครื่องก่อนเริ่ม**

- `~/esp/esp-idf` **ไม่มีแล้ว** — framework ถูกลบไป เหลือแต่ `~/.espressif`
  (toolchain xtensa gcc 15.2.0 + python env, constraints ระบุ v6.1)
- build ล่าสุด 6 พ.ค. 2026 · `IDF_VER=v6.1-dev-2938-g12f36a021f` · เป็นโหมดเก็บข้อมูล ไม่มี BLE
- ไม่มีบอร์ดเสียบ — `/dev/cu.*` มีแต่ Bluetooth-Incoming-Port, Y486BT_55E7, debug-console
- `sdkconfig` ที่อยู่ในรีโปยังเป็นโหมดเก็บข้อมูล: flash 2MB · `PARTITION_TABLE_SINGLE_APP`
  · `# CONFIG_BT_ENABLED is not set` → `sdkconfig.defaults` ยังไม่มีผลจนกว่าจะลบ `sdkconfig`
- ไม่มี `idf_component.yml` ที่ไหนในรีโป

**เจอปัญหาที่ทำให้ต้องเลือกเวอร์ชัน**

`_components/provisioning_component.h` (เขียน 2 ก.ย. ยังไม่เคยผ่าน compiler)
ใช้ API ของ IDF v5 — แต่ตั้งแต่ **v6.0 `wifi_provisioning` ถูกถอดออกจาก core**
ย้ายไปเป็น managed component `espressif/network_provisioning` และเปลี่ยนชื่อ API ยกชุด
→ ถ้า build บน v6.1 จะพังที่ `#include "wifi_provisioning/manager.h"` ทันที

**→ ตัดสินใจใช้ v5.4** เพราะเป้าหมายเฉพาะหน้าคือพิสูจน์ว่า BLE ทำงานกับบอร์ดจริง
ไม่ใช่การอัปเกรด framework ถ้าทำสองอย่างพร้อมกันแล้วพัง จะแยกไม่ออกว่าพังเพราะอะไร

**ทำไปแล้ว**

1. `mkdir -p ~/esp` แล้ว clone v5.4 ลง `~/esp/esp-idf-v5.4`
   ```bash
   git clone -b v5.4 --recursive --depth 1 --shallow-submodules \
     https://github.com/espressif/esp-idf.git esp-idf-v5.4
   ```
   เลือกโฟลเดอร์ชื่อ `esp-idf-v5.4` ไม่ใช่ `esp-idf` เฉย ๆ **โดยตั้งใจ** —
   เผื่อวันหลังจะ clone v6 มาไว้ข้าง ๆ แล้วสลับไปมาได้โดยไม่ต้องลบของเดิม

2. สำรอง sdkconfig โหมดเก็บข้อมูลไว้ที่ `active_ap/sdkconfig.datacollect.keep`

**⚠️ เจอเรื่องที่ต้องรู้: `sdkconfig` ไม่ได้อยู่ใน git**

`git ls-files` บอกว่าในโฟลเดอร์ `active_ap/` git ติดตามแค่ **`sdkconfig.defaults`** ไฟล์เดียว
`sdkconfig` · `sdkconfig.bak` · `sdkconfig.old` ไม่ได้ถูกติดตาม

แปลว่า **ค่าตั้งของโหมดเก็บข้อมูลมีอยู่แค่บนเครื่องนี้เครื่องเดียว** ถ้าไฟล์หายหรือเครื่องพัง
ต้องไปตั้งใน menuconfig ใหม่ทั้งหมดโดยไม่มีอะไรอ้างอิง

ทางแก้ที่ควรทำ (ยังไม่ได้ทำ): ใช้ `idf.py save-defconfig` สร้างไฟล์ที่เก็บเฉพาะค่าที่ต่างจาก
ค่าเริ่มต้น แล้ว commit ไว้เป็น `sdkconfig.datacollect.defaults`
**แต่ยังทำตอนนี้ไม่ได้** เพราะ `sdkconfig` ปัจจุบันถูกสร้างโดย v6.1-dev
ถ้าเอา `idf.py` ของ v5.4 ไปอ่าน จะเกิดการ migrate ค่าและได้ผลที่เชื่อไม่ได้
→ ควรทำหลังจากยืนยันว่าโหมดเก็บข้อมูล build ผ่านบน v5.4 แล้ว

**หมายเหตุเรื่องไฟล์ sdkconfig ที่มีอยู่ 4 ไฟล์**

| ไฟล์ | คืออะไร |
|---|---|
| `sdkconfig` | ค่าที่ใช้จริง สร้างโดย v6.1-dev (6 พ.ค.) — โหมดเก็บข้อมูล |
| `sdkconfig.datacollect.keep` | สำเนาของข้างบน ที่เราเพิ่งสำรองไว้ |
| `sdkconfig.defaults` | ✅ อยู่ใน git — ค่าสำหรับโหมด production (BLE) เขียน 2 ก.ย. |
| `sdkconfig.bak` · `sdkconfig.old` | ของเก่าที่ idf.py สร้างทิ้งไว้เอง ไม่ต้องสนใจ |

**clone เสร็จ — ยืนยันว่าใช้ได้**

```
git describe --tags       → v5.4
components/wifi_provisioning/include/wifi_provisioning/
  manager.h  scheme_ble.h  scheme_console.h  scheme_softap.h
  wifi_config.h  wifi_scan.h
components/protocomm      ✅ มี
components/bt             ✅ มี
components/bt/host/nimble/nimble   11M  (submodule เต็ม ไม่ใช่โฟลเดอร์ว่าง)
components/mbedtls/mbedtls         43M  (submodule เต็ม)
```

→ `#include "wifi_provisioning/manager.h"` กับ `scheme_ble.h` ใน `provisioning_component.h`
จะหาเจอแน่นอนบนเวอร์ชันนี้ ตรงตามที่คาดไว้ในเอกสารตัดสินใจ

**ต่อไป:** `./install.sh esp32` (ดึง toolchain ของ v5.4 — คนละชุดกับ v6.1 ที่มีอยู่ อยู่ร่วมกันได้)

### 2026-09-29 — ❌ ติดดิสก์เต็ม ยังไม่ผ่านขั้น install

`./install.sh esp32` **ล้มเหลว exit 1** เพราะ **ดิสก์เต็ม**

อาการที่เจอ: หลังจากนั้นรันคำสั่งอะไรไม่ได้เลย แม้แต่ `df` เพราะ tool ต้องเขียนไฟล์
ผลลัพธ์ลงดิสก์ก่อน แล้วเขียนไม่ได้ — `ENOSPC: no space left on device`

**สภาพดิสก์ตอนเจอปัญหา**

```
/dev/disk3s5  228Gi total · 175Gi used · 119Mi avail · 100% capacity
```

**ขนาดของสิ่งที่เกี่ยวข้องกับงานนี้ — ไม่ใช่ตัวปัญหา**

| | ขนาด |
|---|---:|
| `~/esp/esp-idf-v5.4` (เพิ่ง clone) | 586M |
| `~/.espressif` (toolchain v6.1 + python env) | 2.9G |
| `~/.espressif/dist` (แคชไฟล์ติดตั้ง ลบได้) | 418M |
| `~/TDG` ทั้งโปรเจกต์ | 2.6G |

shallow clone ได้ผลดี — v5.4 กินแค่ 586M ไม่ใช่ 2GB อย่างที่ประเมินไว้ในเอกสารตัดสินใจ

**ตัวที่กินดิสก์จริง (ไม่เกี่ยวกับโปรเจกต์)**

```
~/Library                              55G
  └ Application Support                44G
      ├ Steam                          29G   ← ตัวการหลัก
      ├ Google                        6.3G
      ├ Code                          3.0G
      ├ discord                       1.7G
      └ Spotify                       1.0G
  ├ Android/sdk                        7.3G
  └ Caches                             2.4G
~/Documents                            5.1G
~/Downloads                            2.7G
```

มี APFS local snapshot ของ OS update ค้างอยู่ 3 ตัวด้วย (`tmutil listlocalsnapshots /`)
ซึ่งกินพื้นที่แบบที่ `du` มองไม่เห็น

**ต้องการพื้นที่:** ~3-4G สำหรับ toolchain v5.4 + ~1G สำหรับผลลัพธ์ build → เป้าหมาย ~5G

**ยังไม่ได้ลบอะไรเลย** — ของที่กินที่เป็นเกมกับข้อมูลส่วนตัวของผู้ใช้ ไม่ใช่ของโปรเจกต์
จึงไม่ใช่สิ่งที่ควรตัดสินใจลบแทน

**บทเรียนที่ควรจดไว้:** ครั้งหน้าก่อน clone framework ขนาดใหญ่ ให้ `df -h` ก่อน
จะได้ไม่เสียเวลา clone จนเสร็จแล้วค่อยพบว่าติดตั้ง toolchain ต่อไม่ได้

**แก้ปัญหาดิสก์แล้ว — ผู้ใช้เคลียร์เอง**

```
ก่อน:  175Gi used · 119Mi avail · 100%
หลัง:  147Gi used ·  29Gi avail ·  84%
```

Steam ลงจาก 29G → 1.2G (ผู้ใช้ลบเกมออก) · `~/.espressif/dist` 418M ยังอยู่ ไม่ต้องลบแล้ว

→ รัน `./install.sh esp32` ต่อ

### 2026-09-29 — install ผ่าน · ตั้งค่าโหมด production ได้ · เจอบั๊กใน sdkconfig.defaults

**install สำเร็จ**

```
idf.py --version  →  ESP-IDF v5.4
idf.py path       →  ~/esp/esp-idf-v5.4/tools/idf.py
```

**ตั้งค่าโหมด production**

```bash
. ~/esp/esp-idf-v5.4/export.sh
cd active_ap
rm -rf build sdkconfig          # build dir เก่าสร้างโดย v6.1-dev ใช้ต่อไม่ได้
idf.py set-target esp32         # อ่าน sdkconfig.defaults ให้เอง
echo 'CONFIG_ENABLE_BLE_PROVISIONING=y' >> sdkconfig
idf.py reconfigure
```

`set-target` ผ่าน — ใน component list มี `wifi_provisioning` · `protocomm` · `bt` ครบ
ไม่มี warning เรื่อง config เลย (มีแต่ CMake deprecation ธรรมดาจาก mbedtls)

ผลที่ได้:

| config | ค่า | ถูกไหม |
|---|---|:---:|
| `CONFIG_ESPTOOLPY_FLASHSIZE` | `"4MB"` | ✅ |
| `CONFIG_PARTITION_TABLE_CUSTOM` | `y` → `partitions.csv` | ✅ |
| `CONFIG_BT_ENABLED` · `CONFIG_BT_NIMBLE_ENABLED` | `y` | ✅ |
| `CONFIG_ENABLE_BLE_PROVISIONING` | `y` | ✅ |
| `CONFIG_PROV_POP` | `"tdg-change-me-per-device"` | ⚠️ ค่า default ต้องเปลี่ยนก่อน flash จริง |
| `CONFIG_DEVICE_CODE` | `""` | ℹ️ ว่าง = โค้ดจะสร้างจาก MAC ให้เอง ตามที่ออกแบบไว้ |
| `CONFIG_ESP_CONSOLE_UART_BAUDRATE` | **115200** | ❌ **ผิด ควรเป็น 921600** |

---

#### 🐛 บั๊กใน `sdkconfig.defaults` (ไฟล์นี้อยู่ใน git)

`sdkconfig.defaults` เขียนไว้ว่า

```
CONFIG_ESP_CONSOLE_UART_BAUDRATE=921600
CONFIG_ESPTOOLPY_MONITOR_BAUD=921600
```

**แต่สองบรรทัดนี้ไม่มีผลเลย** — ผลออกมาเป็น 115200 ทั้งคู่

**สาเหตุ** Kconfig ของ v5.4 (`components/esp_system/Kconfig`) นิยามไว้ว่า

```
config ESP_CONSOLE_UART_BAUDRATE
    int
    prompt "UART console baud rate" if ESP_CONSOLE_UART_CUSTOM   ← ตรงนี้
    depends on ESP_CONSOLE_UART
    default 115200
```

`prompt ... if ESP_CONSOLE_UART_CUSTOM` แปลว่าค่านี้ **ตั้งเองได้เฉพาะเมื่อเปิด
`ESP_CONSOLE_UART_CUSTOM`** ถ้าไม่เปิด มันจะถูกบังคับเป็น default 115200
และค่าที่ใส่ใน `sdkconfig.defaults` ถูกเมินแบบเงียบ ๆ ไม่มี warning

`CONFIG_ESPTOOLPY_MONITOR_BAUD` ก็เป็น 115200 ตามไปด้วย เพราะมันอิงค่าจาก console baudrate

**ยืนยันด้วยการเทียบกับ sdkconfig ที่ใช้เก็บข้อมูลจริง** (`sdkconfig.datacollect.keep`)

```
# CONFIG_ESP_CONSOLE_UART_DEFAULT is not set
CONFIG_ESP_CONSOLE_UART_CUSTOM=y          ← บรรทัดที่ sdkconfig.defaults ขาดไป
CONFIG_ESP_CONSOLE_UART_CUSTOM_NUM_0=y
CONFIG_ESP_CONSOLE_UART_BAUDRATE=921600
```

ตอนนั้นตั้งผ่าน `menuconfig` ซึ่งบังคับให้เลือก Custom ก่อนจะแก้ baudrate ได้ จึงถูกต้อง
แต่พอเขียนลง `sdkconfig.defaults` ด้วยมือ คนเขียนไม่รู้ว่าต้องมี `_CUSTOM=y` ด้วย

**ผลถ้าไม่แก้** — ใครทำตามขั้นตอนใน CLAUDE.md (`rm sdkconfig` แล้ว build)
จะได้ firmware ที่พูดที่ **115200** ในขณะที่ `csi_collector_serial.py` เปิดพอร์ตที่ **921600**
→ อ่านข้อมูลไม่ได้หรือได้เป็นขยะ **โดยไม่มี error บอกสาเหตุ** เสียเวลาหาหลายชั่วโมง

**การแก้** เพิ่มสองบรรทัดนี้ลง `sdkconfig.defaults`

```
CONFIG_ESP_CONSOLE_UART_CUSTOM=y
CONFIG_ESP_CONSOLE_UART_CUSTOM_NUM_0=y
```

**ยังไม่แก้ตอนนี้** เพราะ `idf.py build` กำลังรัน แก้ไฟล์ที่ ninja เฝ้าอยู่จะทำให้
reconfigure กลางทาง — จะแก้หลัง build จบ แล้ว reconfigure + build ใหม่

### 2026-09-29 — ✅ **`idf.py build` ผ่านครั้งแรก**

CLAUDE.md เขียนไว้ว่า *"ยังไม่เคย build จริง — เครื่องที่เขียนโค้ดไม่มี ESP-IDF ติดตั้ง"*
**ตอนนี้ build ผ่านแล้ว** `exit 0` ไม่มี error ไม่มี warning จากโค้ดเรา

```
active-ap.bin        0x12c210 = 1,229,328 bytes ≈ 1,200 KB
app partition        0x200000 = 2,097,152 bytes = 2,048 KB
เหลือว่าง            0xd3df0  =   867,312 bytes ≈   847 KB  (41%)

bootloader.bin       0x6570   =    25,968 bytes  (เหลือ 9%)
```

**ตัวเลขนี้ยืนยันว่าการตัดสินใจเรื่อง partition ถูกต้อง**

| | ประมาณการใน CLAUDE.md | ของจริง |
|---|---|---|
| firmware เดิม (ไม่มี BLE) | 924 KB | — |
| NimBLE + provisioning เพิ่ม | ~250-350 KB | — |
| **รวมที่คาด** | **~1,174-1,274 KB** | **1,200 KB** ✅ ตรง |
| ถ้าใช้ partition 1MB เดิม | ใส่ไม่ลง | ใส่ไม่ลงจริง (1,200 > 1,024) |

ประมาณการเดิมแม่นมาก และ `partitions.csv` ที่ให้ app 2MB จำเป็นจริง ไม่ได้เผื่อเกินไป

**โค้ดที่เขียนไว้ตั้งแต่ 2 ก.ย. compile ผ่านโดยไม่ต้องแก้เลย**
`provisioning_component.h` · `main.cc` ที่แยกสองโหมดด้วย `#ifdef` · `partitions.csv` ·
`Kconfig.projbuild` ใช้ได้ทั้งหมดบน v5.4 ตรงตามที่คาดไว้ในเอกสารตัดสินใจ

---

#### 🐛 แก้บั๊ก baudrate ใน `sdkconfig.defaults` แล้ว

เพิ่มสองบรรทัดพร้อมคอมเมนต์อธิบายสาเหตุ:

```
CONFIG_ESP_CONSOLE_UART_CUSTOM=y
CONFIG_ESP_CONSOLE_UART_CUSTOM_NUM_0=y
```

**ทดสอบว่าแก้ได้จริง** — ลบ `sdkconfig` แล้ว regenerate จาก `sdkconfig.defaults` ใหม่ทั้งหมด:

```
CONFIG_ESP_CONSOLE_UART_CUSTOM=y        ✅
CONFIG_ESP_CONSOLE_UART_CUSTOM_NUM_0=y  ✅
CONFIG_ESP_CONSOLE_UART_BAUDRATE=921600 ✅ (เดิมได้ 115200)
CONFIG_ESPTOOLPY_MONITOR_BAUD=921600    ✅ (เดิมได้ 115200)
```

build ซ้ำหลังแก้ → ผ่าน ขนาดเท่าเดิม 0x12c210 ไม่กระทบอะไร

---

## เหลืออะไร

### ต้องเสียบบอร์ดก่อน (ผมทำแทนไม่ได้)

1. **`esptool.py flash_id`** — เรื่องที่ต้องเช็คก่อนทุกอย่าง
   build นี้ตั้งบนสมมติฐานว่า flash มี **4MB** ถ้าบอร์ดจริงมี 2MB จะ flash ไม่ลง
   ต้องกลับไปลดขนาด app partition แล้ว build ใหม่
   ```bash
   . ~/esp/esp-idf-v5.4/export.sh
   cd fall_detection_backend/ESP32-CSI-Tool/active_ap
   esptool.py flash_id
   ```

2. **flash + monitor**
   ```bash
   idf.py -p /dev/cu.usbserial-XXXX flash monitor
   ```
   สิ่งที่ควรเห็นใน log ถ้าถูกต้อง:
   - `MODE : production (BLE provisioning + AP/STA)` จาก `config_print()`
   - `ยังไม่ได้ตั้งค่า — เปิด BLE ชื่อ "ESP-XXXXXX"` (ชื่อสร้างจาก MAC เพราะ `DEVICE_CODE=""`)
   - `กดปุ่ม BOOT ค้าง 5 วินาที เพื่อล้างค่า WiFi`

3. **ทดสอบจับคู่กับแอปผ่าน BLE** — ต้องใช้ PoP ตรงกันสองฝั่ง
   ตอนนี้ firmware ใช้ค่า default `"tdg-change-me-per-device"`
   ต้องเช็คว่า `lib/provisioning.ts` ฝั่งแอปใช้ค่าเดียวกันไหม **ยังไม่ได้ตรวจ**

### ทำได้เลยไม่ต้องรอบอร์ด

4. **⚠️ `CONFIG_PROV_POP` ยังเป็นค่า default เหมือนกันทุกเครื่อง**
   comment ในไฟล์เตือนเองว่าเป็นจุดอ่อนของ Security 1 — ถ้า PoP เดาง่าย
   คนที่ดักจับ handshake เอาไป brute force offline ได้
   ต้องมีขั้นตอนผลิตที่สุ่ม PoP ต่อเครื่อง **ยังไม่มี**

5. **อุปกรณ์ที่ตั้งค่าเสร็จยังไม่ถูกบันทึกลง Supabase**
   `app/device-setup.tsx` → `handleSave()` สำหรับอุปกรณ์ใหม่ทำแค่ `router.dismiss(4)`
   ไม่มี insert ที่ไหนเลย → ต่อให้ BLE จับคู่ติด อุปกรณ์ก็ยังไม่โผล่ในหน้า Devices
   และ `select-house.tsx` ยัง hardcode `["บ้านแม่","บ้านพ่อ"]` ไม่ได้ส่ง `house_id` ผ่าน flow

6. **`sdkconfig` ของโหมดเก็บข้อมูลยังไม่ได้ commit**
   ตอนนี้ทำได้แล้วเพราะมี v5.4 ใช้งานได้ — ใช้ `idf.py save-defconfig` สร้างไฟล์ที่เก็บ
   เฉพาะค่าที่ต่างจาก default แล้ว commit เป็น `sdkconfig.datacollect.defaults`
   **ระวัง:** `save-defconfig` เขียนทับ `sdkconfig.defaults` ต้องย้ายของเดิมออกก่อน

### เอกสารที่ต้องแก้

7. **CLAUDE.md ล้าสมัยแล้ว** — ยังเขียนว่า *"ยังไม่เคย build จริง"* กับ
   *"เครื่องที่เขียนโค้ดไม่มี ESP-IDF ติดตั้ง"* ทั้งสองข้อไม่จริงแล้ว
   และตารางงานค้างยังบอกว่าข้อ 1 ของ BLE provisioning คือ "build/flash กับบอร์ดจริง"
   ซึ่งตอนนี้เหลือแค่ flash

### 2026-09-29 — ✅ เช็คบอร์ดจริงแล้ว flash 4MB

เสียบบอร์ดแล้วขึ้น `/dev/cu.usbserial-0001` (ชิป CH340/CH9102)

```
esptool.py -p /dev/cu.usbserial-0001 flash_id

Chip is ESP32-D0WD-V3 (revision v3.1)
Features: WiFi, BT, Dual Core, 240MHz, VRef calibration in efuse
Crystal is 40MHz
MAC: 1c:c3:ab:b9:6a:b8
Detected flash size: 4MB
Flash voltage set by a strapping pin to 3.3V
```

**ตอบคำถามที่ค้างมาตั้งแต่เขียน partitions.csv ได้แล้ว**

CLAUDE.md กับคอมเมนต์ใน `partitions.csv` เขียนไว้ว่า *"sdkconfig เดิมตั้งไว้ 2MB
ซึ่งน่าจะไม่ตรงของจริง — เช็คด้วย esptool.py flash_id"*

→ **ของจริงคือ 4MB** สมมติฐานของ build ถูกต้อง `partitions.csv` ที่ให้ app 2MB ใส่ลงได้
ไม่ต้องลดขนาดอะไร · ไฟล์ 1,200 KB ลงบน partition 2,048 KB เหลือ 41%

**device code ที่ firmware จะประกาศออก BLE**

`CONFIG_DEVICE_CODE=""` → `provisioning_device_code()` จะสร้างจาก MAC ด้วย
`snprintf(..., "ESP-%02X%02X%02X", mac[3], mac[4], mac[5])`

MAC = `1c:c3:ab:` **`b9:6a:b8`** → device code = **`ESP-B96AB8`**

ค่านี้ต้องไปอยู่ใน `devices.code` ของ Supabase ด้วย ไม่งั้นเหตุการณ์ที่ส่งมาจากบอร์ดนี้
จะบันทึกใน `fall_events` ได้แต่ไม่โผล่ในหน้า Devices ของแอป
(ตามที่ CLAUDE.md อธิบายเรื่อง `touchDevice()` ไม่สร้างแถวใหม่ให้อุปกรณ์ที่ไม่รู้จัก)

### 2026-09-29 — ❌ flash ไม่สำเร็จ พอร์ตหลุดกลางทาง

```
idf.py -p /dev/cu.usbserial-0001 flash

A fatal error occurred: Could not open /dev/cu.usbserial-0001,
the port is busy or doesn't exist.
([Errno 2] No such file or directory: '/dev/cu.usbserial-0001')
```

เช็คซ้ำหลังจากนั้น — `/dev/cu.usbserial*` **ไม่มีแล้ว** เหลือแต่
`Bluetooth-Incoming-Port` · `Y486BT_55E7` · `debug-console`

**ลำดับเหตุการณ์**

| จังหวะ | พอร์ต | ผล |
|---|---|---|
| รัน `esptool.py flash_id` ครั้งแรก (ไม่ระบุพอร์ต) | ไม่มี `usbserial` | หาไม่เจอ ลอง 2 พอร์ตที่ไม่เกี่ยวแล้วเลิก |
| เช็คซ้ำ | **มี** `usbserial-0001` | บอร์ดถูกเสียบเข้ามา |
| `flash_id -p /dev/cu.usbserial-0001` | มี | ✅ อ่านสำเร็จ ได้ chip + MAC + flash 4MB · จบด้วย `Hard resetting via RTS pin...` |
| `idf.py flash` | **หายไป** | ❌ เปิดพอร์ตไม่ได้ |

**ข้อสังเกต** — บอร์ดกับสายใช้งานได้จริง เพราะ `flash_id` อ่านข้อมูลได้ครบถ้วน
พอร์ตหลุดหลังจาก `--after=hard_reset` สั่ง toggle RTS/DTR
อาการนี้มักมาจากสาย USB หลวมหรือเป็นสายชาร์จที่สายข้อมูลไม่ดี หรือเสียบผ่าน hub
ทำให้ชิป CH340 หลุดแล้วไม่ re-enumerate กลับมา

**ยังไม่ได้แก้** เป็นเรื่องการเชื่อมต่อทางกายภาพ แก้จากฝั่งซอฟต์แวร์ไม่ได้

**สิ่งที่ต้องทำเมื่อกลับมาต่อ**

```bash
# 1) ถอดเสียบสาย USB ใหม่ — ต่อตรงเข้าเครื่อง ไม่ผ่าน hub และต้องเป็นสายที่ส่งข้อมูลได้
# 2) ยืนยันว่าพอร์ตกลับมา
ls /dev/cu.usbserial*

# 3) flash (ชื่อพอร์ตอาจเปลี่ยนจาก -0001 ต้องเช็คจากข้อ 2)
cd ~/TDG/fall_detection_backend/ESP32-CSI-Tool/active_ap
. ~/esp/esp-idf-v5.4/export.sh
idf.py -p /dev/cu.usbserial-XXXX flash

# 4) ดู boot log — console อยู่ที่ 921600 แล้ว
idf.py -p /dev/cu.usbserial-XXXX monitor
```

**สิ่งที่ควรเห็นใน boot log ถ้า firmware ถูกต้อง**

```
MODE             : production (BLE provisioning + AP/STA)
ยังไม่ได้ตั้งค่า — เปิด BLE ชื่อ "ESP-B96AB8"
เปิดแอป → สแกนอุปกรณ์ → เลือก "ESP-B96AB8"
กดปุ่ม BOOT ค้าง 5 วินาที เพื่อล้างค่า WiFi
```

`build/active-ap.bin` พร้อมอยู่แล้ว ไม่ต้อง build ใหม่ — เหลือแค่ flash

---

#### 🔴 เจอเพิ่ม: แอปของเราจับคู่ BLE ไม่ได้ในสภาพปัจจุบัน

ตรวจ `lib/provisioning.ts` กับหน้าจอที่เรียกใช้:

- `connect(name, proofOfPossession?)` → `device.connect(proofOfPossession)`
- `app/connect-device.tsx:19` อ่าน `pop` จาก `useLocalSearchParams()`
- **แต่ `grep -rn "pop" app/scan-qr.tsx app/enter-code.tsx app/scan-devices.tsx` ไม่เจออะไรเลย**

→ ไม่มีหน้าไหนส่ง `pop` มาให้ `connect-device` → `pop` เป็น `undefined` ตลอด
→ `device.connect(undefined)` จะจับคู่ไม่ผ่านกับ firmware ที่ตั้ง `WIFI_PROV_SECURITY_1`
**และจะไม่มี error ที่บอกสาเหตุชัด** ตรงตามที่ CLAUDE.md เตือนไว้เรื่อง PoP ไม่ตรงกันสองฝั่ง

**ทางทดสอบที่แยกปัญหาออกจากกัน** — ใช้แอป **ESP BLE Provisioning** ของ Espressif เอง
(iOS/Android) ซึ่งพิมพ์ PoP ได้ตรง ๆ จะได้ยืนยันว่า firmware ทำงานถูกก่อน
โดยไม่ต้องรอหน้าจอกรอก PoP ฝั่งแอปเสร็จ

PoP ที่ต้องกรอกตอนนี้: `tdg-change-me-per-device` (ค่า default — ต้องเปลี่ยนก่อนใช้จริง)

**ตรวจเพิ่ม — พบว่าต่อผ่าน USB hub**

`ls /dev/cu.usbserial*` ยังไม่เจอ ตรวจระดับ kernel:

```
ioreg -rc IOUSBHostDevice | grep -iE "USB Product Name|idVendor"

"USB Vendor Name"  = "Corechips"
"USB Product Name" = "USB2.0 HUB"
"USB Vendor Name"  = "Corechips"
"USB Product Name" = "USB3.0 HUB"
```

kernel เห็น **hub สองตัว แต่ไม่เห็นอุปกรณ์ serial เลย**
→ บอร์ดต่ออยู่ผ่าน hub/dongle ไม่ได้เสียบตรงเข้าเครื่อง

Corechips เป็นชิป hub ที่ใช้ใน dongle USB-C ทั่วไป จ่ายไฟไม่พอหรือจัดการ re-enumerate
ได้ไม่ดี ซึ่งอธิบายได้ว่าทำไม `flash_id` ผ่านแล้วพอร์ตหายหลัง `--after=hard_reset`

**→ ต้องเสียบบอร์ดตรงเข้าพอร์ตของเครื่อง ไม่ผ่าน dongle**

หมายเหตุ: `system_profiler SPUSBDataType` ใช้ตรวจเรื่องนี้บนเครื่องนี้ไม่ได้ —
คืนค่าว่างแม้ในตอนที่ `/dev/cu.usbserial-0001` มีอยู่จริง ให้ใช้ `ioreg -rc IOUSBHostDevice` แทน

### 2026-09-29 — ✅ flash สำเร็จ · boot ผ่าน · 🔴 แต่ BLE ไม่เปิดเพราะ NVS มีของเก่าค้าง

เสียบสายใหม่แล้วพอร์ตกลับมาเป็น `/dev/cu.usbserial-0001` → flash ผ่าน

```
Wrote 1229328 bytes (741024 compressed) at 0x00010000 in 17.7 seconds
Hash of data verified.
Hard resetting via RTS pin...
Done
```

**boot log ยืนยันว่าทุกอย่างที่ตั้งไว้ถูกต้อง**

```
I boot.esp32: SPI Flash Size : 4MB
I boot: ## Label        Usage         Type ST Offset   Length
I boot:  0 nvs          WiFi data       01 02 00009000 00006000
I boot:  1 phy_init     RF data         01 01 0000f000 00001000
I boot:  2 factory      factory app     00 00 00010000 00200000   ← app 2MB ✅
I app_init: Project name:     active-ap
I app_init: App version:      4f16295-dirty
I app_init: ESP-IDF:          v5.4
I efuse_init: Chip rev:       v3.1

MODE             : production (BLE provisioning + AP/STA)     ← โหมดถูก ✅
```

`partitions.csv` ทำงานจริง — app partition ได้ 0x200000 = 2MB ตามที่ตั้งใจ

---

#### 🔴 ปัญหาที่เจอ: BLE ไม่เปิดเลย

```
I wifi_prov_scheme_ble: BT memory released
I provisioning: ตั้งค่า WiFi ไว้แล้ว — ข้ามขั้นตอน BLE
I wifi_prov_scheme_ble: BTDM memory released
```

`provisioning_init()` เรียก `wifi_prov_mgr_is_provisioned()` แล้วได้ `true`
จึง `wifi_prov_mgr_deinit()` แล้ว return ทันที **ไม่เปิด BLE**

**สาเหตุ: `idf.py flash` ลบแต่ app partition ไม่ลบ NVS**

WiFi credential เก่าจาก firmware รุ่นก่อน (ที่เคยมีโหมด STA/hotspot — ดู `main.cc.save`)
ยังค้างอยู่ใน NVS ที่ `0x9000` firmware ใหม่จึงคิดว่าตั้งค่าไปแล้ว

**นี่ไม่ใช่บั๊กของโค้ด** — พฤติกรรมนี้ถูกต้องตามที่ออกแบบ (ตั้งค่าแล้วไม่ต้องเปิด BLE ซ้ำ)
แค่สภาพ NVS บนบอร์ดตัวนี้ไม่ใช่สภาพของเครื่องใหม่จากโรงงาน

**สามทางแก้ เรียงจากที่แนะนำที่สุด**

1. **กดปุ่ม BOOT ค้าง 5 วินาที** ← ทำได้เลยตอนนี้ ไม่ต้องใช้สาย ไม่ต้องใช้คอม
   เป็นฟีเจอร์ที่เขียนไว้ใน `provisioning_component.h` อยู่แล้ว
   (`prov_reset_watch_task` → `provisioning_reset()` → `esp_wifi_restore()` → `esp_restart()`)
   **ได้ทดสอบโค้ดส่วนนี้ไปด้วยในคราวเดียว** — ถ้าทำงาน บอร์ดจะ reboot แล้วเปิด BLE
2. `esptool.py -p PORT erase_region 0x9000 0x6000` — ลบเฉพาะ NVS ไม่แตะ app
3. `idf.py -p PORT erase-flash` แล้ว `idf.py flash` ใหม่ — ล้างหมดทั้งตัว ใช้เวลานานสุด

---

#### ⚠️ ไดรเวอร์พอร์ตค้างหลังอ่าน log จบ

หลังอ่าน boot log สำเร็จรอบแรกแล้วปิดพอร์ต **เปิดใหม่ไม่ได้อีก**

```
termios.error: (22, 'Invalid argument')
```

เกิดทั้งกับ pyserial และกับ `esptool.py` เอง → เป็นปัญหาระดับไดรเวอร์ ไม่ใช่วิธีเรียก
พอร์ต `/dev/cu.usbserial-0001` ยังมีอยู่ และ `lsof` ยืนยันว่าไม่มีใครถือค้าง
อาการที่เจอบ่อยกับชิป CH340 บน macOS โดยเฉพาะเมื่อต่อผ่าน hub

**แก้โดยถอดเสียบสายใหม่** (เสียบตรง ไม่ผ่าน dongle)

---

#### 📝 เรื่องเล็กที่ควรแก้: `config_print()` พูดไม่ตรงในโหมด production

```
ESP32 CSI Tool — ACTIVE_AP (Serial Mode)     ← ผิดในโหมด production
OUTPUT           : USB Serial (no UDP, no hotspot)   ← ผิด
WIFI_CHANNEL     : 6                          ← ไม่จริงในโหมด AP+STA
MODE             : production (BLE provisioning + AP/STA)   ← อันนี้ถูก
```

สามบรรทัดแรกเป็นข้อความคงที่ที่เขียนไว้ตอนยังมีแต่โหมดเก็บข้อมูล
ในโหมด production ช่องสัญญาณจะถูกเราเตอร์บ้านบังคับ ไม่ใช่ 6 (ซึ่ง main.cc คอมเมนต์ไว้เองแล้ว)
ไม่กระทบการทำงาน แต่ทำให้คนอ่าน log เข้าใจผิด

### 2026-09-29 — 🐛 เจอบั๊กตัวจริง: `sdkconfig.defaults` ไม่ได้เปิด CSI → บอร์ด reboot วนไม่จบ

หลัง flash สำเร็จ บอร์ด **reboot วนซ้ำ** ไม่หยุด อ่าน log ได้ข้อความ panic ตัวจริง:

```
E (715) wifi:CSI not enabled in menuconfig!
ESP_ERROR_CHECK failed: esp_err_t 0xffffffff (ESP_FAIL) at 0x400da004
file: "./main/../../_components/csi_component.h" line 141
func: void csi_init(char*)
expression: esp_wifi_set_csi(1)

abort() was called at PC 0x400905af on core 0
Backtrace: 0x40081c05 0x400905b9 0x4009822d 0x400905af 0x400da004 ...
Rebooting...
```

วงจรที่เกิด: boot → `AP+STA พร้อม` → `กดปุ่ม BOOT ค้าง 5 วินาที` → `csi_init()` → `abort()` → reboot → ซ้ำ
(นับได้ 16 รอบใน 12 วินาทีที่อ่าน log)

**สาเหตุ: `sdkconfig.defaults` ไม่มี `CONFIG_ESP_WIFI_CSI_ENABLED=y`**

เป็นบั๊กคลาสเดียวกับเรื่อง baudrate — ไฟล์ `sdkconfig.defaults` เขียนด้วยมือ
โดยไม่ได้เทียบกับ `sdkconfig` ที่ใช้งานได้จริง จึงขาดออปชันที่จำเป็นไปหลายตัว

**จุดที่ทำให้หลงทาง** `config_print()` พิมพ์ `COLLECT_CSI : 1` ดูเหมือนปกติ เพราะ

| ออปชัน | เป็นของ | ในตอนนั้น |
|---|---|---|
| `CONFIG_SHOULD_COLLECT_CSI` | Kconfig ของโปรเจกต์เราเอง | `y` ✅ ตั้งไว้ |
| `CONFIG_ESP_WIFI_CSI_ENABLED` | ไดรเวอร์ WiFi ของ ESP-IDF | **ไม่ได้ตั้ง** ❌ |

**สองตัวนี้คนละตัวกัน ต้องมีทั้งคู่** ตั้งแค่ตัวแรกไม่พอ — `esp_wifi_set_csi()` จะคืน `ESP_FAIL`

**หาแบบเป็นระบบ ไม่แก้ทีละตัว**

เทียบ `sdkconfig.datacollect.keep` (ใช้งานได้) กับ `sdkconfig` ใหม่ ในกลุ่ม WiFi/CSI/LWIP/WDT
ต่างกัน 83 ออปชัน แต่**เป็นเรื่องจริงแค่ 2 บรรทัด**

```
CONFIG_ESP_WIFI_CSI_ENABLED      y → not set   ⚠️
CONFIG_ESP32_WIFI_CSI_ENABLED    y → not set   ⚠️  (alias เก่าของตัวเดียวกัน ตั้งตัวใหม่พอ)
```

ที่เหลือเป็น `CONFIG_WIFI_RMT_*` กับ `CONFIG_SLAVE_SOC_*` ซึ่งมีแต่ใน v6.1
(ของ esp-wifi-remote / hosted ที่เพิ่มเข้ามาใน v6) กับ `LWIP_DHCP_OPTIONS_LEN` 69 vs 68
ซึ่งเป็น default ที่ต่างกันตามเวอร์ชัน ไม่กระทบอะไร

**แก้แล้ว** เพิ่มลง `sdkconfig.defaults` พร้อมคอมเมนต์เตือนเรื่องความสับสนของสองออปชัน

---

### 2026-09-29 — ✅✅ **BLE provisioning ทำงานบนบอร์ดจริงครั้งแรก**

```bash
rm sdkconfig && idf.py reconfigure          # regenerate จาก defaults ที่แก้แล้ว
echo 'CONFIG_ENABLE_BLE_PROVISIONING=y' >> sdkconfig && idf.py reconfigure
idf.py build                                 # ผ่าน · ขนาดเท่าเดิม 0x12c210
idf.py -p /dev/cu.usbserial-0001 erase-flash # ล้างทั้งตัวรวม NVS → แก้ปัญหา WiFi เก่าค้าง
idf.py -p /dev/cu.usbserial-0001 flash       # ผ่าน
```

**boot log**

```
MODE             : production (BLE provisioning + AP/STA)
I wifi_prov_scheme_ble: BT memory released
I provisioning: ยังไม่ได้ตั้งค่า — เปิด BLE ชื่อ "ESP-B96AB8"
I provisioning: เปิดแอป → สแกนอุปกรณ์ → เลือก "ESP-B96AB8"
I wifi:mode : sta (1c:c3:ab:b9:6a:b8)
I BTDM_INIT: BT controller compile version [20b459d]
I BTDM_INIT: Bluetooth MAC: 1c:c3:ab:b9:6a:ba
I protocomm_nimble: BLE Host Task Started
I wifi_prov_mgr: Provisioning started with service name : ESP-B96AB8
I provisioning: รอแอปเชื่อมต่อผ่าน BLE...
I NimBLE: GAP procedure initiated: advertise
I NimBLE: disc_mode=2 adv_itvl_min=256 adv_itvl_max=256
```

ตรวจแล้วไม่มี `abort()` · `Backtrace` · `Rebooting` · `CSI not enabled` เลยแม้แต่ครั้งเดียว

**สิ่งที่พิสูจน์แล้วว่าทำงาน**

| | |
|---|---|
| `partitions.csv` app 2MB | ✅ boot log ยืนยัน `00010000 00200000` |
| NimBLE (ไม่ใช่ Bluedroid) | ✅ `protocomm_nimble` · `NimBLE` |
| `provisioning_component.h` ทั้งไฟล์ | ✅ log ภาษาไทยที่เขียนไว้ออกมาถูกทุกบรรทัด |
| `main.cc` แยกสองโหมดด้วย `#ifdef` | ✅ `MODE : production` |
| device code สร้างจาก MAC | ✅ `ESP-B96AB8` จาก MAC `...b9:6a:b8` |
| `FREE_BTDM` handler | ✅ `BT memory released` |
| flash 4MB | ✅ |

**ยังไม่ได้ทดสอบ**
- ปุ่ม BOOT ค้าง 5 วินาที — ตอนที่กดทดสอบ บอร์ดอยู่ในภาวะ reboot วน
  `prov_reset_watch_task` จึงไม่มีโอกาสรัน **ต้องทดสอบใหม่**
- การจับคู่จริง ต้องมีฝั่งแอป
- CSI จะออกมาหลัง provisioning เสร็จ (`csi_init()` ถูกเรียกหลัง `provisioning_init()` return)

---

## บทเรียนจากรอบนี้

**`sdkconfig.defaults` ที่เขียนด้วยมือเชื่อไม่ได้** — พลาดไปสองออปชันที่จำเป็น
(baudrate กับ CSI) และทั้งสองครั้งไม่มี warning เตือนเลย ตัวที่สองทำให้บอร์ด reboot วนไม่จบ

**วิธีที่ถูกคือ `idf.py save-defconfig`** ซึ่งสร้างไฟล์จาก `sdkconfig` ที่ใช้งานได้จริง
ไม่ใช่เขียนเอาจากความจำ — ควรทำหลังจากนี้เพื่อไม่ให้เกิดซ้ำ

**`config_print()` ทำให้เข้าใจผิดได้** — พิมพ์ `COLLECT_CSI : 1` จากออปชันของโปรเจกต์
ทั้งที่ออปชันของไดรเวอร์ยังปิดอยู่ ถ้าจะให้มีประโยชน์ตอนดีบัก ควรพิมพ์ค่าที่มีผลจริง

### 2026-09-29 — ↩️ กลับโหมดเก็บข้อมูล (จบรอบนี้)

หยุดงาน BLE ไว้ตรงนี้ กลับบอร์ดเป็นโหมดเก็บข้อมูลตามที่ผู้ใช้สั่ง

**สร้าง `sdkconfig.datacollect.defaults` ขึ้นใหม่** — แก้ช่องว่างที่จดไว้ก่อนหน้าว่า
ค่าตั้งโหมดเก็บข้อมูลมีอยู่แค่ในไฟล์ `sdkconfig` บนเครื่องเดียวซึ่ง git ไม่ติดตาม

ค่าทุกตัวคัดมาจาก `sdkconfig.datacollect.keep` (ของที่ใช้เก็บ dataset จริง) โดยตรวจเทียบแล้ว:

```
CONFIG_ESP_CONSOLE_UART_CUSTOM=y / _NUM_0=y / BAUDRATE=921600 / MONITOR_BAUD=921600
CONFIG_ESP_WIFI_CSI_ENABLED=y          ← ออปชันไดรเวอร์ WiFi
CONFIG_SHOULD_COLLECT_CSI=y            ← ออปชันของโปรเจกต์
CONFIG_SHOULD_COLLECT_ONLY_LLTF=y
CONFIG_SEND_CSI_TO_SERIAL=y
CONFIG_WIFI_CHANNEL=6
CONFIG_ESP_WIFI_SSID="myssid" / PASSWORD="mypassword"
# CONFIG_ENABLE_BLE_PROVISIONING is not set
CONFIG_BT_ENABLED=n                    ← ปิด BT คืน RAM ให้ CSI
CONFIG_ESPTOOLPY_FLASHSIZE_4MB=y + partitions.csv
```

**หมายเหตุ: ไม่ได้ใช้ `sdkconfig.datacollect.keep` ตรง ๆ** เพราะไฟล์นั้นถูกสร้างโดย v6.1-dev
ถ้าเอา `idf.py` ของ v5.4 ไปอ่านจะเกิดการ migrate ค่าแล้วได้ผลที่เชื่อไม่ได้
จึงสร้างไฟล์ defaults ขึ้นใหม่แล้วให้ v5.4 generate `sdkconfig` เองจากศูนย์

**build + flash**

```bash
rm sdkconfig
idf.py -D SDKCONFIG_DEFAULTS="sdkconfig.datacollect.defaults" reconfigure
idf.py build                                  # 0xe7fe0 = 950,240 bytes ≈ 928 KB
idf.py -p /dev/cu.usbserial-0001 flash        # ผ่าน hash verified
```

ขนาดลดจาก 1,200 KB → **928 KB** เพราะ BT ถูกปิด
**ตรงกับที่ CLAUDE.md บันทึกไว้ว่า "firmware ปัจจุบัน 924 KB" เกือบเป๊ะ** — ยืนยันว่ากลับมาเป็นโหมดเดิมจริง
เหลือที่บน partition 55%

**boot log ยืนยัน**

```
WIFI_CHANNEL     : 6
AP SSID          : myssid
OUTPUT           : USB Serial (no UDP, no hotspot)
COLLECT_CSI      : 1   ONLY_LLTF : 1   CSI_TO_SERIAL : 1
MODE             : data collection (AP only, fixed channel)
I wifi:mode : softAP (1c:c3:ab:b9:6a:b9)
I Active CSI collection (AP): AP started: myssid @ channel 6
I Active CSI collection (AP): Ready! CSI → USB Serial
```

ตรวจแล้ว `abort()` 0 · `Rebooting` 0 · `CSI not enabled` 0 · `BLE` 0
อ่าน log ได้ที่ 921600 → baudrate ถูกต้อง พร้อมให้ `csi_collector_serial.py` ต่อได้เลย

**ยังไม่มีข้อมูล CSI จริง** — เห็น `CSI_DATA` แค่ 1 บรรทัดซึ่งเป็นหัวตาราง CSV
(`type,role,mac,rssi,rate,sig_mode,...`) ที่ `csi_init()` พิมพ์ครั้งเดียว
เพราะ **ESP32 #2 (active_sta) ยังไม่ได้เปิด** ไม่มี packet ให้วัด
(log ไม่มี event `STA joined AP, AID=`) — เสียบตัวที่สองเข้าไฟแล้วข้อมูลจะไหลทันที
ไม่ใช่ความผิดปกติ

---

## สลับโหมดไปมาต่อจากนี้

```bash
. ~/esp/esp-idf-v5.4/export.sh

# → โหมดเก็บข้อมูล
rm sdkconfig
idf.py -D SDKCONFIG_DEFAULTS="sdkconfig.datacollect.defaults" reconfigure
idf.py build && idf.py -p /dev/cu.usbserial-XXXX flash

# → โหมด production (BLE)
rm sdkconfig
idf.py reconfigure                       # อ่าน sdkconfig.defaults
echo 'CONFIG_ENABLE_BLE_PROVISIONING=y' >> sdkconfig
idf.py reconfigure
idf.py build && idf.py -p /dev/cu.usbserial-XXXX flash
# ถ้าเคยจับคู่ WiFi ไว้แล้วจะข้าม BLE — ต้อง erase-flash ก่อน หรือกด BOOT ค้าง 5 วิ
```

`sdkconfig` ไม่ได้อยู่ใน git — ไฟล์ที่เป็นแหล่งความจริงคือสอง `*.defaults` ข้างบน

### 2026-09-29 — active_sta (ESP32 #2) กลับโหมดเก็บข้อมูล — build เสร็จ รอ flash

`active_ap` เสร็จไปแล้ว (ดูรายการก่อนหน้า) รอบนี้ทำ `active_sta`

**สภาพที่พบ**

- `sdkconfig` สร้างด้วย **IDF 6.1.0** → ต้อง regenerate ด้วย v5.4 เหมือนกัน
- **ไม่มี `sdkconfig.defaults` เลย** และ `git ls-files` ยืนยันว่า git ติดตามแค่
  `CMakeLists.txt` · `README.md` · `main/CMakeLists.txt` · `main/Kconfig.projbuild`
  · `main/component.mk` · `main/main.cc` — **ไม่มี sdkconfig**
  ค่าตั้งของบอร์ดตัวที่สองก็มีอยู่แค่บนเครื่องนี้เครื่องเดียวเหมือนกัน

**⚠️ เจอความเสี่ยงเดียวกับที่ทำให้ active_ap reboot วน**

`active_sta/main/main.cc:176` เรียก `csi_init((char *) "STA")` ด้วย
ซึ่งข้างในเรียก `esp_wifi_set_csi(1)` → **ตัวนี้ก็ต้องมี `CONFIG_ESP_WIFI_CSI_ENABLED=y`**
ถ้าสร้าง sdkconfig ใหม่โดยไม่ตั้งค่านี้ จะ `abort()` แล้ว reboot วนไม่จบเหมือนกัน
แม้ active_sta จะไม่ได้ส่ง CSI ออก serial ก็ตาม

**สร้าง `active_sta/sdkconfig.defaults`** (ใหม่) + สำรองของเดิมเป็น `sdkconfig.datacollect.keep`

```
CONFIG_ESP_WIFI_CSI_ENABLED=y     ← กัน reboot loop
CONFIG_SHOULD_COLLECT_CSI=y
CONFIG_WIFI_CHANNEL=6             ┐
CONFIG_ESP_WIFI_SSID="myssid"     ├ สามค่านี้ต้องตรงกับ active_ap เป๊ะ ไม่งั้นเกาะไม่ติด
CONFIG_ESP_WIFI_PASSWORD="mypassword" ┘
CONFIG_PACKET_RATE=100            ← อัตราจริงที่วัดได้ ~73 pkt/s
CONFIG_BT_ENABLED=n
```

**console ของ active_sta เป็น 115200 ไม่ใช่ 921600 — และนั่นถูกต้อง**
ตัวนี้ไม่ได้ส่ง CSI ออก serial ใช้ console ดู boot log ตัวเองเท่านั้น
คนละค่ากับ `active_ap` ที่ต้อง 921600 ให้ `csi_collector_serial.py` อ่านได้
จึงไม่ได้ใส่ค่า console ลง defaults ปล่อยให้เป็น default ของ IDF

**build ผ่าน**

```
active-sta.bin  0xea030 = 958,512 bytes ≈ 936 KB
app partition   0x100000 = 1,048,576 bytes  (single-app 1MB ตามของเดิม)
เหลือว่าง       0x15fd0  =  89,552 bytes (9%)   ← ตึงแต่พอ
```

ไม่ได้เปลี่ยน partition/flash ของ active_sta (ยังเป็น single-app 1MB, flash 2MB ตามเดิม)
เพราะยังไม่รู้ขนาด flash จริงของบอร์ดตัวที่สอง และ firmware ไม่มี BT จึงพอดีอยู่แล้ว

**🔲 ยังไม่ได้ flash** — ตรวจ MAC ของบอร์ดที่เสียบอยู่แล้วได้ `1c:c3:ab:b9:6a:b8`
ซึ่งเป็น **บอร์ด AP** ตัวเดิม (flash 4MB) ไม่ใช่ตัวที่สอง
จึงไม่ flash เพื่อไม่ให้เขียน firmware ของ STA ทับบอร์ด AP

**วิธีระบุบอร์ดต่อจากนี้** — ทั้งสองตัวใช้ชิป CH340 พอร์ตจะชื่อ `usbserial-0001` เหมือนกัน
แยกด้วย MAC เท่านั้น

| บอร์ด | MAC | flash |
|---|---|---|
| ESP32 #1 `active_ap` | `1c:c3:ab:b9:6a:b8` | 4MB |
| ESP32 #2 `active_sta` | ยังไม่ทราบ | ยังไม่ทราบ |

**ขั้นตอนเมื่อเสียบ ESP32 #2**

```bash
cd ~/TDG/fall_detection_backend/ESP32-CSI-Tool/active_sta
. ~/esp/esp-idf-v5.4/export.sh
esptool.py -p /dev/cu.usbserial-XXXX flash_id     # ยืนยันว่า MAC ไม่ใช่ ...b9:6a:b8
idf.py -p /dev/cu.usbserial-XXXX flash
```

### 2026-09-29 — ✅ active_sta flash เสร็จ — ทั้งสองบอร์ดกลับโหมดเก็บข้อมูลครบ

ยืนยันบอร์ดด้วย MAC ก่อน flash: `1c:c3:ab:b9:78:cc` ≠ `1c:c3:ab:b9:6a:b8` → เป็น ESP32 #2 จริง
flash 4MB (ตัวที่สองก็ 4MB เหมือนกัน)

**flash ผ่าน** hash verified · **boot log ยืนยัน** (อ่านที่ 115200)

```
PROJECT_NAME: ACTIVE_STA
ESP_WIFI_SSID: myssid
PACKET_RATE: 100
I wifi:mode : sta (1c:c3:ab:b9:78:cc)
I Active CSI collection (Station): connect to ap SSID:myssid password:mypassword
wifi not connected. waiting...
```

ตรวจแล้ว `abort()` 0 · `Rebooting` 0 · `CSI not enabled` 0 · `Guru Meditation` 0

**การใส่ `CONFIG_ESP_WIFI_CSI_ENABLED=y` ลง `active_sta/sdkconfig.defaults` กันปัญหาได้จริง** —
ถ้าไม่ใส่ บอร์ดตัวที่สองจะ `abort()` ที่ `csi_init("STA")` แล้ว reboot วนแบบเดียวกับที่ AP เจอ
เจอล่วงหน้าจากการอ่านโค้ด ไม่ต้องเสียเวลาไล่บั๊กซ้ำ

`wifi not connected. waiting...` **เป็นเรื่องปกติ** — ESP32 #1 ไม่ได้เสียบไฟอยู่ตอนนั้น
(สาย USB ย้ายมาที่ตัว STA) ไม่มี AP `myssid` ให้เกาะ

---

## ตารางบอร์ด

| บอร์ด | โปรเจกต์ | MAC | flash | firmware |
|---|---|---|---|---|
| ESP32 #1 | `active_ap` | `1c:c3:ab:b9:6a:b8` | 4MB | เก็บข้อมูล · 928 KB · console 921600 |
| ESP32 #2 | `active_sta` | `1c:c3:ab:b9:78:cc` | 4MB | เก็บข้อมูล · 936 KB · console 115200 |

ทั้งสองใช้ชิป CH340 พอร์ตขึ้นเป็น `usbserial-0001` เหมือนกันทั้งคู่ — **แยกด้วย MAC เท่านั้น**
เช็คด้วย `esptool.py -p /dev/cu.usbserial-XXXX flash_id` ก่อน flash ทุกครั้ง

⚠️ `active_sta` เหลือที่บน app partition แค่ **9%** (936 KB บน 1MB) — ยังพอ แต่ถ้าเพิ่มโค้ดอีก
จะไม่พอ ถ้าถึงตอนนั้นให้เปลี่ยนเป็น flash 4MB + `partitions.csv` แบบเดียวกับ `active_ap`
(บอร์ดตัวที่สองมี flash 4MB รองรับอยู่แล้ว)

---

## วิธีเริ่มเก็บข้อมูล

```bash
# 1) เสียบ ESP32 #1 (active_ap · MAC ...6a:b8) เข้าคอมด้วย USB — ต้องต่อคอมเพราะส่ง CSI ออก serial
# 2) เสียบ ESP32 #2 (active_sta · MAC ...78:cc) เข้าไฟที่ไหนก็ได้ ไม่ต้องต่อคอม
# 3) ยืนยันว่าเกาะกันติดแล้ว
cd ~/TDG/fall_detection_backend/ml_service
python data_collection/esp_checker.py
# 4) เก็บข้อมูล — กด 's' เลือกโหมด session สลับคลาส
python data_collection/csi_collector_serial.py
```

สัญญาณว่าเกาะกันติด: ฝั่ง AP จะขึ้น `STA joined AP, AID=1`
และฝั่ง STA จะหยุดพิมพ์ `wifi not connected. waiting...`

## ไฟล์ config ที่เป็นแหล่งความจริงตอนนี้

| ไฟล์ | ใช้ทำอะไร | อยู่ใน git |
|---|---|:---:|
| `active_ap/sdkconfig.defaults` | โหมด production (BLE) · แก้ 2 บั๊กแล้ว | ✅ |
| `active_ap/sdkconfig.datacollect.defaults` | โหมดเก็บข้อมูล ของ AP | 🔲 ใหม่ ยังไม่ commit |
| `active_sta/sdkconfig.defaults` | ของ STA (มีโหมดเดียว) | 🔲 ใหม่ ยังไม่ commit |
| `*/sdkconfig` | ไฟล์ที่ idf.py สร้าง | ❌ git ไม่ติดตาม |
| `*/sdkconfig.datacollect.keep` | สำเนาของ v6.1 เดิม เก็บอ้างอิง | ❌ |

### 2026-09-29 — เปลี่ยนโหมดเก็บข้อมูลเป็น UDP (build เสร็จ รอ flash)

ผู้ใช้ขอเปลี่ยนจากส่ง CSI ผ่านสาย USB เป็นผ่าน UDP เพื่อไม่ต้องเสียบบอร์ดกับแมค

**ไม่ต้องเขียนโค้ดใหม่เลย ทั้งสองฝั่งพร้อมอยู่แล้ว**

ฝั่ง firmware — `_components/csi_component.h`
```
บรรทัด 33   udp_init()        สร้าง socket + เปิด SO_BROADCAST
บรรทัด 66   send_udp()        sendto() ไป UDP_TARGET_IP:5500
บรรทัด 124  #ifdef CONFIG_SEND_CSI_TO_UDP → send_udp(...)
บรรทัด 21   UDP_TARGET_PORT 5500
ค่าเริ่มต้นปลายทาง 192.168.4.255 (broadcast ของซับเน็ต softAP)
```

ฝั่ง Python — **`csi_collector_serial.py` รองรับ UDP อยู่แล้ว**
```
บรรทัด 12   CSI_TRANSPORT=udp python data_collection/csi_collector_serial.py
บรรทัด 35   TRANSPORT = os.environ.get("CSI_TRANSPORT", "serial")
บรรทัด 46   UDP_PORT = 5500      ← ตรงกับ firmware
บรรทัด 191  คลาสอ่าน UDP
บรรทัด 298  branch เลือกทางรับข้อมูล
```

**⚠️ ห้ามใช้ `csi_collector.py`** — เป็นตัวเก่า (22 เม.ย.) `grep -c "session"` ได้ **0**
เทียบกับ `csi_collector_serial.py` ที่ได้ **28** → ตัวเก่าไม่มีโหมด session สลับคลาส
ใช้ตัวนั้นจะกลับไปสร้าง session confound ที่ทำให้ dataset ชุดแรกใช้ไม่ได้
ชื่อไฟล์ทำให้เข้าใจผิดว่า "serial" ใช้ได้แค่ serial — จริง ๆ มันทำได้ทั้งสองทาง

**สร้าง `active_ap/sdkconfig.datacollect_udp.defaults`** — ต่างจากตัว serial แค่สามบรรทัด

```
CONFIG_SEND_CSI_TO_UDP=y
CONFIG_CSI_UDP_TARGET_IP="192.168.4.255"
# CONFIG_SEND_CSI_TO_SERIAL is not set      ← ปิด ไม่ให้ UART เป็นคอขวด
```

คง `CONFIG_ESP_CONSOLE_UART_BAUDRATE=921600` ไว้ เพราะ boot log ยังออก serial ปกติ
(ปิดแค่การส่ง CSI ออก serial ไม่ได้ปิด console)

**build ผ่าน** `0xea100` = 958,720 bytes ≈ 936 KB · เหลือที่บน partition 54%

**🔲 ยังไม่ได้ flash** — บอร์ดที่เสียบอยู่คือ ESP32 #2 (MAC `...78:cc`) ต้องสลับไป ESP32 #1

**`active_sta` ไม่ต้องแก้อะไร** — มันแค่ยิง packet ให้ AP วัด ไม่เกี่ยวกับวิธีที่ AP ส่งข้อมูลออก

---

#### ⚠️ ข้อแลกเปลี่ยนของโหมด UDP — UDP ไม่ได้ตัดแมคออกจากสมการ

แมคต้องเกาะ WiFi `myssid` ที่ ESP32 ปล่อย เพื่อรับ UDP broadcast ผลคือ

1. **แมคเสียการเชื่อมต่ออินเทอร์เน็ต**ตลอดที่เก็บข้อมูล
2. **แมคกลายเป็นแหล่งสัญญาณเพิ่มบนช่อง 6** ช่องเดียวกับที่วัด CSI
   → ต้องวางห่างจากบริเวณที่ทำท่า และ **ห้ามขยับตลอด session**
3. ESP32 #1 ยังต้องมีไฟจาก USB adapter (แค่ไม่ต้องเป็นคอม)

**ที่ได้คือไม่ต้องมีสายยาวถึงแมค ไม่ใช่ไม่ต้องมีแมค**
(ข้อ 1-2 เป็นคำเตือนที่ Kconfig ของโปรเจกต์เขียนไว้เองตั้งแต่ตอนเพิ่มออปชันนี้)

#### ⚠️ จุดต้องสงสัยถ้าเจอปัญหาระหว่างเก็บข้อมูล

`send_udp()` ถูกเรียกจากใน `_wifi_csi_cb()` (บรรทัด 72) ซึ่งเป็น callback ของไดรเวอร์ WiFi
โดยตรง และถือ mutex แบบ `portMAX_DELAY` ก่อนเรียก `sendto()`

การเรียก socket แบบ blocking ในคอนเท็กซ์ callback ของ WiFi ทำให้อาจ drop CSI
หรือโดน watchdog ได้ถ้าโหลดสูง — เป็นดีไซน์ของ ESP32-CSI-Tool ต้นทาง ไม่ใช่ของเรา
และโปรเจกต์นี้เคยใช้โหมด UDP มาก่อน จึงไม่บล็อกการใช้งาน
แต่ **ถ้าเจอ packet หายเยอะกว่าเดิมหรือบอร์ดค้าง ให้สงสัยจุดนี้ก่อน**
(อัตราจริงเคยวัดได้ ~73 pkt/s จากที่ตั้ง 100 อยู่แล้วในโหมด serial)

---

## สามโหมดที่สลับได้ตอนนี้ (active_ap)

```bash
. ~/esp/esp-idf-v5.4/export.sh
cd ~/TDG/fall_detection_backend/ESP32-CSI-Tool/active_ap
rm sdkconfig

# 1) เก็บข้อมูล ผ่าน USB Serial
idf.py -D SDKCONFIG_DEFAULTS="sdkconfig.datacollect.defaults" reconfigure

# 2) เก็บข้อมูล ผ่าน UDP  ← ที่เพิ่งสร้าง
idf.py -D SDKCONFIG_DEFAULTS="sdkconfig.datacollect_udp.defaults" reconfigure

# 3) production (BLE provisioning)
idf.py reconfigure && echo 'CONFIG_ENABLE_BLE_PROVISIONING=y' >> sdkconfig && idf.py reconfigure

# แล้วทุกโหมด
idf.py build && idf.py -p /dev/cu.usbserial-XXXX flash
```

### 2026-09-29 — ✅ flash โหมด UDP ลง ESP32 #1 แล้ว + แก้ log ที่พูดไม่ตรง

ยืนยัน MAC `1c:c3:ab:b9:6a:b8` = ตัว AP ก่อน flash · flash ผ่าน hash verified

**ตรวจครั้งแรกพบว่าทำงานถูก แต่ log โกหก**

```
CSI_TO_SERIAL    : 0                              ← ถูก
CSI_DATA ทาง serial 0 บรรทัด                       ← ถูก CSI ไม่ออก serial แล้ว
DHCP server started ... IP: 192.168.4.1           ← ถูก พร้อมให้แมคเกาะ

OUTPUT           : USB Serial (no UDP, no hotspot)   ← ❌ โกหก
Ready! CSI → USB Serial                              ← ❌ โกหก
ESP32 CSI Tool — ACTIVE_AP (Serial Mode)             ← ❌ ไม่จริงอีกแล้ว
```

สามบรรทัดนี้เป็นสตริงคงที่ที่เขียนไว้ตอนโปรเจกต์มีแต่โหมด serial
ไม่กระทบการทำงาน แต่**ทำให้คนที่ไล่ปัญหาตอนเก็บข้อมูลเข้าใจผิดว่าข้อมูลออกทาง serial**
ซึ่งอันตรายกว่าเรื่องความสวยงาม เพราะจะไปหาสาเหตุผิดที่

**แก้ `active_ap/main/main.cc` 5 จุด**

| จุด | เดิม | ใหม่ |
|---|---|---|
| `#define` | มีแต่ `SEND_CSI_TO_SERIAL` | + `SEND_CSI_TO_UDP` · `CSI_UDP_TARGET_IP_STR` |
| หัวเรื่อง | `ACTIVE_AP (Serial Mode)` | `ACTIVE_AP` |
| `OUTPUT` | ข้อความคงที่ | `#if` เลือกตามที่ตั้งจริง + พิมพ์ IP:port หรือ baud |
| `Ready!` | ข้อความคงที่ | `#if` + เตือนว่าคอมต้องเกาะ SSID ไหน · มี `#else` เตือนถ้าไม่ได้เปิดทางส่งเลย |
| `config_print` | มีแต่ `CSI_TO_SERIAL` | + บรรทัด `CSI_TO_UDP` |

build ผ่าน `0xea150` ≈ 936 KB (เหลือ 54%) · flash แล้ว · **ยืนยันด้วย log จริง**

```
ESP32 CSI Tool — ACTIVE_AP
WIFI_CHANNEL     : 6
AP SSID          : myssid
OUTPUT           : UDP 192.168.4.255:5500
COLLECT_CSI      : 1
ONLY_LLTF        : 1
CSI_TO_SERIAL    : 0
CSI_TO_UDP       : 1
CSI_TO_SD        : 0
MODE             : data collection (AP only, fixed channel)
I Active CSI collection (AP): AP started: myssid @ channel 6
I Active CSI collection (AP): Ready! CSI → UDP 192.168.4.255:5500 (คอมต้องเกาะ "myssid" เพื่อรับ)
I esp_netif_lwip: DHCP server started on interface WIFI_AP_DEF with IP: 192.168.4.1
```

โค้ดที่แก้รองรับทั้งสามโหมด — สลับ config แล้ว log จะเปลี่ยนตามเอง ไม่ต้องแก้โค้ดซ้ำ
และถ้าเผลอปิดทั้ง `SEND_CSI_TO_SERIAL` กับ `SEND_CSI_TO_UDP` จะขึ้น `ESP_LOGW` เตือน
ไม่เงียบหายเหมือนก่อน

---

## 🔲 เหลือขั้นที่ต้องทำเองเพื่อเริ่มเก็บข้อมูล

```bash
# 1) เปิดไฟ ESP32 #2 (MAC ...78:cc) — ตอนนี้ยังไม่ได้เสียบไฟ เพราะสายอยู่ที่ตัว #1
#    เสียบ USB adapter ที่ไหนก็ได้ ไม่ต้องต่อคอม

# 2) ESP32 #1 (MAC ...6a:b8) เสียบไฟ วางที่ไหนก็ได้ในระยะ WiFi

# 3) ให้แมคเกาะ WiFi ที่ ESP32 #1 ปล่อย   ← ทำเองในหน้า WiFi
#    SSID: myssid   รหัส: mypassword
#    แมคจะได้ IP 192.168.4.x จาก DHCP ของ ESP32 และ **เสียเน็ตระหว่างนี้**

# 4) เก็บข้อมูล — สคริปต์ตัวเดิม เปลี่ยนแค่ตัวแปรสภาพแวดล้อม
cd ~/TDG/fall_detection_backend/ml_service
CSI_TRANSPORT=udp python data_collection/csi_collector_serial.py
#   กด 's' = โหมด session สลับคลาส
```

**สัญญาณว่าพร้อมจริง** ฝั่ง AP ขึ้น `STA joined AP, AID=` สองครั้ง
(ครั้งหนึ่งจาก ESP32 #2 อีกครั้งจากแมค) · สคริปต์ขึ้น `รอ CSI ทาง UDP :5500` แล้วเริ่มนับ packet

**⚠️ ย้ำเรื่องตำแหน่งแมค** ในโหมดนี้แมคเป็นแหล่งสัญญาณบนช่อง 6 ด้วย
วางให้ห่างจากบริเวณที่ทำท่า และห้ามขยับตลอด session เดียวกัน
ไม่งั้นจะได้ confound แบบใหม่มาแทน confound เดิมที่กำลังแก้

### 2026-09-29 — เรื่องความร้อนของ ESP32 #1 · ตัดสินใจ: ฮีตซิงก์ + อุ่นบอร์ด ไม่แก้โค้ด

**อาการ** ESP32 #1 ร้อนขึ้นชัดเจนหลังเปลี่ยนเป็นโหมด UDP

**วินิจฉัย** ผู้ใช้ยืนยันว่าร้อนที่ **ฝาเหล็กของโมดูล** ไม่ใช่แถวพอร์ต USB
→ เป็นชิป/วิทยุ **ไม่ใช่ LDO** → การจ่ายไฟปกติ ไม่มีปัญหา regulator

**สาเหตุ** โหมด serial เดิม บอร์ดแทบไม่ส่งอะไรออกอากาศ (แค่ beacon + ACK)
ข้อมูลออกทางสาย USB ซึ่งไม่ใช้วิทยุเลย

โหมด UDP ทุก CSI sample กลายเป็น WiFi packet ที่ต้องส่งออกอากาศ
```
CSI_RAW=1 + ONLY_LLTF → 128 ไบต์ พิมพ์เป็นตัวเลขคั่นเว้นวรรค
≈ 750 ไบต์/packet × ~73 packet/วินาที ≈ 55 KB/s ส่งไม่หยุด
```
TX เป็นตัวกินไฟหลักของ ESP32 (พีค ~250mA เทียบกับ RX ~100mA)

ตรวจเพิ่ม: `CONFIG_ESP_PHY_MAX_WIFI_TX_POWER=20` → **กำลังส่งอยู่ค่าสูงสุด 20 dBm (100 mW)**
และไม่มี `esp_wifi_set_max_tx_power()` ที่ runtime เลย

`WIFI_PS_NONE` มีส่วนด้วยแต่**ไม่ใช่ของใหม่** — ตั้งไว้ตั้งแต่โหมด serial และปิดไม่ได้
เพราะ CSI จะขาดช่วง

**สิ่งที่สำคัญกว่าความร้อนเอง** ESP32 รับได้ถึง 85°C ความร้อนระดับนี้ปกติสำหรับ TX ต่อเนื่อง
เรื่องที่กระทบงานจริงคือ **CSI ดริฟต์ตามอุณหภูมิ** — ถ้าบอร์ดเย็นตอนเริ่มแล้วร้อนขึ้นเรื่อย ๆ
ค่าช่วงต้นกับช่วงท้าย session จะต่างกัน = คอนฟาวด์แบบเดียวกับที่ทำให้ dataset ชุดแรกใช้ไม่ได้
แค่เปลี่ยนจาก "สภาพห้อง" เป็น "อุณหภูมิบอร์ด"

โหมด session สลับคลาสกันเรื่องนี้ไว้อยู่แล้วบางส่วน (คลาสกระจายทั่วช่วงเวลาเท่ากัน
ดริฟต์จึงกระทบทั้งคู่เท่ากัน) แต่ไม่ควรพึ่งอย่างเดียว

**ตัดสินใจ: ไม่แก้โค้ด** ใช้ฮีตซิงก์ติดฝาเหล็ก + อุ่นบอร์ด 10-15 นาทีก่อนเก็บทุกครั้ง

**ทางเลือกที่ยังไม่ใช้ (เก็บไว้เผื่อยังร้อนเกิน)**
ลดกำลังส่งเป็น 15 dBm — `esp_wifi_set_max_tx_power(60)` ใน `softap_init()`
(หน่วยเป็น 0.25 dBm → 60 = 15 dBm · 20→15 dBm = 100→32 mW)
**ไม่กระทบคุณภาพ CSI** เพราะ CSI วัดจากสัญญาณที่ #1 *รับ* มาจาก #2 ไม่ใช่จากที่ #1 ส่ง
กำลังส่งของ #1 มีผลแค่กับ UDP packet · beacon · ACK ที่มันส่งออกไป
**ความเสี่ยง** ถ้าลดมากแล้วคอมอยู่ไกล UDP จะหาย และ #2 อาจไม่ได้ ACK แล้วส่งซ้ำ
ซึ่งเปลี่ยนรูปแบบ traffic ที่เราวัด — ต้องเทียบอัตรา packet ก่อน/หลังถ้าจะทำ

**อัปเดต `collect_runbook.md`** 3 จุด

1. **ลบข้อความที่ไม่จริงแล้ว** — เดิมเขียนว่า *"เครื่องที่เขียนโค้ดไม่มี ESP-IDF —
   ต้องมีคนช่วย build/flash ก่อน"* และสั่งให้เปิด `idf.py menuconfig` เอง
   → แทนด้วยความจริง: ESP-IDF v5.4 ติดตั้งแล้ว · UDP flash ไว้แล้ว ไม่ต้องทำอะไร
   · ถ้าสลับโหมดให้ใช้ไฟล์ `*.defaults` **ห้ามใช้ menuconfig** (กันพลาดออปชันจำเป็นซ้ำ)
   · เพิ่มวิธีแยกบอร์ดสองตัวด้วย MAC
2. **เพิ่มใน checklist ก่อนเริ่ม** — อุ่นบอร์ด 10-15 นาที · ติดฮีตซิงก์
   พร้อมหัวข้ออธิบายว่าทำไม (เรื่อง CSI ดริฟต์) และบันทึกทางเลือกลดกำลังส่งไว้
3. **หัวข้อ "ห้ามตลอด session"** — เพิ่มว่าถอดปลั๊กแล้วต้องอุ่นใหม่ 10-15 นาที

### 2026-10-13 — ↩️ กลับโหมด USB Serial (ยกเลิกโหมด UDP)

**เหตุผล** โหมด UDP บังคับให้แมคเกาะ AP ของ ESP32 จึงใช้เน็ตไม่ได้ระหว่างเก็บข้อมูล
ทางแก้ต้องมี interface ที่สองให้แมค (USB tethering หรือ Ethernet dongle)
ผู้ใช้เลือกไม่เพิ่มอุปกรณ์ → กลับไปใช้สาย USB ซึ่งแมคยังเกาะ WiFi บ้านได้ปกติ

**บันทึกไว้ว่าทำไมไม่ใช้ทางที่ดูง่ายกว่า** — ให้ ESP32 #1 ต่อ WiFi บ้านแล้วทำ bridge
**ทำไม่ได้** เพราะ ESP32 มีวิทยุชุดเดียว ในโหมด AP+STA ช่องของ AP ถูกบังคับให้ตามเราเตอร์บ้าน
`WIFI_CHANNEL=6` จะไม่มีผล → ข้อมูลใหม่เทียบกับของเก่าไม่ได้
(คอมเมนต์ใน `main.cc` เตือนเรื่องนี้ไว้เองแล้ว · CLAUDE.md ระบุว่า dataset เก็บบนช่อง 6 คงที่)

และถ้าจะ tether ต้องเป็น **USB tethering ไม่ใช่ WiFi hotspot** — hotspot จะเพิ่มสัญญาณ
2.4GHz ในห้องมากวน CSI ส่วน Ethernet dongle สะอาดสุดเพราะไม่เพิ่มคลื่นเลย
(เก็บไว้เป็นทางเลือกถ้าวันหลังอยากได้ทั้งสองอย่าง)

**build เสร็จ รอ flash**

```bash
rm sdkconfig
idf.py -D SDKCONFIG_DEFAULTS="sdkconfig.datacollect.defaults" reconfigure
idf.py build
```

| config | ค่า |
|---|---|
| `CONFIG_SEND_CSI_TO_SERIAL` | `y` |
| `CONFIG_SEND_CSI_TO_UDP` | not set |
| `CONFIG_ESP_WIFI_CSI_ENABLED` | `y` |
| `CONFIG_ESP_CONSOLE_UART_BAUDRATE` | `921600` |
| `CONFIG_WIFI_CHANNEL` | `6` |
| `CONFIG_ENABLE_BLE_PROVISIONING` | not set |

`active-ap.bin` `0xe7ff0` ≈ 928 KB · เหลือที่ 55%

**🔲 ยังไม่ได้ flash** — ไม่มีบอร์ดเสียบอยู่ (`/dev/cu.usbserial*` ไม่มี)
เสียบ ESP32 #1 (MAC `...6a:b8`) แล้วรัน:

```bash
. ~/esp/esp-idf-v5.4/export.sh
cd ~/TDG/fall_detection_backend/ESP32-CSI-Tool/active_ap
esptool.py -p /dev/cu.usbserial-XXXX flash_id    # ยืนยัน MAC = ...6a:b8
idf.py -p /dev/cu.usbserial-XXXX flash
```

ควรเห็นใน boot log หลัง flash (ทดสอบว่าโค้ด log ที่แก้ไว้ทำงานข้ามโหมด):
```
OUTPUT           : USB Serial @ 921600 baud
CSI_TO_SERIAL    : 1
CSI_TO_UDP       : 0
Ready! CSI → USB Serial
```

**เรื่องความร้อนหายไปเองด้วย** — โหมด serial วิทยุไม่ต้องส่ง UDP ออกอากาศ
กลับไปเป็น "รับเป็นหลัก" เหมือนเดิม ความร้อนจึงลดลงมาก
แต่ **ยังควรอุ่นบอร์ด 10-15 นาทีก่อนเก็บ** อยู่ เพราะ CSI ดริฟต์ตามอุณหภูมิไม่ว่าโหมดไหน

---

### 2026-11-11 — ↩️ กลับมาใช้ UDP + แก้บั๊กอัตรา CSI สองตัว (73 → 100 pkt/s)

**เน็ตของแมค** แก้ด้วย iPhone ทางสาย USB (ปิด Wi-Fi ของ iPhone · iPhone USB อยู่เหนือ Wi-Fi ใน Service Order ·
ปิด "Disable unless needed" · ปิด Internet Sharing ของแมค) · แมคเกาะ `myssid` ไม่ติดตอนแรก =
`reason 15` จากรหัสเก่าใน Keychain → Forget network แล้วเกาะใหม่

**วัดอัตราที่แมครับได้** (`ml_service/data_collection/udp_rate_check.py` · 60 วิ/รอบ · ตำแหน่งทดสอบ ไม่ใช่ตำแหน่งเก็บ)

| รอบ | #1 | #2 | pkt/s | min/วิ | SD | ขาด >50ms | ตัวนับฝั่ง #1 ต่อวิ |
|---|---|---|---:|---:|---:|---:|---|
| A | เดิม broadcast | เดิม (CSI on) | 42.2 | 0 | 35.5 | 245 | — |
| B | เดิม broadcast | CSI off | 19.0 | 0 | 16.9 | 156 | — |
| C1 | คิว+task · broadcast | CSI off | 77.9 | 20 | 12.2 | 280 | cb 191 · sent 100 · **fail 92** |
| C2 | คิว+task · unicast | CSI off | 71.8 | 52 | 10.4 | 122 | cb 468 · **qdrop 304** · fail 94 |
| D | + กรอง MAC #2 | CSI off | 149 ⚠️ | 69 | 26.4 | 15 | cb 310 · qdrop 109 · fail 51 |
| **E** | **+ กรอง MAC** | **CSI off + จังหวะคงที่** | **99.9** | **96** | **0.9** | **0** | cb 101 · qdrop 0 · **fail 0** |

**บั๊กที่ 1 — #2 ไม่ได้คุมอัตรา** (`_components/sockets_component.h`) · `lag = end - start` วัดรวมเวลา
`vTaskDelay` ของรอบเดียวกัน → รอบถัดไป `wait_ms ≤ 0` ไม่หน่วง → ส่งเป็นคู่ ๆ · อัตราจริงถูกกดด้วยอะไรก็ตาม
ที่ทำให้ `sendto` ช้า — ตอน CSI ฝั่ง #2 เปิดอยู่คือ UART 115200 (~16 บรรทัด/วิ) → ~73 แกว่ง = ชุดข้อมูลแรก ·
ปิด CSI แล้วพุ่งเป็น 150-310 (รอบ D) · แก้ด้วย `vTaskDelayUntil` ทุก 10 ms

**บั๊กที่ 2 — #1 ส่ง UDP ใน WiFi callback** (`_components/csi_component.h`) · format + `sendto` ทำใน WiFi task
และไม่เช็คค่าคืน → broadcast 1 Mbps ส่งไม่ออก ~73% แบบเงียบ · แก้: callback copy ลงคิว (64) → task แยก
(core 1, prio 5) format + ส่ง · ตัวนับ `STAT,...,cb,skip,qdrop,sent,fail,dest` ทุก 1 วิ (UDP + serial) ·
กรอง `CONFIG_CSI_UDP_SOURCE_MAC` · `HELLO` ที่ port 5501 → unicast (กลับ broadcast ถ้าเงียบ 10 วิ) ·
ทาง serial คงพฤติกรรมเดิม · บรรทัด `CSI_DATA` รูปแบบเดิมทุกตัวอักษร

**ไฟล์** `_components/csi_component.h` · `_components/sockets_component.h` · `active_ap/main/Kconfig.projbuild`
(+`CSI_UDP_SOURCE_MAC`) · `active_ap/sdkconfig.datacollect_udp.defaults` · `active_sta/sdkconfig.datacollect_nocsi.defaults` (ใหม่)
· build อยู่ที่ `active_ap/build_udp` · `active_sta/build_nocsi` (สำรอง: `active_sta/build_orig` = #2 แบบเดิม)

**ผลต่อข้อมูล** อัตราเปลี่ยน 73 → 100 · ตัดสินใจคงระยะเวลาเท่าชุดแรก: window 273 pkt (2.73 วิ) · stride 68 ·
ค่าใน `csi_collector_serial.py` + `preprocess_v3.py` ปรับตามแล้ว · ชุดใหม่ใช้กับ `rf_v1` ไม่ได้

**🔲 ยังไม่ได้ทำ** วัดซ้ำที่ตำแหน่งเก็บจริง · commit
