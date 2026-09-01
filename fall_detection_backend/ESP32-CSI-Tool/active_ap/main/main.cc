#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "spi_flash_mmap.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "lwip/err.h"
#include "lwip/sys.h"

#include "../../_components/nvs_component.h"
#include "../../_components/sd_component.h"
#include "../../_components/csi_component.h"
#include "../../_components/time_component.h"
#include "../../_components/input_component.h"

#ifdef CONFIG_ENABLE_BLE_PROVISIONING
#include "../../_components/provisioning_component.h"
#endif

// =================================================
// สองโหมด เลือกใน menuconfig → ESP32 CSI Tool Config
//
// 1. โหมดเก็บข้อมูล (ค่าเริ่มต้น, ENABLE_BLE_PROVISIONING = n)
//    AP อย่างเดียว ส่ง CSI ผ่าน USB Serial → Mac
//    ช่องสัญญาณคงที่ตาม WIFI_CHANNEL — จำเป็นสำหรับให้ข้อมูลเทียบกันได้
//
// 2. โหมด production (ENABLE_BLE_PROVISIONING = y)
//    ตั้ง WiFi บ้านลูกค้าผ่าน BLE ครั้งแรก แล้วทำงานเป็น AP+STA พร้อมกัน
//      AP  → ให้ ESP32 #2 เกาะเพื่อสร้าง packet ให้วัด CSI
//      STA → เกาะ WiFi บ้าน เอาไว้ส่ง CSI ขึ้น cloud
//
//    ⚠️ ข้อจำกัดที่ต้องรู้: ESP32 มีวิทยุชุดเดียว ในโหมด AP+STA
//       **ช่องสัญญาณของ AP จะถูกบังคับให้ตามช่องของเราเตอร์บ้าน**
//       ตั้ง WIFI_CHANNEL ไว้เท่าไรก็ไม่มีผล
//       แปลว่า CSI ที่เก็บได้จริงในบ้านลูกค้าจะอยู่คนละช่องกับตอนเทรน
//       (ตอนเก็บข้อมูลใช้ช่อง 6 คงที่) — ต้องทดสอบว่าโมเดลยังทำงานข้ามช่องได้ไหม
// =================================================

#define ESP_WIFI_SSID   CONFIG_ESP_WIFI_SSID
#define ESP_WIFI_PASS   CONFIG_ESP_WIFI_PASSWORD
#define MAX_STA_CONN    16

#ifdef CONFIG_WIFI_CHANNEL
#define WIFI_CHANNEL CONFIG_WIFI_CHANNEL
#else
#define WIFI_CHANNEL 6
#endif

#ifdef CONFIG_SHOULD_COLLECT_CSI
#define SHOULD_COLLECT_CSI 1
#else
#define SHOULD_COLLECT_CSI 0
#endif

#ifdef CONFIG_SHOULD_COLLECT_ONLY_LLTF
#define SHOULD_COLLECT_ONLY_LLTF 1
#else
#define SHOULD_COLLECT_ONLY_LLTF 0
#endif

#ifdef CONFIG_SEND_CSI_TO_SERIAL
#define SEND_CSI_TO_SERIAL 1
#else
#define SEND_CSI_TO_SERIAL 0
#endif

#ifdef CONFIG_SEND_CSI_TO_SD
#define SEND_CSI_TO_SD 1
#else
#define SEND_CSI_TO_SD 0
#endif

static const char *TAG = "Active CSI collection (AP)";

static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                               int32_t event_id, void* event_data) {
    if (event_id == WIFI_EVENT_AP_STACONNECTED) {
        wifi_event_ap_staconnected_t* event = (wifi_event_ap_staconnected_t*) event_data;
        ESP_LOGI(TAG, "ESP32 STA joined AP, AID=%d", event->aid);
    } else if (event_id == WIFI_EVENT_AP_STADISCONNECTED) {
        wifi_event_ap_stadisconnected_t* event = (wifi_event_ap_stadisconnected_t*) event_data;
        ESP_LOGI(TAG, "ESP32 STA left AP, AID=%d", event->aid);
    }
}

