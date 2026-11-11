
#ifndef ESP32_CSI_CSI_COMPONENT_H
#define ESP32_CSI_CSI_COMPONENT_H

#include "time_component.h"
#include "math.h"
#include <sstream>
#include <iostream>
#include "lwip/sockets.h"
#include "lwip/netdb.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

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

// ─────────────────────────────────────────────────────────────
// CSI 1 ตัว ที่ copy ออกมาจาก callback — ข้อมูลพอสร้างบรรทัด CSI_DATA ได้ครบเหมือนเดิม
// ─────────────────────────────────────────────────────────────
#define CSI_BUF_MAX 384
typedef struct {
    wifi_pkt_rx_ctrl_t rx_ctrl;
    uint8_t  mac[6];
    uint16_t len;        // data->len จริง (พิมพ์ลงคอลัมน์ len เหมือนเดิม)
    uint16_t n;          // จำนวนค่าที่ copy มา (LLTF = 128)
    bool     rts;        // real_time_set ณ ตอนรับ
    double   steady_ts;  // get_steady_clock_timestamp() ณ ตอนรับ
    int8_t   buf[CSI_BUF_MAX];
} csi_item_t;

// สร้างบรรทัด CSI_DATA — รูปแบบตรงกับของเดิมทุกตัวอักษร (preprocess อ่านแบบเดิมได้)
static std::string format_csi_line(const csi_item_t *it) {
    std::stringstream ss;
    char mac[20] = {0};
    sprintf(mac, "%02X:%02X:%02X:%02X:%02X:%02X",
            it->mac[0], it->mac[1], it->mac[2], it->mac[3], it->mac[4], it->mac[5]);
    const wifi_pkt_rx_ctrl_t &r = it->rx_ctrl;
    ss << "CSI_DATA,"
       << project_type << ","
       << mac << ","
       << r.rssi << ","
       << r.rate << ","
       << r.sig_mode << ","
       << r.mcs << ","
       << r.cwb << ","
       << r.smoothing << ","
       << r.not_sounding << ","
       << r.aggregation << ","
       << r.stbc << ","
       << r.fec_coding << ","
       << r.sgi << ","
       << r.noise_floor << ","
       << r.ampdu_cnt << ","
       << r.channel << ","
       << r.secondary_channel << ","
       << r.timestamp << ","
       << r.ant << ","
       << r.sig_len << ","
       << r.rx_state << ","
       << it->rts << ","
       << it->steady_ts << ","
       << it->len << ",[";
#if CSI_RAW
    for (int i = 0; i < it->n; i++) {
        ss << (int) it->buf[i] << " ";
    }
#endif
    ss << "]\n";
    return ss.str();
}

static void fill_item(csi_item_t *it, wifi_csi_info_t *data) {
    it->rx_ctrl   = data->rx_ctrl;
    memcpy(it->mac, data->mac, 6);
    it->len       = data->len;
#if CONFIG_SHOULD_COLLECT_ONLY_LLTF
    int want = 128;
#else
    int want = data->len;
#endif
    if (want > CSI_BUF_MAX) want = CSI_BUF_MAX;
    it->n         = want;
    it->rts       = real_time_set;
    it->steady_ts = get_steady_clock_timestamp();
    memcpy(it->buf, data->buf, want);
}

