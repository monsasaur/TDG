# ตัดสินใจ — จะ build firmware BLE provisioning ด้วย ESP-IDF เวอร์ชันไหน

**วันที่ตรวจ:** 29 ก.ย. 2026
**ตรวจกับของจริง:** `~/.espressif` · `active_ap/build/compile_commands.json` · `_components/provisioning_component.h` · `active_ap/main/CMakeLists.txt`

---

## 1. สภาพเครื่องตอนนี้

| สิ่งที่เช็ค | ผล |
|---|---|
| `~/esp/esp-idf` (framework source) | ❌ **ไม่มีแล้ว** ถูกลบไป |
| `~/.espressif` (toolchain + python env) | ✅ ยังอยู่ · `espidf.constraints.v6.1.txt` · xtensa gcc 15.2.0 |
| `idf.py` ใน PATH | ❌ ยังไม่ได้ source `export.sh` |
| build ล่าสุด | 6 พ.ค. 2026 · `IDF_VER=v6.1-dev-2938-g12f36a021f` · **โหมดเก็บข้อมูล ไม่มี BLE** |
| บอร์ดเสียบอยู่ | ❌ ไม่มี `/dev/cu.usbserial-*` |
| `idf_component.yml` ในรีโป | ❌ ไม่มีที่ไหนเลย |

**สรุป:** ต้อง clone framework ใหม่ก่อนทำอะไรได้ และต้องเลือกเวอร์ชันก่อน clone

---

## 2. ปัญหาที่ทำให้ต้องเลือก

`_components/provisioning_component.h` เขียนเมื่อ 2 ก.ย. **ยังไม่เคยผ่าน compiler เลย** และมันเขียนด้วย API ของ IDF v5:

```c
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_ble.h"
// ...
wifi_prov_mgr_config_t config = {};
config.scheme = wifi_prov_scheme_ble;
config.scheme_event_handler = WIFI_PROV_SCHEME_BLE_EVENT_HANDLER_FREE_BTDM;
wifi_prov_mgr_init(config);
wifi_prov_mgr_start_provisioning(WIFI_PROV_SECURITY_1, PROV_POP, name, NULL);
```

**ตั้งแต่ IDF v6.0 `wifi_provisioning` ถูกถอดออกจาก core** ย้ายไปเป็น managed component
ในรีจิสทรีชื่อ **`espressif/network_provisioning`** (เพิ่มการรองรับ Thread เข้าไปด้วย) และเปลี่ยนชื่อ API ยกชุด

แปลว่า **ถ้า clone v6.1 มา build ตอนนี้ จะพังที่บรรทัด `#include` ทันที**

อ้างอิง:
- https://developer.espressif.com/blog/2026/03/idf-v6-0-release/
- https://docs.espressif.com/projects/esp-idf/en/stable/esp32/migration-guides/release-6.x/6.0/provisioning.html
- https://components.espressif.com/components/espressif/network_provisioning

---

## 3. ทางเลือก A — clone v5.4 (ไม่แก้โค้ด)

**ข้อดี:** โค้ดที่เขียนไว้ compile ได้เลย ไม่ต้องแก้แม้บรรทัดเดียว · v5.4 เป็น LTS
**ข้อเสีย:** โหลด framework ใหม่ ~2GB + `install.sh` ดึง toolchain ของ v5.4 เพิ่ม (อยู่ร่วมกับ v6.1 ได้ ไม่ทับกัน)

