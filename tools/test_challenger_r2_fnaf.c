#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

#include "eadk.h"
#include "eq_font.h"

// Stubs for EADK platform calls to allow native GCC execution
void eadk_display_push_rect(eadk_rect_t rect, const eadk_color_t* pixels) {
    (void)rect;
    (void)pixels;
    // Verify rect bounds strictly conform to ST7789 320x240
    assert(rect.x + rect.width <= 320);
    assert(rect.y + rect.height <= 240);
}

void eadk_display_push_rect_uniform(eadk_rect_t rect, eadk_color_t color) {
    (void)rect;
    (void)color;
    assert(rect.x + rect.width <= 320);
    assert(rect.y + rect.height <= 240);
}

void eadk_display_pull_rect(eadk_rect_t rect, eadk_color_t* pixels) {
    (void)rect;
    (void)pixels;
}

bool eadk_display_wait_for_vblank(void) {
    return true;
}

void eq_display_draw_string(const char* text, eadk_point_t point, bool large_font, eadk_color_t text_color, eadk_color_t background_color) {
    (void)text;
    (void)point;
    (void)large_font;
    (void)text_color;
    (void)background_color;
}

void eadk_timing_usleep(uint32_t us) { (void)us; }
void eadk_timing_msleep(uint32_t ms) { (void)ms; }
uint32_t _eadk_timing_millis_low(void) { return 0; }
uint32_t _eadk_timing_millis_high(void) { return 0; }
eadk_event_t eadk_event_get(int32_t* timeout) { (void)timeout; return 0; }
void _eadk_keyboard_scan_do_scan(void) {}
uint32_t _eadk_keyboard_scan_high(void) { return 0; }
uint32_t _eadk_keyboard_scan_low(void) { return 0; }

// Include actual game implementation
#include "launcher/src/app_fnaf.c"

static int s_tests_run = 0;
static int s_tests_passed = 0;
static int s_tests_failed = 0;

#define CHALLENGER_ASSERT(cond, name) do { \
    s_tests_run++; \
    if (cond) { \
        s_tests_passed++; \
        printf("  [PASS] %s\n", (name)); \
    } else { \
        s_tests_failed++; \
        printf("  [FAIL] %s (Line %d: %s)\n", (name), __LINE__, #cond); \
    } \
} while(0)

/* =========================================================================
 * 1. 6 AM JUMPSCARE OVERRIDE EMPIRICAL TESTS
 * ========================================================================= */

void test_6am_override_normal_jumpscare(void) {
    printf("\n[GROUP 1.1] 6 AM Override during ongoing Bonnie Jumpscare\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.hour = 5;
    // 5:59:59 AM (1000 ms before 6 AM)
    g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 1000;

    // Trigger jumpscare
    g_fnaf.state = FNAF_STATE_JUMPSCARE;
    g_fnaf.scare_type = SCARE_BONNIE;
    g_fnaf.scare_timer_ms = 100;

    // Simulate 1500 ms in steps of 50 ms
    for (int i = 0; i < 30; i++) {
        fnaf_update(50);
    }

    CHALLENGER_ASSERT(g_fnaf.hour >= 6, "Clock reached 6 AM during jumpscare");
    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_6AM_WIN, "State must be FNAF_STATE_6AM_WIN");
    CHALLENGER_ASSERT(g_fnaf.state != FNAF_STATE_GAME_OVER, "State must NOT be GAME_OVER");

    // Advance an additional 3000 ms to ensure win state persists and does not revert to death
    for (int i = 0; i < 60; i++) {
        fnaf_update(50);
    }
    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_6AM_WIN, "Win state persists through subsequent updates");
}

void test_6am_override_1ms_boundary(void) {
    printf("\n[GROUP 1.2] 6 AM Override boundary condition (1 ms remaining)\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_JUMPSCARE;
    g_fnaf.scare_type = SCARE_CHICA;
    g_fnaf.scare_timer_ms = 1750; // Jumpscare ends at 1800 ms (50 ms before Game Over)
    g_fnaf.hour = 5;
    g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 1; // Exactly 1 ms before 6 AM

    // Advance 2 ms: 6 AM should trigger first and pre-empt Game Over
    fnaf_update(2);

    CHALLENGER_ASSERT(g_fnaf.hour == 6, "Hour increments to 6 on 1ms boundary");
    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_6AM_WIN, "6 AM overrides jumpscare even when scare_timer_ms was at 1750ms");
}

