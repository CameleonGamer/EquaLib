#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

#include "eadk.h"
#include "eq_font.h"

// Tracking variables for display boundary verification
static uint64_t g_total_pushes = 0;
static uint64_t g_boundary_violations = 0;
static uint16_t g_min_x = 0xFFFF;
static uint16_t g_max_x_bound = 0;
static uint16_t g_min_y = 0xFFFF;
static uint16_t g_max_y_bound = 0;

static void check_rect_bounds(eadk_rect_t rect, const char* context) {
    g_total_pushes++;
    
    // Check bounds against ST7789 display controller limits (320x240)
    // Coords are [0, 319] and [0, 239]
    bool valid = true;
    if (rect.x >= EADK_SCREEN_WIDTH) valid = false;
    if (rect.y >= EADK_SCREEN_HEIGHT) valid = false;
    if (rect.width == 0 || rect.height == 0) valid = false;
    if ((uint32_t)rect.x + (uint32_t)rect.width > EADK_SCREEN_WIDTH) valid = false;
    if ((uint32_t)rect.y + (uint32_t)rect.height > EADK_SCREEN_HEIGHT) valid = false;

    if (!valid) {
        g_boundary_violations++;
        printf("  [VIOLATION in %s] rect={x=%u, y=%u, w=%u, h=%u} violates ST7789 [320x240]!\n",
               context, rect.x, rect.y, rect.width, rect.height);
    }

    if (rect.x < g_min_x) g_min_x = rect.x;
    if (rect.x + rect.width > g_max_x_bound) g_max_x_bound = rect.x + rect.width;
    if (rect.y < g_min_y) g_min_y = rect.y;
    if (rect.y + rect.height > g_max_y_bound) g_max_y_bound = rect.y + rect.height;
}

// Display function stubs with bounds checking
void eadk_display_push_rect(eadk_rect_t rect, const eadk_color_t* pixels) {
    (void)pixels;
    check_rect_bounds(rect, "eadk_display_push_rect");
}

void eadk_display_push_rect_uniform(eadk_rect_t rect, eadk_color_t color) {
    (void)color;
    check_rect_bounds(rect, "eadk_display_push_rect_uniform");
}

void eadk_display_pull_rect(eadk_rect_t rect, eadk_color_t* pixels) {
    (void)rect; (void)pixels;
}

bool eadk_display_wait_for_vblank(void) {
    return true;
}

// Mock timing and keyboard functions
static uint64_t s_mock_millis = 0;
uint32_t _eadk_timing_millis_low(void) { return (uint32_t)(s_mock_millis & 0xFFFFFFFF); }
uint32_t _eadk_timing_millis_high(void) { return (uint32_t)(s_mock_millis >> 32); }
void eadk_timing_usleep(uint32_t us) { s_mock_millis += (us / 1000); }
void eadk_timing_msleep(uint32_t ms) { s_mock_millis += ms; }
eadk_event_t eadk_event_get(int32_t* timeout) { (void)timeout; return 0; }
void _eadk_keyboard_scan_do_scan(void) {}
uint32_t _eadk_keyboard_scan_high(void) { return 0; }
uint32_t _eadk_keyboard_scan_low(void) { return 0; }

// Include the actual source file under test
#include "launcher/src/app_fnaf.c"

// Include font rendering implementation to also test eq_display_draw_string bounds
#include "launcher/src/eq_font.c"

static int g_test_pass = 0;
static int g_test_fail = 0;

#define ASSERT_TEST(cond, name) do { \
    if (cond) { \
        printf("  [PASS] %s\n", name); \
        g_test_pass++; \
    } else { \
        printf("  [FAIL] %s\n", name); \
        g_test_fail++; \
    } \
} while(0)

