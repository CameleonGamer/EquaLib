#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"
#include "storage.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

/* ========================================================================= */
/* PALETTE RETRO OFFICIELLE FLAPPY BIRD (RGB565)                             */
/* ========================================================================= */
#define COLOR_SKY          0x4DF9  /* Cyan ciel officiel (#4ec0ca) */
#define COLOR_CLOUD_WHITE  0xFFFF  /* Blanc nuage */

/* Tuyaux rétro style Mario / Flappy Bird */
#define COLOR_PIPE_BLACK   0x0000  /* Contour noir */
#define COLOR_PIPE_WHITE   0xD7EF  /* Reflet blanc/vert lime */
#define COLOR_PIPE_LIGHT   0x9F27  /* Vert clair */
#define COLOR_PIPE_GREEN   0x75E5  /* Vert principal */
#define COLOR_PIPE_DARK    0x5404  /* Vert ombre */
#define COLOR_PIPE_DEEP    0x3AC2  /* Vert ombre profonde */

/* Sol et herbe */
#define COLOR_GRASS_TOP    0x75E5  /* Herbe vert vif */
#define COLOR_GRASS_SEAM   0x3961  /* Couture d'herbe foncée */
#define COLOR_GROUND_SAND  0xDEB2  /* Sable officiel */

/* Oiseau */
#define COLOR_BIRD_BODY    0xFFE0  /* Jaune vif */
#define COLOR_BIRD_BELLY   0xFB80  /* Orange ventre */
#define COLOR_BIRD_BEAK    0xFA40  /* Bec rouge-orange */
#define COLOR_BIRD_WHITE   0xFFFF  /* Blanc oeil / aile */

/* Dimensions */
#define PLAY_TOP           22
#define GROUND_Y           204

#define BIRD_X             52
#define BIRD_W             18
#define BIRD_H             14

#define PIPE_BODY_W        32
#define PIPE_CAP_W         36
#define PIPE_CAP_H         12
#define PIPE_GAP           68
#define MAX_PIPES          2
#define PIPE_SPEED         2

typedef struct {
    int x;
    int gap_y;
    bool passed;
    bool active;
} pipe_t;

/* ========================================================================= */
/* PRIMITIVES GRAPHIQUES 100% UNIFORMES SÉCURISÉES                           */
/* ========================================================================= */
static void draw_clamped_rect(int x, int y, int w, int h, eadk_color_t color) {
    if (w <= 0 || h <= 0) return;
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x >= EADK_SCREEN_WIDTH || y >= EADK_SCREEN_HEIGHT) return;
    if (x + w > EADK_SCREEN_WIDTH) w = EADK_SCREEN_WIDTH - x;
    if (y + h > EADK_SCREEN_HEIGHT) h = EADK_SCREEN_HEIGHT - y;
    if (w <= 0 || h <= 0) return;

    eadk_rect_t rect = {(uint16_t)x, (uint16_t)y, (uint16_t)w, (uint16_t)h};
    eadk_display_push_rect_uniform(rect, color);
}

/* ------------------------------------------------------------------------- */
/* Tracé d'un tuyau rétro 3D vert                                            */
/* ------------------------------------------------------------------------- */
static void draw_pipe_body(int bx, int by, int bh) {
    if (bh <= 0) return;
    /* 32 px de large décomposés en bandes verticales */
    draw_clamped_rect(bx,      by, 1,  bh, COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 1,  by, 2,  bh, COLOR_PIPE_LIGHT);
    draw_clamped_rect(bx + 3,  by, 18, bh, COLOR_PIPE_GREEN);
    draw_clamped_rect(bx + 21, by, 6,  bh, COLOR_PIPE_DARK);
    draw_clamped_rect(bx + 27, by, 4,  bh, COLOR_PIPE_DEEP);
    draw_clamped_rect(bx + 31, by, 1,  bh, COLOR_PIPE_BLACK);
}