void test_6am_override_blackout_freddy(void) {
    printf("\n[GROUP 1.3] 6 AM Override during Freddy Power Outage Jumpscare\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_JUMPSCARE;
    g_fnaf.scare_type = SCARE_FREDDY_POWER_OUT;
    g_fnaf.scare_timer_ms = 800;
    g_fnaf.hour = 5;
    g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 500;

    // Advance 1000 ms
    fnaf_update(1000);

    CHALLENGER_ASSERT(g_fnaf.hour == 6, "Hour reaches 6 AM during blackout jumpscare");
    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_6AM_WIN, "Blackout jumpscare cleanly converts to 6 AM win");
}

/* =========================================================================
 * 2. FOXY DOOR STRIKE BLACKOUT EMPIRICAL TESTS
 * ========================================================================= */

void test_foxy_blackout_at_3percent(void) {
    printf("\n[GROUP 2.1] Foxy Door Strike at 3.0% battery with 2nd bang\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(2);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.power_percent = 3.0f;
    g_fnaf.door_left_closed = true;
    g_fnaf.door_right_closed = true;
    g_fnaf.light_left_on = true;
    g_fnaf.monitor_up = false;
    g_fnaf.foxy_stage = 3;
    g_fnaf.foxy_sprint_timer = 20; // 20 ms left in sprint
    g_fnaf.foxy_bang_count = 1;    // Next hit: 1% + 5% * 1 = 6% penalty

    // Advance 20 ms (exact strike moment)
    fnaf_update(20);

    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_POWER_OUT, "State immediately becomes FNAF_STATE_POWER_OUT on strike tick");
    CHALLENGER_ASSERT(g_fnaf.power_percent == 0.0f, "Power percent is clamped to exactly 0.0%");
    CHALLENGER_ASSERT(g_fnaf.door_left_closed == false, "Left door must be forced open immediately");
    CHALLENGER_ASSERT(g_fnaf.door_right_closed == false, "Right door must be forced open immediately");
    CHALLENGER_ASSERT(g_fnaf.light_left_on == false, "Left light must be shut off immediately");
    CHALLENGER_ASSERT(g_fnaf.light_right_on == false, "Right light must be shut off immediately");
    CHALLENGER_ASSERT(g_fnaf.monitor_up == false, "Monitor must be forced down immediately");
}

void test_foxy_blackout_boundary_cases(void) {
    printf("\n[GROUP 2.2] Foxy Door Strike at 1.0% and 0.5% battery\n");
    // Test 1.0% battery, 1st bang (1% penalty -> 0.0%)
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(2);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.power_percent = 1.0f;
    g_fnaf.door_left_closed = true;
    g_fnaf.foxy_stage = 3;
    g_fnaf.foxy_sprint_timer = 10;
    g_fnaf.foxy_bang_count = 0; // 1st bang: penalty 1.0%

    fnaf_update(10);
    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_POWER_OUT, "1.0% battery strikes down to POWER_OUT immediately");
    CHALLENGER_ASSERT(g_fnaf.power_percent == 0.0f, "Power percent is 0.0%");
    CHALLENGER_ASSERT(!g_fnaf.door_left_closed, "Left door is open");

    // Test 0.5% battery, 1st bang (1% penalty -> -0.5% -> clamp to 0.0%)
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(2);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.power_percent = 0.5f;
    g_fnaf.door_left_closed = true;
    g_fnaf.foxy_stage = 3;
    g_fnaf.foxy_sprint_timer = 10;
    g_fnaf.foxy_bang_count = 0;

    fnaf_update(10);
    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_POWER_OUT, "0.5% battery clamps to POWER_OUT");
    CHALLENGER_ASSERT(g_fnaf.power_percent == 0.0f, "Power percent clamped to 0.0% (not negative)");

    // Test AI isolation: in POWER_OUT, standard AI ticks are frozen
    fnaf_update(10000);
    CHALLENGER_ASSERT(g_fnaf.state == FNAF_STATE_POWER_OUT || g_fnaf.state == FNAF_STATE_JUMPSCARE, 
                      "State remains in blackout flow, no animatronics entering office");
}

