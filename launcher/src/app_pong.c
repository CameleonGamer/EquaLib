#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define PONG_TOP        24
#define PONG_BOTTOM     236
#define PONG_LEFT       0
#define PONG_RIGHT      320

#define PADDLE_W        6
#define PADDLE_H        36
#define P1_X            14
#define CPU_X           300
#define BALL_SIZE       6

#define COLOR_PONG_BG   0x0821 /* Fond bleu nuit rétro */
#define COLOR_WALL      0x3DFE /* Cyan néon */
#define COLOR_NET       0x1945 /* Bleu foncé pointillé */
#define COLOR_P1        0x3DFE /* Cyan joueur */
#define COLOR_CPU       0xFA80 /* Corail / Orange CPU */
#define COLOR_BALL      0xFFFF /* Blanc pur */
#define COLOR_TEXT      0xFFFF /* Blanc */

static void draw_pong_court(void) {
    /* Fond de jeu */
    eadk_rect_t field = {PONG_LEFT, PONG_TOP, PONG_RIGHT - PONG_LEFT, PONG_BOTTOM - PONG_TOP};
    eadk_display_push_rect_uniform(field, COLOR_PONG_BG);

    /* Murs supérieur et inférieur */
    eadk_rect_t top_wall = {0, PONG_TOP, 320, 2};
    eadk_rect_t bot_wall = {0, PONG_BOTTOM - 2, 320, 2};
    eadk_display_push_rect_uniform(top_wall, COLOR_WALL);
    eadk_display_push_rect_uniform(bot_wall, COLOR_WALL);

    /* Filet central en pointillés */
    for (int y = PONG_TOP + 4; y < PONG_BOTTOM - 4; y += 10) {
        eadk_rect_t dash = {159, (uint16_t)y, 2, 6};
        eadk_display_push_rect_uniform(dash, COLOR_NET);
    }
}

