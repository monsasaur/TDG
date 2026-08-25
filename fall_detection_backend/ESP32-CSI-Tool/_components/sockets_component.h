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

        double lag = 0.0;
        while (1) {
            double start_time = get_steady_clock_timestamp();

            if (!is_wifi_connected()) {
                printf("ERROR: wifi is not connected\n");
                break;
            }

            // UDP sendto ไม่ต้อง connect ไม่มี error
            sendto(socket_fd, data, strlen(data), 0,
                   (const struct sockaddr *) &caddr, sizeof(caddr));

#if defined CONFIG_PACKET_RATE && (CONFIG_PACKET_RATE > 0)
            double wait_ms = (1000.0 / CONFIG_PACKET_RATE) - (lag * 1000.0);
            int w = (int) floor(wait_ms);
            if (w > 0) vTaskDelay(pdMS_TO_TICKS(w));
#else
            vTaskDelay(pdMS_TO_TICKS(10));
#endif
            double end_time = get_steady_clock_timestamp();
            lag = end_time - start_time;
        }

        close(socket_fd);
    }
}