#ifdef CONFIG_SEND_CSI_TO_UDP
// ─────────────────────────────────────────────────────────────
// ทาง UDP — callback แค่ copy ลงคิว · task แยกเป็นคน format + sendto
//
// เดิม format string + sendto ทำใน callback ซึ่งรันอยู่ใน **WiFi task**
// ระหว่างที่ sendto ค้าง (lwIP/คิวส่งเต็ม) WiFi task รับ packet ถัดไปไม่ได้ → CSI หาย
// และค่าที่ sendto คืนมาไม่เคยถูกเช็ค → packet ที่ส่งไม่ออกหายเงียบ ไม่มีใครรู้
//
// ตัวนับ (พิมพ์ทุก 1 วิ เป็นบรรทัด STAT ทั้งทาง UDP และ serial — collector กรองทิ้งเพราะไม่ใช่ CSI_DATA):
//   cb    = callback ที่ WiFi ส่งมา (CSI ที่ #1 วัดได้จริง ทุก MAC)
//   skip  = ทิ้งเพราะ MAC ไม่ตรง CONFIG_CSI_UDP_SOURCE_MAC
//   dup   = ทิ้งเพราะเป็นเฟรมเดิมที่ #2 ส่งซ้ำ (rx_seq เท่าตัวก่อน)
//   qdrop = คิวเต็ม ทิ้ง
//   sent  = sendto สำเร็จ
//   fail  = sendto ล้มเหลว (ENOMEM ฯลฯ)
// เทียบกับจำนวนที่คอมรับได้ → รู้ว่าหายที่ #2, ที่ #1, หรือกลางอากาศ
//
// unicast: คอมส่ง "HELLO" มาที่ port 5501 → ส่งตรงไป IP นั้นแทน broadcast
//   (unicast มี ACK + ส่งซ้ำ + ใช้ rate สูง · broadcast ส่งที่ 1 Mbps ไม่มีส่งซ้ำ)
//   ไม่มี HELLO เกิน 10 วิ → กลับเป็น broadcast เอง
// ─────────────────────────────────────────────────────────────
#define CSI_QUEUE_LEN     64
#define UDP_CTRL_PORT     5501
#define HELLO_TIMEOUT_US  (10 * 1000000LL)

static QueueHandle_t   csi_queue = NULL;
static volatile uint32_t st_cb = 0, st_skip = 0, st_dup = 0, st_qdrop = 0, st_sent = 0, st_fail = 0;
// เฟรมที่ #2 ส่งซ้ำ (retry) มีเลขลำดับ 802.11 เดิม — ESP32 ยังเรียก callback ให้ทุกครั้งที่รับได้
// ถ้าไม่ทิ้ง: ข้อมูลมีเฟรมซ้ำ (เจอจริง 2026-11-11: 130-190 pkt/s ทั้งที่ #2 ส่ง 100) window สั้นลง
// และ #1 ต้องส่งของซ้ำ → ช่องยิ่งแน่น → #2 ยิ่งส่งซ้ำ วนเป็นวงจร
static int32_t  last_seq = -1;
static uint8_t  src_mac[6];
static bool     src_filter = false;   // true = ส่งเฉพาะเฟรมจาก src_mac (CONFIG_CSI_UDP_SOURCE_MAC)

static void src_filter_init() {
#ifdef CONFIG_CSI_UDP_SOURCE_MAC
    unsigned int m[6];
    if (sscanf(CONFIG_CSI_UDP_SOURCE_MAC, "%x:%x:%x:%x:%x:%x",
               &m[0], &m[1], &m[2], &m[3], &m[4], &m[5]) == 6) {
        for (int i = 0; i < 6; i++) src_mac[i] = (uint8_t) m[i];
        src_filter = true;
        printf("CSI_SRC_MAC      : %s (ส่งเฉพาะ MAC นี้)\n", CONFIG_CSI_UDP_SOURCE_MAC);
    } else {
        printf("CSI_SRC_MAC      : ทุก MAC\n");
    }
#endif
}
static int      ctrl_sock = -1;
static uint32_t peer_ip = 0;          // network order · 0 = ใช้ broadcast
static int64_t  peer_seen_us = 0;
static csi_item_t cb_item;            // ใช้ใน callback เท่านั้น (WiFi task ตัวเดียว)

static void ctrl_init() {
    ctrl_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (ctrl_sock < 0) return;
    struct sockaddr_in a;
    memset(&a, 0, sizeof(a));
    a.sin_family = AF_INET;
    a.sin_port = htons(UDP_CTRL_PORT);
    a.sin_addr.s_addr = htonl(INADDR_ANY);
    if (bind(ctrl_sock, (struct sockaddr*)&a, sizeof(a)) != 0) {
        close(ctrl_sock);
        ctrl_sock = -1;
    }
}

