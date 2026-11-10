#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <sys/types.h>
#include <unistd.h>
#include <signal.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include <esp_http_server.h>

char *data = (char *) "1\n";

void socket_transmitter_sta_loop(bool (*is_wifi_connected)()) {
    while (1) {
        // รอให้ WiFi เชื่อมต่อก่อน
        while (!is_wifi_connected()) {
            printf("wifi not connected. waiting...\n");
            vTaskDelay(1000 / portTICK_PERIOD_MS);
        }
        printf("wifi connected. sending packets...\n");

        // สร้าง UDP socket
        int socket_fd = socket(PF_INET, SOCK_DGRAM, 0);
        if (socket_fd == -1) {
            printf("ERROR: Socket creation error [%s]\n", strerror(errno));
            vTaskDelay(1000 / portTICK_PERIOD_MS);
            continue;
        }

        // ส่งไปหา ESP32 AP เพื่อ trigger CSI
        struct sockaddr_in caddr;
        caddr.sin_family = AF_INET;
        caddr.sin_port   = htons(5500);
        inet_aton("192.168.4.1", &caddr.sin_addr);  // IP ของ ESP32 AP

        printf("sending frames to AP 192.168.4.1:5500\n");

        // ส่งตามจังหวะคงที่ด้วย vTaskDelayUntil
        //
        // เดิมคำนวณ lag = end - start โดยวัด *รวมเวลา vTaskDelay ของรอบเดียวกันไปด้วย*
        // ผลคือรอบถัดไป wait_ms ≤ 0 เลยไม่หน่วงเลย → ส่งเป็นคู่ ๆ ติดกันแล้วเว้น 10 ms
        // อัตราจริงจึงไม่ได้คุมที่ PACKET_RATE: ถูกกดด้วยอะไรก็ตามที่ทำให้ sendto ช้า
        // (เช่น CSI ฝั่ง #2 พ่น UART 115200) วัดจริง 2026-11-11: ปิด CSI ที่ #2 แล้ว
        // #1 ได้เฟรมจาก #2 ถึง 150-310/วิ ทั้งที่ตั้งไว้ 100 · ชุดข้อมูลแรกได้ 73 แบบแกว่ง
#if defined CONFIG_PACKET_RATE && (CONFIG_PACKET_RATE > 0)
        TickType_t period = pdMS_TO_TICKS(1000 / CONFIG_PACKET_RATE);
#else
        TickType_t period = pdMS_TO_TICKS(10);
#endif
        if (period < 1) period = 1;
        TickType_t last_wake = xTaskGetTickCount();
        while (1) {
            if (!is_wifi_connected()) {
                printf("ERROR: wifi is not connected\n");
                break;
            }

            // UDP sendto ไม่ต้อง connect ไม่มี error
            sendto(socket_fd, data, strlen(data), 0,
                   (const struct sockaddr *) &caddr, sizeof(caddr));

            // ถ้าช้ากว่ากำหนด (sendto ค้าง) จะไม่ส่งชดเชยรัว ๆ — ข้ามไปจังหวะถัดไปเลย
            if (xTaskGetTickCount() - last_wake >= period) {
                last_wake = xTaskGetTickCount();
            }
            vTaskDelayUntil(&last_wake, period);
        }

        close(socket_fd);
    }
}