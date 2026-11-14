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
    fnaf_start_night(2);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.power_percent = 3.0f;
    g_fnaf.door_left_closed = true;
    g_fnaf.foxy_stage = 3;
    g_fnaf.foxy_sprint_timer = 5;
    g_fnaf.foxy_bang_count = 1; // 2nd hit: 6% penalty -> 3% - 6% = -3% -> clamps to 0%

    printf("Before Foxy Strike: state=%d (OFFICE=2), power=%.1f%%, door_left_closed=%d\n",
           g_fnaf.state, g_fnaf.power_percent, g_fnaf.door_left_closed);

    // Tick 10 ms (Foxy sprint timer expires -> bangs door)
    fnaf_update(10);

    printf("Immediately After Strike (tick 10ms): state=%d (POWER_OUT=3), power=%.1f%%, door_left_closed=%d\n",
           g_fnaf.state, g_fnaf.power_percent, g_fnaf.door_left_closed);

    // Tick 1000 ms more
    fnaf_update(1000);
    printf("After +1000ms: state=%d, power=%.1f%%, door_left_closed=%d\n",
           g_fnaf.state, g_fnaf.power_percent, g_fnaf.door_left_closed);

    // Tick until drain accumulator reaches drain_interval_ms (~4830 ms for 2 bars)
    for (int t = 0; t < 10; t++) {
        fnaf_update(500);
        printf("After +%d ms: state=%d, power=%.1f%%, door_left_closed=%d\n",
               (t + 3) * 500, g_fnaf.state, g_fnaf.power_percent, g_fnaf.door_left_closed);
        if (g_fnaf.state == FNAF_STATE_POWER_OUT) break;
    }

    return 0;
}
