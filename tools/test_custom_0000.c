#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <assert.h>

#include "eadk.h"
#include "eq_font.h"

// Define stubs for EADK symbols
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
    fnaf_start_night(7);
    g_fnaf.state = FNAF_STATE_OFFICE; // Skip intro
    g_fnaf.ai_freddy = 0;
    g_fnaf.ai_bonnie = 0;
    g_fnaf.ai_chica = 0;
    g_fnaf.ai_foxy = 0;

    printf("Starting Custom Night 7 with AI 0/0/0/0. Current hour: %d\n", g_fnaf.hour);
    for (int h = 1; h <= 5; h++) {
        g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 10;
        fnaf_update(20);
        printf("Hour %d AM -> Bonnie AI: %d, Chica AI: %d, Foxy AI: %d, Freddy AI: %d\n",
               g_fnaf.hour, g_fnaf.ai_bonnie, g_fnaf.ai_chica, g_fnaf.ai_foxy, g_fnaf.ai_freddy);
    }
    return 0;
}
