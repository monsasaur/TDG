#ifndef ESP32_CSI_PROVISIONING_COMPONENT_H
#define ESP32_CSI_PROVISIONING_COMPONENT_H

/**
 * provisioning_component.h
 * ตั้งค่า WiFi บ้านลูกค้าผ่าน BLE — ลูกค้าไม่ต้อง hardcode SSID/รหัสผ่านลง firmware
 *
 * ฝั่งแอปใช้ @orbital-systems/react-native-esp-idf-provisioning
 * (ห่อ ESP-IDF provisioning ของ Espressif) — ดู lib/provisioning.ts
 *
 * ── ตัวระบุอุปกรณ์ ───────────────────────────────────────────────
 * ชื่อ BLE ที่ประกาศออกไป = device code เช่น "ESP-0001A"
 * ค่านี้ต้องตรงกับ 3 ที่:
 *   1. devices.code ใน Supabase
 *   2. device_id ที่ส่งไปกับ POST /api/v1/predict
 *   3. DEVICE_PREFIX ใน lib/provisioning.ts (ขึ้นต้นด้วย "ESP-")
 * ไม่ตั้งใน menuconfig จะสร้างจาก MAC ให้อัตโนมัติ
 *
 * ── ความปลอดภัย: เลือก Security 1 ─────────────────────────────────
 * ESP-IDF มีให้เลือกระหว่าง secure1 (X25519 + AES-CTR, ยืนยันด้วย PoP)
 * กับ secure2 (SRP6a, ต้องมี username + salt/verifier)
 *
 * เลือก secure1 เพราะ secure2 ต้อง generate salt กับ verifier แยกต่อเครื่อง
 * ตอนผลิต ซึ่งเพิ่มขั้นตอนการผลิตจริงโดยที่ยังไม่ได้ประโยชน์เพิ่ม
 * ในเมื่อ PoP ของเราเป็นสตริงสุ่มยาวที่พิมพ์บนกล่อง
 *
 * ⚠️ ข้อแลกเปลี่ยนที่ต้องรู้: จุดอ่อนของ secure1 คือถ้า PoP สั้นหรือเดาง่าย
 *    คนที่ดักจับ handshake ไว้เอาไป brute force offline ได้
 *    **PoP จึงต้องยาวและสุ่ม และต้องไม่ซ้ำกันระหว่างเครื่อง** ห้ามใช้ PIN 4 หลัก
 *    ถ้าวันหลังจะเปลี่ยนไป secure2 ต้องแก้ทั้งไฟล์นี้และ lib/provisioning.ts พร้อมกัน
 */

#include <string.h>
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_mac.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "driver/gpio.h"

#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_ble.h"

static const char *PROV_TAG = "provisioning";

#define PROV_DEVICE_NAME_LEN 32

/** ตั้งค่าจาก menuconfig — ดู Kconfig.projbuild */
#ifdef CONFIG_PROV_POP
#define PROV_POP CONFIG_PROV_POP
#else
#define PROV_POP "tdg-change-me-per-device"
#endif

#ifdef CONFIG_DEVICE_CODE
#define DEVICE_CODE_CONFIGURED CONFIG_DEVICE_CODE
#else
#define DEVICE_CODE_CONFIGURED ""
#endif

/** รอจนได้ WiFi จริง หรือ provisioning จบ */
static EventGroupHandle_t prov_event_group;
#define PROV_DONE_BIT BIT0

static char prov_device_code[PROV_DEVICE_NAME_LEN] = {0};

/**
 * device code ที่ใช้เป็นทั้งชื่อ BLE และ device_id ตอนส่งข้อมูลขึ้น cloud
 * ตั้งใน menuconfig ได้ ถ้าไม่ตั้งจะสร้างจาก MAC — ต่างเครื่องได้คนละค่าแน่นอน
 */
