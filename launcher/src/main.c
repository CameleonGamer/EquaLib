#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

/* Déclarations mini libc */
size_t strlen(const char* s);
int snprintf(char* buf, size_t max, const char* fmt, ...);

/* Déclarations des sous-applications intégrées */
void run_mariokart_app(void);
void run_periodic_table_app(void);
void run_courses_app(void);
void run_math_tools_app(void);

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
static bool s_exam_mode = false;
static uint64_t s_last_pulse_ms = 0;
static bool s_led_active = false;

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
        eadk_display_push_rect_uniform(led, 0x8000); /* Rouge éteint/sombre */
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

/* Mini calculatrice furtive et fonctionnelle pour le Mode Panique */
static void run_panic_calculator(void) {
    s_exam_mode = true;
    char expr[64] = "cos(pi/3) + ln(e^2)";
    char result[32] = "2.5";
    int expr_len = strlen(expr);
    bool redraw = true;
    eadk_keyboard_state_t prev_kbd = eadk_keyboard_scan();

    while (true) {
        uint64_t now = eadk_timing_millis();
        bool prev_led = s_led_active;
        exam_tick(now);

        if (prev_led != s_led_active) {
            redraw = true;
        }

        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        /* Combinaison secrète de sortie : Shift + Home OU Toolbox + Back */
        bool shift = eadk_keyboard_key_down(kbd, eadk_key_shift);
        bool home = eadk_keyboard_key_down(kbd, eadk_key_home);
        bool toolbox = eadk_keyboard_key_down(kbd, eadk_key_toolbox);
        bool back = eadk_keyboard_key_down(kbd, eadk_key_back);

        if ((shift && home) || (toolbox && back)) {
            break;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

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
            redraw = true;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_backspace) && expr_len > 0) {
            expr[--expr_len] = '\0';
            redraw = true;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            evaluate_simple_expr(expr, result, sizeof(result));
            redraw = true;
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;
            eadk_display_push_rect_uniform(eadk_screen_rect, eadk_color_white);

            /* Bandeau jaune officiel */
            eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 20};
            eadk_display_push_rect_uniform(bar, COLOR_NUMWORKS);

            eadk_point_t p_status = {8, 4};
            eadk_display_draw_string("[EXAMEN ACTIF]", p_status, false, COLOR_EXAM_RED, COLOR_NUMWORKS);

            eadk_point_t p_calc = {130, 4};
            eadk_display_draw_string("Calculs", p_calc, false, eadk_color_black, COLOR_NUMWORKS);

            /* LED d'examen */
            draw_exam_indicator(EADK_SCREEN_WIDTH - 20, 5, COLOR_NUMWORKS);

            /* Historique calcul précédent */
            eadk_rect_t box1 = {8, 28, EADK_SCREEN_WIDTH - 16, 50};
            eadk_display_push_rect_uniform(box1, 0xF7BE);

            eadk_point_t p_expr1 = {16, 36};
            eadk_display_draw_string("cos(pi/3) + ln(e^2)", p_expr1, false, 0x4208, 0xF7BE);

            eadk_point_t p_res1 = {EADK_SCREEN_WIDTH - 50, 56};
            eadk_display_draw_string("2.5", p_res1, true, eadk_color_black, 0xF7BE);

            /* Ligne active */
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

            /* Indication discrète en bas */
            eadk_rect_t bottom = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom, eadk_color_white);
            eadk_point_t p_tip = {10, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("Shift+Home ou Toolbox+Back : Sortie", p_tip, false, 0xAD75, eadk_color_white);
        }

        eadk_timing_msleep(20);
    }
}

/* Liste des applications de la bibliothèque EquaLib */
typedef struct {
    const char * name;
    const char * category;
    const char * desc;
} app_item_t;

