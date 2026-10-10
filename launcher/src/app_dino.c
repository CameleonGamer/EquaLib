#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"
#include "storage.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define DINO_TOP_BAR    22
#define DINO_GROUND_Y   195
#define DINO_X          40

#define COLOR_DINO_BG   0xF7BE /* Gris/Crème papier rétro */
#define COLOR_DINO_FG   0x2945 /* Ardoise très foncé */
#define COLOR_DINO_ACC  0x52AA /* Gris moyen */
#define COLOR_DINO_RED  0xD800 /* Rouge */

typedef struct {
    float x;
    int type; /* 0: Petit cactus, 1: Grand cactus, 2: Double cactus, 3: Ptérodactyle */
    int y;
    int w;
    int h;
    bool active;
} obstacle_t;

#define MAX_OBSTACLES 3

static void draw_dino_body(int y, bool duck, int leg_tick) {
    if (duck) {
        /* Dino accroupi (w=28, h=14) */
        eadk_rect_t body = {DINO_X, (uint16_t)(y + 10), 24, 12};
        eadk_rect_t head = {DINO_X + 18, (uint16_t)(y + 8), 10, 8};
        eadk_rect_t eye = {DINO_X + 24, (uint16_t)(y + 9), 2, 2};
        eadk_display_push_rect_uniform(body, COLOR_DINO_FG);
        eadk_display_push_rect_uniform(head, COLOR_DINO_FG);
        eadk_display_push_rect_uniform(eye, COLOR_DINO_BG);

        /* Pattes */
        if (leg_tick == 0) {
            eadk_rect_t leg = {DINO_X + 6, (uint16_t)(y + 22), 4, 3};
            eadk_display_push_rect_uniform(leg, COLOR_DINO_FG);
        } else {
            eadk_rect_t leg = {DINO_X + 14, (uint16_t)(y + 22), 4, 3};
            eadk_display_push_rect_uniform(leg, COLOR_DINO_FG);
        }
    } else {
        /* Dino debout standard (w=20, h=24) */
        eadk_rect_t head = {DINO_X + 8, (uint16_t)(y), 12, 10};
        eadk_rect_t snout = {DINO_X + 16, (uint16_t)(y + 3), 4, 6};
        eadk_rect_t eye = {DINO_X + 11, (uint16_t)(y + 2), 2, 2};
        eadk_rect_t body = {DINO_X + 2, (uint16_t)(y + 9), 12, 12};
        eadk_rect_t arm = {DINO_X + 14, (uint16_t)(y + 12), 3, 2};
        eadk_rect_t tail = {DINO_X, (uint16_t)(y + 11), 3, 7};

        eadk_display_push_rect_uniform(head, COLOR_DINO_FG);
        eadk_display_push_rect_uniform(snout, COLOR_DINO_FG);
        eadk_display_push_rect_uniform(body, COLOR_DINO_FG);
        eadk_display_push_rect_uniform(arm, COLOR_DINO_FG);
        eadk_display_push_rect_uniform(tail, COLOR_DINO_FG);
        eadk_display_push_rect_uniform(eye, COLOR_DINO_BG);

        /* Pattes animées */
        if (leg_tick == 0) {
            eadk_rect_t l1 = {DINO_X + 4, (uint16_t)(y + 20), 3, 5};
            eadk_rect_t l2 = {DINO_X + 10, (uint16_t)(y + 20), 3, 2};
            eadk_display_push_rect_uniform(l1, COLOR_DINO_FG);
            eadk_display_push_rect_uniform(l2, COLOR_DINO_FG);
        } else if (leg_tick == 1) {
            eadk_rect_t l1 = {DINO_X + 4, (uint16_t)(y + 20), 3, 2};
            eadk_rect_t l2 = {DINO_X + 10, (uint16_t)(y + 20), 3, 5};
            eadk_display_push_rect_uniform(l1, COLOR_DINO_FG);
            eadk_display_push_rect_uniform(l2, COLOR_DINO_FG);
        } else {
            /* En saut */
            eadk_rect_t l1 = {DINO_X + 4, (uint16_t)(y + 20), 3, 4};
            eadk_rect_t l2 = {DINO_X + 10, (uint16_t)(y + 20), 3, 4};
            eadk_display_push_rect_uniform(l1, COLOR_DINO_FG);
            eadk_display_push_rect_uniform(l2, COLOR_DINO_FG);
        }
    }
}