const char *provisioning_device_code() {
    if (prov_device_code[0] != '\0') return prov_device_code;

    if (strlen(DEVICE_CODE_CONFIGURED) > 0) {
        strncpy(prov_device_code, DEVICE_CODE_CONFIGURED, PROV_DEVICE_NAME_LEN - 1);
        return prov_device_code;
    }

    uint8_t mac[6];
    esp_wifi_get_mac(WIFI_IF_STA, mac);
    // ขึ้นต้นด้วย ESP- ให้ตรงกับ DEVICE_PREFIX ที่แอปใช้กรองตอนสแกน
    snprintf(prov_device_code, PROV_DEVICE_NAME_LEN, "ESP-%02X%02X%02X", mac[3], mac[4], mac[5]);
    return prov_device_code;
}

static void prov_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data) {
    if (event_base != WIFI_PROV_EVENT) return;

    switch (event_id) {
        case WIFI_PROV_START:
            ESP_LOGI(PROV_TAG, "รอแอปเชื่อมต่อผ่าน BLE...");
            break;

        case WIFI_PROV_CRED_RECV: {
            wifi_sta_config_t *cfg = (wifi_sta_config_t *) event_data;
            ESP_LOGI(PROV_TAG, "ได้ SSID แล้ว: %s", (const char *) cfg->ssid);
            break;
        }

        case WIFI_PROV_CRED_FAIL: {
            wifi_prov_sta_fail_reason_t *reason = (wifi_prov_sta_fail_reason_t *) event_data;
            ESP_LOGE(PROV_TAG, "เชื่อมต่อไม่สำเร็จ: %s",
                     (*reason == WIFI_PROV_STA_AUTH_ERROR)
                         ? "รหัสผ่าน WiFi ไม่ถูกต้อง"
                         : "หา SSID ไม่เจอ");
            // ไม่ reset เอง — ปล่อยให้แอปลองส่งรหัสใหม่เข้ามาได้เลย
            // ถ้า reset ทุกครั้งที่พิมพ์รหัสผิด ลูกค้าจะต้องเริ่มขั้นตอนใหม่ทั้งหมด
            break;
        }

        case WIFI_PROV_CRED_SUCCESS:
            ESP_LOGI(PROV_TAG, "เชื่อมต่อ WiFi สำเร็จ — เก็บลง NVS แล้ว");
            break;

        case WIFI_PROV_END:
            ESP_LOGI(PROV_TAG, "จบขั้นตอนตั้งค่า");
            wifi_prov_mgr_deinit();
            xEventGroupSetBits(prov_event_group, PROV_DONE_BIT);
            break;

        default:
            break;
    }
}

/**
 * เรียกหลัง esp_wifi_init() แต่ก่อนตั้งค่า AP
 *
 * ถ้าเคยตั้งค่าไว้แล้ว (มีใน NVS) จะข้ามไปเลย ไม่เปิด BLE
 * ถ้ายังไม่เคย จะเปิด BLE แล้ว **บล็อกรอ** จนกว่าจะตั้งค่าเสร็จ
 *
 * @return true = มี WiFi credential พร้อมใช้แล้ว
 */
