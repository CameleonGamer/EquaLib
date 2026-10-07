#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "apps.h"
#include "equalib_manifest.h"

/* Déclarations mini libc */
size_t strlen(const char* s);
int snprintf(char* buf, size_t max, const char* fmt, ...);

/* Symboles officiels EADK requis par Epsilon */
const char eadk_app_name[] __attribute__((section(".rodata.eadk_app_name"))) = "EquaLib";
const uint32_t eadk_api_level __attribute__((section(".rodata.eadk_api_level"))) = 0;

#define COLOR_NUMWORKS 0xFE60 /* Jaune officiel NumWorks ~RGB(255, 187, 0) */
#define COLOR_GRAY_BG  0xF7BE
#define COLOR_CARD_BG  0xFFFF
#define COLOR_CARD_SEL 0xFFF0
#define COLOR_TEXT_MUTED 0x7BEF
#define COLOR_EXAM_RED 0xF800

/* Simulation du Mode Examen (100% sécurisée sans aucun accès direct aux registres STM32) */
static bool s_exam_mode = true;
static uint64_t s_last_pulse_ms = 0;
static bool s_led_active = false;

/* Manifeste dynamique stocké en flash (.rodata), modifiable à chaud lors du packaging */
const equalib_manifest_t g_equalib_manifest __attribute__((used, aligned(4), section(".rodata.equalib_manifest"))) = {
    .magic = EQUALIB_MANIFEST_MAGIC,
    .version = 1,
    .app_count = 5,
    .flags = 0,
    .apps = {
        {"mariokart", "1. Mario Kart", "Jeu / Arcade", "Course Mode 7 3D complete pour N0120", APP_TYPE_MARIOKART, {0,0,0}, 0, 0},
        {"periodique", "2. Tableau Periodique", "Chimie", "118 elements, masses et configurations", APP_TYPE_PERIODIC, {0,0,0}, 0, 0},
        {"fiches", "3. Fiches de Cours", "Revision", "Formulaires Maths, Physique et Chimie", APP_TYPE_COURSES, {0,0,0}, 0, 0},
        {"math_solver", "4. Solveur de Maths", "Algebre", "Polynomes 2nd degre, racines et outils", APP_TYPE_MATH_TOOLS, {0,0,0}, 0, 0},
        {"stealth_calc", "5. Mode Furtif Panique", "Securite", "Fausse calculatrice avec [EXAMEN ACTIF]", APP_TYPE_STEALTH, {0,0,0}, 0, 0}
    }
};

/* Gestion du clignotement 1 Hz (120ms allumé, 880ms éteint) */
static void exam_tick(uint64_t now) {
    if (!s_exam_mode) {
        s_led_active = false;
        return;
    }
    uint64_t diff = now - s_last_pulse_ms;
    if (!s_led_active && diff >= 1000) {
        s_last_pulse_ms = now;
        s_led_active = true;
    } else if (s_led_active && diff >= 120) {
        s_led_active = false;
    }
}

/* Dessine l'indicateur LED d'examen sur la barre de titre */
static void draw_exam_indicator(uint16_t x, uint16_t y, eadk_color_t bg_color) {
    if (s_exam_mode && s_led_active) {
        eadk_rect_t led = {x, y, 10, 10};
        eadk_display_push_rect_uniform(led, COLOR_EXAM_RED);
        eadk_point_t p = {(uint16_t)(x - 65), (uint16_t)(y - 1)};
        eadk_display_draw_string("EXAMEN", p, false, COLOR_EXAM_RED, bg_color);
    } else if (s_exam_mode) {
        eadk_rect_t led = {x, y, 10, 10};
        eadk_display_push_rect_uniform(led, 0x8000); /* Rouge sombre quand inactif */
        eadk_point_t p = {(uint16_t)(x - 65), (uint16_t)(y - 1)};
        eadk_display_draw_string("EXAMEN", p, false, 0x8000, bg_color);
    }
}

