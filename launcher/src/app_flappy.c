#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

/* ========================================================================= */
/* PALETTE OFFICIELLE FLAPPY BIRD RETRO (RGB565)                             */
/* ========================================================================= */
#define COLOR_SKY          0x4DF9  /* Cyan ciel officiel (#4ec0ca) */
#define COLOR_CLOUD_WHITE  0xFFFF  /* Blanc nuage */

/* Tuyaux rétro style Super Mario / Flappy Bird */
#define COLOR_PIPE_BLACK   0x0000  /* Contour noir officiel */
#define COLOR_PIPE_WHITE   0xD7EF  /* Reflet blanc/vert vif (#d5ff7a) */
#define COLOR_PIPE_LIGHT   0x9F27  /* Vert clair reflet (#9de63a) */
#define COLOR_PIPE_GREEN   0x75E5  /* Vert tuyau officiel (#73bf2e) */
#define COLOR_PIPE_DARK    0x5404  /* Ombre vert moyen (#558022) */
#define COLOR_PIPE_DEEP    0x3AC2  /* Ombre tuyau sombre (#385816) */

/* Sol et herbe */
#define COLOR_GRASS_TOP    0x75E5  /* Herbe vert vif */
#define COLOR_GRASS_SEAM   0x3961  /* Ligne de couture foncée */
#define COLOR_GROUND_SAND  0xDEB2  /* Sable officiel (#ded895) */

/* Dimensions du monde de jeu */
#define PLAY_TOP         22
#define GROUND_Y         204

#define BIRD_X           56
#define BIRD_W           17
#define BIRD_H           12

#define PIPE_W           32
#define PIPE_CAP_W       36
#define PIPE_CAP_H       12
#define PIPE_GAP         64
#define MAX_PIPES        2
#define PIPE_SPEED       2

typedef struct {
    int x;
    int gap_y;
    bool passed;
    bool active;
} pipe_t;

/* ========================================================================= */
/* SPRITES DE L'OISEAU (17x12 PIXELS, 4 FRAMES D'ANIMATION)                  */
/* ========================================================================= */
#define B_TR 0x0001 /* Marqueur de transparence */
#define B_BK 0x0000 /* Noir contour */
#define B_WT 0xFFFF /* Blanc oeil/aile */
#define B_YW 0xFFE0 /* Jaune vif (haut corps) */
#define B_YD 0xFE40 /* Jaune moyen */
#define B_OG 0xFB80 /* Orange ventre */
#define B_RD 0xFA40 /* Rouge-orange bec */
#define B_DK 0xC920 /* Rouge sombre séparation bec */
#define B_WG 0xCE79 /* Ombre blanche de l'aile */

/* Frame 0 : Aile vers le haut (impulsion de saut) */
static const uint16_t s_bird_frame_up[BIRD_H][BIRD_W] = {
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_YW,B_YW,B_YW,B_YW,B_BK,B_WT,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_BK,B_BK,B_WT,B_WT,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR},
    {B_BK,B_WT,B_WT,B_WT,B_WT,B_WT,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_BK,B_BK,B_BK},
    {B_BK,B_WT,B_WT,B_WT,B_WG,B_WT,B_YW,B_YW,B_WT,B_WT,B_WT,B_WT,B_BK,B_RD,B_RD,B_RD,B_BK},
    {B_BK,B_WT,B_WT,B_WG,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_RD,B_RD,B_DK,B_BK,B_TR},
    {B_TR,B_BK,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_YW,B_YW,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR},
    {B_TR,B_TR,B_BK,B_OG,B_OG,B_OG,B_OG,B_OG,B_OG,B_BK,B_RD,B_RD,B_RD,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_BK,B_BK,B_OG,B_OG,B_OG,B_BK,B_DK,B_DK,B_DK,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR}
};