bool provisioning_init() {
    prov_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_PROV_EVENT, ESP_EVENT_ANY_ID,
                                               &prov_event_handler, NULL));

    wifi_prov_mgr_config_t config = {};
    config.scheme = wifi_prov_scheme_ble;
    // คืน RAM ของ BT ทั้งหมดหลังตั้งค่าเสร็จ — CSI ต้องใช้ RAM มาก
    // ไม่คืนแล้วจะเหลือ heap ไม่พอตอนเก็บ CSI ต่อเนื่อง
    config.scheme_event_handler = WIFI_PROV_SCHEME_BLE_EVENT_HANDLER_FREE_BTDM;

    ESP_ERROR_CHECK(wifi_prov_mgr_init(config));

    bool provisioned = false;
    ESP_ERROR_CHECK(wifi_prov_mgr_is_provisioned(&provisioned));

    if (provisioned) {
        ESP_LOGI(PROV_TAG, "ตั้งค่า WiFi ไว้แล้ว — ข้ามขั้นตอน BLE");
        wifi_prov_mgr_deinit();
        return true;
    }

    const char *name = provisioning_device_code();
    ESP_LOGI(PROV_TAG, "ยังไม่ได้ตั้งค่า — เปิด BLE ชื่อ \"%s\"", name);
    ESP_LOGI(PROV_TAG, "เปิดแอป → สแกนอุปกรณ์ → เลือก \"%s\"", name);

    ESP_ERROR_CHECK(wifi_prov_mgr_start_provisioning(
        WIFI_PROV_SECURITY_1,
        PROV_POP,
        name,
        NULL   // service_key ใช้เฉพาะ scheme softap — BLE ไม่ใช้
    ));

    // บล็อกรอจนตั้งค่าเสร็จ ยังไม่ต้องเปิด AP/CSI ระหว่างนี้
    // เพราะ wifi_prov_mgr จัดการ wifi mode เองอยู่ ถ้าไปแทรกจะชนกัน
    xEventGroupWaitBits(prov_event_group, PROV_DONE_BIT, true, true, portMAX_DELAY);
    return true;
}

/** ลบ WiFi ที่เก็บไว้แล้ว reboot — ใช้ตอนย้ายบ้านหรือเปลี่ยนเราเตอร์ */
void provisioning_reset() {
    ESP_LOGW(PROV_TAG, "ลบ WiFi ที่ตั้งไว้ — จะ reboot เข้าโหมดตั้งค่าใหม่");
    ESP_ERROR_CHECK(esp_wifi_restore());
    vTaskDelay(pdMS_TO_TICKS(500));
    esp_restart();
}

// ---------------------------------------------------------------
// ปุ่ม reset — กดปุ่ม BOOT ค้างเพื่อกลับเข้าโหมดตั้งค่า
// ---------------------------------------------------------------

#define PROV_RESET_GPIO      GPIO_NUM_0    // ปุ่ม BOOT บน DevKit — active low
#define PROV_RESET_HOLD_MS   5000          // ต้องกดค้างนานขนาดนี้
#define PROV_RESET_POLL_MS   200

/**
 * ต้องกดค้าง 5 วินาที ไม่ใช่กดแล้วรีเซ็ตเลย
 * เพราะ GPIO0 เป็นปุ่มเดียวกับที่ใช้เข้า bootloader — กดพลาดทีเดียวแล้ว
 * ลูกค้าต้องตั้งค่า WiFi ใหม่ทั้งหมด
 */
static void prov_reset_watch_task(void *arg) {
    gpio_config_t io = {};
    io.pin_bit_mask = 1ULL << PROV_RESET_GPIO;
    io.mode         = GPIO_MODE_INPUT;
    io.pull_up_en   = GPIO_PULLUP_ENABLE;
    gpio_config(&io);

    int held_ms = 0;
    while (true) {
        if (gpio_get_level(PROV_RESET_GPIO) == 0) {
            held_ms += PROV_RESET_POLL_MS;
            if (held_ms >= PROV_RESET_HOLD_MS) {
                provisioning_reset();   // ไม่ return — บอร์ด restart
            } else if (held_ms % 1000 == 0) {
                ESP_LOGW(PROV_TAG, "กดค้างอยู่ %d/%d วินาที เพื่อล้างค่า WiFi",
                         held_ms / 1000, PROV_RESET_HOLD_MS / 1000);
            }
        } else {
            held_ms = 0;   // ปล่อยก่อนครบ = ยกเลิก
        }
        vTaskDelay(pdMS_TO_TICKS(PROV_RESET_POLL_MS));
    }
}

void provisioning_start_reset_watcher() {
    xTaskCreate(prov_reset_watch_task, "prov_reset", 2560, NULL, 3, NULL);
    ESP_LOGI(PROV_TAG, "กดปุ่ม BOOT ค้าง %d วินาที เพื่อล้างค่า WiFi",
             PROV_RESET_HOLD_MS / 1000);
}

#endif //ESP32_CSI_PROVISIONING_COMPONENT_H