static void draw_pipe_cap(int cx, int cy, int ch, bool is_top) {
    if (ch <= 0) return;
    int cw = PIPE_CAP_W; /* 36 px */

    /* Bordures extérieures */
    draw_clamped_rect(cx, cy, cw, 1, COLOR_PIPE_BLACK);
    draw_clamped_rect(cx, cy + ch - 1, cw, 1, COLOR_PIPE_BLACK);
    draw_clamped_rect(cx, cy, 1, ch, COLOR_PIPE_BLACK);
    draw_clamped_rect(cx + cw - 1, cy, 1, ch, COLOR_PIPE_BLACK);

    /* Lèvre d'ombre intérieure */
    if (is_top) {
        draw_clamped_rect(cx + 1, cy + ch - 2, cw - 2, 1, COLOR_PIPE_DEEP);
    } else {
        draw_clamped_rect(cx + 1, cy + 1, cw - 2, 1, COLOR_PIPE_DEEP);
    }

    int inner_y = cy + (is_top ? 1 : 2);
    int inner_h = ch - 3;
    if (inner_h > 0) {
        draw_clamped_rect(cx + 1,  inner_y, 2,  inner_h, COLOR_PIPE_WHITE);
        draw_clamped_rect(cx + 3,  inner_y, 20, inner_h, COLOR_PIPE_GREEN);
        draw_clamped_rect(cx + 23, inner_y, 7,  inner_h, COLOR_PIPE_DARK);
        draw_clamped_rect(cx + 30, inner_y, 5,  inner_h, COLOR_PIPE_DEEP);
    }
}

static void draw_pipe(const pipe_t* p) {
    if (!p->active) return;
    int px = p->x;
    if (px + PIPE_CAP_W <= 0 || px >= EADK_SCREEN_WIDTH) return;

    int gy = p->gap_y;
    int body_x = px + 2;

    /* Tuyau supérieur */
    int top_cap_y = gy - PIPE_CAP_H;
    int top_body_h = top_cap_y - PLAY_TOP;
    if (top_body_h > 0) {
        draw_pipe_body(body_x, PLAY_TOP, top_body_h);
    }
    draw_pipe_cap(px, top_cap_y, PIPE_CAP_H, true);

    /* Tuyau inférieur */
    int bot_cap_y = gy + PIPE_GAP;
    draw_pipe_cap(px, bot_cap_y, PIPE_CAP_H, false);

    int bot_body_y = bot_cap_y + PIPE_CAP_H;
    int bot_body_h = GROUND_Y - bot_body_y;
    if (bot_body_h > 0) {
        draw_pipe_body(body_x, bot_body_y, bot_body_h);
    }
}

static void erase_pipe_trail(int old_px) {
    /* Efface exactement les 2 pixels arrière laissés par le tuyau */
    int erase_x = old_px + PIPE_CAP_W - PIPE_SPEED;
    draw_clamped_rect(erase_x, PLAY_TOP, PIPE_SPEED, GROUND_Y - PLAY_TOP, COLOR_SKY);
}

/* ------------------------------------------------------------------------- */
/* Tracé de l'oiseau 18x14 pixels avec géométrie vectorielle 100% stable     */
/* ------------------------------------------------------------------------- */
static void draw_bird(int by, int wing_state) {
    if (by < PLAY_TOP) by = PLAY_TOP;
    if (by + BIRD_H > GROUND_Y) by = GROUND_Y - BIRD_H;
    int bx = BIRD_X;

    /* 1. Contour noir de l'oiseau */
    draw_clamped_rect(bx + 4,  by,      9,  1,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 2,  by + 1,  3,  1,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 1,  by + 2,  2,  1,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx,      by + 3,  1,  7,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 1,  by + 10, 2,  1,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 3,  by + 11, 2,  1,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 5,  by + 12, 7,  1,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 12, by + 11, 2,  1,  COLOR_PIPE_BLACK);

    /* 2. Corps jaune vif */
    draw_clamped_rect(bx + 2,  by + 2,  11, 6,  COLOR_BIRD_BODY);
    draw_clamped_rect(bx + 1,  by + 3,  12, 5,  COLOR_BIRD_BODY);

    /* 3. Ventre orange */
    draw_clamped_rect(bx + 3,  by + 8,  9,  3,  COLOR_BIRD_BELLY);

    /* 4. Aile blanche animée */
    if (wing_state == 0) {
        /* Aile en haut */
        draw_clamped_rect(bx + 2, by + 2, 5, 4, COLOR_BIRD_WHITE);
        draw_clamped_rect(bx + 1, by + 1, 6, 1, COLOR_PIPE_BLACK);
    } else if (wing_state == 1) {
        /* Aile au milieu */
        draw_clamped_rect(bx + 2, by + 5, 5, 4, COLOR_BIRD_WHITE);
        draw_clamped_rect(bx + 1, by + 4, 7, 1, COLOR_PIPE_BLACK);
    } else {
        /* Aile en bas */
        draw_clamped_rect(bx + 2, by + 7, 5, 4, COLOR_BIRD_WHITE);
        draw_clamped_rect(bx + 1, by + 6, 7, 1, COLOR_PIPE_BLACK);
    }

    /* 5. Gros oeil blanc */
    draw_clamped_rect(bx + 9,  by + 1,  5,  5,  COLOR_BIRD_WHITE);
    draw_clamped_rect(bx + 9,  by,      4,  1,  COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 14, by + 1,  1,  4,  COLOR_PIPE_BLACK);

    /* Pupille noire */
    draw_clamped_rect(bx + 12, by + 2,  2,  3,  COLOR_PIPE_BLACK);

    /* 6. Grand bec orange rétro */
    draw_clamped_rect(bx + 13, by + 6,  5,  4,  COLOR_BIRD_BEAK);
    draw_clamped_rect(bx + 13, by + 8,  5,  1,  COLOR_PIPE_BLACK); /* Séparation bouche */
    draw_clamped_rect(bx + 17, by + 7,  1,  3,  COLOR_PIPE_BLACK); /* Bordure bout du bec */
    draw_clamped_rect(bx + 13, by + 10, 4,  1,  COLOR_PIPE_BLACK); /* Dessous du bec */
}

