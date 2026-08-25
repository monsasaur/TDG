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

// =================================================
// AP-only mode — ส่ง CSI ผ่าน USB Serial → Mac
// ไม่ต้อง connect hotspot ใดๆ
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
    printf("-----------------------\n\n");
}

extern "C" void app_main() {
    config_print();
    nvs_init();
    sd_init();
    softap_init();

#if !(SHOULD_COLLECT_CSI)
    printf("CSI disabled. Enable via idf.py menuconfig\n");
#endif

    csi_init((char *) "AP");
}