/* =========================================================================
 * 3. CUSTOM NIGHT 0/0/0/0 AI GUARD EMPIRICAL TESTS
 * ========================================================================= */

void test_custom_night_0000_normal_pacing(void) {
    printf("\n[GROUP 3.1] Custom Night 0/0/0/0 AI Guard (NORMAL Pacing)\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(7); // Night 7
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.ai_freddy = 0;
    g_fnaf.ai_bonnie = 0;
    g_fnaf.ai_chica = 0;
    g_fnaf.ai_foxy = 0;

    bool all_ai_zero_throughout = true;

    // Simulate entire night: 6 hours
    for (int h = 1; h <= 6; h++) {
        // Advance clock to right before hour transition
        g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 10;
        fnaf_update(20); // Cross hour threshold

        if (g_fnaf.ai_freddy != 0 || g_fnaf.ai_bonnie != 0 || g_fnaf.ai_chica != 0 || g_fnaf.ai_foxy != 0) {
            all_ai_zero_throughout = false;
            printf("    Failed at hour %d: AI levels F=%d, B=%d, C=%d, Fox=%d\n",
                   g_fnaf.hour, g_fnaf.ai_freddy, g_fnaf.ai_bonnie, g_fnaf.ai_chica, g_fnaf.ai_foxy);
        }
    }

    CHALLENGER_ASSERT(all_ai_zero_throughout, "Custom Night 0/0/0/0: All animatronics strictly AI 0 across all 6 hours");
    CHALLENGER_ASSERT(g_fnaf.bonnie_loc == LOC_STAGE, "Bonnie stayed at Stage");
    CHALLENGER_ASSERT(g_fnaf.chica_loc == LOC_STAGE, "Chica stayed at Stage");
    CHALLENGER_ASSERT(g_fnaf.foxy_stage == 0, "Foxy stayed at Stage 0");
    CHALLENGER_ASSERT(g_fnaf.freddy_loc == LOC_STAGE, "Freddy stayed at Stage");
}

void test_custom_night_0000_fast_pacing(void) {
    printf("\n[GROUP 3.2] Custom Night 0/0/0/0 AI Guard (FAST Pacing)\n");
    fnaf_init_game(FNAF_PACING_FAST);
    fnaf_start_night(7); // Night 7
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.ai_freddy = 0;
    g_fnaf.ai_bonnie = 0;
    g_fnaf.ai_chica = 0;
    g_fnaf.ai_foxy = 0;

    // Check immediately after init
    CHALLENGER_ASSERT(g_fnaf.ai_bonnie == 0, "FAST mode does NOT increment Custom Night AI on start");
    CHALLENGER_ASSERT(g_fnaf.ai_chica == 0, "FAST mode does NOT increment Chica AI on start");
    CHALLENGER_ASSERT(g_fnaf.ai_foxy == 0, "FAST mode does NOT increment Foxy AI on start");
    CHALLENGER_ASSERT(g_fnaf.ai_freddy == 0, "FAST mode does NOT increment Freddy AI on start");

    bool all_ai_zero_fast = true;
    for (int h = 1; h <= 6; h++) {
        g_fnaf.hour_timer_ms = g_fnaf.hour_duration_ms - 10;
        fnaf_update(20);
        if (g_fnaf.ai_freddy != 0 || g_fnaf.ai_bonnie != 0 || g_fnaf.ai_chica != 0 || g_fnaf.ai_foxy != 0) {
            all_ai_zero_fast = false;
        }
    }

    CHALLENGER_ASSERT(all_ai_zero_fast, "Custom Night 0/0/0/0 in FAST mode preserves 0 AI levels across all hours");
}

/* =========================================================================
 * 4. LIGHT AUTO-SHUT ON PAN EMPIRICAL TESTS
 * ========================================================================= */

void test_light_auto_shut_on_pan(void) {
    printf("\n[GROUP 4.1] Hallway Light Auto-Shut on View Pan\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;

    // Start at pan 0 (left door)
    g_fnaf.view_pan = 0;

    // 1. Turn left light on via Back key
    fnaf_handle_input(1ULL << eadk_key_back, 1ULL << eadk_key_back);
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.light_left_on == true, "Left light is ON at Pan 0");
    CHALLENGER_ASSERT(g_fnaf.light_right_on == false, "Right light is OFF at Pan 0");

    // 2. Pan right to center (pan 1)
    fnaf_handle_input(1ULL << eadk_key_right, 1ULL << eadk_key_right);
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.view_pan == 1, "Panned to Pan 1 (center)");
    CHALLENGER_ASSERT(g_fnaf.light_left_on == false, "Left light turned OFF immediately upon panning to Pan 1");
    CHALLENGER_ASSERT(g_fnaf.light_right_on == false, "Right light remains OFF");

    // 3. Pan right to pan 2 (right door)
    fnaf_handle_input(1ULL << eadk_key_right, 1ULL << eadk_key_right);
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.view_pan == 2, "Panned to Pan 2 (right door)");
    CHALLENGER_ASSERT(g_fnaf.light_left_on == false, "Left light still OFF");

    // 4. Turn right light on via Back key
    fnaf_handle_input(1ULL << eadk_key_back, 1ULL << eadk_key_back);
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.light_right_on == true, "Right light is ON at Pan 2");

    // 5. Pan left to center (pan 1)
    fnaf_handle_input(1ULL << eadk_key_left, 1ULL << eadk_key_left);
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.view_pan == 1, "Panned back to Pan 1 (center)");
    CHALLENGER_ASSERT(g_fnaf.light_right_on == false, "Right light turned OFF immediately upon panning to Pan 1");

    // 6. Attempt to turn lights ON while at Pan 1
    fnaf_handle_input(1ULL << eadk_key_back, 1ULL << eadk_key_back);
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.light_left_on == false && g_fnaf.light_right_on == false, 
                      "Pressing Back key at Pan 1 does not turn on any light");

    // 7. Defense-in-depth: If light_left_on is forcefully injected while view_pan == 1, fnaf_update must clear it
    g_fnaf.light_left_on = true;
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.light_left_on == false, "Defense-in-depth in fnaf_update clears light_left_on when view_pan != 0");

    g_fnaf.light_right_on = true;
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.light_right_on == false, "Defense-in-depth in fnaf_update clears light_right_on when view_pan != 2");
}