static void ctrl_poll() {
    if (ctrl_sock < 0) return;
    char buf[16];
    struct sockaddr_in from;
    socklen_t fl = sizeof(from);
    int n;
    while ((n = recvfrom(ctrl_sock, buf, sizeof(buf), MSG_DONTWAIT,
                         (struct sockaddr*)&from, &fl)) > 0) {
        if (n >= 5 && memcmp(buf, "HELLO", 5) == 0) {
            if (peer_ip != from.sin_addr.s_addr) {
                printf("UDP peer → unicast %s\n", inet_ntoa(from.sin_addr));
            }
            peer_ip = from.sin_addr.s_addr;
            peer_seen_us = esp_timer_get_time();
        }
        fl = sizeof(from);
    }
    if (peer_ip && esp_timer_get_time() - peer_seen_us > HELLO_TIMEOUT_US) {
        printf("UDP peer หาย → กลับเป็น broadcast\n");
        peer_ip = 0;
    }
}

static void udp_send_str(const char *msg) {
    if (udp_sock < 0) udp_init();
    if (udp_sock < 0) { st_fail++; return; }
    struct sockaddr_in dst = udp_dest;
    if (peer_ip) dst.sin_addr.s_addr = peer_ip;
    int r = sendto(udp_sock, msg, strlen(msg), 0, (struct sockaddr*)&dst, sizeof(dst));
    if (r < 0) st_fail++; else st_sent++;
}

static void csi_udp_task(void *arg) {
    static csi_item_t it;
    int64_t next_stat = esp_timer_get_time() + 1000000;
    ctrl_init();
    while (true) {
        if (xQueueReceive(csi_queue, &it, pdMS_TO_TICKS(100)) == pdTRUE) {
            std::string line = format_csi_line(&it);
            udp_send_str(line.c_str());
        }
        int64_t now = esp_timer_get_time();
        if (now >= next_stat) {
            next_stat += 1000000;
            ctrl_poll();
            char stat[160];
            snprintf(stat, sizeof(stat),
                     "STAT,%s,%lld,cb=%lu,skip=%lu,dup=%lu,qdrop=%lu,sent=%lu,fail=%lu,dest=%s\n",
                     project_type, (long long)(now / 1000),
                     (unsigned long)st_cb, (unsigned long)st_skip, (unsigned long)st_dup,
                     (unsigned long)st_qdrop,
                     (unsigned long)st_sent, (unsigned long)st_fail,
                     peer_ip ? "unicast" : "broadcast");
            printf("%s", stat);
            udp_send_str(stat);
        }
    }
}
#endif

void _wifi_csi_cb(void *ctx, wifi_csi_info_t *data) {
#ifdef CONFIG_SEND_CSI_TO_UDP
    st_cb++;
    if (src_filter && memcmp(data->mac, src_mac, 6) != 0) {
        st_skip++;
    } else if (src_filter && (int32_t) data->rx_seq == last_seq) {
        st_dup++;                     // เฟรมเดิมที่ #2 ส่งซ้ำ — เก็บแค่ครั้งแรก
    } else if (csi_queue) {
        if (src_filter) last_seq = data->rx_seq;
        fill_item(&cb_item, data);
        if (xQueueSend(csi_queue, &cb_item, 0) != pdTRUE) st_qdrop++;
    }
#endif
#if CONFIG_SEND_CSI_TO_SERIAL
    // ทาง serial คงพฤติกรรมเดิม (format + พิมพ์ใน callback) — dataset ชุดแรกเก็บแบบนี้
    xSemaphoreTake(mutex, portMAX_DELAY);
    static csi_item_t it;             // static — ไม่กิน stack ของ WiFi task (~430 ไบต์)
    fill_item(&it, data);
    outprintf("%s", format_csi_line(&it).c_str());
    vTaskDelay(0);
    xSemaphoreGive(mutex);
#endif
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
#ifdef CONFIG_SEND_CSI_TO_UDP
    src_filter_init();
    csi_queue = xQueueCreate(CSI_QUEUE_LEN, sizeof(csi_item_t));
    // priority ต่ำกว่า WiFi (23) และ lwIP (18) · pin core 1 — WiFi อยู่ core 0
    xTaskCreatePinnedToCore(&csi_udp_task, "csi_udp", 8192, NULL, 5, NULL, 1);
#endif
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(&_wifi_csi_cb, NULL));

    _print_csi_csv_header();
#endif
}

#endif //ESP32_CSI_CSI_COMPONENT_H