int main(void) {
    printf("============================================================\n");
    printf("ST7789 DISPLAY COORDINATE BOUNDS EMPIRICAL STRESS HARNESS\n");
    printf("============================================================\n");

    // -------------------------------------------------------------------------
    // TEST 1: Direct calls to fnaf_display_init
    // -------------------------------------------------------------------------
    printf("\n--- Section 1: Display Init Rect Bounds ---\n");
    fnaf_display_init();
    ASSERT_TEST(g_boundary_violations == 0, "fnaf_display_init rect strictly within [0, 319]x[0, 239]");

    // -------------------------------------------------------------------------
    // TEST 2: Adversarial Coordinate Stress on fnaf_draw_image
    // -------------------------------------------------------------------------
    printf("\n--- Section 2: Adversarial Coordinate Clamping in fnaf_draw_image ---\n");
    int16_t test_xs[] = {-32768, -1000, -320, -100, -1, 0, 1, 100, 319, 320, 1000, 32767};
    int16_t test_ys[] = {-32768, -1000, -240, -100, -1, 0, 1, 100, 239, 240, 1000, 32767};
    int num_xs = sizeof(test_xs) / sizeof(test_xs[0]);
    int num_ys = sizeof(test_ys) / sizeof(test_ys[0]);

    uint64_t pushes_before = g_total_pushes;
    for (int aid = 0; aid < FNAF_ASSET_COUNT; aid++) {
        for (int xi = 0; xi < num_xs; xi++) {
            for (int yi = 0; yi < num_ys; yi++) {
                fnaf_draw_image((fnaf_asset_id_t)aid, test_xs[xi], test_ys[yi]);
            }
        }
    }
    uint64_t pushes_after = g_total_pushes;
    printf("  Executed %llu adversarial draw image pushes across %d assets x %d coordinate pairs\n",
           (unsigned long long)(pushes_after - pushes_before), FNAF_ASSET_COUNT, num_xs * num_ys);
    ASSERT_TEST(g_boundary_violations == 0, "Zero boundary violations with extreme adversarial (dst_x, dst_y)");

    // Test invalid asset IDs
    fnaf_draw_image((fnaf_asset_id_t)-1, 0, 0);
    fnaf_draw_image((fnaf_asset_id_t)FNAF_ASSET_COUNT, 0, 0);
    fnaf_draw_image((fnaf_asset_id_t)9999, 0, 0);
    fnaf_draw_image((fnaf_asset_id_t)-9999, 0, 0);
    ASSERT_TEST(g_boundary_violations == 0, "Invalid asset IDs safely rejected without push");

    // -------------------------------------------------------------------------
    // TEST 3: TV Snow Static Noise Bounds
    // -------------------------------------------------------------------------
    printf("\n--- Section 3: TV Snow Static Generator Bounds ---\n");
    uint16_t snow_intensities[] = {0, 10, 50, 100, 150, 200, 255, 1000, 65535};
    for (size_t i = 0; i < sizeof(snow_intensities)/sizeof(snow_intensities[0]); i++) {
        fnaf_draw_tv_snow(snow_intensities[i]);
    }
    ASSERT_TEST(g_boundary_violations == 0, "TV snow rects strictly within [0, 319]x[0, 239]");

    // -------------------------------------------------------------------------
    // TEST 4: Subtitle Banner Bounds Stress
    // -------------------------------------------------------------------------
    printf("\n--- Section 4: Subtitle Banner Dynamic Width Bounds ---\n");
    fnaf_init_game(FNAF_PACING_NORMAL);
    fnaf_start_night(1);

    // Various subtitle lengths: 0, 1, 10, 40, 46, 47, 100 chars
    const char *test_subtitles[] = {
        "",
        "X",
        "* footsteps *",
        "* BANG BANG BANG *",
        "1234567890123456789012345678901234567890123456", // 46 chars
        "12345678901234567890123456789012345678901234567", // 47 chars
        "VERY LONG SUBTITLE STRING THAT EXCEEDS BUFFER SIZE TO TEST CLAMPING SAFETY COMPLETELY"
    };

    for (size_t s = 0; s < sizeof(test_subtitles)/sizeof(test_subtitles[0]); s++) {
        fnaf_draw_subtitle(test_subtitles[s], COLOR_YELLOW);
        fnaf_render_hud_overlay();
    }
    ASSERT_TEST(g_boundary_violations == 0, "Subtitle banner rects strictly within display bounds");

    // -------------------------------------------------------------------------
    // TEST 5: Complete Render State Machine Exhaustive Sweep
    // -------------------------------------------------------------------------
    printf("\n--- Section 5: Exhaustive State Machine Render Sweep ---\n");

    // 5.1 Title State (various pacing and nights)
    for (int p = 0; p <= 1; p++) {
        for (int n = 1; n <= 7; n++) {
            g_fnaf.state = FNAF_STATE_TITLE;
            g_fnaf.pacing_mode = (fnaf_pacing_mode_t)p;
            g_fnaf.night = n;
            fnaf_render();
        }
    }
    ASSERT_TEST(g_boundary_violations == 0, "FNAF_STATE_TITLE all configurations valid");

    // 5.2 Night Intro State (nights 1 to 7)
    for (int n = 1; n <= 7; n++) {
        g_fnaf.state = FNAF_STATE_NIGHT_INTRO;
        g_fnaf.night = n;
        fnaf_render();
    }
    ASSERT_TEST(g_boundary_violations == 0, "FNAF_STATE_NIGHT_INTRO all nights valid");

    // 5.3 6 AM Win State (nights 1 to 7)
    for (int n = 1; n <= 7; n++) {
        g_fnaf.state = FNAF_STATE_6AM_WIN;
        g_fnaf.night = n;
        fnaf_render();
    }
    ASSERT_TEST(g_boundary_violations == 0, "FNAF_STATE_6AM_WIN all nights valid");

    // 5.4 Jumpscare State (all scare types)
    fnaf_scare_type_t scares[] = {SCARE_BONNIE, SCARE_CHICA, SCARE_FOXY, SCARE_FREDDY_OFFICE, SCARE_FREDDY_POWER_OUT};
    for (size_t sc = 0; sc < sizeof(scares)/sizeof(scares[0]); sc++) {
        g_fnaf.state = FNAF_STATE_JUMPSCARE;
        g_fnaf.scare_type = scares[sc];
        fnaf_render();
    }
    ASSERT_TEST(g_boundary_violations == 0, "FNAF_STATE_JUMPSCARE all animatronics valid");

    // 5.5 Game Over State
    g_fnaf.state = FNAF_STATE_GAME_OVER;
    fnaf_render();
    ASSERT_TEST(g_boundary_violations == 0, "FNAF_STATE_GAME_OVER valid");

    // 5.6 Custom Night Menu (bot selections 0..4, AI values 0..20)
    g_fnaf.state = FNAF_STATE_CUSTOM_NIGHT;
    for (int bot = 0; bot <= 4; bot++) {
        g_fnaf.custom_selected_bot = bot;
        for (int val = 0; val <= 20; val += 5) {
            g_fnaf.ai_freddy = val;
            g_fnaf.ai_bonnie = val;
            g_fnaf.ai_chica = val;
            g_fnaf.ai_foxy = val;
            fnaf_render();
        }
    }
    ASSERT_TEST(g_boundary_violations == 0, "FNAF_STATE_CUSTOM_NIGHT all combinations valid");

    // 5.7 Blackout State (Toreador flashing, timers)
    g_fnaf.state = FNAF_STATE_POWER_OUT;
    g_fnaf.toreador_flashing = false;
    fnaf_render();
    g_fnaf.toreador_flashing = true;
    for (uint32_t t = 0; t <= 3000; t += 300) {
        g_fnaf.toreador_timer_ms = t;
        fnaf_render();
    }
    ASSERT_TEST(g_boundary_violations == 0, "FNAF_STATE_POWER_OUT Toreador march renders valid");

    // 5.8 Office State - Surveillance Monitor (All 11 cameras, static transition, rec dot)
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.monitor_up = true;
    for (int cam = 0; cam < CAM_COUNT; cam++) {
        g_fnaf.active_cam = (fnaf_cam_id_t)cam;
        g_fnaf.cam_static_timer_ms = 0; // Clear static
        fnaf_render();
        g_fnaf.cam_static_timer_ms = 200; // Active static
        fnaf_render();
    }
    ASSERT_TEST(g_boundary_violations == 0, "Surveillance monitor all 11 cameras valid");

    // 5.9 Office State - Room Views, Panning, Lights, Doors
    g_fnaf.monitor_up = false;
    for (int pan = 0; pan < 3; pan++) {
        g_fnaf.view_pan = pan;
        for (int dl = 0; dl <= 1; dl++) {
            g_fnaf.door_left_closed = (bool)dl;
            for (int dr = 0; dr <= 1; dr++) {
                g_fnaf.door_right_closed = (bool)dr;
                for (int ll = 0; ll <= 1; ll++) {
                    g_fnaf.light_left_on = (bool)ll;
                    for (int lr = 0; lr <= 1; lr++) {
                        g_fnaf.light_right_on = (bool)lr;
                        for (int bars = 1; bars <= 5; bars++) {
                            g_fnaf.power_usage_bars = bars;

                            // Bonnie and Chica permutations
                            g_fnaf.bonnie_loc = (dl ? LOC_DOOR_LEFT : LOC_WEST_CORNER);
                            g_fnaf.chica_loc = (dr ? LOC_DOOR_RIGHT : LOC_EAST_CORNER);
                            g_fnaf.bonnie_in_office = false;
                            g_fnaf.chica_in_office = false;
                            fnaf_render();

                            if (pan == 1) {
                                g_fnaf.bonnie_in_office = true;
                                fnaf_render();
                                g_fnaf.bonnie_in_office = false;
                                g_fnaf.chica_in_office = true;
                                fnaf_render();
                            }
                        }
                    }
                }
            }
        }
    }
    ASSERT_TEST(g_boundary_violations == 0, "Office room views (doors, lights, animatronics) all valid");

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    printf("\n============================================================\n");
    printf("ST7789 BOUNDS EMPIRICAL VERIFICATION SUMMARY\n");
    printf("============================================================\n");
    printf("  Total Display Push Operations Verified : %llu\n", (unsigned long long)g_total_pushes);
    printf("  Boundary Violations Detected           : %llu\n", (unsigned long long)g_boundary_violations);
    printf("  Observed Coordinate Span X             : [%u .. %u] (Allowed: [0 .. 320])\n", g_min_x, g_max_x_bound);
    printf("  Observed Coordinate Span Y             : [%u .. %u] (Allowed: [0 .. 240])\n", g_min_y, g_max_y_bound);
    printf("  Unit Assertions Passed                 : %d / %d\n", g_test_pass, g_test_pass + g_test_fail);
    printf("============================================================\n");

    if (g_boundary_violations > 0 || g_test_fail > 0) {
        printf("RESULT: FAIL - ST7789 display bounds violated!\n");
        return 1;
    } else {
        printf("RESULT: PASS - 100%% compliant with ST7789 [0..319]x[0..239] display limits!\n");
        return 0;
    }
}