static void erase_bird(int old_by) {
    if (old_by < PLAY_TOP) old_by = PLAY_TOP;
    if (old_by + BIRD_H > GROUND_Y) old_by = GROUND_Y - BIRD_H;
    draw_clamped_rect(BIRD_X, old_by, BIRD_W, BIRD_H, COLOR_SKY);
}

/* ========================================================================= */
/* DÉCOR ET AFFICHAGE STATIQUE                                               */
/* ========================================================================= */
static void draw_clouds(void) {
    draw_clamped_rect(30, 45, 45, 12, COLOR_CLOUD_WHITE);
    draw_clamped_rect(38, 38, 28, 8,  COLOR_CLOUD_WHITE);
    draw_clamped_rect(170, 60, 50, 12, COLOR_CLOUD_WHITE);
    draw_clamped_rect(180, 52, 32, 8,  COLOR_CLOUD_WHITE);
}

static void draw_initial_scene(void) {
    /* Barre supérieure jaune officielle NumWorks */
    draw_clamped_rect(0, 0, EADK_SCREEN_WIDTH, 22, 0xFE60);
    eadk_point_t pt_title = {8, 5};
    eadk_display_draw_string("Flappy Bird Arcade", pt_title, false, eadk_color_black, 0xFE60);

    /* Fond ciel cyan */
    draw_clamped_rect(0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP, COLOR_SKY);

    /* Nuages */
    draw_clouds();

    /* Sol rétro */
    draw_clamped_rect(0, GROUND_Y, EADK_SCREEN_WIDTH, 1, COLOR_PIPE_BLACK);
    draw_clamped_rect(0, GROUND_Y + 1, EADK_SCREEN_WIDTH, 3, COLOR_GRASS_TOP);
    draw_clamped_rect(0, GROUND_Y + 4, EADK_SCREEN_WIDTH, 2, COLOR_GRASS_SEAM);
    draw_clamped_rect(0, GROUND_Y + 6, EADK_SCREEN_WIDTH, EADK_SCREEN_HEIGHT - 16 - (GROUND_Y + 6), COLOR_GROUND_SAND);

    /* Barre d'aide inférieure */
    draw_clamped_rect(0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16, eadk_color_white);
    eadk_point_t pt_ctrl = {20, EADK_SCREEN_HEIGHT - 13};
    eadk_display_draw_string("OK / HAUT : Voler  |  BACK : Hub", pt_ctrl, false, 0x4208, eadk_color_white);
}

static void draw_score(int score, int best_score) {
    char buf[32];
    snprintf(buf, sizeof(buf), "Score: %d  |  Record: %d", score, best_score);
    draw_clamped_rect(155, 0, 160, 22, 0xFE60);
    eadk_point_t pt_sc = {160, 5};
    eadk_display_draw_string(buf, pt_sc, false, eadk_color_black, 0xFE60);
}