/* =========================================================================
 * 5. RAPID STRESS & CORNER CASES
 * ========================================================================= */

void test_stress_rapid_pan_and_light_switching(void) {
    printf("\n[GROUP 5.1] Stress Test: 1000 Rapid Pan and Light Toggles\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;

    bool invariant_pan_light_consistent = true;

    for (int i = 0; i < 1000; i++) {
        int r = rand() % 4;
        uint64_t key = 0;
        if (r == 0) key = (1ULL << eadk_key_left);
        else if (r == 1) key = (1ULL << eadk_key_right);
        else if (r == 2) key = (1ULL << eadk_key_back);
        else if (r == 3) key = (1ULL << eadk_key_ok);

        fnaf_handle_input(key, key);
        fnaf_update(16);

        if (g_fnaf.view_pan != 0 && g_fnaf.light_left_on) {
            invariant_pan_light_consistent = false;
        }
        if (g_fnaf.view_pan != 2 && g_fnaf.light_right_on) {
            invariant_pan_light_consistent = false;
        }
        if (g_fnaf.light_left_on && g_fnaf.light_right_on) {
            invariant_pan_light_consistent = false;
        }
    }

    CHALLENGER_ASSERT(invariant_pan_light_consistent, "Invariant held: Hallway lights never remain on outside their respective views across 1000 rapid inputs");
}

void test_screamer_coordinate_safety(void) {
    printf("\n[GROUP 5.2] Display Coordinate Safety Clamping Verification\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_JUMPSCARE;
    g_fnaf.scare_type = SCARE_BONNIE;

    // Call fnaf_draw_image with adversarial coordinates: negative, large positive, out of bounds
    // Since eadk_display_push_rect has assert(rect.x + rect.width <= 320 && rect.y + rect.height <= 240),
    // any coordinate leakage will trigger an assertion abort!
    fnaf_draw_image(FNAF_IMG_SCARE_BONNIE, -100, -100);
    fnaf_draw_image(FNAF_IMG_SCARE_BONNIE, 500, 500);
    fnaf_draw_image(FNAF_IMG_SCARE_BONNIE, -4, 4);
    fnaf_draw_image(FNAF_IMG_SCARE_BONNIE, 4, -4);

    CHALLENGER_ASSERT(true, "fnaf_draw_image successfully clamped adversarial coordinates without ST7789 display overflow");
}

void test_usage_5_bars_with_pan_validation(void) {
    printf("\n[GROUP 5.3] Usage 5 Bars Drain Rate & Pan Auto-Shut Energy Conservation\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.view_pan = 0; // MUST be at pan 0 for light_left to stay on!
    g_fnaf.door_left_closed = true;
    g_fnaf.door_right_closed = true;
    g_fnaf.light_left_on = true;
    g_fnaf.monitor_up = true;

    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.power_usage_bars == 5, "Power usage reaches 5 bars when at Pan 0 with both doors, left light, and monitor active");

    float p0 = g_fnaf.power_percent;
    // At usage 5, interval is 9670 / 5 = 1934 ms. Advance 2000 ms.
    fnaf_update(2000);
    CHALLENGER_ASSERT(g_fnaf.power_percent <= p0 - 1.0f, "Usage 5 drains at ~1.93s per 1% battery");

    // Now lower monitor and pan to center (pan 1): left light should auto-shut and usage should drop to 3 bars (or 2 if doors remain closed)!
    fnaf_handle_input(1ULL << eadk_key_down, 1ULL << eadk_key_down); // Flip monitor down
    CHALLENGER_ASSERT(g_fnaf.monitor_up == false, "Monitor flipped down");

    fnaf_handle_input(1ULL << eadk_key_right, 1ULL << eadk_key_right); // Pan right to center
    fnaf_update(16);
    CHALLENGER_ASSERT(g_fnaf.view_pan == 1, "Panned to Pan 1");
    CHALLENGER_ASSERT(g_fnaf.light_left_on == false, "Light auto-shut upon panning to center");
    CHALLENGER_ASSERT(g_fnaf.power_usage_bars == 3, "Power usage drops to 3 bars (base + 2 doors), conserving battery in the background");
}

/* =========================================================================
 * MAIN TEST RUNNER
 * ========================================================================= */

int main(void) {
    printf("======================================================================\n");
    printf("CHALLENGER R2 EMPIRICAL ADVERSARIAL STRESS SUITE (app_fnaf.c)\n");
    printf("======================================================================\n");

    test_6am_override_normal_jumpscare();
    test_6am_override_1ms_boundary();
    test_6am_override_blackout_freddy();

    test_foxy_blackout_at_3percent();
    test_foxy_blackout_boundary_cases();

    test_custom_night_0000_normal_pacing();
    test_custom_night_0000_fast_pacing();

    test_light_auto_shut_on_pan();

    test_stress_rapid_pan_and_light_switching();
    test_screamer_coordinate_safety();
    test_usage_5_bars_with_pan_validation();

    printf("\n======================================================================\n");
    printf("CHALLENGER RESULTS: Total: %d, Passed: %d, Failed: %d\n", 
           s_tests_run, s_tests_passed, s_tests_failed);
    printf("======================================================================\n");

    if (s_tests_failed == 0) {
        printf("VERDICT: ALL ADVERSARIAL STRESS TESTS PASSED EMPIRICALLY!\n");
        return 0;
    } else {
        printf("VERDICT: FAILURES DETECTED (%d failed tests)!\n", s_tests_failed);
        return 1;
    }
}
