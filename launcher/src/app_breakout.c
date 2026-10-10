#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

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

void run_breakout_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

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
    float ball_x = paddle_x + (PADDLE_W - BALL_SIZE) / 2.0f;
    float ball_y = PADDLE_Y - BALL_SIZE - 1.0f;
    float ball_vx = 2.8f;
    float ball_vy = -3.2f;

    int lives = 3;
    int score = 0;
    int total_bricks = BRICK_ROWS * BRICK_COLS;
    bool in_serve = true;
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

                for (int r = 0; r < BRICK_ROWS; r++) {
                    for (int c = 0; c < BRICK_COLS; c++) {
                        bricks[r][c].active = true;
                    }
                }

                paddle_x = (320 - PADDLE_W) / 2.0f;
                ball_x = paddle_x + (PADDLE_W - BALL_SIZE) / 2.0f;
                ball_y = PADDLE_Y - BALL_SIZE - 1.0f;
                ball_vx = 2.8f;
                ball_vy = -3.2f;

                eadk_display_push_rect_uniform(screen_field, COLOR_BRK_BG);
                eadk_display_push_rect_uniform(w_top, COLOR_WALL);
                eadk_display_push_rect_uniform(w_left, COLOR_WALL);
                eadk_display_push_rect_uniform(w_right, COLOR_WALL);
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
            if (ball_x <= 5.0f) {
                ball_x = 5.0f;
                ball_vx = -ball_vx;
            } else if (ball_x + BALL_SIZE >= 315.0f) {
                ball_x = 315.0f - BALL_SIZE;
                ball_vx = -ball_vx;
            }

            /* Mur supérieur */
            if (ball_y <= BRK_TOP_BAR + 3.0f) {
                ball_y = BRK_TOP_BAR + 3.0f;
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
                            score += bricks[r][c].points;
                            total_bricks--;

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
                lives--;
                if (lives <= 0) {
                    game_over = true;
                } else {
                    in_serve = true;
                }
            }
        }

        /* Rendu graphique propre */
        eadk_display_push_rect_uniform(screen_field, COLOR_BRK_BG);
        eadk_display_push_rect_uniform(w_top, COLOR_WALL);
        eadk_display_push_rect_uniform(w_left, COLOR_WALL);
        eadk_display_push_rect_uniform(w_right, COLOR_WALL);

        /* Tracé des Briques */
        for (int r = 0; r < BRICK_ROWS; r++) {
            for (int c = 0; c < BRICK_COLS; c++) {
                if (bricks[r][c].active) {
                    int bx = BRICK_START_X + c * (BRICK_W + BRICK_GAP_X);
                    int by = BRICK_START_Y + r * (BRICK_H + BRICK_GAP_Y);
                    eadk_rect_t brk_rect = {(uint16_t)bx, (uint16_t)by, BRICK_W, BRICK_H};
                    eadk_display_push_rect_uniform(brk_rect, bricks[r][c].color);

                    /* Bordure 3D brique */
                    eadk_rect_t hi = {(uint16_t)bx, (uint16_t)by, BRICK_W, 1};
                    eadk_display_push_rect_uniform(hi, 0xFFFF);
                }
            }
        }

        /* Tracé de la Raquette */
        eadk_rect_t pad_rect = {(uint16_t)paddle_x, PADDLE_Y, PADDLE_W, PADDLE_H};
        eadk_display_push_rect_uniform(pad_rect, COLOR_PADDLE);
        eadk_rect_t pad_rim = {(uint16_t)paddle_x, PADDLE_Y + 1, PADDLE_W, 2};
        eadk_display_push_rect_uniform(pad_rim, COLOR_WALL);

        /* Tracé de la Balle */
        eadk_rect_t b_rect = {(uint16_t)ball_x, (uint16_t)ball_y, BALL_SIZE, BALL_SIZE};
        eadk_display_push_rect_uniform(b_rect, COLOR_BALL);

        /* HUD Supérieur : Score & Vies */
        char hud_buf[48];
        snprintf(hud_buf, sizeof(hud_buf), "SCORE:%04d   BALLES:%d", score, lives);
        eadk_point_t p_hud = {16, BRK_TOP_BAR + 4};
        eadk_display_draw_string(hud_buf, p_hud, false, COLOR_TEXT, COLOR_BRK_BG);

        /* Consigne de service */
        if (in_serve && !game_over && !victory) {
            eadk_point_t p_srv = {75, 160};
            eadk_display_draw_string("Appuyez sur OK pour lancer !", p_srv, false, 0xFFE0, COLOR_BRK_BG);
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