static void safe_push_rect(int x, int y, int w, int h, eadk_color_t color) {
    if (w <= 0 || h <= 0) return;
    if (x < 0) {
        w += x;
        x = 0;
    }
    if (x + w > 320) {
        w = 320 - x;
    }
    if (w <= 0) return;
    if (y < DINO_TOP_BAR) {
        h -= (DINO_TOP_BAR - y);
        y = DINO_TOP_BAR;
    }
    if (y + h > 240) {
        h = 240 - y;
    }
    if (h <= 0) return;
    eadk_rect_t r = {(uint16_t)x, (uint16_t)y, (uint16_t)w, (uint16_t)h};
    eadk_display_push_rect_uniform(r, color);
}

static void erase_dino_body(int y) {
    eadk_rect_t box = {DINO_X - 1, (uint16_t)(y - 1), 33, 27};
    eadk_display_push_rect_uniform(box, COLOR_DINO_BG);
    eadk_rect_t g_res = {DINO_X - 1, DINO_GROUND_Y, 33, 2};
    eadk_display_push_rect_uniform(g_res, COLOR_DINO_FG);
}

static void draw_obstacle(const obstacle_t* obs, int tick) {
    if (!obs->active || obs->x < -25 || obs->x > 320) return;
    int ox = (int)obs->x;
    int oy = obs->y;

    if (obs->type == 0) {
        /* Petit cactus (12x18) */
        safe_push_rect(ox + 3, oy, 4, 18, COLOR_DINO_FG);
        safe_push_rect(ox, oy + 5, 3, 7, COLOR_DINO_FG);
        safe_push_rect(ox + 7, oy + 3, 3, 8, COLOR_DINO_FG);
    } else if (obs->type == 1) {
        /* Grand cactus (14x24) */
        safe_push_rect(ox + 4, oy, 5, 24, COLOR_DINO_FG);
        safe_push_rect(ox, oy + 6, 4, 9, COLOR_DINO_FG);
        safe_push_rect(ox + 9, oy + 4, 4, 10, COLOR_DINO_FG);
    } else if (obs->type == 2) {
        /* Double cactus (22x20) */
        safe_push_rect(ox + 2, oy + 4, 4, 16, COLOR_DINO_FG);
        safe_push_rect(ox + 12, oy, 5, 20, COLOR_DINO_FG);
    } else if (obs->type == 3) {
        /* Ptérodactyle volant (20x12) */
        safe_push_rect(ox + 4, oy + 4, 12, 4, COLOR_DINO_FG);
        safe_push_rect(ox, oy + 5, 5, 3, COLOR_DINO_FG);
        if ((tick / 8) % 2 == 0) {
            safe_push_rect(ox + 7, oy, 4, 5, COLOR_DINO_FG);
        } else {
            safe_push_rect(ox + 7, oy + 7, 4, 5, COLOR_DINO_FG);
        }
    }
}

static void erase_obstacle_trail(int ox, int oy, int w, int h, int delta) {
    if (delta <= 0) delta = 5;
    safe_push_rect(ox + w, oy, delta, h, COLOR_DINO_BG);
}