static const app_item_t s_apps[] = {
    {"1. Mario Kart", "Jeu / Arcade", "Course Mode 7 3D complete pour N0120"},
    {"2. Tableau Periodique", "Chimie", "118 elements, masses et configurations"},
    {"3. Fiches de Cours", "Revision", "Formulaires Maths, Physique et Chimie"},
    {"4. Solveur de Maths", "Algebre", "Polynomes 2nd degre, racines et outils"},
    {"5. Mode Furtif Panique", "Securite", "Fausse calculatrice avec [EXAMEN ACTIF]"}
};
#define APP_COUNT (sizeof(s_apps) / sizeof(s_apps[0]))

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    int selected = 0;
    bool redraw = true;
    uint64_t last_back_press = 0;
    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        uint64_t now = eadk_timing_millis();
        bool prev_led = s_led_active;
        exam_tick(now);

        /* Si la LED d'examen a changé d'état, on met à jour la barre de titre */
        if (s_exam_mode && prev_led != s_led_active) {
            redraw = true;
        }

        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        /* Sortie complète de l'application via Home ou On/Off */
        if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
            if (selected < (int)APP_COUNT - 1) {
                selected++;
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
            if (selected > 0) {
                selected--;
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            /* Lancement effectif de la véritable application sélectionnée */
            if (selected == 0) {
                run_mariokart_app();
            } else if (selected == 1) {
                run_periodic_table_app();
            } else if (selected == 2) {
                run_courses_app();
            } else if (selected == 3) {
                run_math_tools_app();
            } else if (selected == 4) {
                run_panic_calculator();
            }
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            /* Détection double appui rapide pour Mode Panique Furtif */
            if (now - last_back_press < 500) {
                run_panic_calculator();
            }
            last_back_press = now;
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_toolbox)) {
            /* Basculer la simulation du Mode Examen sans aucun crash */
            s_exam_mode = !s_exam_mode;
            s_led_active = false;
            redraw = true;
        }

        prev_kbd = kbd;

        /* Rendu graphique de l'interface EquaLib Hub */
        if (redraw) {
            redraw = false;
            eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_GRAY_BG);

            /* Barre supérieure officielle */
            eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top_bar, COLOR_NUMWORKS);

            eadk_point_t p_title = {8, 5};
            eadk_display_draw_string("EquaLib Hub (Cameleon & Gemini)", p_title, false, eadk_color_black, COLOR_NUMWORKS);

            /* Indicateur visuel du Mode Examen */
            draw_exam_indicator(EADK_SCREEN_WIDTH - 20, 6, COLOR_NUMWORKS);

            /* Liste des cartes d'applications */
            int start_y = 28;
            int card_h = 36;
            int card_w = EADK_SCREEN_WIDTH - 16;

            for (int i = 0; i < (int)APP_COUNT; i++) {
                int y = start_y + i * (card_h + 5);
                bool is_sel = (i == selected);

                eadk_rect_t card = {8, (uint16_t)y, (uint16_t)card_w, (uint16_t)card_h};
                eadk_display_push_rect_uniform(card, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

                /* Barre d'accentuation à gauche de la carte sélectionnée */
                if (is_sel) {
                    eadk_rect_t accent = {8, (uint16_t)y, 4, (uint16_t)card_h};
                    eadk_display_push_rect_uniform(accent, COLOR_NUMWORKS);
                }

                eadk_point_t p_name = {20, (uint16_t)(y + 5)};
                eadk_display_draw_string(s_apps[i].name, p_name, false, eadk_color_black, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

                eadk_point_t p_cat = {(uint16_t)(EADK_SCREEN_WIDTH - 110), (uint16_t)(y + 5)};
                eadk_display_draw_string(s_apps[i].category, p_cat, false, COLOR_TEXT_MUTED, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

                eadk_point_t p_desc = {20, (uint16_t)(y + 20)};
                eadk_display_draw_string(s_apps[i].desc, p_desc, false, 0x52AA, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);
            }

            /* Pied de page avec raccourcis */
            eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);

            eadk_point_t p_help = {8, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("OK: Lancer | Toolbox: Mode Examen | Backx2: Furtif", p_help, false, 0x4208, eadk_color_white);
        }

        eadk_timing_msleep(20);
    }

    return 0;
}
