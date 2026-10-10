#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"
#include "storage.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define BRK_TOP_BAR     22
#define BRK_BOTTOM      240
#define BRK_LEFT        0
#define BRK_RIGHT       320

#define PADDLE_Y        222
#define PADDLE_W        46
#define PADDLE_H        7
#define BALL_SIZE       6

#define BRICK_COLS      8
#define BRICK_ROWS      5
#define BRICK_W         34
#define BRICK_H         10
#define BRICK_START_X   10
#define BRICK_START_Y   44
#define BRICK_GAP_X     4
#define BRICK_GAP_Y     4

#define COLOR_BRK_BG    0x0821 /* Fond bleu nuit rétro */
#define COLOR_WALL      0x3DFE /* Bordures cyan néon */
#define COLOR_PADDLE    0xFFFF /* Blanc pur raquette */
#define COLOR_BALL      0xFFFF /* Blanc pur balle */
#define COLOR_TEXT      0xFFFF /* Blanc */

typedef struct {
    bool active;
    uint16_t color;
    int points;
} brick_t;

static const uint16_t s_row_colors[5] = {
    0xF800, /* Rangée 0: Rouge (50 pts) */
    0xFA80, /* Rangée 1: Orange (40 pts) */
    0xFFE0, /* Rangée 2: Jaune (30 pts) */
    0x07E0, /* Rangée 3: Vert (20 pts) */
    0x3DFE  /* Rangée 4: Cyan (10 pts) */
};

static const int s_row_points[5] = {50, 40, 30, 20, 10};

static void draw_single_brick(int r, int c, uint16_t color) {
    int bx = BRICK_START_X + c * (BRICK_W + BRICK_GAP_X);
    int by = BRICK_START_Y + r * (BRICK_H + BRICK_GAP_Y);
    eadk_rect_t brk_rect = {(uint16_t)bx, (uint16_t)by, BRICK_W, BRICK_H};
    eadk_display_push_rect_uniform(brk_rect, color);
    eadk_rect_t hi = {(uint16_t)bx, (uint16_t)by, BRICK_W, 1};
    eadk_display_push_rect_uniform(hi, 0xFFFF);
}

static void erase_single_brick(int r, int c) {
    int bx = BRICK_START_X + c * (BRICK_W + BRICK_GAP_X);
    int by = BRICK_START_Y + r * (BRICK_H + BRICK_GAP_Y);
    eadk_rect_t brk_rect = {(uint16_t)bx, (uint16_t)by, BRICK_W, BRICK_H};
    eadk_display_push_rect_uniform(brk_rect, COLOR_BRK_BG);
}