void run_pong_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    /* Barre supérieure EquaLib */
    eadk_rect_t top_bar = {0, 0, 320, PONG_TOP};
    eadk_display_push_rect_uniform(top_bar, 0x10A2);
    eadk_point_t p_title = {8, 4};
    eadk_display_draw_string("Pong Arcade Retro (Premier a 7)", p_title, false, COLOR_TEXT, 0x10A2);

    draw_pong_court();

    float p1_y = 110.0f;
    float cpu_y = 110.0f;
    float old_p1_y = p1_y;
    float old_cpu_y = cpu_y;

    float ball_x = 160.0f;
    float ball_y = 120.0f;
    float old_ball_x = ball_x;
    float old_ball_y = ball_y;

    float ball_vx = 3.2f;
    float ball_vy = 1.6f;

    int p1_score = 0;
    int cpu_score = 0;
    int last_p1_score = -1;
    int last_cpu_score = -1;

    bool game_over = false;
    bool in_serve = true;
    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || eadk_keyboard_key_down(kbd, eadk_key_home)) {
            break;
        }

        if (game_over) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                p1_score = 0;
                cpu_score = 0;
                last_p1_score = -1;
                last_cpu_score = -1;
                p1_y = 110.0f;
                cpu_y = 110.0f;
                ball_x = 160.0f;
                ball_y = 120.0f;
                ball_vx = (eadk_random() % 2 == 0) ? 3.2f : -3.2f;
                ball_vy = 1.6f;
                game_over = false;
                in_serve = false;
                draw_pong_court();
            }
            prev_kbd = kbd;
            eadk_timing_msleep(20);
            continue;
        }

        if (in_serve) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe) ||
                eadk_keyboard_key_down(kbd, eadk_key_up) || eadk_keyboard_key_down(kbd, eadk_key_down)) {
                in_serve = false;
            }
        }

        /* Déplacement Joueur 1 */
        if (eadk_keyboard_key_down(kbd, eadk_key_up) || eadk_keyboard_key_down(kbd, eadk_key_eight)) {
            p1_y -= 4.5f;
            if (p1_y < PONG_TOP + 2) p1_y = PONG_TOP + 2;
        }
        if (eadk_keyboard_key_down(kbd, eadk_key_down) || eadk_keyboard_key_down(kbd, eadk_key_two)) {
            p1_y += 4.5f;
            if (p1_y + PADDLE_H > PONG_BOTTOM - 2) p1_y = (PONG_BOTTOM - 2) - PADDLE_H;
        }

        if (!in_serve) {
            /* IA CPU */
            float cpu_center = cpu_y + PADDLE_H / 2.0f;
            float target_y = (ball_vx > 0.0f && ball_x > 100.0f) ? (ball_y + BALL_SIZE / 2.0f) : 130.0f;
            float diff = target_y - cpu_center;
            if (diff > 3.0f) cpu_y += (diff > 8.0f ? 3.8f : 2.5f);
            else if (diff < -3.0f) cpu_y -= (diff < -8.0f ? 3.8f : 2.5f);

            if (cpu_y < PONG_TOP + 2) cpu_y = PONG_TOP + 2;
            if (cpu_y + PADDLE_H > PONG_BOTTOM - 2) cpu_y = (PONG_BOTTOM - 2) - PADDLE_H;

            /* Déplacement balle */
            ball_x += ball_vx;
            ball_y += ball_vy;

            /* Rebond haut et bas */
            if (ball_y <= PONG_TOP + 2) {
                ball_y = PONG_TOP + 2;
                ball_vy = -ball_vy;
            } else if (ball_y + BALL_SIZE >= PONG_BOTTOM - 2) {
                ball_y = (PONG_BOTTOM - 2) - BALL_SIZE;
                ball_vy = -ball_vy;
            }

            /* Collision raquette Joueur 1 */
            if (ball_vx < 0.0f && ball_x <= P1_X + PADDLE_W && ball_x + BALL_SIZE >= P1_X) {
                if (ball_y + BALL_SIZE >= p1_y && ball_y <= p1_y + PADDLE_H) {
                    ball_x = P1_X + PADDLE_W;
                    float rel = ((ball_y + BALL_SIZE / 2.0f) - (p1_y + PADDLE_H / 2.0f)) / (PADDLE_H / 2.0f);
                    ball_vx = (ball_vx < -5.5f) ? 5.8f : (-ball_vx * 1.05f);
                    ball_vy = rel * 4.0f;
                    if (ball_vy > -0.8f && ball_vy < 0.8f) ball_vy = (ball_vy >= 0 ? 1.4f : -1.4f);
                }
            }

            /* Collision raquette CPU */
            if (ball_vx > 0.0f && ball_x + BALL_SIZE >= CPU_X && ball_x <= CPU_X + PADDLE_W) {
                if (ball_y + BALL_SIZE >= cpu_y && ball_y <= cpu_y + PADDLE_H) {
                    ball_x = CPU_X - BALL_SIZE;
                    float rel = ((ball_y + BALL_SIZE / 2.0f) - (cpu_y + PADDLE_H / 2.0f)) / (PADDLE_H / 2.0f);
                    ball_vx = (ball_vx > 5.5f) ? -5.8f : (-ball_vx * 1.05f);
                    ball_vy = rel * 4.0f;
                    if (ball_vy > -0.8f && ball_vy < 0.8f) ball_vy = (ball_vy >= 0 ? 1.4f : -1.4f);
                }
            }

            /* But marqué */
            if (ball_x < PONG_LEFT - 10) {
                cpu_score++;
                if (cpu_score >= 7) game_over = true;
                in_serve = true;
                ball_x = 160.0f;
                ball_y = 120.0f;
                ball_vx = 3.2f;
                ball_vy = 1.6f;
                draw_pong_court();
            } else if (ball_x > PONG_RIGHT + 10) {
                p1_score++;
                if (p1_score >= 7) game_over = true;
                in_serve = true;
                ball_x = 160.0f;
                ball_y = 120.0f;
                ball_vx = -3.2f;
                ball_vy = 1.6f;
                draw_pong_court();
            }
        }

        /* Effacement anciens éléments */
        eadk_rect_t clr_p1 = {P1_X, (uint16_t)old_p1_y, PADDLE_W, PADDLE_H};
        eadk_display_push_rect_uniform(clr_p1, COLOR_PONG_BG);

        eadk_rect_t clr_cpu = {CPU_X, (uint16_t)old_cpu_y, PADDLE_W, PADDLE_H};
        eadk_display_push_rect_uniform(clr_cpu, COLOR_PONG_BG);

        eadk_rect_t clr_ball = {(uint16_t)old_ball_x, (uint16_t)old_ball_y, BALL_SIZE, BALL_SIZE};
        eadk_display_push_rect_uniform(clr_ball, COLOR_PONG_BG);

        /* Redessiner les pointillés au passage de la balle si nécessaire */
        if (old_ball_x >= 155 && old_ball_x <= 165) {
            for (int y = PONG_TOP + 4; y < PONG_BOTTOM - 4; y += 10) {
                if (y >= old_ball_y - 8 && y <= old_ball_y + 10) {
                    eadk_rect_t dash = {159, (uint16_t)y, 2, 6};
                    eadk_display_push_rect_uniform(dash, COLOR_NET);
                }
            }
        }

        /* Dessin Joueur 1 */
        eadk_rect_t r_p1 = {P1_X, (uint16_t)p1_y, PADDLE_W, PADDLE_H};
        eadk_display_push_rect_uniform(r_p1, COLOR_P1);
        old_p1_y = p1_y;

        /* Dessin CPU */
        eadk_rect_t r_cpu = {CPU_X, (uint16_t)cpu_y, PADDLE_W, PADDLE_H};
        eadk_display_push_rect_uniform(r_cpu, COLOR_CPU);
        old_cpu_y = cpu_y;

        /* Dessin Balle */
        eadk_rect_t r_ball = {(uint16_t)ball_x, (uint16_t)ball_y, BALL_SIZE, BALL_SIZE};
        eadk_display_push_rect_uniform(r_ball, COLOR_BALL);
        old_ball_x = ball_x;
        old_ball_y = ball_y;

        /* Affichage Scores */
        if (p1_score != last_p1_score || cpu_score != last_cpu_score) {
            char s1_str[8];
            char sc_str[8];
            snprintf(s1_str, sizeof(s1_str), "%d", p1_score);
            snprintf(sc_str, sizeof(sc_str), "%d", cpu_score);
            eadk_point_t p_s1 = {120, PONG_TOP + 8};
            eadk_point_t p_sc = {186, PONG_TOP + 8};
            eadk_display_draw_string(s1_str, p_s1, true, COLOR_P1, COLOR_PONG_BG);
            eadk_display_draw_string(sc_str, p_sc, true, COLOR_CPU, COLOR_PONG_BG);
            last_p1_score = p1_score;
            last_cpu_score = cpu_score;
        }

        /* Message service */
        if (in_serve && !game_over) {
            eadk_point_t p_srv = {75, 170};
            eadk_display_draw_string("Appuyez sur OK pour servir !", p_srv, false, 0xFFE0, COLOR_PONG_BG);
        }

        /* Fin de match */
        if (game_over) {
            eadk_rect_t box = {40, 80, 240, 75};
            eadk_display_push_rect_uniform(box, 0x10A2);
            eadk_rect_t inner = {42, 82, 236, 71};
            eadk_display_push_rect_uniform(inner, 0x0000);

            if (p1_score >= 7) {
                eadk_point_t pt1 = {80, 92};
                eadk_display_draw_string("VICTOIRE ECLATANTE !", pt1, false, 0x07E0, 0x0000);
            } else {
                eadk_point_t pt1 = {85, 92};
                eadk_display_draw_string("LE CPU L'EMPORTE !", pt1, false, 0xF800, 0x0000);
            }
            eadk_point_t pt2 = {65, 114};
            eadk_display_draw_string("OK: Rejouer | Back: Quitter", pt2, false, COLOR_TEXT, 0x0000);
        }

        prev_kbd = kbd;
        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}