```bash
# 1) clone v5.4 (shallow ประหยัดเวลาและพื้นที่)
mkdir -p ~/esp && cd ~/esp
git clone -b v5.4 --recursive --depth 1 --shallow-submodules \
  https://github.com/espressif/esp-idf.git esp-idf-v5.4

# 2) ติดตั้ง toolchain เฉพาะ esp32 (ไม่เอาชิปอื่น)
cd ~/esp/esp-idf-v5.4 && ./install.sh esp32

# 3) source — ต้องทำทุกครั้งที่เปิด terminal ใหม่
. ~/esp/esp-idf-v5.4/export.sh

# 4) ⚠️ เช็คขนาด flash จริงก่อน — partitions.csv ต้องการ 4MB
#    เสียบบอร์ดแล้วรัน ถ้าได้ 2MB ต้องเปลี่ยนบอร์ดหรือลดขนาด app partition
esptool.py flash_id

# 5) สำรอง sdkconfig โหมดเก็บข้อมูลไว้ก่อน แล้วลบให้ sdkconfig.defaults มีผล
cd ~/TDG/fall_detection_backend/ESP32-CSI-Tool/active_ap
cp sdkconfig sdkconfig.datacollect.keep
rm sdkconfig

# 6) ตั้งค่า
idf.py set-target esp32
idf.py menuconfig
#   → ESP32 CSI Tool Config → BLE WiFi Provisioning
#     [*] ENABLE_BLE_PROVISIONING
#         PROV_POP    = ค่าสุ่มยาว ไม่ซ้ำต่อเครื่อง (ห้ามใช้ค่า default)
#         DEVICE_CODE = เช่น ESP-0001A (ต้องมีใน devices.code ของ Supabase ด้วย)

# 7) build
idf.py fullclean && idf.py build

# 8) flash
idf.py -p /dev/cu.usbserial-XXXX flash monitor
```

**กลับไปโหมดเก็บข้อมูล:** `cp sdkconfig.datacollect.keep sdkconfig && idf.py fullclean && idf.py build`

---

## 4. ทางเลือก B — clone v6.1 (แก้โค้ด)

**ข้อดี:** ตรงกับ toolchain ที่ `~/.espressif` เตรียมไว้แล้ว · ไม่ต้องโหลด toolchain ซ้ำ · อยู่บนของใหม่ที่ยังได้รับ support ยาว
**ข้อเสีย:** ต้องเขียน `provisioning_component.h` ใหม่ + เพิ่ม `idf_component.yml`

```bash
# 1) clone
mkdir -p ~/esp && cd ~/esp
git clone -b v6.1 --recursive --depth 1 --shallow-submodules \
  https://github.com/espressif/esp-idf.git
cd ~/esp/esp-idf && ./install.sh esp32
. ~/esp/esp-idf/export.sh

# 2) ประกาศ dependency (สร้าง main/idf_component.yml ให้เอง)
cd ~/TDG/fall_detection_backend/ESP32-CSI-Tool/active_ap
idf.py add-dependency "espressif/network_provisioning^1.2.4"

# 3) ⚠️ ต้องแก้ provisioning_component.h ก่อน build (ดูข้อ 4.1)

# 4) จากนั้นเหมือนทางเลือก A ข้อ 4-8
```

### 4.1 สิ่งที่ต้องแก้ในโค้ด

ทิศทางการเปลี่ยนชื่อคือ `wifi_prov_*` → `network_prov_*` และ header ย้ายไป
`network_provisioning/manager.h` แต่ **ชื่อสัญลักษณ์ตัวต่อตัวต้องเปิดอ่านจาก header
ที่ดาวน์โหลดมาจริงก่อน** ไม่ควรเดา — ไฟล์จะอยู่ที่
`active_ap/managed_components/espressif__network_provisioning/include/`

จุดที่ต้องแก้ใน `_components/provisioning_component.h`:

