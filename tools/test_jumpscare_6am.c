#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>

#include "eadk.h"
#include "eq_font.h"

void eadk_display_push_rect(eadk_rect_t rect, const eadk_color_t* pixels) { (void)rect; (void)pixels; }
void eadk_display_push_rect_uniform(eadk_rect_t rect, eadk_color_t color) { (void)rect; (void)color; }
void eadk_display_pull_rect(eadk_rect_t rect, eadk_color_t* pixels) { (void)rect; (void)pixels; }
bool eadk_display_wait_for_vblank(void) { return true; }
void eq_display_draw_string(const char* text, eadk_point_t point, bool large_font, eadk_color_t text_color, eadk_color_t background_color) {
    (void)text; (void)point; (void)large_font; (void)text_color; (void)background_color;
}
void eadk_timing_usleep(uint32_t us) { (void)us; }
void eadk_timing_msleep(uint32_t ms) { (void)ms; }
uint32_t _eadk_timing_millis_low(void) { return 0; }
uint32_t _eadk_timing_millis_high(void) { return 0; }
eadk_event_t eadk_event_get(int32_t* timeout) { (void)timeout; return 0; }
void _eadk_keyboard_scan_do_scan(void) {}
uint32_t _eadk_keyboard_scan_high(void) { return 0; }
uint32_t _eadk_keyboard_scan_low(void) { return 0; }

#include "launcher/src/app_fnaf.c"

int main(void) {
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.hour = 5;
    g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 50; // 50 ms before 6 AM (5:59:59 AM)

    // Bonnie jumpscare triggers!
    g_fnaf.state = FNAF_STATE_JUMPSCARE;
    g_fnaf.scare_type = SCARE_BONNIE;
    g_fnaf.scare_timer_ms = 0;

    printf("Jumpscare started at 5:59 AM. hour=%d, hour_timer=%u / %u, state=%d (JUMPSCARE=4)\n",
           g_fnaf.hour, g_fnaf.hour_timer_ms, g_fnaf.hour_duration_ms, g_fnaf.state);

    // Now simulate 2000 ms (jumpscare lasts 1800 ms)
    for (int t = 1; t <= 20; t++) {
        fnaf_update(100);
        if (t % 5 == 0) {
            printf("After +%d ms: state=%d (GAME_OVER=5, WIN_6AM=6), scare_timer=%u, hour=%d, hour_timer=%u\n",
                   t * 100, g_fnaf.state, g_fnaf.scare_timer_ms, g_fnaf.hour, g_fnaf.hour_timer_ms);
        }
    }

    return 0;
}
