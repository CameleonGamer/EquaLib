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
    g_fnaf.view_pan = 0; // Left door view

    // Turn on left light
    fnaf_handle_input(1ULL << eadk_key_back, 1ULL << eadk_key_back);
    printf("At Pan 0, Light Left is: %s\n", g_fnaf.light_left_on ? "ON" : "OFF");

    // Pan right to center desk
    fnaf_handle_input(1ULL << eadk_key_right, 1ULL << eadk_key_right);
    printf("Panned to Pan %d, Light Left is: %s\n", g_fnaf.view_pan, g_fnaf.light_left_on ? "ON" : "OFF");

    // Pan right to right door
    fnaf_handle_input(1ULL << eadk_key_right, 1ULL << eadk_key_right);
    printf("Panned to Pan %d, Light Left is: %s\n", g_fnaf.view_pan, g_fnaf.light_left_on ? "ON" : "OFF");

    return 0;
}