/* Évaluateur arithmétique simple pour la calculatrice panique */
static void evaluate_simple_expr(const char* expr, char* result, size_t max_res) {
    int v1 = 0;
    int v2 = 0;
    char op = 0;
    int i = 0;
    while (expr[i] == ' ') i++;
    int sign1 = 1;
    if (expr[i] == '-') { sign1 = -1; i++; }
    while (expr[i] >= '0' && expr[i] <= '9') {
        v1 = v1 * 10 + (expr[i] - '0');
        i++;
    }
    v1 *= sign1;

    while (expr[i] == ' ') i++;
    if (expr[i] == '+' || expr[i] == '-' || expr[i] == '*' || expr[i] == '/') {
        op = expr[i++];
    }

    while (expr[i] == ' ') i++;
    int sign2 = 1;
    if (expr[i] == '-') { sign2 = -1; i++; }
    while (expr[i] >= '0' && expr[i] <= '9') {
        v2 = v2 * 10 + (expr[i] - '0');
        i++;
    }
    v2 *= sign2;

    if (op == '+') snprintf(result, max_res, "%d", v1 + v2);
    else if (op == '-') snprintf(result, max_res, "%d", v1 - v2);
    else if (op == '*') snprintf(result, max_res, "%d", v1 * v2);
    else if (op == '/' && v2 != 0) snprintf(result, max_res, "%d", v1 / v2);
    else snprintf(result, max_res, "%d", v1);
}

/* Redessine uniquement la barre supérieure de la calculatrice furtive */
static void draw_panic_top_bar(void) {
    eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 20};
    eadk_display_push_rect_uniform(bar, COLOR_NUMWORKS);

    eadk_point_t p_status = {8, 4};
    eadk_display_draw_string("[EXAMEN ACTIF]", p_status, false, COLOR_EXAM_RED, COLOR_NUMWORKS);

    eadk_point_t p_calc = {130, 4};
    eadk_display_draw_string("Calculs", p_calc, false, eadk_color_black, COLOR_NUMWORKS);

    draw_exam_indicator(EADK_SCREEN_WIDTH - 20, 5, COLOR_NUMWORKS);
}