void run_breakout_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    eq_storage_t* store = eq_storage_get();
    int hi_score = store->record_breakout;

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, 320, BRK_TOP_BAR};
    eadk_display_push_rect_uniform(top_bar, 0x10A2);
    eadk_point_t p_title = {8, 4};
    eadk_display_draw_string("Casse-Briques Arcade (NumWorks N0120)", p_title, false, COLOR_TEXT, 0x10A2);

    brick_t bricks[BRICK_ROWS][BRICK_COLS];
    for (int r = 0; r < BRICK_ROWS; r++) {
        for (int c = 0; c < BRICK_COLS; c++) {
            bricks[r][c].active = true;
            bricks[r][c].color = s_row_colors[r];
            bricks[r][c].points = s_row_points[r];
        }
    }

    float paddle_x = (320 - PADDLE_W) / 2.0f;
    float old_paddle_x = paddle_x;

    float ball_x = paddle_x + (PADDLE_W - BALL_SIZE) / 2.0f;
    float ball_y = PADDLE_Y - BALL_SIZE - 1.0f;
    float old_ball_x = ball_x;
    float old_ball_y = ball_y;

    float ball_vx = 2.8f;
    float ball_vy = -3.2f;

    int lives = 3;
    int score = 0;
    int prev_score = -1;
    int prev_lives = -1;
    int total_bricks = BRICK_ROWS * BRICK_COLS;
    bool in_serve = true;
    bool prev_in_serve = false;
    bool game_over = false;
    bool victory = false;

    eadk_rect_t screen_field = {0, BRK_TOP_BAR, 320, BRK_BOTTOM - BRK_TOP_BAR};
    eadk_display_push_rect_uniform(screen_field, COLOR_BRK_BG);

    /* Bordures latérales et supérieure */
    eadk_rect_t w_top = {0, BRK_TOP_BAR, 320, 2};
    eadk_rect_t w_left = {0, BRK_TOP_BAR, 4, 240 - BRK_TOP_BAR};
    eadk_rect_t w_right = {316, BRK_TOP_BAR, 4, 240 - BRK_TOP_BAR};
    eadk_display_push_rect_uniform(w_top, COLOR_WALL);
    eadk_display_push_rect_uniform(w_left, COLOR_WALL);
    eadk_display_push_rect_uniform(w_right, COLOR_WALL);

    /* Tracé initial des briques */
    for (int r = 0; r < BRICK_ROWS; r++) {
        for (int c = 0; c < BRICK_COLS; c++) {
            draw_single_brick(r, c, bricks[r][c].color);
        }
    }

    /* Tracé initial raquette et balle */
    eadk_rect_t pad_init = {(uint16_t)paddle_x, PADDLE_Y, PADDLE_W, PADDLE_H};
    eadk_display_push_rect_uniform(pad_init, COLOR_PADDLE);
    eadk_rect_t b_init = {(uint16_t)ball_x, (uint16_t)ball_y, BALL_SIZE, BALL_SIZE};
    eadk_display_push_rect_uniform(b_init, COLOR_BALL);

    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || eadk_keyboard_key_down(kbd, eadk_key_home)) {
            break;
        }

        if (game_over || victory) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                score = 0;
                lives = 3;
                total_bricks = BRICK_ROWS * BRICK_COLS;
                game_over = false;
                victory = false;
                in_serve = true;
                prev_in_serve = false;
                prev_score = -1;
                prev_lives = -1;

                for (int r = 0; r < BRICK_ROWS; r++) {
                    for (int c = 0; c < BRICK_COLS; c++) {
                        bricks[r][c].active = true;
                    }
                }

                paddle_x = (320 - PADDLE_W) / 2.0f;
                old_paddle_x = paddle_x;
                ball_x = paddle_x + (PADDLE_W - BALL_SIZE) / 2.0f;
                ball_y = PADDLE_Y - BALL_SIZE - 1.0f;
                old_ball_x = ball_x;
                old_ball_y = ball_y;
                ball_vx = 2.8f;
                ball_vy = -3.2f;

                eadk_display_push_rect_uniform(screen_field, COLOR_BRK_BG);
                eadk_display_push_rect_uniform(w_top, COLOR_WALL);
                eadk_display_push_rect_uniform(w_left, COLOR_WALL);
                eadk_display_push_rect_uniform(w_right, COLOR_WALL);

                for (int r = 0; r < BRICK_ROWS; r++) {
                    for (int c = 0; c < BRICK_COLS; c++) {
                        draw_single_brick(r, c, bricks[r][c].color);
                    }
                }
            }
            prev_kbd = kbd;
            eadk_timing_msleep(20);
            continue;
        }

        /* Déplacement raquette */
        if (eadk_keyboard_key_down(kbd, eadk_key_left) || eadk_keyboard_key_down(kbd, eadk_key_four)) {
            paddle_x -= 5.5f;
            if (paddle_x < 6.0f) paddle_x = 6.0f;
        }
        if (eadk_keyboard_key_down(kbd, eadk_key_right) || eadk_keyboard_key_down(kbd, eadk_key_six)) {
            paddle_x += 5.5f;
            if (paddle_x + PADDLE_W > 314.0f) paddle_x = 314.0f - PADDLE_W;
        }

        /* Lancement de balle */
        if (in_serve) {
            ball_x = paddle_x + (PADDLE_W - BALL_SIZE) / 2.0f;
            ball_y = PADDLE_Y - BALL_SIZE - 1.0f;
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe) ||
                eadk_keyboard_key_down(pressed, eadk_key_up)) {
                in_serve = false;
                ball_vx = (eadk_random() % 2 == 0) ? 2.6f : -2.6f;
                ball_vy = -3.4f;
            }
        } else {
            /* Physique de la balle */
            ball_x += ball_vx;
            ball_y += ball_vy;

            /* Murs latéraux */
            if (ball_x <= 4.0f) {
                ball_x = 4.0f;
                ball_vx = -ball_vx;
            } else if (ball_x + BALL_SIZE >= 316.0f) {
                ball_x = 316.0f - BALL_SIZE;
                ball_vx = -ball_vx;
            }

            /* Mur supérieur */
            if (ball_y <= BRK_TOP_BAR + 2.0f) {
                ball_y = BRK_TOP_BAR + 2.0f;
                ball_vy = -ball_vy;
            }

            /* Rebond raquette */
            if (ball_vy > 0.0f && ball_y + BALL_SIZE >= PADDLE_Y && ball_y <= PADDLE_Y + PADDLE_H) {
                if (ball_x + BALL_SIZE >= paddle_x && ball_x <= paddle_x + PADDLE_W) {
                    ball_y = PADDLE_Y - BALL_SIZE;
                    float rel = ((ball_x + BALL_SIZE / 2.0f) - (paddle_x + PADDLE_W / 2.0f)) / (PADDLE_W / 2.0f);
                    ball_vx = rel * 4.2f;
                    ball_vy = -3.8f;
                    if (ball_vx > -0.6f && ball_vx < 0.6f) ball_vx = (ball_vx >= 0 ? 1.4f : -1.4f);
                }
            }

            /* Collision avec les briques */
            for (int r = 0; r < BRICK_ROWS; r++) {
                for (int c = 0; c < BRICK_COLS; c++) {
                    if (bricks[r][c].active) {
                        int bx = BRICK_START_X + c * (BRICK_W + BRICK_GAP_X);
                        int by = BRICK_START_Y + r * (BRICK_H + BRICK_GAP_Y);

                        if (ball_x + BALL_SIZE >= bx && ball_x <= bx + BRICK_W &&
                            ball_y + BALL_SIZE >= by && ball_y <= by + BRICK_H) {
                            bricks[r][c].active = false;
                            erase_single_brick(r, c);
                            score += bricks[r][c].points;
                            total_bricks--;

                            if (score > hi_score) {
                                hi_score = score;
                                store->record_breakout = hi_score;
                                eq_storage_commit();
                            }

                            /* Inversion verticale ou horizontale selon point d'impact */
                            if (ball_y + BALL_SIZE - ball_vy <= by || ball_y - ball_vy >= by + BRICK_H) {
                                ball_vy = -ball_vy;
                            } else {
                                ball_vx = -ball_vx;
                            }

                            if (total_bricks <= 0) {
                                victory = true;
                            }
                            goto collision_done;
                        }
                    }
                }
            }
collision_done: ;

            /* Perte de balle en bas */
            if (ball_y > 235.0f) {
                /* Effacer l'ancienne balle */
                int ox = (int)old_ball_x;
                int oy = (int)old_ball_y;
                int ow = BALL_SIZE;
                int oh = BALL_SIZE;
                if (ox < 4) { ow -= (4 - ox); ox = 4; }
                if (ox + ow > 316) ow = 316 - ox;
                if (oy < BRK_TOP_BAR + 2) { oh -= (BRK_TOP_BAR + 2 - oy); oy = BRK_TOP_BAR + 2; }
                if (ow > 0 && oh > 0) {
                    eadk_rect_t clr_b = {(uint16_t)ox, (uint16_t)oy, (uint16_t)ow, (uint16_t)oh};
                    eadk_display_push_rect_uniform(clr_b, COLOR_BRK_BG);
                }

                lives--;
                if (lives <= 0) {
                    game_over = true;
                } else {
                    in_serve = true;
                }
            }
        }

        /* Effacement et Redessin ciblé de la raquette (zéro scintillement) */
        if ((int)paddle_x != (int)old_paddle_x) {
            eadk_rect_t clr_pad = {(uint16_t)old_paddle_x, PADDLE_Y, PADDLE_W, PADDLE_H};
            eadk_display_push_rect_uniform(clr_pad, COLOR_BRK_BG);

            eadk_rect_t pad_rect = {(uint16_t)paddle_x, PADDLE_Y, PADDLE_W, PADDLE_H};
            eadk_display_push_rect_uniform(pad_rect, COLOR_PADDLE);
            eadk_rect_t pad_rim = {(uint16_t)paddle_x, PADDLE_Y + 1, PADDLE_W, 2};
            eadk_display_push_rect_uniform(pad_rim, COLOR_WALL);

            old_paddle_x = paddle_x;
        }

        /* Effacement et Redessin ciblé de la balle (zéro scintillement) */
        if (!game_over && !victory) {
            if ((int)ball_x != (int)old_ball_x || (int)ball_y != (int)old_ball_y) {
                int ox = (int)old_ball_x;
                int oy = (int)old_ball_y;
                int ow = BALL_SIZE;
                int oh = BALL_SIZE;
                if (ox < 4) { ow -= (4 - ox); ox = 4; }
                if (ox + ow > 316) ow = 316 - ox;
                if (oy < BRK_TOP_BAR + 2) { oh -= (BRK_TOP_BAR + 2 - oy); oy = BRK_TOP_BAR + 2; }
                if (ow > 0 && oh > 0) {
                    eadk_rect_t clr_ball = {(uint16_t)ox, (uint16_t)oy, (uint16_t)ow, (uint16_t)oh};
                    eadk_display_push_rect_uniform(clr_ball, COLOR_BRK_BG);
                }

                eadk_rect_t b_rect = {(uint16_t)ball_x, (uint16_t)ball_y, BALL_SIZE, BALL_SIZE};
                eadk_display_push_rect_uniform(b_rect, COLOR_BALL);

                old_ball_x = ball_x;
                old_ball_y = ball_y;
            }
        }

        /* HUD Supérieur : Mise à jour uniquement sur changement de valeur */
        if (score != prev_score || lives != prev_lives) {
            prev_score = score;
            prev_lives = lives;

            eadk_rect_t hud_zone = {12, BRK_TOP_BAR + 2, 296, 14};
            eadk_display_push_rect_uniform(hud_zone, COLOR_BRK_BG);

            char hud_buf[64];
            snprintf(hud_buf, sizeof(hud_buf), "SCORE:%04d  HI:%04d  BALLES:%d", score, hi_score, lives);
            eadk_point_t p_hud = {16, BRK_TOP_BAR + 4};
            eadk_display_draw_string(hud_buf, p_hud, false, COLOR_TEXT, COLOR_BRK_BG);
        }

        /* Consigne de service dynamique */
        if (in_serve != prev_in_serve) {
            prev_in_serve = in_serve;
            eadk_rect_t srv_zone = {60, 160, 200, 16};
            eadk_display_push_rect_uniform(srv_zone, COLOR_BRK_BG);
            if (in_serve && !game_over && !victory) {
                eadk_point_t p_srv = {65, 160};
                eadk_display_draw_string("Appuyez sur OK pour lancer !", p_srv, false, 0xFFE0, COLOR_BRK_BG);
            }
        }

        /* Fin de jeu / Victoire */
        if (game_over || victory) {
            eadk_rect_t box = {40, 80, 240, 75};
            eadk_display_push_rect_uniform(box, 0x10A2);
            eadk_rect_t inner = {42, 82, 236, 71};
            eadk_display_push_rect_uniform(inner, 0x0000);

            if (victory) {
                eadk_point_t p1 = {75, 92};
                eadk_display_draw_string("VICTOIRE TOTALE ! BRAVO", p1, false, 0x07E0, 0x0000);
            } else {
                eadk_point_t p1 = {95, 92};
                eadk_display_draw_string("G A M E   O V E R", p1, false, 0xF800, 0x0000);
            }
            eadk_point_t p2 = {65, 114};
            eadk_display_draw_string("OK: Rejouer | Back: Quitter", p2, false, COLOR_TEXT, 0x0000);
        }

        prev_kbd = kbd;
        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}