void softap_init() {
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL, NULL));

    wifi_config_t ap_config = {};
    strcpy((char*)ap_config.ap.ssid, ESP_WIFI_SSID);
    ap_config.ap.ssid_len       = strlen(ESP_WIFI_SSID);
    ap_config.ap.channel        = WIFI_CHANNEL;
    strcpy((char*)ap_config.ap.password, ESP_WIFI_PASS);
    ap_config.ap.max_connection = MAX_STA_CONN;
    ap_config.ap.authmode       = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    esp_wifi_set_ps(WIFI_PS_NONE);
    ESP_LOGI(TAG, "AP started: %s @ channel %d", ESP_WIFI_SSID, WIFI_CHANNEL);
    ESP_LOGI(TAG, "Ready! CSI → USB Serial");
}

void config_print() {
    printf("\n\n-----------------------\n");
    printf("ESP32 CSI Tool — ACTIVE_AP (Serial Mode)\n");
    printf("-----------------------\n");
    printf("WIFI_CHANNEL     : %d\n", WIFI_CHANNEL);
    printf("AP SSID          : %s\n", ESP_WIFI_SSID);
    printf("OUTPUT           : USB Serial (no UDP, no hotspot)\n");
    printf("COLLECT_CSI      : %d\n", SHOULD_COLLECT_CSI);
    printf("ONLY_LLTF        : %d\n", SHOULD_COLLECT_ONLY_LLTF);
    printf("CSI_TO_SERIAL    : %d\n", SEND_CSI_TO_SERIAL);
    printf("CSI_TO_SD        : %d\n", SEND_CSI_TO_SD);
#ifdef CONFIG_ENABLE_BLE_PROVISIONING
    printf("MODE             : production (BLE provisioning + AP/STA)\n");
#else
    printf("MODE             : data collection (AP only, fixed channel)\n");
#endif
    printf("-----------------------\n\n");
}

#ifdef CONFIG_ENABLE_BLE_PROVISIONING
/**
 * โหมด production — AP (ให้ ESP32 #2 เกาะ) + STA (เกาะ WiFi บ้าน) พร้อมกัน
 *
 * ต้อง stop wifi ก่อนเปลี่ยนเป็น APSTA เพราะตอนออกจาก provisioning
 * ตัวจัดการเปิด wifi ค้างไว้ในโหมด STA อยู่ — เปลี่ยนโหมดทั้งที่ยังรันอยู่
 * จะทำให้การเชื่อมต่อหลุดแบบไม่คาดเดา
 */
void apsta_start() {
    ESP_ERROR_CHECK(esp_wifi_stop());

    wifi_config_t ap_config = {};
    strcpy((char*)ap_config.ap.ssid, ESP_WIFI_SSID);
    ap_config.ap.ssid_len       = strlen(ESP_WIFI_SSID);
    ap_config.ap.channel        = WIFI_CHANNEL;   // จะถูก STA บังคับทับ ดูหมายเหตุด้านบน
    strcpy((char*)ap_config.ap.password, ESP_WIFI_PASS);
    ap_config.ap.max_connection = MAX_STA_CONN;
    ap_config.ap.authmode       = WIFI_AUTH_WPA2_PSK;

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
    // ไม่ต้องตั้ง config ของ STA — esp_wifi_init อ่านค่าที่ provisioning เก็บไว้ใน NVS ให้เอง
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_ERROR_CHECK(esp_wifi_connect());

    esp_wifi_set_ps(WIFI_PS_NONE);   // ห้าม sleep ไม่งั้น CSI ขาดช่วง
    ESP_LOGI(TAG, "AP+STA พร้อม — AP \"%s\" · device code \"%s\"",
             ESP_WIFI_SSID, provisioning_device_code());
}
#endif

extern "C" void app_main() {
    config_print();
    nvs_init();
    sd_init();

#ifdef CONFIG_ENABLE_BLE_PROVISIONING
    // ต้องเตรียม netif/event loop/wifi ให้พร้อมก่อน wifi_prov_mgr ถึงจะทำงานได้
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_ap();
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler, NULL, NULL));

    provisioning_init();              // ยังไม่เคยตั้งค่า → เปิด BLE แล้วบล็อกรอ
    apsta_start();
    provisioning_start_reset_watcher();
#else
    softap_init();                    // โหมดเก็บข้อมูล — AP อย่างเดียว ช่องคงที่
#endif

#if !(SHOULD_COLLECT_CSI)
    printf("CSI disabled. Enable via idf.py menuconfig\n");
#endif

    csi_init((char *) "AP");
}
