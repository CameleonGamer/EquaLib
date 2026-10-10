#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"
#include "storage.h"

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

static void erase_alien_sprite(int x, int y) {
    eadk_rect_t r = {(uint16_t)x, (uint16_t)y, ALIEN_W + 1, ALIEN_H + 2};
    eadk_display_push_rect_uniform(r, COLOR_INV_BG);
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

static void erase_cannon(int cx) {
    eadk_rect_t r = {(uint16_t)cx, CANNON_Y, CANNON_W, CANNON_H};
    eadk_display_push_rect_uniform(r, COLOR_INV_BG);
}

static void draw_bunker_block(int bx, int k, int hp) {
    eadk_rect_t part = {(uint16_t)(bx + k * 6), 185, 6, 12};
    if (hp <= 0) {
        eadk_display_push_rect_uniform(part, COLOR_INV_BG);
    } else {
        uint16_t b_col = (hp == 3) ? COLOR_SHIELD : ((hp == 2) ? 0x2296 : 0x118C);
        eadk_display_push_rect_uniform(part, b_col);
    }
}

void run_space_invaders_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    eq_storage_t* store = eq_storage_get();
    int hi_score = store->record_space_invaders;

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, 320, INV_TOP_BAR};
    eadk_display_push_rect_uniform(top_bar, 0x10A2);
    eadk_point_t p_title = {8, 4};
    eadk_display_draw_string("Space Invaders Arcade (NumWorks)", p_title, false, COLOR_TEXT, 0x10A2);

    int cannon_x = 152;
    int old_cannon_x = cannon_x;
    int lives = 3;
    int score = 0;
    int wave = 1;
    int prev_score = -1;
    int prev_wave = -1;
    int prev_lives = -1;
    bool game_over = false;
    bool victory = false;

    bullet_t p_laser = {0, 0, false};
    int old_laser_x = 0;
    int old_laser_y = 0;
    bool old_laser_active = false;

    bullet_t alien_bombs[3];
    int old_bomb_x[3] = {0, 0, 0};
    int old_bomb_y[3] = {0, 0, 0};
    bool old_bomb_active[3] = {false, false, false};
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
    float old_grid_x = grid_x;
    float old_grid_y = grid_y;
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

    /* Rendu initial des bunkers */
    for (int b = 0; b < 3; b++) {
        for (int k = 0; k < 4; k++) {
            draw_bunker_block(bunkers[b].x, k, bunkers[b].hp[k]);
        }
    }

    /* Rendu initial des aliens */
    for (int r = 0; r < ALIEN_ROWS; r++) {
        for (int c = 0; c < ALIEN_COLS; c++) {
            draw_alien_sprite((int)grid_x + c * 32, (int)grid_y + r * 20, r, anim_frame);
        }
    }

    /* Rendu initial du canon */
    draw_cannon(cannon_x);

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
                old_cannon_x = cannon_x;
                p_laser.active = false;
                old_laser_active = false;
                for (int i = 0; i < 3; i++) {
                    alien_bombs[i].active = false;
                    old_bomb_active[i] = false;
                }
                for (int r = 0; r < ALIEN_ROWS; r++) {
                    for (int c = 0; c < ALIEN_COLS; c++) {
                        aliens[r][c].alive = true;
                    }
                }
                grid_x = 30.0f;
                grid_y = 45.0f;
                old_grid_x = grid_x;
                old_grid_y = grid_y;
                grid_vx = 1.6f + (wave - 1) * 0.4f;

                for (int b = 0; b < 3; b++) {
                    for (int k = 0; k < 4; k++) bunkers[b].hp[k] = 3;
                }

                prev_score = -1;
                prev_wave = -1;
                prev_lives = -1;

                eadk_display_push_rect_uniform(screen_field, COLOR_INV_BG);
                for (int b = 0; b < 3; b++) {
                    for (int k = 0; k < 4; k++) {
                        draw_bunker_block(bunkers[b].x, k, bunkers[b].hp[k]);
                    }
                }
                for (int r = 0; r < ALIEN_ROWS; r++) {
                    for (int c = 0; c < ALIEN_COLS; c++) {
                        draw_alien_sprite((int)grid_x + c * 32, (int)grid_y + r * 20, r, anim_frame);
                    }
                }
                draw_cannon(cannon_x);
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
                                erase_alien_sprite(ax, ay);
                                p_laser.active = false;
                                score += (3 - r) * 10;
                                if (score > hi_score) {
                                    hi_score = score;
                                    store->record_space_invaders = hi_score;
                                    eq_storage_commit();
                                }
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
                                draw_bunker_block(bunkers[b].x, part, bunkers[b].hp[part]);
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
        bool alien_stepped = false;
        if (step_counter % step_interval == 0 && alive_count > 0) {
            alien_stepped = true;
            old_grid_x = grid_x;
            old_grid_y = grid_y;

            grid_x += grid_vx;
            anim_frame = 1 - anim_frame;

            if (max_col_x >= 310 && grid_vx > 0) {
                grid_vx = -grid_vx;
                grid_y += 8.0f;
            } else if (min_col_x <= 10 && grid_vx < 0) {
                grid_vx = -grid_vx;
                grid_y += 8.0f;
            }

            /* Effacer et retracer chaque alien de manière unitaire (zéro scintillement d'armada) */
            for (int r = 0; r < ALIEN_ROWS; r++) {
                for (int c = 0; c < ALIEN_COLS; c++) {
                    if (aliens[r][c].alive) {
                        int oax = (int)old_grid_x + c * 32;
                        int oay = (int)old_grid_y + r * 20;
                        int nax = (int)grid_x + c * 32;
                        int nay = (int)grid_y + r * 20;
                        erase_alien_sprite(oax, oay);
                        draw_alien_sprite(nax, nay, r, anim_frame);
                    }
                }
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
                                draw_bunker_block(bunkers[b].x, part, bunkers[b].hp[part]);
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

        /* Effacement et Redessin ciblé du canon */
        if (cannon_x != old_cannon_x) {
            erase_cannon(old_cannon_x);
            draw_cannon(cannon_x);
            old_cannon_x = cannon_x;
        }

        /* Effacement et Redessin ciblé du laser joueur */
        if (old_laser_active) {
            eadk_rect_t clr_l = {(uint16_t)old_laser_x, (uint16_t)old_laser_y, 2, 7};
            eadk_display_push_rect_uniform(clr_l, COLOR_INV_BG);
        }
        if (p_laser.active) {
            eadk_rect_t l_rect = {(uint16_t)p_laser.x, (uint16_t)p_laser.y, 2, 6};
            eadk_display_push_rect_uniform(l_rect, COLOR_LASER);
            old_laser_x = (int)p_laser.x;
            old_laser_y = (int)p_laser.y;
            old_laser_active = true;
        } else {
            old_laser_active = false;
        }

        /* Effacement et Redessin ciblé des bombes aliens */
        for (int i = 0; i < 3; i++) {
            if (old_bomb_active[i]) {
                eadk_rect_t clr_b = {(uint16_t)old_bomb_x[i], (uint16_t)old_bomb_y[i], 2, 6};
                eadk_display_push_rect_uniform(clr_b, COLOR_INV_BG);
            }
            if (alien_bombs[i].active) {
                eadk_rect_t b_rect = {(uint16_t)alien_bombs[i].x, (uint16_t)alien_bombs[i].y, 2, 5};
                eadk_display_push_rect_uniform(b_rect, COLOR_BOMB);
                old_bomb_x[i] = (int)alien_bombs[i].x;
                old_bomb_y[i] = (int)alien_bombs[i].y;
                old_bomb_active[i] = true;
            } else {
                old_bomb_active[i] = false;
            }
        }

        /* HUD Supérieur : Mise à jour uniquement sur changement */
        if (score != prev_score || wave != prev_wave || lives != prev_lives) {
            prev_score = score;
            prev_wave = wave;
            prev_lives = lives;

            eadk_rect_t hud_clr = {10, INV_TOP_BAR + 2, 300, 14};
            eadk_display_push_rect_uniform(hud_clr, COLOR_INV_BG);

            char hud_buf[64];
            snprintf(hud_buf, sizeof(hud_buf), "SCORE:%04d  HI:%04d  VAGUE:%d  VIES:%d", score, hi_score, wave, lives);
            eadk_point_t p_hud = {12, INV_TOP_BAR + 4};
            eadk_display_draw_string(hud_buf, p_hud, false, COLOR_TEXT, COLOR_INV_BG);
        }

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