void run_dino_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    eq_storage_t* store = eq_storage_get();
    int hi_score = store->record_dino;

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, 320, DINO_TOP_BAR};
    eadk_display_push_rect_uniform(top_bar, 0x10A2);
    eadk_point_t p_title = {8, 4};
    eadk_display_draw_string("Chrome Dino Runner (NumWorks N0120)", p_title, false, 0xFFFF, 0x10A2);

    float dino_y = DINO_GROUND_Y - 24;
    float old_dino_y = dino_y;
    float dino_vy = 0.0f;
    bool is_jumping = false;
    bool is_ducking = false;
    bool old_ducking = false;
    bool game_over = false;

    float speed = 4.0f;
    int score = 0;
    int prev_score = -1;
    int prev_hi_score = -1;
    int frame_tick = 0;

    obstacle_t obstacles[MAX_OBSTACLES];
    float old_obs_x[MAX_OBSTACLES] = {0, 0, 0};
    bool old_obs_active[MAX_OBSTACLES] = {false, false, false};

    for (int i = 0; i < MAX_OBSTACLES; i++) {
        obstacles[i].active = false;
        obstacles[i].x = 0;
        obstacles[i].w = 0;
        obstacles[i].h = 0;
        obstacles[i].type = 0;
        obstacles[i].y = 0;
    }

    /* Sol complet initial */
    eadk_rect_t screen_field = {0, DINO_TOP_BAR, 320, 240 - DINO_TOP_BAR};
    eadk_display_push_rect_uniform(screen_field, COLOR_DINO_BG);

    eadk_rect_t ground_line = {0, DINO_GROUND_Y, 320, 2};
    eadk_display_push_rect_uniform(ground_line, COLOR_DINO_FG);

    draw_dino_body((int)dino_y, false, 0);

    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || eadk_keyboard_key_down(kbd, eadk_key_home)) {
            break;
        }

        if (game_over) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe) ||
                eadk_keyboard_key_down(pressed, eadk_key_up)) {
                score = 0;
                prev_score = -1;
                prev_hi_score = -1;
                speed = 4.0f;
                dino_y = DINO_GROUND_Y - 24;
                old_dino_y = dino_y;
                dino_vy = 0.0f;
                is_jumping = false;
                is_ducking = false;
                old_ducking = false;
                game_over = false;
                frame_tick = 0;

                for (int i = 0; i < MAX_OBSTACLES; i++) {
                    obstacles[i].active = false;
                    old_obs_active[i] = false;
                }

                eadk_display_push_rect_uniform(screen_field, COLOR_DINO_BG);
                eadk_display_push_rect_uniform(ground_line, COLOR_DINO_FG);
                draw_dino_body((int)dino_y, false, 0);
            }
            prev_kbd = kbd;
            eadk_timing_msleep(20);
            continue;
        }

        /* Commandes Saut / Accroupissement */
        if (!is_jumping) {
            if (eadk_keyboard_key_down(pressed, eadk_key_up) || eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                dino_vy = -8.5f;
                is_jumping = true;
            }
        }

        is_ducking = eadk_keyboard_key_down(kbd, eadk_key_down);

        /* Physique du saut */
        if (is_jumping) {
            dino_y += dino_vy;
            dino_vy += is_ducking ? 1.0f : 0.6f;
            if (dino_y >= DINO_GROUND_Y - 24) {
                dino_y = DINO_GROUND_Y - 24;
                dino_vy = 0.0f;
                is_jumping = false;
            }
        }

        /* Gestion et déplacement des obstacles */
        for (int i = 0; i < MAX_OBSTACLES; i++) {
            if (obstacles[i].active) {
                old_obs_x[i] = obstacles[i].x;
                obstacles[i].x -= speed;

                /* Effacer le sillage de dépassement derrière l'obstacle */
                erase_obstacle_trail((int)obstacles[i].x, obstacles[i].y, obstacles[i].w, obstacles[i].h, (int)speed + 2);
                draw_obstacle(&obstacles[i], frame_tick);

                if (obstacles[i].x + obstacles[i].w <= 0) {
                    obstacles[i].active = false;
                    old_obs_active[i] = false;
                }
            }
        }

        /* Génération d'obstacles aléatoires espacés */
        if (frame_tick % 50 == 0 && (eadk_random() % 3 == 0)) {
            bool can_spawn = true;
            for (int i = 0; i < MAX_OBSTACLES; i++) {
                if (obstacles[i].active && obstacles[i].x > 210) {
                    can_spawn = false;
                    break;
                }
            }

            if (can_spawn) {
                for (int i = 0; i < MAX_OBSTACLES; i++) {
                    if (!obstacles[i].active) {
                        obstacles[i].active = true;
                        obstacles[i].x = 320;
                        old_obs_x[i] = 320;
                        old_obs_active[i] = true;

                        int r = eadk_random() % 100;
                        if (r < 25 && score > 80) {
                            /* Ptérodactyle */
                            obstacles[i].type = 3;
                            obstacles[i].w = 20;
                            obstacles[i].h = 12;
                            obstacles[i].y = (r < 12) ? (DINO_GROUND_Y - 26) : (DINO_GROUND_Y - 14);
                        } else if (r < 60) {
                            /* Petit cactus */
                            obstacles[i].type = 0;
                            obstacles[i].w = 12;
                            obstacles[i].h = 18;
                            obstacles[i].y = DINO_GROUND_Y - 18;
                        } else if (r < 85) {
                            /* Grand cactus */
                            obstacles[i].type = 1;
                            obstacles[i].w = 14;
                            obstacles[i].h = 24;
                            obstacles[i].y = DINO_GROUND_Y - 24;
                        } else {
                            /* Double cactus */
                            obstacles[i].type = 2;
                            obstacles[i].w = 22;
                            obstacles[i].h = 20;
                            obstacles[i].y = DINO_GROUND_Y - 20;
                        }
                        break;
                    }
                }
            }
        }

        /* Détection de collisions (Hitbox précise) */
        int dw = is_ducking ? 26 : 14;
        int dh = is_ducking ? 12 : 20;
        int dx = DINO_X + (is_ducking ? 2 : 4);
        int dy = (int)dino_y + (is_ducking ? 10 : 2);

        for (int i = 0; i < MAX_OBSTACLES; i++) {
            if (obstacles[i].active) {
                int ox = (int)obstacles[i].x;
                int oy = obstacles[i].y;
                int ow = obstacles[i].w;
                int oh = obstacles[i].h;

                if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
                    game_over = true;
                    if (score > hi_score) {
                        hi_score = score;
                        store->record_dino = hi_score;
                        eq_storage_commit();
                    }
                    break;
                }
            }
        }

        /* Effacement et Redessin ciblé du Dino (zéro scintillement) */
        if ((int)dino_y != (int)old_dino_y || is_ducking != old_ducking || (!is_jumping && (frame_tick % 4 == 0))) {
            erase_dino_body((int)old_dino_y);
            int leg_tick = is_jumping ? 2 : ((frame_tick / 4) % 2);
            draw_dino_body((int)dino_y, is_ducking && !is_jumping, leg_tick);
            old_dino_y = dino_y;
            old_ducking = is_ducking;
        }

        /* Affichage Score uniquement s'il a changé */
        if (score != prev_score || hi_score != prev_hi_score) {
            prev_score = score;
            prev_hi_score = hi_score;

            eadk_rect_t sc_box = {175, DINO_TOP_BAR + 4, 140, 14};
            eadk_display_push_rect_uniform(sc_box, COLOR_DINO_BG);

            char sc_buf[32];
            snprintf(sc_buf, sizeof(sc_buf), "HI %05d  %05d", hi_score, score);
            eadk_point_t p_sc = {180, DINO_TOP_BAR + 6};
            eadk_display_draw_string(sc_buf, p_sc, false, COLOR_DINO_FG, COLOR_DINO_BG);
        }

        /* Message Game Over */
        if (game_over) {
            eadk_rect_t box = {40, 75, 240, 75};
            eadk_display_push_rect_uniform(box, COLOR_DINO_FG);
            eadk_rect_t inner = {42, 77, 236, 71};
            eadk_display_push_rect_uniform(inner, COLOR_DINO_BG);

            eadk_point_t p1 = {95, 87};
            eadk_display_draw_string("G A M E   O V E R", p1, false, COLOR_DINO_RED, COLOR_DINO_BG);

            char final_sc[32];
            snprintf(final_sc, sizeof(final_sc), "Score final: %d", score);
            eadk_point_t p2 = {100, 107};
            eadk_display_draw_string(final_sc, p2, false, COLOR_DINO_FG, COLOR_DINO_BG);

            eadk_point_t p3 = {65, 127};
            eadk_display_draw_string("OK: Rejouer | Back: Quitter", p3, false, COLOR_DINO_ACC, COLOR_DINO_BG);
        }

        frame_tick++;
        if (frame_tick % 5 == 0) {
            score++;
            if (score > hi_score) {
                hi_score = score;
                store->record_dino = hi_score;
                eq_storage_commit();
            }
        }
        if (frame_tick % 300 == 0 && speed < 7.0f) speed += 0.25f;

        prev_kbd = kbd;
        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}