/* Frame 1 : Aile horizontale (vol plané) */
static const uint16_t s_bird_frame_mid[BIRD_H][BIRD_W] = {
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_YW,B_YW,B_YW,B_YW,B_BK,B_WT,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_BK,B_BK,B_BK},
    {B_BK,B_WT,B_WT,B_WT,B_WT,B_WT,B_YW,B_YW,B_WT,B_WT,B_WT,B_WT,B_BK,B_RD,B_RD,B_RD,B_BK},
    {B_BK,B_WT,B_WT,B_WT,B_WG,B_WT,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_RD,B_RD,B_DK,B_BK,B_TR},
    {B_TR,B_BK,B_WT,B_WG,B_YW,B_YW,B_YW,B_YW,B_YW,B_YW,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR},
    {B_TR,B_TR,B_BK,B_BK,B_OG,B_OG,B_OG,B_OG,B_OG,B_BK,B_RD,B_RD,B_RD,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_BK,B_BK,B_OG,B_OG,B_OG,B_BK,B_DK,B_DK,B_DK,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR}
};

/* Frame 2 : Aile vers le bas (chute progressive) */
static const uint16_t s_bird_frame_down[BIRD_H][BIRD_W] = {
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_YW,B_YW,B_YW,B_YW,B_BK,B_WT,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_BK,B_BK,B_BK},
    {B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_WT,B_WT,B_BK,B_RD,B_RD,B_RD,B_BK},
    {B_BK,B_WT,B_WT,B_WT,B_WT,B_WT,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_RD,B_RD,B_DK,B_BK,B_TR},
    {B_BK,B_WT,B_WT,B_WT,B_WG,B_WT,B_YW,B_YW,B_YW,B_YW,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR},
    {B_TR,B_BK,B_WT,B_WG,B_OG,B_OG,B_OG,B_OG,B_OG,B_BK,B_RD,B_RD,B_RD,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_BK,B_BK,B_BK,B_OG,B_OG,B_OG,B_BK,B_DK,B_DK,B_DK,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR}
};

/* Frame 3 : Piqué à 45 degrés (chute rapide) */
static const uint16_t s_bird_frame_dive[BIRD_H][BIRD_W] = {
    {B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_BK,B_BK,B_WT,B_WT,B_YW,B_YW,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_BK,B_WT,B_WT,B_WT,B_WT,B_YW,B_YW,B_YW,B_YW,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_BK,B_WT,B_WT,B_WG,B_WT,B_YW,B_YW,B_YW,B_YW,B_YW,B_BK,B_WT,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_BK,B_WT,B_WG,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_BK,B_YW,B_YW,B_YW,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_BK,B_OG,B_OG,B_YW,B_YW,B_WT,B_WT,B_BK,B_WT,B_WT,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_BK,B_OG,B_OG,B_OG,B_YW,B_WT,B_WT,B_WT,B_BK,B_RD,B_RD,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_BK,B_BK,B_OG,B_OG,B_BK,B_BK,B_BK,B_RD,B_RD,B_DK,B_BK,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_OG,B_BK,B_RD,B_RD,B_DK,B_BK,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_BK,B_BK,B_BK,B_BK,B_BK,B_TR,B_TR,B_TR,B_TR,B_TR},
    {B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR,B_TR}
};

/* ========================================================================= */
/* FONCTIONS DE TRACÉ SÉCURISÉES SANS AUCUN DÉPASSEMENT NI FREEZE            */
/* ========================================================================= */
static void draw_clamped_rect(int x, int y, int w, int h, eadk_color_t color) {
    if (w <= 0 || h <= 0) return;
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > EADK_SCREEN_WIDTH) w = EADK_SCREEN_WIDTH - x;
    if (y + h > EADK_SCREEN_HEIGHT) h = EADK_SCREEN_HEIGHT - y;
    if (w <= 0 || h <= 0) return;

    eadk_rect_t rect = {(uint16_t)x, (uint16_t)y, (uint16_t)w, (uint16_t)h};
    eadk_display_push_rect_uniform(rect, color);
}