static void draw_game_over(int score, int best_score) {
    /* Bannière GAME OVER */
    draw_clamped_rect(75, 45, 170, 26, COLOR_PIPE_BLACK);
    draw_clamped_rect(77, 47, 166, 22, 0xFA40);
    eadk_point_t pt_go = {98, 51};
    eadk_display_draw_string("GAME OVER", pt_go, true, 0xFFFF, 0xFA40);

    /* Boîte des scores */
    draw_clamped_rect(60, 78, 200, 68, COLOR_PIPE_BLACK);
    draw_clamped_rect(62, 80, 196, 64, 0xFFFF);

    char s_buf[32];
    snprintf(s_buf, sizeof(s_buf), "Score: %d", score);
    eadk_point_t pt_s = {78, 88};
    eadk_display_draw_string(s_buf, pt_s, true, COLOR_PIPE_BLACK, 0xFFFF);

    char b_buf[32];
    snprintf(b_buf, sizeof(b_buf), "Record: %d", best_score);
    eadk_point_t pt_b = {78, 108};
    eadk_display_draw_string(b_buf, pt_b, false, 0x5404, 0xFFFF);

    if (score >= 10) {
        const char* medal = (score >= 40) ? "[ Platine ]" :
                            (score >= 30) ? "[ Or ]" :
                            (score >= 20) ? "[ Argent ]" : "[ Bronze ]";
        eadk_point_t pt_m = {78, 126};
        eadk_display_draw_string(medal, pt_m, false, 0xFA40, 0xFFFF);
    }

    /* Raccourci pour rejouer */
    draw_clamped_rect(65, 155, 190, 22, COLOR_PIPE_BLACK);
    draw_clamped_rect(66, 156, 188, 20, 0xFE60);
    eadk_point_t pt_rst = {75, 160};
    eadk_display_draw_string("OK: Rejouer   |   BACK: Hub", pt_rst, false, eadk_color_black, 0xFE60);
}