| บรรทัดประมาณ | ของเดิม | ต้องเปลี่ยน |
|---|---|---|
| include | `wifi_provisioning/manager.h` · `scheme_ble.h` | header ของ network_provisioning |
| `PROV_TAG` block | `wifi_prov_mgr_config_t` | ชนิดใหม่ |
| | `wifi_prov_scheme_ble` | scheme ตัวใหม่ |
| | `WIFI_PROV_SCHEME_BLE_EVENT_HANDLER_FREE_BTDM` | macro ตัวใหม่ |
| `prov_event_handler` | `WIFI_PROV_EVENT` · `WIFI_PROV_START` · `WIFI_PROV_CRED_RECV` · `WIFI_PROV_CRED_FAIL` · `WIFI_PROV_CRED_SUCCESS` · `WIFI_PROV_END` | event base + enum ชุดใหม่ |
| | `wifi_prov_sta_fail_reason_t` · `WIFI_PROV_STA_AUTH_ERROR` | ชนิด/ค่าใหม่ |
| `provisioning_init` | `wifi_prov_mgr_init` · `_is_provisioned` · `_deinit` · `_start_provisioning` | ชุดใหม่ |
| | `WIFI_PROV_SECURITY_1` | ค่าใหม่ |

**ฝั่งแอปต้องเช็คด้วย** — `lib/provisioning.ts` ใช้
`@orbital-systems/react-native-esp-idf-provisioning` ซึ่งห่อ SDK ฝั่งมือถือของ Espressif
ต้องยืนยันว่า protocol ที่ไลบรารีนั้นพูด ยังเข้ากับ `network_provisioning` เวอร์ชันใหม่
(น่าจะเข้าได้เพราะ protocomm ไม่เปลี่ยน แต่ยังไม่ได้ตรวจ)

---

## 5. เทียบให้เห็นภาพ

| | A — v5.4 | B — v6.1 |
|---|---|---|
| แก้โค้ด firmware | ไม่ต้อง | ต้องเขียน `provisioning_component.h` ใหม่ |
| เพิ่ม `idf_component.yml` | ไม่ต้อง | ต้อง |
| โหลด framework | ~2GB | ~2GB |
| โหลด toolchain เพิ่ม | ต้อง (ของ v5.4) | ไม่ต้อง |
| ความเสี่ยงที่ build พังโดยไม่คาดคิด | ต่ำ — API ตรงกับโค้ด | กลาง — ยังไม่เคยเห็น header จริง |
| ต้องตรวจฝั่งแอปเพิ่ม | ไม่ | ควรตรวจ |

**คำแนะนำ:** ไปทาง **A** ก่อน เป้าหมายเฉพาะหน้าคือพิสูจน์ว่า BLE provisioning
ทำงานกับบอร์ดจริงได้ ไม่ใช่การอัปเกรด framework การย้ายไป v6 เก็บไว้ทำทีหลัง
ตอนที่ฟีเจอร์นิ่งแล้ว จะได้แยกสาเหตุออกจากกันได้ว่าพังเพราะโค้ดเราหรือเพราะเวอร์ชัน

---

## 6. สิ่งที่ยังต้องทำไม่ว่าเลือกทางไหน

1. **เช็ค `esptool.py flash_id`** — `partitions.csv` ให้ app 2MB ต้องมี flash 4MB
   `sdkconfig` เดิมตั้งไว้ 2MB ซึ่งน่าจะไม่ตรงของจริง ถ้าบอร์ดมี 2MB จริงต้องลดขนาด app
2. **`PROV_POP` ยังเป็น `"tdg-change-me-per-device"`** เหมือนกันทุกเครื่อง — ต้องมีขั้นตอนผลิตที่สุ่มต่อเครื่อง
3. **`main/CMakeLists.txt` ไม่ประกาศ `REQUIRES`** — `main` ได้ทุก component โดยปริยาย
   จึงไม่น่าพัง แต่ถ้าเจอ error หา header ไม่เจอ ให้เพิ่ม `REQUIRES` เข้าไปตรงนี้
4. **อุปกรณ์ที่ตั้งค่าเสร็จยังไม่ถูกบันทึกลง Supabase** — `app/device-setup.tsx` กดบันทึกแล้ว
   `router.dismiss(4)` เฉย ๆ ไม่มี insert ที่ไหน ต่อให้ BLE ติดแล้วอุปกรณ์ก็ยังไม่โผล่ในแอป
