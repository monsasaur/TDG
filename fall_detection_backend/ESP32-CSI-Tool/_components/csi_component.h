
#ifndef ESP32_CSI_CSI_COMPONENT_H
#define ESP32_CSI_CSI_COMPONENT_H

#include "time_component.h"
#include "math.h"
#include <sstream>
#include <iostream>
#include "lwip/sockets.h"
#include "lwip/netdb.h"
#include "esp_netif.h"

// ปลายทาง UDP — ค่าเริ่มต้นเป็น broadcast ของซับเน็ต softAP (192.168.4.0/24)
// ใช้ broadcast เพื่อไม่ต้อง hardcode IP ของเครื่องรับ: คอมเกาะ "myssid" แล้วฟัง
// port 5500 ได้เลย ไม่ว่า DHCP จะแจก IP อะไรให้
#ifdef CONFIG_CSI_UDP_TARGET_IP
#define UDP_TARGET_IP   CONFIG_CSI_UDP_TARGET_IP
#else
#define UDP_TARGET_IP   "192.168.4.255"
#endif
#define UDP_TARGET_PORT 5500

#define CSI_RAW 1
#define CSI_AMPLITUDE 0
#define CSI_PHASE 0
#define CSI_TYPE CSI_RAW

char *project_type;
static int udp_sock = -1;
static struct sockaddr_in udp_dest;
SemaphoreHandle_t mutex = xSemaphoreCreateMutex();

void udp_init() {
    udp_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (udp_sock < 0) return;

    int on = 1;
    setsockopt(udp_sock, SOL_SOCKET, SO_BROADCAST, &on, sizeof(on));

    memset(&udp_dest, 0, sizeof(udp_dest));
    udp_dest.sin_family = AF_INET;
    udp_dest.sin_port = htons(UDP_TARGET_PORT);
    inet_aton(UDP_TARGET_IP, &udp_dest.sin_addr);

    // ผูกกับ interface ที่มีอยู่จริง
    //   โหมดเก็บข้อมูล (AP อย่างเดียว)  → ส่งออก AP interface  ← ปกติใช้อันนี้
    //   โหมด production (AP+STA)        → ส่งออก STA เพื่อไป cloud
    // เดิม bind กับ STA อย่างเดียว ซึ่งในโหมด AP-only ไม่มี netif นั้น → ส่งไม่ออก
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    if (netif == NULL) {
        netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
    }
    if (netif) {
        esp_netif_ip_info_t ip_info;
        if (esp_netif_get_ip_info(netif, &ip_info) == ESP_OK && ip_info.ip.addr) {
            struct sockaddr_in src_addr;
            memset(&src_addr, 0, sizeof(src_addr));
            src_addr.sin_family = AF_INET;
            src_addr.sin_addr.s_addr = ip_info.ip.addr;
            src_addr.sin_port = 0;
            bind(udp_sock, (struct sockaddr*)&src_addr, sizeof(src_addr));
        }
    }
}

void send_udp(const char* message) {
    if (udp_sock < 0) udp_init();
    sendto(udp_sock, message, strlen(message), 0,
           (struct sockaddr*)&udp_dest, sizeof(udp_dest));
}

void _wifi_csi_cb(void *ctx, wifi_csi_info_t *data) {
    xSemaphoreTake(mutex, portMAX_DELAY);
    std::stringstream ss;

    wifi_csi_info_t d = data[0];
    char mac[20] = {0};
    sprintf(mac, "%02X:%02X:%02X:%02X:%02X:%02X", d.mac[0], d.mac[1], d.mac[2], d.mac[3], d.mac[4], d.mac[5]);

    ss << "CSI_DATA,"
       << project_type << ","
       << mac << ","
       << d.rx_ctrl.rssi << ","
       << d.rx_ctrl.rate << ","
       << d.rx_ctrl.sig_mode << ","
       << d.rx_ctrl.mcs << ","
       << d.rx_ctrl.cwb << ","
       << d.rx_ctrl.smoothing << ","
       << d.rx_ctrl.not_sounding << ","
       << d.rx_ctrl.aggregation << ","
       << d.rx_ctrl.stbc << ","
       << d.rx_ctrl.fec_coding << ","
       << d.rx_ctrl.sgi << ","
       << d.rx_ctrl.noise_floor << ","
       << d.rx_ctrl.ampdu_cnt << ","
       << d.rx_ctrl.channel << ","
       << d.rx_ctrl.secondary_channel << ","
       << d.rx_ctrl.timestamp << ","
       << d.rx_ctrl.ant << ","
       << d.rx_ctrl.sig_len << ","
       << d.rx_ctrl.rx_state << ","
       << real_time_set << ","
       << get_steady_clock_timestamp() << ","
       << data->len << ",[";

#if CONFIG_SHOULD_COLLECT_ONLY_LLTF
    int data_len = 128;
#else
    int data_len = data->len;
#endif

    int8_t *my_ptr;
#if CSI_RAW
    my_ptr = data->buf;
    for (int i = 0; i < data_len; i++) {
        ss << (int) my_ptr[i] << " ";
    }
#endif
    ss << "]\n";

#if CONFIG_SEND_CSI_TO_SERIAL
    outprintf("%s", ss.str().c_str());
#endif
#ifdef CONFIG_SEND_CSI_TO_UDP
    send_udp(ss.str().c_str());
#endif
    vTaskDelay(0);
    xSemaphoreGive(mutex);
}

void _print_csi_csv_header() {
    // header ส่งทาง serial เท่านั้น — ฝั่ง UDP กรองด้วย "CSI_DATA" อยู่แล้ว
    char *header_str = (char *) "type,role,mac,rssi,rate,sig_mode,mcs,bandwidth,smoothing,not_sounding,aggregation,stbc,fec_coding,sgi,noise_floor,ampdu_cnt,channel,secondary_channel,local_timestamp,ant,sig_len,rx_state,real_time_set,real_timestamp,len,CSI_DATA\n";
    outprintf(header_str);
}

void csi_init(char *type) {
    project_type = type;

#ifdef CONFIG_SHOULD_COLLECT_CSI
    ESP_ERROR_CHECK(esp_wifi_set_csi(1));

    wifi_csi_config_t configuration_csi;
    configuration_csi.lltf_en = 1;
    configuration_csi.htltf_en = 1;
    configuration_csi.stbc_htltf2_en = 1;
    configuration_csi.ltf_merge_en = 1;
    configuration_csi.channel_filter_en = 0;
    configuration_csi.manu_scale = 0;

    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&configuration_csi));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(&_wifi_csi_cb, NULL));

    _print_csi_csv_header();
#endif
}

#endif //ESP32_CSI_CSI_COMPONENT_H