/* ========================================================================= */
/* BOUCLE PRINCIPALE FLAPPY BIRD                                             */
/* ========================================================================= */
void run_flappy_app(void) {
    /* Attente relâchement des touches initiales */
    int k_cycles = 0;
    while (eadk_keyboard_scan() != 0 && k_cycles < 25) {
        eadk_timing_msleep(20);
        k_cycles++;
    }

    int bird_y = 90 * 10;
    int old_bird_y = 90;
    int bird_vy = 0;
    const int gravity = 2;
    const int flap_power = -22;

    pipe_t pipes[MAX_PIPES];
    for (int i = 0; i < MAX_PIPES; i++) {
        pipes[i].active = (i < 2);
        pipes[i].x = 320 + i * 150;
        pipes[i].gap_y = 65 + (int)(eadk_random() % 65);
        pipes[i].passed = false;
    }

    int score = 0;
    int best_score = eq_storage_get()->record_flappy;
    int prev_drawn_score = -1;
    bool game_over = false;
    bool started = false;

    eadk_keyboard_state_t prev_kbd = 0;

    /* Rendu initial */
    draw_initial_scene();
    draw_score(score, best_score);
    prev_drawn_score = score;

    /* Boîte d'indication */
    eadk_rect_t hint_box = {60, 95, 200, 34};
    draw_clamped_rect(hint_box.x, hint_box.y, hint_box.width, hint_box.height, COLOR_PIPE_BLACK);
    draw_clamped_rect(hint_box.x + 2, hint_box.y + 2, hint_box.width - 4, hint_box.height - 4, 0xFFFF);
    eadk_point_t pt_h1 = {78, 101};
    eadk_display_draw_string("Appuyez sur OK ou HAUT", pt_h1, false, 0x0000, 0xFFFF);
    eadk_point_t pt_h2 = {96, 114};
    eadk_display_draw_string("pour vous envoler !", pt_h2, false, 0x3186, 0xFFFF);

    draw_bird(bird_y / 10, 1);

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
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
                /* Nettoyer et relancer */
                draw_clamped_rect(0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP, COLOR_SKY);
                draw_clouds();

                bird_y = 90 * 10;
                old_bird_y = 90;
                bird_vy = 0;
                score = 0;
                game_over = false;
                started = false;

                for (int i = 0; i < MAX_PIPES; i++) {
                    pipes[i].active = (i < 2);
                    pipes[i].x = 320 + i * 150;
                    pipes[i].gap_y = 65 + (int)(eadk_random() % 65);
                    pipes[i].passed = false;
                }

                draw_score(score, best_score);
                prev_drawn_score = score;

                draw_clamped_rect(hint_box.x, hint_box.y, hint_box.width, hint_box.height, COLOR_PIPE_BLACK);
                draw_clamped_rect(hint_box.x + 2, hint_box.y + 2, hint_box.width - 4, hint_box.height - 4, 0xFFFF);
                eadk_display_draw_string("Appuyez sur OK ou HAUT", pt_h1, false, 0x0000, 0xFFFF);
                eadk_display_draw_string("pour vous envoler !", pt_h2, false, 0x3186, 0xFFFF);

                draw_bird(bird_y / 10, 1);
            }
        } else {
            if (flap) {
                if (!started) {
                    /* Effacer la boîte de consigne */
                    draw_clamped_rect(hint_box.x, hint_box.y, hint_box.width, hint_box.height, COLOR_SKY);
                    draw_clouds();
                    started = true;
                }
                bird_vy = flap_power;
            }

            if (started) {
                /* Physique de chute / vol */
                bird_vy += gravity;
                if (bird_vy > 36) bird_vy = 36;
                bird_y += bird_vy;

                int cur_by = bird_y / 10;
                if (cur_by + BIRD_H >= GROUND_Y) {
                    cur_by = GROUND_Y - BIRD_H;
                    game_over = true;
                }
                if (cur_by < PLAY_TOP) {
                    cur_by = PLAY_TOP;
                    bird_vy = 0;
                }

                /* Déplacement des tuyaux */
                for (int i = 0; i < MAX_PIPES; i++) {
                    if (!pipes[i].active) continue;

                    int old_px = pipes[i].x;
                    pipes[i].x -= PIPE_SPEED;

                    /* Effacer uniquement le sillage de 2px à l'arrière */
                    erase_pipe_trail(old_px);

                    /* Compter le score */
                    if (!pipes[i].passed && pipes[i].x + PIPE_BODY_W < BIRD_X) {
                        pipes[i].passed = true;
                        score++;
                        if (score > best_score) {
                            best_score = score;
                            eq_storage_get()->record_flappy = best_score;
                            eq_storage_commit();
                        }
                    }

                    /* Recyclage hors écran */
                    if (pipes[i].x < -PIPE_CAP_W) {
                        int max_x = 0;
                        for (int j = 0; j < MAX_PIPES; j++) {
                            if (pipes[j].active && pipes[j].x > max_x) {
                                max_x = pipes[j].x;
                            }
                        }
                        pipes[i].x = max_x + 150;
                        pipes[i].gap_y = 65 + (int)(eadk_random() % 65);
                        pipes[i].passed = false;
                    }

                    /* Détection de collision */
                    int px = pipes[i].x;
                    int gy = pipes[i].gap_y;
                    if (BIRD_X + BIRD_W > px && BIRD_X < px + PIPE_CAP_W) {
                        if (cur_by < gy || cur_by + BIRD_H > gy + PIPE_GAP) {
                            game_over = true;
                        }
                    }

                    /* Tracé incrémental du tuyau */
                    draw_pipe(&pipes[i]);
                }

                /* Rendu de l'oiseau */
                if (cur_by != old_bird_y) {
                    erase_bird(old_bird_y);
                    old_bird_y = cur_by;
                }

                int wing = (bird_vy < -4) ? 0 : (bird_vy > 10 ? 2 : 1);
                draw_bird(cur_by, wing);

                /* Mise à jour du score */
                if (score != prev_drawn_score) {
                    draw_score(score, best_score);
                    prev_drawn_score = score;
                }

                if (game_over) {
                    draw_game_over(score, best_score);
                }
            }
        }

        prev_kbd = kbd;

        /* Cadence constante à 50 FPS (identique à 2048) */
        eadk_timing_msleep(20);
    }

    int exit_cycles = 0;
    while (eadk_keyboard_scan() != 0 && exit_cycles < 25) {
        eadk_timing_msleep(20);
        exit_cycles++;
    }
}
