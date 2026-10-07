#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define COLOR_SKY       0x7ECF  /* Bleu ciel */
#define COLOR_GROUND    0xD586  /* Sol terre/sable */
#define COLOR_GRASS     0x4DE6  /* Herbe verte */
#define COLOR_PIPE      0x2C44  /* Tuyau vert foncé */
#define COLOR_PIPE_RIM  0x1A42  /* Bordure de tuyau */
#define COLOR_BIRD      0xFDC0  /* Jaune oiseau */
#define COLOR_BEAK      0xFBA0  /* Orange bec */
#define COLOR_EYE_WHITE 0xFFFF
#define COLOR_EYE_PUPIL 0x0000

#define PLAY_TOP        22
#define PLAY_BOTTOM     214
#define GROUND_Y        214

#define BIRD_X          60
#define BIRD_W          14
#define BIRD_H          11

#define PIPE_W          32
#define PIPE_GAP        58
#define MAX_PIPES       3

typedef struct {
    int x;
    int gap_y;
    bool passed;
    bool active;
} pipe_t;

void run_flappy_app(void) {
    /* Debounce initial */
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    int bird_y = 100 * 10;      /* En dixièmes de pixels pour physique fluide */
    int bird_vy = 0;             /* Vitesse verticale */
    const int gravity = 2;       /* Accélération */
    const int flap_power = -22;  /* Impulsion vers le haut */

    pipe_t pipes[MAX_PIPES];
    for (int i = 0; i < MAX_PIPES; i++) {
        pipes[i].active = false;
        pipes[i].x = 320 + i * 130;
        pipes[i].gap_y = 60 + (int)(eadk_random() % 80);
        pipes[i].passed = false;
    }
    pipes[0].active = true;
    pipes[1].active = true;

    int score = 0;
    int best_score = 0;
    bool game_over = false;
    bool started = false;

    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        /* Mode Panique Furtif universel via [Var] */
        if (eadk_keyboard_key_down(kbd, eadk_key_var)) {
            run_panic_calculator();
            while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
            prev_kbd = 0;
            continue;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        bool flap = eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                    eadk_keyboard_key_down(pressed, eadk_key_exe) ||
                    eadk_keyboard_key_down(pressed, eadk_key_up);

        if (game_over) {
            if (flap) {
                /* Redémarrer la partie */
                bird_y = 100 * 10;
                bird_vy = 0;
                score = 0;
                game_over = false;
                started = false;
                for (int i = 0; i < MAX_PIPES; i++) {
                    pipes[i].active = (i < 2);
                    pipes[i].x = 320 + i * 130;
                    pipes[i].gap_y = 60 + (int)(eadk_random() % 80);
                    pipes[i].passed = false;
                }
            }
        } else {
            if (flap) {
                started = true;
                bird_vy = flap_power;
            }

            if (started) {
                /* Physique de l'oiseau */
                bird_vy += gravity;
                if (bird_vy > 35) bird_vy = 35;
                bird_y += bird_vy;

                int py = bird_y / 10;
                if (py + BIRD_H >= GROUND_Y) {
                    py = GROUND_Y - BIRD_H;
                    game_over = true;
                }
                if (py < PLAY_TOP) {
                    py = PLAY_TOP;
                    bird_vy = 0;
                }

                /* Déplacement des tuyaux */
                for (int i = 0; i < MAX_PIPES; i++) {
                    if (!pipes[i].active) continue;

                    pipes[i].x -= 3;

                    /* Vérification score */
                    if (!pipes[i].passed && pipes[i].x + PIPE_W < BIRD_X) {
                        pipes[i].passed = true;
                        score++;
                        if (score > best_score) best_score = score;
                    }

                    /* Recyclage du tuyau */
                    if (pipes[i].x < -PIPE_W) {
                        /* Trouver le X max parmi les autres tuyaux */
                        int max_x = 0;
                        for (int j = 0; j < MAX_PIPES; j++) {
                            if (pipes[j].active && pipes[j].x > max_x) {
                                max_x = pipes[j].x;
                            }
                        }
                        pipes[i].x = max_x + 130;
                        pipes[i].gap_y = 55 + (int)(eadk_random() % 85);
                        pipes[i].passed = false;
                    }

                    /* Collision avec les tuyaux */
                    int px = pipes[i].x;
                    int gy = pipes[i].gap_y;

                    if (BIRD_X + BIRD_W > px && BIRD_X < px + PIPE_W) {
                        if (py < gy || py + BIRD_H > gy + PIPE_GAP) {
                            game_over = true;
                        }
                    }
                }
            }
        }

        prev_kbd = kbd;

        /* RENDU GRAPHIQUE */
        /* Fond ciel */
        eadk_rect_t sky_rect = {0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP};
        eadk_display_push_rect_uniform(sky_rect, COLOR_SKY);

        /* Tuyaux */
        for (int i = 0; i < MAX_PIPES; i++) {
            if (!pipes[i].active) continue;
            int px = pipes[i].x;
            if (px + PIPE_W < 0 || px >= EADK_SCREEN_WIDTH) continue;

            int gy = pipes[i].gap_y;
            int draw_x = (px < 0) ? 0 : px;
            int draw_w = PIPE_W;
            if (px < 0) draw_w += px;
            if (draw_x + draw_w > EADK_SCREEN_WIDTH) draw_w = EADK_SCREEN_WIDTH - draw_x;

            if (draw_w > 0) {
                /* Tuyau haut */
                if (gy > PLAY_TOP) {
                    eadk_rect_t top_p = {(uint16_t)draw_x, (uint16_t)PLAY_TOP, (uint16_t)draw_w, (uint16_t)(gy - PLAY_TOP)};
                    eadk_display_push_rect_uniform(top_p, COLOR_PIPE);
                    /* Rebord haut */
                    if (gy - 6 >= PLAY_TOP) {
                        eadk_rect_t rim_top = {(uint16_t)draw_x, (uint16_t)(gy - 6), (uint16_t)draw_w, 6};
                        eadk_display_push_rect_uniform(rim_top, COLOR_PIPE_RIM);
                    }
                }

                /* Tuyau bas */
                int bot_y = gy + PIPE_GAP;
                if (bot_y < GROUND_Y) {
                    eadk_rect_t bot_p = {(uint16_t)draw_x, (uint16_t)bot_y, (uint16_t)draw_w, (uint16_t)(GROUND_Y - bot_y)};
                    eadk_display_push_rect_uniform(bot_p, COLOR_PIPE);
                    /* Rebord bas */
                    eadk_rect_t rim_bot = {(uint16_t)draw_x, (uint16_t)bot_y, (uint16_t)draw_w, 6};
                    eadk_display_push_rect_uniform(rim_bot, COLOR_PIPE_RIM);
                }
            }
        }

        /* Sol */
        eadk_rect_t grass_rect = {0, GROUND_Y, EADK_SCREEN_WIDTH, 6};
        eadk_display_push_rect_uniform(grass_rect, COLOR_GRASS);
        eadk_rect_t ground_rect = {0, GROUND_Y + 6, EADK_SCREEN_WIDTH, EADK_SCREEN_HEIGHT - 16 - (GROUND_Y + 6)};
        eadk_display_push_rect_uniform(ground_rect, COLOR_GROUND);

        /* Oiseau */
        int by = bird_y / 10;
        eadk_rect_t bird_body = {(uint16_t)BIRD_X, (uint16_t)by, BIRD_W, BIRD_H};
        eadk_display_push_rect_uniform(bird_body, COLOR_BIRD);
        /* Bec */
        eadk_rect_t bird_beak = {(uint16_t)(BIRD_X + BIRD_W - 3), (uint16_t)(by + 4), 5, 4};
        eadk_display_push_rect_uniform(bird_beak, COLOR_BEAK);
        /* Oeil */
        eadk_rect_t bird_eye = {(uint16_t)(BIRD_X + BIRD_W - 6), (uint16_t)(by + 2), 3, 3};
        eadk_display_push_rect_uniform(bird_eye, COLOR_EYE_WHITE);
        eadk_rect_t bird_pupil = {(uint16_t)(BIRD_X + BIRD_W - 5), (uint16_t)(by + 3), 1, 1};
        eadk_display_push_rect_uniform(bird_pupil, COLOR_EYE_PUPIL);

        /* Barre supérieure */
        eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
        eadk_display_push_rect_uniform(top_bar, 0xFE60);
        eadk_point_t pt_title = {8, 5};
        eadk_display_draw_string("Flappy Bird NW", pt_title, false, eadk_color_black, 0xFE60);

        char score_str[32];
        snprintf(score_str, sizeof(score_str), "Score: %d  Best: %d", score, best_score);
        eadk_point_t pt_score = {180, 5};
        eadk_display_draw_string(score_str, pt_score, false, eadk_color_black, 0xFE60);

        /* Écran Game Over ou Attente */
        if (!started && !game_over) {
            eadk_rect_t hint_box = {60, 90, 200, 36};
            eadk_display_push_rect_uniform(hint_box, 0x0000);
            eadk_rect_t hint_inner = {62, 92, 196, 32};
            eadk_display_push_rect_uniform(hint_inner, 0xFFFF);
            eadk_point_t pt_h1 = {78, 96};
            eadk_display_draw_string("Appuyez sur OK ou HAUT", pt_h1, false, 0x0000, 0xFFFF);
            eadk_point_t pt_h2 = {100, 110};
            eadk_display_draw_string("pour commencer !", pt_h2, false, 0x3186, 0xFFFF);
        } else if (game_over) {
            eadk_rect_t over_box = {50, 70, 220, 74};
            eadk_display_push_rect_uniform(over_box, 0x0000);
            eadk_rect_t over_inner = {52, 72, 216, 70};
            eadk_display_push_rect_uniform(over_inner, 0xFFFF);

            eadk_point_t pt_gov = {95, 78};
            eadk_display_draw_string("GAME OVER", pt_gov, true, 0xF800, 0xFFFF);

            char final_s[32];
            snprintf(final_s, sizeof(final_s), "Score: %d  |  Record: %d", score, best_score);
            eadk_point_t pt_fin = {68, 104};
            eadk_display_draw_string(final_s, pt_fin, false, 0x0000, 0xFFFF);

            eadk_point_t pt_rst = {65, 122};
            eadk_display_draw_string("OK: Rejouer  |  BACK: Hub", pt_rst, false, 0x028A, 0xFFFF);
        }

        /* Barre inférieure */
        eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
        eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
        eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
        eadk_display_draw_string("OK / HAUT: Voler  |  BACK: Quitter  |  Var: Furtif", pt_help, false, 0x4208, eadk_color_white);

        eadk_timing_msleep(25);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
