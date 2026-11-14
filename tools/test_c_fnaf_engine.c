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

static int g_pass = 0;
static int g_fail = 0;

#define TEST_ASSERT(cond, msg) do { \
    if (cond) { \
        printf("  [PASS] %s\n", msg); \
        g_pass++; \
    } else { \
        printf("  [FAIL] %s\n", msg); \
        g_fail++; \
    } \
} while(0)

// ---------------------------------------------------------------------------
// 1. CLOCK WRAP-AROUND EMPIRICAL TESTS
// ---------------------------------------------------------------------------

void test_clock_wraparound_jumpscare(void) {
    printf("\n--- Test 1.1: 6 AM Override during Jumpscare Animation ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_JUMPSCARE;
    g_fnaf.scare_type = SCARE_BONNIE;
    g_fnaf.scare_timer_ms = 500;
    g_fnaf.hour = 5;
    g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 10; // 10 ms before 6 AM

    // Tick 20 ms (should cross the 6 AM threshold)
    fnaf_update(20);

    TEST_ASSERT(g_fnaf.hour == 6, "Clock must advance to Hour 6 during jumpscare");
    TEST_ASSERT(g_fnaf.state == FNAF_STATE_6AM_WIN, "6 AM victory must unconditionally override jumpscare state");
}

void test_clock_wraparound_blackout(void) {
    printf("\n--- Test 1.2: 6 AM Override during Blackout Toreador Sequence ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_POWER_OUT;
    g_fnaf.toreador_flashing = true;
    g_fnaf.hour = 5;
    g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 10;

    fnaf_update(20);

    TEST_ASSERT(g_fnaf.hour == 6, "Clock must advance to Hour 6 during blackout");
    TEST_ASSERT(g_fnaf.state == FNAF_STATE_6AM_WIN, "6 AM victory must unconditionally override blackout state");
}

void test_clock_wraparound_foxy_sprint(void) {
    printf("\n--- Test 1.3: 6 AM Override during Foxy sprint attack ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(2);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.door_left_closed = false;
    g_fnaf.foxy_stage = 3;
    g_fnaf.foxy_sprint_timer = 5; // 5 ms before attack
    g_fnaf.hour = 5;
    g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 5; // 5 ms before 6 AM

    // Tick 10 ms
    fnaf_update(10);

    TEST_ASSERT(g_fnaf.hour == 6, "Clock must advance to Hour 6 during Foxy sprint");
    TEST_ASSERT(g_fnaf.state == FNAF_STATE_6AM_WIN, "6 AM victory must unconditionally override Foxy attack");
}

// ---------------------------------------------------------------------------
// 2. RAPID INPUT STRESS EMPIRICAL TESTS
// ---------------------------------------------------------------------------

void test_rapid_inputs(void) {
    printf("\n--- Test 2.1: Rapid Door, Light, and Pan Toggles ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;

    bool usage_invariant_held = true;
    bool light_exclusivity_held = true;
    bool pan_away_shuts_light = true;

    // Simulate 500 rapid key events
    for (int i = 0; i < 500; i++) {
        uint64_t k = 0;
        int act = i % 6;
        if (act == 0) k = (1ULL << eadk_key_left);
        else if (act == 1) k = (1ULL << eadk_key_right);
        else if (act == 2) k = (1ULL << eadk_key_ok);
        else if (act == 3) k = (1ULL << eadk_key_back);
        else if (act == 4) k = (1ULL << eadk_key_up);
        else if (act == 5) k = (1ULL << eadk_key_down);

        int prev_pan = g_fnaf.view_pan;
        bool prev_light_l = g_fnaf.light_left_on;
        bool prev_light_r = g_fnaf.light_right_on;

        fnaf_handle_input(k, k);
        fnaf_update(16);

        if (g_fnaf.power_usage_bars < 1 || g_fnaf.power_usage_bars > 5) {
            usage_invariant_held = false;
        }
        if (g_fnaf.light_left_on && g_fnaf.light_right_on) {
            light_exclusivity_held = false;
        }
        // If we panned away from left door while left light was on, did it auto-shut?
        if (prev_pan == 0 && g_fnaf.view_pan != 0 && prev_light_l && g_fnaf.light_left_on) {
            pan_away_shuts_light = false;
        }
    }

    TEST_ASSERT(usage_invariant_held, "Power usage bars strictly clamped in [1, 5] across 500 rapid toggles");
    TEST_ASSERT(light_exclusivity_held, "Light mutual exclusivity (Left & Right never on together) preserved");
    TEST_ASSERT(pan_away_shuts_light, "Panning away from door turns off hallway blindspot light");
}

void test_rapid_camera_switching(void) {
    printf("\n--- Test 2.2: Rapid Camera Switching ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.monitor_up = true;

    bool cam_bounds_held = true;

    for (int i = 0; i < 500; i++) {
        uint64_t k = (i % 2 == 0) ? (1ULL << eadk_key_left) : (1ULL << eadk_key_right);
        fnaf_handle_input(k, k);
        fnaf_update(16);
        if (g_fnaf.active_cam < 0 || g_fnaf.active_cam >= CAM_COUNT) {
            cam_bounds_held = false;
        }
    }

    TEST_ASSERT(cam_bounds_held, "Active camera index strictly clamped in [0, CAM_COUNT - 1] during rapid navigation");
}

// ---------------------------------------------------------------------------
// 3. CUSTOM NIGHT EXTREMES
// ---------------------------------------------------------------------------

void test_custom_night_0000(void) {
    printf("\n--- Test 3.1: Custom Night 0/0/0/0 Inactivity & Hourly Boost Immunity ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    g_fnaf.state = FNAF_STATE_CUSTOM_NIGHT;
    g_fnaf.ai_freddy = 0;
    g_fnaf.ai_bonnie = 0;
    g_fnaf.ai_chica = 0;
    g_fnaf.ai_foxy = 0;
    g_fnaf.custom_selected_bot = 4;
    fnaf_start_night(7); // Launch Custom Night
    g_fnaf.ai_freddy = 0;
    g_fnaf.ai_bonnie = 0;
    g_fnaf.ai_chica = 0;
    g_fnaf.ai_foxy = 0;

    // Simulate 4 hours to pass 2 AM, 3 AM, 4 AM
    for (int h = 0; h < 4; h++) {
        g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 1;
        fnaf_update(2);
    }

    TEST_ASSERT(g_fnaf.ai_bonnie == 0, "Custom Night 0/0/0/0: Bonnie AI must remain 0 (immune to hourly escalation)");
    TEST_ASSERT(g_fnaf.ai_chica == 0, "Custom Night 0/0/0/0: Chica AI must remain 0 (immune to hourly escalation)");
    TEST_ASSERT(g_fnaf.ai_foxy == 0, "Custom Night 0/0/0/0: Foxy AI must remain 0 (immune to hourly escalation)");
    TEST_ASSERT(g_fnaf.bonnie_loc == LOC_STAGE, "Custom Night 0/0/0/0: Bonnie never leaves Show Stage");
    TEST_ASSERT(g_fnaf.chica_loc == LOC_STAGE, "Custom Night 0/0/0/0: Chica never leaves Show Stage");
    TEST_ASSERT(g_fnaf.foxy_stage == 0, "Custom Night 0/0/0/0: Foxy stays at Stage 0 (curtain closed)");
}

void test_custom_night_20202020(void) {
    printf("\n--- Test 3.2: Custom Night 20/20/20/20 Extreme Activity ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(7);
    g_fnaf.ai_freddy = 20;
    g_fnaf.ai_bonnie = 20;
    g_fnaf.ai_chica = 20;
    g_fnaf.ai_foxy = 20;
    g_fnaf.state = FNAF_STATE_OFFICE;

    // Run 200 ticks of simulation (stress test)
    for (int i = 0; i < 200; i++) {
        fnaf_update(50);
    }

    TEST_ASSERT(g_fnaf.state == FNAF_STATE_OFFICE || g_fnaf.state == FNAF_STATE_JUMPSCARE || g_fnaf.state == FNAF_STATE_POWER_OUT,
                "Custom Night 20/20/20/20: State machine remains stable without corrupt states");
}

// ---------------------------------------------------------------------------
// 4. POWER EDGE CASES
// ---------------------------------------------------------------------------

void test_power_clamp_and_foxy_strike(void) {
    printf("\n--- Test 4.1: Foxy Door Strike Power Penalty & Negative Clamping ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(2);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.power_percent = 3.0f;
    g_fnaf.door_left_closed = true;
    g_fnaf.foxy_stage = 3;
    g_fnaf.foxy_sprint_timer = 10;
    g_fnaf.foxy_bang_count = 1; // Next hit penalty is 6.0f (3.0 - 6.0 = -3.0f)

    // Tick 20 ms -> Foxy strikes door!
    fnaf_update(20);

    TEST_ASSERT(g_fnaf.power_percent == 0.0f, "Power percent clamps cleanly to 0.0% (never negative)");
    TEST_ASSERT(g_fnaf.state == FNAF_STATE_POWER_OUT, "Exhausting power via Foxy strike immediately triggers POWER_OUT blackout");
    TEST_ASSERT(g_fnaf.door_left_closed == false, "Blackout immediately forces Left Door open");
}

void test_five_usage_bars_drain(void) {
    printf("\n--- Test 4.2: 5 Usage Bars Extreme Battery Drain ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.door_left_closed = true;
    g_fnaf.door_right_closed = true;
    g_fnaf.light_left_on = true;
    g_fnaf.monitor_up = true;

    fnaf_update(16);

    TEST_ASSERT(g_fnaf.power_usage_bars == 5, "Power usage bars clamp strictly to 5 with all devices active");

    float initial_power = g_fnaf.power_percent;
    // Usage 5 interval is 9670 / 5 = 1934 ms in NORMAL mode.
    // Advance 2000 ms -> should lose exactly 1% power
    fnaf_update(2000);

    TEST_ASSERT(g_fnaf.power_percent <= initial_power - 1.0f, "Usage 5 drains at extreme ~1.93s per 1% battery rate");
}

int main(void) {
    printf("============================================================\n");
    printf("C EMPIRICAL VERIFICATION SUITE: FNAF ENGINE (app_fnaf.c)\n");
    printf("============================================================\n");

    test_clock_wraparound_jumpscare();
    test_clock_wraparound_blackout();
    test_clock_wraparound_foxy_sprint();
    test_rapid_inputs();
    test_rapid_camera_switching();
    test_custom_night_0000();
    test_custom_night_20202020();
    test_power_clamp_and_foxy_strike();
    test_five_usage_bars_drain();

    printf("\n============================================================\n");
    printf("TOTAL: %d, PASS: %d, FAIL: %d\n", g_pass + g_fail, g_pass, g_fail);
    printf("============================================================\n");

    return (g_fail > 0) ? 1 : 0;
}
