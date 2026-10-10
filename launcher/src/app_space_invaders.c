#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define INV_TOP_BAR     22
#define INV_BOTTOM      236
#define CANNON_Y        214
#define CANNON_W        16
#define CANNON_H        10

#define ALIEN_COLS      6
#define ALIEN_ROWS      3
#define ALIEN_W         14
#define ALIEN_H         10

#define COLOR_INV_BG    0x0821 /* Noir bleuté spatial */
#define COLOR_CANNON    0x07E0 /* Vert éclatant */
#define COLOR_LASER     0xFFE0 /* Jaune laser */
#define COLOR_BOMB      0xF800 /* Rouge bombe alien */
#define COLOR_SHIELD    0x3DFE /* Cyan bouclier */
#define COLOR_TEXT      0xFFFF /* Blanc */

typedef struct {
    bool alive;
    int row;
    int col;
} alien_t;

typedef struct {
    float x;
    float y;
    bool active;
} bullet_t;

typedef struct {
    int x;
    int hp[4]; /* 4 blocs de bouclier */
} bunker_t;

static void draw_alien_sprite(int x, int y, int type, int frame) {
    uint16_t col = (type == 0) ? 0xFA80 : ((type == 1) ? 0x3DFE : 0x4FE0);

    /* Corps central commun (10x6) */
    eadk_rect_t body = {(uint16_t)(x + 2), (uint16_t)(y + 2), 10, 6};
    eadk_display_push_rect_uniform(body, col);

    /* Yeux */
    eadk_rect_t e1 = {(uint16_t)(x + 4), (uint16_t)(y + 4), 2, 2};
    eadk_rect_t e2 = {(uint16_t)(x + 8), (uint16_t)(y + 4), 2, 2};
    eadk_display_push_rect_uniform(e1, COLOR_INV_BG);
    eadk_display_push_rect_uniform(e2, COLOR_INV_BG);

    /* Antennes */
    eadk_rect_t a1 = {(uint16_t)(x + 3), (uint16_t)(y), 2, 2};
    eadk_rect_t a2 = {(uint16_t)(x + 9), (uint16_t)(y), 2, 2};
    eadk_display_push_rect_uniform(a1, col);
    eadk_display_push_rect_uniform(a2, col);

    /* Tentacules animés (frame 0 vs 1) */
    if (frame == 0) {
        eadk_rect_t l1 = {(uint16_t)(x + 1), (uint16_t)(y + 7), 2, 3};
        eadk_rect_t l2 = {(uint16_t)(x + 11), (uint16_t)(y + 7), 2, 3};
        eadk_display_push_rect_uniform(l1, col);
        eadk_display_push_rect_uniform(l2, col);
    } else {
        eadk_rect_t l1 = {(uint16_t)(x + 3), (uint16_t)(y + 8), 3, 2};
        eadk_rect_t l2 = {(uint16_t)(x + 8), (uint16_t)(y + 8), 3, 2};
        eadk_display_push_rect_uniform(l1, col);
        eadk_display_push_rect_uniform(l2, col);
    }
}

static void draw_cannon(int cx) {
    /* Base du canon */
    eadk_rect_t base = {(uint16_t)(cx), CANNON_Y + 4, CANNON_W, 6};
    eadk_display_push_rect_uniform(base, COLOR_CANNON);

    /* Tourelle */
    eadk_rect_t turret = {(uint16_t)(cx + 4), CANNON_Y + 2, 8, 3};
    eadk_display_push_rect_uniform(turret, COLOR_CANNON);

    /* Canon */
    eadk_rect_t barrel = {(uint16_t)(cx + 7), CANNON_Y, 2, 3};
    eadk_display_push_rect_uniform(barrel, 0xFFFF);
}