static void draw_pipe_body(int bx, int by, int bh) {
    if (bh <= 0) return;
    /* Corps de tuyau 32px stylisé Mario Bros */
    draw_clamped_rect(bx,      by, 1,  bh, COLOR_PIPE_BLACK);
    draw_clamped_rect(bx + 1,  by, 2,  bh, COLOR_PIPE_LIGHT);
    draw_clamped_rect(bx + 3,  by, 17, bh, COLOR_PIPE_GREEN);
    draw_clamped_rect(bx + 20, by, 6,  bh, COLOR_PIPE_DARK);
    draw_clamped_rect(bx + 26, by, 5,  bh, COLOR_PIPE_DEEP);
    draw_clamped_rect(bx + 31, by, 1,  bh, COLOR_PIPE_BLACK);
}

static void draw_pipe_cap(int cx, int cy, int ch, bool is_top) {
    if (ch <= 0) return;
    int cw = PIPE_CAP_W; /* 36 px */

    /* Bordure noire extérieure */
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

    /* Remplissage vert 3D avec reflet blanc */
    int inner_y = cy + (is_top ? 1 : 2);
    int inner_h = ch - 3;
    if (inner_h > 0) {
        draw_clamped_rect(cx + 1,  inner_y, 2,  inner_h, COLOR_PIPE_WHITE);
        draw_clamped_rect(cx + 3,  inner_y, 19, inner_h, COLOR_PIPE_GREEN);
        draw_clamped_rect(cx + 22, inner_y, 6,  inner_h, COLOR_PIPE_DARK);
        draw_clamped_rect(cx + 28, inner_y, 7,  inner_h, COLOR_PIPE_DEEP);
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
    /* Efface exactement la bande de 2px à l'arrière du tuyau */
    draw_clamped_rect(old_px + PIPE_CAP_W - PIPE_SPEED, PLAY_TOP, PIPE_SPEED, GROUND_Y - PLAY_TOP, COLOR_SKY);
}

static void draw_bird(int by, int frame) {
    if (by < PLAY_TOP) by = PLAY_TOP;
    if (by + BIRD_H > GROUND_Y) by = GROUND_Y - BIRD_H;

    uint16_t bird_buf[BIRD_H * BIRD_W];
    const uint16_t (*src)[BIRD_W];

    if (frame == 0) src = s_bird_frame_up;
    else if (frame == 1) src = s_bird_frame_mid;
    else if (frame == 2) src = s_bird_frame_down;
    else src = s_bird_frame_dive;

    for (int r = 0; r < BIRD_H; r++) {
        for (int c = 0; c < BIRD_W; c++) {
            uint16_t px = src[r][c];
            bird_buf[r * BIRD_W + c] = (px == B_TR) ? COLOR_SKY : px;
        }
    }

    eadk_rect_t rect = {(uint16_t)BIRD_X, (uint16_t)by, BIRD_W, BIRD_H};
    eadk_display_push_rect(rect, bird_buf);
}

static void erase_bird(int old_by) {
    if (old_by < PLAY_TOP) old_by = PLAY_TOP;
    if (old_by + BIRD_H > GROUND_Y) old_by = GROUND_Y - BIRD_H;
    draw_clamped_rect(BIRD_X, old_by, BIRD_W, BIRD_H, COLOR_SKY);
}

static void draw_initial_scene(void) {
    /* Barre supérieure officielle */
    draw_clamped_rect(0, 0, EADK_SCREEN_WIDTH, 22, 0xFE60);
    eadk_point_t pt_title = {8, 5};
    eadk_display_draw_string("Flappy Bird Arcade", pt_title, false, eadk_color_black, 0xFE60);

    /* Ciel */
    draw_clamped_rect(0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP, COLOR_SKY);

    /* Nuages rétro */
    draw_clamped_rect(30, 45, 45, 12, COLOR_CLOUD_WHITE);
    draw_clamped_rect(38, 38, 28, 8, COLOR_CLOUD_WHITE);
    draw_clamped_rect(170, 60, 50, 12, COLOR_CLOUD_WHITE);
    draw_clamped_rect(180, 52, 32, 8, COLOR_CLOUD_WHITE);

    /* Sol rétro */
    draw_clamped_rect(0, GROUND_Y, EADK_SCREEN_WIDTH, 1, COLOR_PIPE_BLACK);
    draw_clamped_rect(0, GROUND_Y + 1, EADK_SCREEN_WIDTH, 3, COLOR_GRASS_TOP);
    draw_clamped_rect(0, GROUND_Y + 4, EADK_SCREEN_WIDTH, 2, COLOR_GRASS_SEAM);
    draw_clamped_rect(0, GROUND_Y + 6, EADK_SCREEN_WIDTH, EADK_SCREEN_HEIGHT - (GROUND_Y + 6), COLOR_GROUND_SAND);

    /* Contrôles */
    eadk_point_t pt_ctrl = {28, EADK_SCREEN_HEIGHT - 12};
    eadk_display_draw_string("OK / HAUT : Voler   |   BACK : Hub   |   Var : Furtif", pt_ctrl, false, 0x5240, COLOR_GROUND_SAND);
}

static void draw_score(int score, int best_score) {
    char buf[32];
    snprintf(buf, sizeof(buf), "Score: %d  |  Record: %d", score, best_score);
    draw_clamped_rect(160, 0, 155, 22, 0xFE60);
    eadk_point_t pt_sc = {165, 5};
    eadk_display_draw_string(buf, pt_sc, false, eadk_color_black, 0xFE60);
}

static void draw_game_over(int score, int best_score) {
    /* Bannière GAME OVER */
    draw_clamped_rect(75, 45, 170, 26, COLOR_PIPE_BLACK);
    draw_clamped_rect(77, 47, 166, 22, 0xFA40);
    eadk_point_t pt_go = {98, 51};
    eadk_display_draw_string("GAME OVER", pt_go, true, 0xFFFF, 0xFA40);

    /* Boîte des scores */
    draw_clamped_rect(60, 78, 200, 72, COLOR_PIPE_BLACK);
    draw_clamped_rect(62, 80, 196, 68, 0xFFFF);

    char s_buf[32];
    snprintf(s_buf, sizeof(s_buf), "Score: %d", score);
    eadk_point_t pt_s = {78, 88};
    eadk_display_draw_string(s_buf, pt_s, true, COLOR_PIPE_BLACK, 0xFFFF);

    char b_buf[32];
    snprintf(b_buf, sizeof(b_buf), "Record: %d", best_score);
    eadk_point_t pt_b = {78, 110};
    eadk_display_draw_string(b_buf, pt_b, false, 0x5404, 0xFFFF);

    if (score >= 10) {
        const char* medal = (score >= 40) ? "[ Platine ]" :
                            (score >= 30) ? "[ Or ]" :
                            (score >= 20) ? "[ Argent ]" : "[ Bronze ]";
        eadk_point_t pt_m = {78, 128};
        eadk_display_draw_string(medal, pt_m, false, 0xFA40, 0xFFFF);
    }

    /* Raccourci */
    draw_clamped_rect(65, 160, 190, 22, COLOR_PIPE_BLACK);
    draw_clamped_rect(66, 161, 188, 20, 0xFE60);
    eadk_point_t pt_rst = {75, 165};
    eadk_display_draw_string("OK: Rejouer   |   BACK: Hub", pt_rst, false, eadk_color_black, 0xFE60);
}

/* ========================================================================= */
/* BOUCLE PRINCIPALE DU JEU FLAPPY BIRD                                      */
/* ========================================================================= */
void run_flappy_app(void) {
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
        pipes[i].active = false;
        pipes[i].x = 320 + i * 150;
        pipes[i].gap_y = 65 + (int)(eadk_random() % 65);
        pipes[i].passed = false;
    }
    pipes[0].active = true;
    pipes[1].active = true;

    int score = 0;
    int best_score = 0;
    int prev_drawn_score = -1;
    bool game_over = false;
    bool started = false;

    eadk_keyboard_state_t prev_kbd = 0;

    /* Rendu initial */
    draw_initial_scene();
    draw_score(score, best_score);
    prev_drawn_score = score;

    /* Boîte de consigne */
    eadk_rect_t hint_box = {60, 95, 200, 34};
    eadk_display_push_rect_uniform(hint_box, COLOR_PIPE_BLACK);
    eadk_rect_t hint_inner = {62, 97, 196, 30};
    eadk_display_push_rect_uniform(hint_inner, 0xFFFF);
    eadk_point_t pt_h1 = {78, 101};
    eadk_display_draw_string("Appuyez sur OK ou HAUT", pt_h1, false, 0x0000, 0xFFFF);
    eadk_point_t pt_h2 = {96, 114};
    eadk_display_draw_string("pour vous envoler !", pt_h2, false, 0x3186, 0xFFFF);

    draw_bird(bird_y / 10, 1);

    while (true) {
        uint64_t frame_start = eadk_timing_millis();
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        /* Mode Panique Furtif [Var] */
        if (eadk_keyboard_key_down(kbd, eadk_key_var)) {
            run_panic_calculator();
            int p_cycles = 0;
            while (eadk_keyboard_scan() != 0 && p_cycles < 25) {
                eadk_timing_msleep(20);
                p_cycles++;
            }
            prev_kbd = 0;
            draw_initial_scene();
            draw_score(score, best_score);
            for (int i = 0; i < MAX_PIPES; i++) {
                draw_pipe(&pipes[i]);
            }
            draw_bird(bird_y / 10, 1);
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
                /* Nettoyer et relancer */
                draw_clamped_rect(0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP, COLOR_SKY);
                draw_clamped_rect(30, 45, 45, 12, COLOR_CLOUD_WHITE);
                draw_clamped_rect(38, 38, 28, 8, COLOR_CLOUD_WHITE);
                draw_clamped_rect(170, 60, 50, 12, COLOR_CLOUD_WHITE);
                draw_clamped_rect(180, 52, 32, 8, COLOR_CLOUD_WHITE);

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

                eadk_display_push_rect_uniform(hint_box, COLOR_PIPE_BLACK);
                eadk_display_push_rect_uniform(hint_inner, 0xFFFF);
                eadk_display_draw_string("Appuyez sur OK ou HAUT", pt_h1, false, 0x0000, 0xFFFF);
                eadk_display_draw_string("pour vous envoler !", pt_h2, false, 0x3186, 0xFFFF);

                draw_bird(bird_y / 10, 1);
            }
        } else {
            if (flap) {
                if (!started) {
                    draw_clamped_rect(hint_box.x, hint_box.y, hint_box.width, hint_box.height, COLOR_SKY);
                    started = true;
                }
                bird_vy = flap_power;
            }

            if (started) {
                /* Physique */
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

                /* Déplacement tuyaux */
                for (int i = 0; i < MAX_PIPES; i++) {
                    if (!pipes[i].active) continue;

                    int old_px = pipes[i].x;
                    pipes[i].x -= PIPE_SPEED;

                    /* Effacer le sillage de 2px à l'arrière */
                    erase_pipe_trail(old_px);

                    /* Score */
                    if (!pipes[i].passed && pipes[i].x + PIPE_W < BIRD_X) {
                        pipes[i].passed = true;
                        score++;
                        if (score > best_score) best_score = score;
                    }

                    /* Recyclage */
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

                    /* Collision */
                    int px = pipes[i].x;
                    int gy = pipes[i].gap_y;
                    if (BIRD_X + BIRD_W > px && BIRD_X < px + PIPE_CAP_W) {
                        if (cur_by < gy || cur_by + BIRD_H > gy + PIPE_GAP) {
                            game_over = true;
                        }
                    }

                    /* Tracé tuyau */
                    draw_pipe(&pipes[i]);
                }

                /* Rendu oiseau */
                if (cur_by != old_bird_y) {
                    erase_bird(old_bird_y);
                    old_bird_y = cur_by;
                }

                int bird_frame = (bird_vy < -4) ? 0 : (bird_vy > 18 ? 3 : (bird_vy > 6 ? 2 : 1));
                draw_bird(cur_by, bird_frame);

                /* Score */
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

        /* Cadence 60 FPS */
        uint64_t elapsed = eadk_timing_millis() - frame_start;
        if (elapsed < 16) {
            eadk_timing_msleep((uint32_t)(16 - elapsed));
        }
    }

    int exit_cycles = 0;
    while (eadk_keyboard_scan() != 0 && exit_cycles < 25) {
        eadk_timing_msleep(20);
        exit_cycles++;
    }
}
