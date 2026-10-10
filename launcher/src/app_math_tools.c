#include <eadk.h>
#include <stdbool.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define COLOR_NUMWORKS 0xFE60
#define COLOR_CARD_BG  0xFFFF
#define COLOR_GRAY_BG  0xF7BE

static int int_sqrt(int n) {
    if (n <= 0) return 0;
    int x = n;
    int y = (x + 1) / 2;
    while (y < x) {
        x = y;
        y = (x + n / x) / 2;
    }
    return x;
}

void run_math_tools_app(void) {
    int a = 1, b = -5, c = 6;
    int active_field = 0; /* 0: a, 1: b, 2: c */
    bool redraw = true;
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
    eadk_keyboard_state_t prev_kbd = 0;

    bool full_redraw = true;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
            active_field = (active_field + 1) % 3;
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
            active_field = (active_field + 2) % 3;
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_right) || eadk_keyboard_key_down(pressed, eadk_key_plus)) {
            if (active_field == 0) a++;
            else if (active_field == 1) b++;
            else c++;
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_left) || eadk_keyboard_key_down(pressed, eadk_key_minus)) {
            if (active_field == 0) a--;
            else if (active_field == 1) b--;
            else c--;
            redraw = true;
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;

            if (full_redraw) {
                full_redraw = false;
                eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_GRAY_BG);

                /* Entete */
                eadk_rect_t top = {0, 0, EADK_SCREEN_WIDTH, 22};
                eadk_display_push_rect_uniform(top, COLOR_NUMWORKS);
                eadk_point_t pt_title = {10, 5};
                eadk_display_draw_string("Solveur Polynome 2nd Degre", pt_title, false, eadk_color_black, COLOR_NUMWORKS);

                /* Pied de page */
                eadk_rect_t bottom = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
                eadk_display_push_rect_uniform(bottom, eadk_color_white);
                eadk_point_t pt_help = {10, EADK_SCREEN_HEIGHT - 13};
                eadk_display_draw_string("Haut/Bas: Sel  |  +/- : Ajuster  |  BACK: Menu", pt_help, false, 0x4208, eadk_color_white);
            }

            /* Boite principale */
            eadk_rect_t main_box = {16, 32, EADK_SCREEN_WIDTH - 32, 175};
            eadk_display_push_rect_uniform(main_box, COLOR_CARD_BG);

            /* Equation courante */
            char eq_str[64];
            snprintf(eq_str, sizeof(eq_str), "(%d)x^2 + (%d)x + (%d) = 0", a, b, c);
            eadk_point_t pt_eq = {30, 45};
            eadk_display_draw_string(eq_str, pt_eq, true, eadk_color_black, COLOR_CARD_BG);

            /* Champs coefficients */
            const char* fields[3] = {"Coeff a :", "Coeff b :", "Coeff c :"};
            int vals[3] = {a, b, c};

            for (int i = 0; i < 3; i++) {
                int y = 78 + i * 22;
                eadk_color_t fg = eadk_color_black;

                if (i == active_field) {
                    eadk_rect_t hlg = {26, (uint16_t)(y - 2), EADK_SCREEN_WIDTH - 52, 20};
                    eadk_display_push_rect_uniform(hlg, 0xFFE0);
                }

                eadk_point_t p_lbl = {30, (uint16_t)y};
                eadk_display_draw_string(fields[i], p_lbl, false, fg, (i == active_field) ? 0xFFE0 : COLOR_CARD_BG);

                char v_str[16];
                snprintf(v_str, sizeof(v_str), "%d", vals[i]);
                eadk_point_t p_v = {120, (uint16_t)y};
                eadk_display_draw_string(v_str, p_v, true, fg, (i == active_field) ? 0xFFE0 : COLOR_CARD_BG);
            }

            /* Calcul Delta = b^2 - 4ac */
            int delta = b * b - 4 * a * c;
            char delta_str[64];
            snprintf(delta_str, sizeof(delta_str), "Delta = %d^2 - 4*(%d)*(%d) = %d", b, a, c, delta);
            eadk_point_t pt_delta = {30, 150};
            eadk_display_draw_string(delta_str, pt_delta, false, 0x028A, COLOR_CARD_BG);

            /* Racines exactes */
            char sol_str[64];
            if (a == 0) {
                if (b != 0) {
                    snprintf(sol_str, sizeof(sol_str), "Degre 1 : x = %d / %d", -c, b);
                } else {
                    snprintf(sol_str, sizeof(sol_str), (c == 0) ? "Infini de solutions" : "Aucune solution");
                }
            } else if (delta > 0) {
                int sq = int_sqrt(delta);
                if (sq * sq == delta) {
                    int num1 = -b - sq;
                    int num2 = -b + sq;
                    int den = 2 * a;
                    if (den != 0 && num1 % den == 0 && num2 % den == 0) {
                        snprintf(sol_str, sizeof(sol_str), "x1 = %d  |  x2 = %d", num1 / den, num2 / den);
                    } else {
                        snprintf(sol_str, sizeof(sol_str), "x1 = %d/%d | x2 = %d/%d", num1, den, num2, den);
                    }
                } else {
                    snprintf(sol_str, sizeof(sol_str), "x = (%d +/- sqrt(%d)) / %d", -b, delta, 2 * a);
                }
            } else if (delta == 0) {
                int den = 2 * a;
                if (den != 0 && (-b) % den == 0) {
                    snprintf(sol_str, sizeof(sol_str), "Racine double : x0 = %d", -b / den);
                } else {
                    snprintf(sol_str, sizeof(sol_str), "Racine double : x0 = %d/%d", -b, den);
                }
            } else {
                int sq = int_sqrt(-delta);
                snprintf(sol_str, sizeof(sol_str), "x = (%d +/- %di) / %d", -b, (sq * sq == -delta) ? sq : 1, 2 * a);
            }
            eadk_point_t pt_sol = {30, 172};
            eadk_display_draw_string(sol_str, pt_sol, true, (delta >= 0) ? 0x0460 : 0xC000, COLOR_CARD_BG);
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