void run_space_invaders_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, 320, INV_TOP_BAR};
    eadk_display_push_rect_uniform(top_bar, 0x10A2);
    eadk_point_t p_title = {8, 4};
    eadk_display_draw_string("Space Invaders Arcade (NumWorks)", p_title, false, COLOR_TEXT, 0x10A2);

    int cannon_x = 152;
    int lives = 3;
    int score = 0;
    int wave = 1;
    bool game_over = false;
    bool victory = false;

    bullet_t p_laser = {0, 0, false};
    bullet_t alien_bombs[3];
    for (int i = 0; i < 3; i++) alien_bombs[i].active = false;

    alien_t aliens[ALIEN_ROWS][ALIEN_COLS];
    for (int r = 0; r < ALIEN_ROWS; r++) {
        for (int c = 0; c < ALIEN_COLS; c++) {
            aliens[r][c].alive = true;
            aliens[r][c].row = r;
            aliens[r][c].col = c;
        }
    }

    float grid_x = 30.0f;
    float grid_y = 45.0f;
    float grid_vx = 1.6f;
    int anim_frame = 0;
    int step_counter = 0;

    bunker_t bunkers[3] = {
        {60,  {3, 3, 3, 3}},
        {150, {3, 3, 3, 3}},
        {240, {3, 3, 3, 3}}
    };

    eadk_rect_t screen_field = {0, INV_TOP_BAR, 320, 240 - INV_TOP_BAR};
    eadk_display_push_rect_uniform(screen_field, COLOR_INV_BG);

    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || eadk_keyboard_key_down(kbd, eadk_key_home)) {
            break;
        }

        if (game_over || victory) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                if (game_over) {
                    score = 0;
                    lives = 3;
                    wave = 1;
                } else {
                    wave++;
                }
                game_over = false;
                victory = false;
                cannon_x = 152;
                p_laser.active = false;
                for (int i = 0; i < 3; i++) alien_bombs[i].active = false;
                for (int r = 0; r < ALIEN_ROWS; r++) {
                    for (int c = 0; c < ALIEN_COLS; c++) {
                        aliens[r][c].alive = true;
                    }
                }
                grid_x = 30.0f;
                grid_y = 45.0f;
                grid_vx = 1.6f + (wave - 1) * 0.4f;

                for (int b = 0; b < 3; b++) {
                    for (int k = 0; k < 4; k++) bunkers[b].hp[k] = 3;
                }

                eadk_display_push_rect_uniform(screen_field, COLOR_INV_BG);
            }
            prev_kbd = kbd;
            eadk_timing_msleep(20);
            continue;
        }

        /* Déplacement joueur */
        if (eadk_keyboard_key_down(kbd, eadk_key_left) || eadk_keyboard_key_down(kbd, eadk_key_four)) {
            cannon_x -= 4;
            if (cannon_x < 10) cannon_x = 10;
        }
        if (eadk_keyboard_key_down(kbd, eadk_key_right) || eadk_keyboard_key_down(kbd, eadk_key_six)) {
            cannon_x += 4;
            if (cannon_x + CANNON_W > 310) cannon_x = 310 - CANNON_W;
        }

        /* Tir Laser joueur */
        if (!p_laser.active) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe) ||
                eadk_keyboard_key_down(pressed, eadk_key_up)) {
                p_laser.active = true;
                p_laser.x = cannon_x + 7;
                p_laser.y = CANNON_Y - 4;
            }
        }

        /* Déplacement laser joueur */
        if (p_laser.active) {
            p_laser.y -= 7.0f;
            if (p_laser.y < INV_TOP_BAR) {
                p_laser.active = false;
            } else {
                /* Collision avec aliens */
                for (int r = 0; r < ALIEN_ROWS; r++) {
                    for (int c = 0; c < ALIEN_COLS; c++) {
                        if (aliens[r][c].alive) {
                            int ax = (int)grid_x + c * 32;
                            int ay = (int)grid_y + r * 20;
                            if (p_laser.x >= ax && p_laser.x <= ax + ALIEN_W &&
                                p_laser.y >= ay && p_laser.y <= ay + ALIEN_H) {
                                aliens[r][c].alive = false;
                                p_laser.active = false;
                                score += (3 - r) * 10;
                                break;
                            }
                        }
                    }
                    if (!p_laser.active) break;
                }

                /* Collision laser avec bunkers */
                if (p_laser.active) {
                    for (int b = 0; b < 3; b++) {
                        if (p_laser.x >= bunkers[b].x && p_laser.x < bunkers[b].x + 24 &&
                            p_laser.y >= 185 && p_laser.y <= 197) {
                            int part = (int)(p_laser.x - bunkers[b].x) / 6;
                            if (part >= 0 && part < 4 && bunkers[b].hp[part] > 0) {
                                bunkers[b].hp[part]--;
                                p_laser.active = false;
                                break;
                            }
                        }
                    }
                }
            }
        }

        /* Progression des aliens */
        step_counter++;
        int alive_count = 0;
        int min_col_x = 320;
        int max_col_x = 0;

        for (int r = 0; r < ALIEN_ROWS; r++) {
            for (int c = 0; c < ALIEN_COLS; c++) {
                if (aliens[r][c].alive) {
                    alive_count++;
                    int ax = (int)grid_x + c * 32;
                    if (ax < min_col_x) min_col_x = ax;
                    if (ax + ALIEN_W > max_col_x) max_col_x = ax + ALIEN_W;
                }
            }
        }

        if (alive_count == 0) {
            victory = true;
        }

        /* Vitesse dépend du nombre d'aliens vivants */
        int step_interval = (alive_count > 12) ? 6 : ((alive_count > 6) ? 4 : 2);
        if (step_counter % step_interval == 0) {
            grid_x += grid_vx;
            anim_frame = 1 - anim_frame;

            if (max_col_x >= 310 && grid_vx > 0) {
                grid_vx = -grid_vx;
                grid_y += 8.0f;
            } else if (min_col_x <= 10 && grid_vx < 0) {
                grid_vx = -grid_vx;
                grid_y += 8.0f;
            }
        }

        /* Les aliens descendent trop bas */
        if (grid_y + (ALIEN_ROWS * 20) >= CANNON_Y - 10) {
            game_over = true;
        }

        /* Tirs de bombes par les aliens */
        for (int i = 0; i < 3; i++) {
            if (!alien_bombs[i].active && (eadk_random() % 45 == 0) && alive_count > 0) {
                int col = eadk_random() % ALIEN_COLS;
                for (int r = ALIEN_ROWS - 1; r >= 0; r--) {
                    if (aliens[r][col].alive) {
                        alien_bombs[i].active = true;
                        alien_bombs[i].x = grid_x + col * 32 + 6;
                        alien_bombs[i].y = grid_y + r * 20 + ALIEN_H;
                        break;
                    }
                }
            }

            if (alien_bombs[i].active) {
                alien_bombs[i].y += 3.5f;
                if (alien_bombs[i].y >= 235) {
                    alien_bombs[i].active = false;
                } else {
                    /* Collision bombe avec bunkers */
                    for (int b = 0; b < 3; b++) {
                        if (alien_bombs[i].x >= bunkers[b].x && alien_bombs[i].x < bunkers[b].x + 24 &&
                            alien_bombs[i].y >= 185 && alien_bombs[i].y <= 197) {
                            int part = (int)(alien_bombs[i].x - bunkers[b].x) / 6;
                            if (part >= 0 && part < 4 && bunkers[b].hp[part] > 0) {
                                bunkers[b].hp[part]--;
                                alien_bombs[i].active = false;
                                break;
                            }
                        }
                    }

                    /* Collision bombe avec joueur */
                    if (alien_bombs[i].active &&
                        alien_bombs[i].x >= cannon_x && alien_bombs[i].x <= cannon_x + CANNON_W &&
                        alien_bombs[i].y >= CANNON_Y && alien_bombs[i].y <= CANNON_Y + CANNON_H) {
                        alien_bombs[i].active = false;
                        lives--;
                        if (lives <= 0) game_over = true;
                    }
                }
            }
        }

        /* Rendu graphique propre */
        eadk_display_push_rect_uniform(screen_field, COLOR_INV_BG);

        /* Tracé des Aliens */
        for (int r = 0; r < ALIEN_ROWS; r++) {
            for (int c = 0; c < ALIEN_COLS; c++) {
                if (aliens[r][c].alive) {
                    draw_alien_sprite((int)grid_x + c * 32, (int)grid_y + r * 20, r, anim_frame);
                }
            }
        }

        /* Tracé des Bunkers */
        for (int b = 0; b < 3; b++) {
            for (int k = 0; k < 4; k++) {
                if (bunkers[b].hp[k] > 0) {
                    uint16_t b_col = (bunkers[b].hp[k] == 3) ? COLOR_SHIELD :
                                     ((bunkers[b].hp[k] == 2) ? 0x05E0 : 0xCE60);
                    eadk_rect_t b_part = {(uint16_t)(bunkers[b].x + k * 6), 185, 5, 12};
                    eadk_display_push_rect_uniform(b_part, b_col);
                }
            }
        }

        /* Tracé du Canon */
        draw_cannon(cannon_x);

        /* Tracé du Laser joueur */
        if (p_laser.active) {
            eadk_rect_t l_rect = {(uint16_t)p_laser.x, (uint16_t)p_laser.y, 2, 6};
            eadk_display_push_rect_uniform(l_rect, COLOR_LASER);
        }

        /* Tracé des Bombes */
        for (int i = 0; i < 3; i++) {
            if (alien_bombs[i].active) {
                eadk_rect_t b_rect = {(uint16_t)alien_bombs[i].x, (uint16_t)alien_bombs[i].y, 2, 5};
                eadk_display_push_rect_uniform(b_rect, COLOR_BOMB);
            }
        }

        /* HUD Supérieur : Score, Wave, Vies */
        char hud_buf[48];
        snprintf(hud_buf, sizeof(hud_buf), "SCORE:%04d  VAGUE:%d  VIES:%d", score, wave, lives);
        eadk_point_t p_hud = {12, INV_TOP_BAR + 4};
        eadk_display_draw_string(hud_buf, p_hud, false, COLOR_TEXT, COLOR_INV_BG);

        /* Fin de jeu / Victoire */
        if (game_over || victory) {
            eadk_rect_t box = {40, 80, 240, 75};
            eadk_display_push_rect_uniform(box, 0x10A2);
            eadk_rect_t inner = {42, 82, 236, 71};
            eadk_display_push_rect_uniform(inner, 0x0000);

            if (victory) {
                eadk_point_t p1 = {70, 92};
                eadk_display_draw_string("VAGUE ELIMINEE ! BRAVO", p1, false, 0x07E0, 0x0000);
                eadk_point_t p2 = {70, 114};
                eadk_display_draw_string("OK: Prochaine Vague | Back", p2, false, COLOR_TEXT, 0x0000);
            } else {
                eadk_point_t p1 = {95, 92};
                eadk_display_draw_string("G A M E   O V E R", p1, false, 0xF800, 0x0000);
                eadk_point_t p2 = {65, 114};
                eadk_display_draw_string("OK: Rejouer | Back: Quitter", p2, false, COLOR_TEXT, 0x0000);
            }
        }

        prev_kbd = kbd;
        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}