/* Mini calculatrice furtive et 100% réaliste pour le Mode Panique */
void run_panic_calculator(void) {
    s_exam_mode = true;
    char expr[64] = "cos(pi/3) + ln(e^2)";
    char result[32] = "2.5";
    int expr_len = (int)strlen(expr);
    bool redraw_all = true;

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        uint64_t now = eadk_timing_millis();
        bool prev_led = s_led_active;
        exam_tick(now);

        /* Si l'état de pulsation change, on redessine SEULEMENT la barre supérieure (aucun clignotement d'écran !) */
        if (prev_led != s_led_active) {
            draw_panic_top_bar();
        }

        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        /* Raccourcis de sortie :
         * 1. Touche [Var] : bascule instantanée aller/retour !
         * 2. Shift + Home ou Toolbox + Back (combinaison secrète)
         * 3. Home / On/Off : retour immédiat Epsilon
         */
        bool shift = eadk_keyboard_key_down(kbd, eadk_key_shift);
        bool home = eadk_keyboard_key_down(kbd, eadk_key_home);
        bool toolbox = eadk_keyboard_key_down(kbd, eadk_key_toolbox);
        bool back = eadk_keyboard_key_down(kbd, eadk_key_back);
        bool var_key = eadk_keyboard_key_down(kbd, eadk_key_var);

        if ((shift && home) || (toolbox && back) || (home && !shift)) {
            break;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        /* Sortie via appui sur Var */
        if (eadk_keyboard_key_down(pressed, eadk_key_var)) {
            break;
        }

        /* Sortie via appui sur Back si expression vide */
        if (eadk_keyboard_key_down(pressed, eadk_key_back) && expr_len == 0) {
            break;
        }

        /* Saisie de chiffres et touches */
        char add_ch = 0;
        if (eadk_keyboard_key_down(pressed, eadk_key_zero)) add_ch = '0';
        else if (eadk_keyboard_key_down(pressed, eadk_key_one)) add_ch = '1';
        else if (eadk_keyboard_key_down(pressed, eadk_key_two)) add_ch = '2';
        else if (eadk_keyboard_key_down(pressed, eadk_key_three)) add_ch = '3';
        else if (eadk_keyboard_key_down(pressed, eadk_key_four)) add_ch = '4';
        else if (eadk_keyboard_key_down(pressed, eadk_key_five)) add_ch = '5';
        else if (eadk_keyboard_key_down(pressed, eadk_key_six)) add_ch = '6';
        else if (eadk_keyboard_key_down(pressed, eadk_key_seven)) add_ch = '7';
        else if (eadk_keyboard_key_down(pressed, eadk_key_eight)) add_ch = '8';
        else if (eadk_keyboard_key_down(pressed, eadk_key_nine)) add_ch = '9';
        else if (eadk_keyboard_key_down(pressed, eadk_key_plus)) add_ch = '+';
        else if (eadk_keyboard_key_down(pressed, eadk_key_minus)) add_ch = '-';
        else if (eadk_keyboard_key_down(pressed, eadk_key_multiplication)) add_ch = '*';
        else if (eadk_keyboard_key_down(pressed, eadk_key_division)) add_ch = '/';
        else if (eadk_keyboard_key_down(pressed, eadk_key_dot)) add_ch = '.';

        if (add_ch && expr_len < (int)sizeof(expr) - 2) {
            expr[expr_len++] = add_ch;
            expr[expr_len] = '\0';
            redraw_all = true;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_backspace) && expr_len > 0) {
            expr[--expr_len] = '\0';
            redraw_all = true;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            evaluate_simple_expr(expr, result, sizeof(result));
            redraw_all = true;
        }

        prev_kbd = kbd;

        if (redraw_all) {
            redraw_all = false;
            eadk_display_push_rect_uniform(eadk_screen_rect, eadk_color_white);

            draw_panic_top_bar();

            /* Historique calcul precedent */
            eadk_rect_t box1 = {8, 28, EADK_SCREEN_WIDTH - 16, 50};
            eadk_display_push_rect_uniform(box1, 0xF7BE);

            eadk_point_t p_expr1 = {16, 36};
            eadk_display_draw_string("cos(pi/3) + ln(e^2)", p_expr1, false, 0x4208, 0xF7BE);

            eadk_point_t p_res1 = {EADK_SCREEN_WIDTH - 50, 56};
            eadk_display_draw_string("2.5", p_res1, true, eadk_color_black, 0xF7BE);

            /* Ligne active de calcul */
            eadk_rect_t box2 = {8, 86, EADK_SCREEN_WIDTH - 16, 56};
            eadk_display_push_rect_uniform(box2, 0xF7BE);

            char active_line[80];
            snprintf(active_line, sizeof(active_line), "> %s_", expr);
            eadk_point_t p_cur = {16, 94};
            eadk_display_draw_string(active_line, p_cur, false, eadk_color_black, 0xF7BE);

            if (result[0]) {
                size_t res_len = strlen(result);
                uint16_t ans_x = (uint16_t)(EADK_SCREEN_WIDTH - 20 - res_len * 10);
                eadk_point_t p_ans = {ans_x, 118};
                eadk_display_draw_string(result, p_ans, true, 0x028A, 0xF7BE);
            }

            /* Bas de l'ecran sobre et authentique (style officiel NumWorks) */
            eadk_rect_t bottom = {0, EADK_SCREEN_HEIGHT - 18, EADK_SCREEN_WIDTH, 18};
            eadk_display_push_rect_uniform(bottom, 0xEF7D);
            eadk_point_t p_sub = {10, EADK_SCREEN_HEIGHT - 14};
            eadk_display_draw_string("rad   norm", p_sub, false, 0x7BEF, 0xEF7D);
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    /* Attendre le relâchement initial des touches */
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    /* Détermination du nombre d'applications via le manifeste */
    uint32_t total_apps = g_equalib_manifest.app_count;
    if (g_equalib_manifest.magic != EQUALIB_MANIFEST_MAGIC || total_apps == 0 || total_apps > MAX_MANIFEST_APPS) {
        total_apps = 5;
    }

    int selected = 0;
    int scroll_offset = 0;
    bool redraw = true;
    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        uint64_t now = eadk_timing_millis();
        bool prev_led = s_led_active;
        exam_tick(now);

        /* Si la LED d'examen a changé d'état et qu'un redessin complet n'est pas déjà planifié */
        if (!redraw && s_exam_mode && prev_led != s_led_active) {
            draw_exam_indicator(EADK_SCREEN_WIDTH - 20, 6, COLOR_NUMWORKS);
        }

        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        /* Sortie complète de l'application vers Epsilon via Home, On/Off ou Back depuis le Hub */
        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off) ||
            eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        /* Raccourci Panique Furtif universel direct : Touche [Var] */
        if (eadk_keyboard_key_down(pressed, eadk_key_var)) {
            run_panic_calculator();
            while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
            prev_kbd = 0;
            redraw = true;
            continue;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
            if (selected < (int)total_apps - 1) {
                selected++;
                if (selected >= scroll_offset + 5) {
                    scroll_offset = selected - 4;
                }
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
            if (selected > 0) {
                selected--;
                if (selected < scroll_offset) {
                    scroll_offset = selected;
                }
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            const equalib_manifest_app_t* app = &g_equalib_manifest.apps[selected];
            uint8_t type = app->app_type;

            if (type == APP_TYPE_MARIOKART) {
                run_mariokart_app();
            } else if (type == APP_TYPE_PERIODIC) {
                run_periodic_table_app();
            } else if (type == APP_TYPE_COURSES) {
                run_courses_app();
            } else if (type == APP_TYPE_MATH_TOOLS) {
                run_math_tools_app();
            } else if (type == APP_TYPE_STEALTH) {
                run_panic_calculator();
            } else if (type == APP_TYPE_FLAPPY) {
                run_flappy_app();
            } else if (type == APP_TYPE_2048) {
                run_2048_app();
            } else if (type == APP_TYPE_SNAKE) {
                run_snake_app();
            } else if (type == APP_TYPE_TETRIS) {
                run_tetris_app();
            } else if (type == APP_TYPE_MINESWEEPER) {
                run_minesweeper_app();
            } else if (type == APP_TYPE_PYTHON || type == APP_TYPE_TEXT_VIEWER) {
                const char* data_ptr = NULL;
                if (app->data_size > 0) {
                    data_ptr = (const char*)(0x90180000 + app->data_offset);
                }
                /* Détection intelligente : si c'est du code Python, l'exécuter avec le moteur Python */
                if (type == APP_TYPE_PYTHON || (data_ptr && app->data_size > 0 &&
                    (data_ptr[0] == '#' || data_ptr[0] == 'i' || data_ptr[0] == 'd' || data_ptr[0] == 'f' || data_ptr[0] == 'k'))) {
                    run_python_app((const char*)app->name, data_ptr, app->data_size);
                } else {
                    run_text_viewer_app((const char*)app->name, data_ptr, app->data_size);
                }
            }

            while (eadk_keyboard_scan() != 0) {
                eadk_timing_msleep(20);
            }
            prev_kbd = 0;
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_toolbox)) {
            /* Basculer la simulation du Mode Examen */
            s_exam_mode = !s_exam_mode;
            s_led_active = false;
            redraw = true;
        }

        prev_kbd = kbd;

        /* Rendu graphique du Hub */
        if (redraw) {
            redraw = false;
            eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_GRAY_BG);

            /* Barre superieure officielle */
            eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top_bar, COLOR_NUMWORKS);

            eadk_point_t p_title = {8, 5};
            eadk_display_draw_string("EquaLib Hub (Cameleon & Gemini)", p_title, false, eadk_color_black, COLOR_NUMWORKS);

            /* Indicateur visuel du Mode Examen */
            draw_exam_indicator(EADK_SCREEN_WIDTH - 20, 6, COLOR_NUMWORKS);

            /* Liste des cartes d'applications avec défilement fluide */
            int start_y = 28;
            int card_h = 36;
            int card_w = EADK_SCREEN_WIDTH - 16;
            int visible_count = 5;
            if (visible_count > (int)total_apps - scroll_offset) {
                visible_count = (int)total_apps - scroll_offset;
            }

            for (int v = 0; v < visible_count; v++) {
                int i = scroll_offset + v;
                int y = start_y + v * (card_h + 5);
                bool is_sel = (i == selected);

                eadk_rect_t card = {8, (uint16_t)y, (uint16_t)card_w, (uint16_t)card_h};
                eadk_display_push_rect_uniform(card, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

                if (is_sel) {
                    eadk_rect_t accent = {8, (uint16_t)y, 4, (uint16_t)card_h};
                    eadk_display_push_rect_uniform(accent, COLOR_NUMWORKS);
                }

                const equalib_manifest_app_t* cur_app = &g_equalib_manifest.apps[i];

                eadk_point_t p_name = {20, (uint16_t)(y + 5)};
                eadk_display_draw_string((const char*)cur_app->name, p_name, false, eadk_color_black, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

                eadk_point_t p_cat = {(uint16_t)(EADK_SCREEN_WIDTH - 110), (uint16_t)(y + 5)};
                eadk_display_draw_string((const char*)cur_app->category, p_cat, false, COLOR_TEXT_MUTED, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

                eadk_point_t p_desc = {20, (uint16_t)(y + 20)};
                eadk_display_draw_string((const char*)cur_app->desc, p_desc, false, 0x52AA, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);
            }

            /* Pied de page avec raccourcis clairs */
            eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);

            eadk_point_t p_help = {8, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("OK: Lancer | Back: Quitter | Var: Furtif | Toolbox: Examen", p_help, false, 0x4208, eadk_color_white);
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    return 0;
}
