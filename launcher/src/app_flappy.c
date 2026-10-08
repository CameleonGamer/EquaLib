#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

/* ========================================================================= */
/* PALETTE OFFICIELLE FLAPPY BIRD RETRO (RGB565)                             */
/* ========================================================================= */
#define COLOR_SKY          0x4DF9  /* Cyan ciel officiel (#4ec0ca) */
#define COLOR_SKY_HORIZON  0x76B9  /* Ciel clair vers l'horizon */

/* Ville / Bâtiments d'arrière-plan */
#define COLOR_BLDG_BACK    0x8EF8  /* Bâtiments arrière (cyan brumeux #8be0c2) */
#define COLOR_BLDG_FRONT   0x7E37  /* Bâtiments avant (#7cd9b8) */
#define COLOR_BLDG_WIN     0xDF3E  /* Fenêtres rétro pastel */

/* Arbres et buissons */
#define COLOR_BUSH_LIGHT   0x6E2F  /* Vert feuillage clair (#6ec47d) */
#define COLOR_BUSH_DARK    0x44CA  /* Vert feuillage ombre (#459850) */

/* Nuages rétro */
#define COLOR_CLOUD_WHITE  0xFFFF  /* Blanc nuage */
#define COLOR_CLOUD_SHADOW 0xCE79  /* Ombre nuage bleue/grise (#cce5eb) */

/* Tuyaux rétro style Super Mario / Flappy Bird */
#define COLOR_PIPE_BLACK   0x0000  /* Contour noir officiel */
#define COLOR_PIPE_WHITE   0xD7EF  /* Reflet blanc/vert vif (#d5ff7a) */
#define COLOR_PIPE_LIGHT   0x9F27  /* Vert clair reflet (#9de63a) */
#define COLOR_PIPE_GREEN   0x75E5  /* Vert tuyau officiel (#73bf2e) */
#define COLOR_PIPE_DARK    0x5404  /* Ombre vert moyen (#558022) */
#define COLOR_PIPE_DEEP    0x3AC2  /* Ombre tuyau sombre (#385816) */
#define COLOR_PIPE_SHADOW  0x1A60  /* Ombre portée sous le chapeau */

/* Sol et herbe */
#define COLOR_GRASS_TOP    0x75E5  /* Herbe vert vif */
#define COLOR_GRASS_TEETH  0x5404  /* Dents d'herbe sombres */
#define COLOR_GRASS_SEAM   0x3961  /* Ligne de couture foncée */
#define COLOR_GROUND_SAND  0xDEB2  /* Sable officiel (#ded895) */
#define COLOR_GROUND_STRIPE 0xCE4F /* Bandes diagonales du sable (#cfc57c) */
#define COLOR_GROUND_BASE  0xBD49  /* Bas du sol */

/* Dimensions du monde de jeu */
#define PLAY_TOP         22
#define GROUND_Y         204

#define BIRD_X           56
#define BIRD_W           17
#define BIRD_H           12

#define PIPE_W           32
#define PIPE_CAP_W       36
#define PIPE_CAP_H       14
#define PIPE_GAP         62
#define MAX_PIPES        3
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
/* CHIFFRES RETRO 3D POUR LE SCORE (10x14 PIXELS)                            */
/* ========================================================================= */
static const char* const s_digit_map[10][14] = {
    /* 0 */ {
        "..BBBBBB..",".BWWWWWWXB","BWWBBBBWWX","BWWBBBBWWX",
        "BWWBBBBWWX","BWWBBBBWWX","BWWBBBBWWX","BWWBBBBWWX",
        "BWWBBBBWWX","BWWBBBBWWX","BWWBBBBWWX","BWWBBBBWWX",
        ".BWWWWWWXB","..BBBBBB.."
    },
    /* 1 */ {
        "...BBBB...","..BWWWWXB.",".BWWWWWWXB","...BBWWWWX",
        "...BBWWWWX","...BBWWWWX","...BBWWWWX","...BBWWWWX",
        "...BBWWWWX","...BBWWWWX","...BBWWWWX","...BBWWWWX",
        ".BBWWWWWWX",".BBBBBBBBB"
    },
    /* 2 */ {
        "..BBBBBB..",".BWWWWWWXB","BWWBBBBWWX","BWWBBBBWWX",
        "......BWWX",".....BWWXB","....BWWXB.","...BWWXB..",
        "..BWWXB...",".BWWXB....","BWWBBBBBBB","BWWWWWWWWX",
        "BWWWWWWWWX","BBBBBBBBBB"
    },
    /* 3 */ {
        "..BBBBBB..",".BWWWWWWXB","BWWBBBBWWX","......BWWX",
        ".....BWWXB","...BBWWXB.","...BBWWWWX",".....BBWWX",
        "......BWWX","......BWWX","BWWBBBBWWX",".BWWWWWWXB",
        "..BBBBBB..",".........."
    },
    /* 4 */ {
        "....BBBB..","...BWWWWX.","..BWWWWWWX",".BWWBBWWWW",
        "BWWX.BWWWW","BWWX.BWWWW","BWWBBWWWWW","BWWWWWWWWW",
        "BBBBBBWWWW",".....BWWWW",".....BWWWW",".....BWWWW",
        ".....BWWWW",".....BBBBB"
    },
    /* 5 */ {
        ".BBBBBBBBB",".BWWWWWWWW",".BWWBBBBBB",".BWWWWWWW.",
        ".BBBBBBWWX","......BWWX","......BWWX","......BWWX",
        "BWWBBBBWWX",".BWWWWWWXB","..BBBBBB..","..........",
        "..........",".........."
    },
    /* 6 */ {
        "..BBBBBB..",".BWWWWWWXB","BWWBBBBBBX","BWWBBBBBB.",
        "BWWWWWWWWX","BWWBBBBWWX","BWWBBBBWWX","BWWBBBBWWX",
        "BWWBBBBWWX",".BWWWWWWXB","..BBBBBB..","..........",
        "..........",".........."
    },
    /* 7 */ {
        "BBBBBBBBBB","BWWWWWWWWX","BBBBBBBWWX","......BWWX",
        ".....BWWXB","....BWWXB.","...BWWXB..","...BWWXB..",
        "..BWWXB...","..BWWXB...","..BWWXB...","..BWWXB...",
        "...BBBB...",".........."
    },
    /* 8 */ {
        "..BBBBBB..",".BWWWWWWXB","BWWBBBBWWX","BWWBBBBWWX",
        ".BWWWWWWXB","..BBBBBB..",".BWWWWWWXB","BWWBBBBWWX",
        "BWWBBBBWWX","BWWBBBBWWX",".BWWWWWWXB","..BBBBBB..",
        "..........",".........."
    },
    /* 9 */ {
        "..BBBBBB..",".BWWWWWWXB","BWWBBBBWWX","BWWBBBBWWX",
        "BWWBBBBWWX",".BWWWWWWWX","..BBBBWWWW","......BWWX",
        "BWWBBBBWWX",".BWWWWWWXB","..BBBBBB..","..........",
        "..........",".........."
    }
};

/* ========================================================================= */
/* GÉNÉRATEUR MATHÉMATIQUE DE DÉCOR (CIEL, NUAGES, VILLE, ARBRES)            */
/* ========================================================================= */
static int get_building_top(int x) {
    if (x < 28)  return 168;
    if (x < 62)  return 154;
    if (x < 96)  return 165;
    if (x < 136) return 148;
    if (x < 170) return 160;
    if (x < 208) return 152;
    if (x < 242) return 166;
    if (x < 278) return 156;
    return 162;
}

static bool is_building_front(int x) {
    return ((x >= 28 && x < 62) || (x >= 96 && x < 136) || (x >= 170 && x < 208) || (x >= 242 && x < 278));
}

static int iabs(int v) {
    return (v < 0) ? -v : v;
}

static bool check_cloud(int x, int y, int cx, int cy, int cw, bool* is_shadow) {
    *is_shadow = false;
    if (y < cy - 6 || y > cy + 14) return false;
    if (x < cx - cw / 2 || x > cx + cw / 2) return false;

    bool in_cloud = false;
    /* Base horizontale du nuage */
    if (y >= cy + 4 && y <= cy + 14 && iabs(x - cx) <= cw / 2) in_cloud = true;
    /* Dôme gauche */
    if (y >= cy - 2 && y <= cy + 10 && iabs(x - (cx - cw / 5)) <= cw / 3) in_cloud = true;
    /* Dôme central haut */
    if (y >= cy - 6 && y <= cy + 8 && iabs(x - (cx + cw / 8)) <= cw / 4) in_cloud = true;

    if (in_cloud) {
        if (y >= cy + 12) *is_shadow = true;
        return true;
    }
    return false;
}

static uint16_t get_skyline_pixel(int x, int y) {
    /* 1. Arbres / Buissons au premier plan */
    if (y >= 193) {
        int canopy_top = 193 + (x % 14 < 7 ? 0 : 2);
        if (y >= canopy_top) {
            return (y <= canopy_top + 2) ? COLOR_BUSH_LIGHT : COLOR_BUSH_DARK;
        }
    }

    /* 2. Bâtiments / Skyline de la ville */
    int b_top = get_building_top(x);
    if (y >= b_top) {
        int ly = y - b_top;
        if ((ly % 10 >= 3 && ly % 10 <= 6) && (x % 8 >= 3 && x % 8 <= 5)) {
            return COLOR_BLDG_WIN;
        }
        return is_building_front(x) ? COLOR_BLDG_FRONT : COLOR_BLDG_BACK;
    }

    /* 3. Nuages rétro */
    bool shadow = false;
    if (check_cloud(x, y, 45, 48, 52, &shadow) ||
        check_cloud(x, y, 160, 36, 62, &shadow) ||
        check_cloud(x, y, 275, 50, 54, &shadow)) {
        return shadow ? COLOR_CLOUD_SHADOW : COLOR_CLOUD_WHITE;
    }

    /* 4. Ciel bleu authentique avec dégradé subtil à l'horizon */
    if (y >= 170) return COLOR_SKY_HORIZON;
    return COLOR_SKY;
}

/* Restauration exacte d'une bande de décor */
static void restore_background_strip(int x, int w) {
    if (w <= 0) return;
    int x1 = x;
    int x2 = x + w;
    if (x1 < 0) x1 = 0;
    if (x2 > EADK_SCREEN_WIDTH) x2 = EADK_SCREEN_WIDTH;
    if (x2 <= x1) return;

    int act_w = x2 - x1;
    int h = GROUND_Y - PLAY_TOP;
    static uint16_t strip_buf[4 * 182]; /* Max 4 colonnes par frame */

    if (act_w > 4) act_w = 4;

    for (int r = 0; r < h; r++) {
        int py = PLAY_TOP + r;
        for (int c = 0; c < act_w; c++) {
            int px = x1 + c;
            strip_buf[r * act_w + c] = get_skyline_pixel(px, py);
        }
    }

    eadk_rect_t r_strip = {(uint16_t)x1, (uint16_t)PLAY_TOP, (uint16_t)act_w, (uint16_t)h};
    eadk_display_push_rect(r_strip, strip_buf);
}

/* Restauration d'une région rectangulaire du décor */
static void restore_background_rect(int rx, int ry, int rw, int rh) {
    if (rw <= 0 || rh <= 0) return;
    if (rx < 0) { rw += rx; rx = 0; }
    if (rx + rw > EADK_SCREEN_WIDTH) rw = EADK_SCREEN_WIDTH - rx;
    if (rw <= 0) return;

    uint16_t row_buf[320];

    for (int r = 0; r < rh; r++) {
        int py = ry + r;
        if (py < 0 || py >= EADK_SCREEN_HEIGHT) continue;
        for (int c = 0; c < rw; c++) {
            row_buf[c] = get_skyline_pixel(rx + c, py);
        }
        eadk_rect_t rect = {(uint16_t)rx, (uint16_t)py, (uint16_t)rw, 1};
        eadk_display_push_rect(rect, row_buf);
    }
}

/* ========================================================================= */
/* RENDU OFFICIEL DU SOL & DE L'HERBE RETRO                                  */
/* ========================================================================= */
static void draw_retro_ground(void) {
    /* 1. Ligne de bordure herbe */
    eadk_display_push_rect_uniform((eadk_rect_t){0, (uint16_t)GROUND_Y, EADK_SCREEN_WIDTH, 1}, COLOR_PIPE_BLACK);

    /* 2. Bande d'herbe vert vif */
    eadk_display_push_rect_uniform((eadk_rect_t){0, (uint16_t)(GROUND_Y + 1), EADK_SCREEN_WIDTH, 3}, COLOR_GRASS_TOP);

    /* 3. Dents d'herbe sombres */
    for (int x = 0; x < EADK_SCREEN_WIDTH; x += 8) {
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)x, (uint16_t)(GROUND_Y + 4), 4, 2}, COLOR_GRASS_TEETH);
    }

    /* 4. Ligne de couture foncée */
    eadk_display_push_rect_uniform((eadk_rect_t){0, (uint16_t)(GROUND_Y + 6), EADK_SCREEN_WIDTH, 1}, COLOR_GRASS_SEAM);

    /* 5. Sol sable chaud */
    eadk_rect_t sand_rect = {0, (uint16_t)(GROUND_Y + 7), EADK_SCREEN_WIDTH, (uint16_t)(EADK_SCREEN_HEIGHT - (GROUND_Y + 7))};
    eadk_display_push_rect_uniform(sand_rect, COLOR_GROUND_SAND);

    /* 6. Bandes diagonales du sable à 45 degrés */
    for (int x = -10; x < EADK_SCREEN_WIDTH + 30; x += 14) {
        for (int y = GROUND_Y + 7; y < EADK_SCREEN_HEIGHT - 12; y += 2) {
            int sx = x + (y - GROUND_Y);
            if (sx >= 0 && sx < EADK_SCREEN_WIDTH - 3) {
                eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)sx, (uint16_t)y, 3, 2}, COLOR_GROUND_STRIPE);
            }
        }
    }

    /* 7. Rappel des touches en bas du sol en ton chaud discret */
    eadk_point_t pt_ctrl = {28, EADK_SCREEN_HEIGHT - 11};
    eadk_display_draw_string("OK / HAUT : Voler   |   BACK : Hub   |   Var : Furtif", pt_ctrl, false, 0x5240, COLOR_GROUND_SAND);
}

/* ========================================================================= */
/* RENDU DES TUYAUX RASTER HAUTE PERFORMANCE (0 SCINTILLEMENT)               */
/* ========================================================================= */
static const uint16_t s_pipe_body_row[32] = {
    COLOR_PIPE_BLACK, COLOR_PIPE_WHITE,
    COLOR_PIPE_LIGHT, COLOR_PIPE_LIGHT, COLOR_PIPE_LIGHT,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_DARK, COLOR_PIPE_DARK, COLOR_PIPE_DARK,
    COLOR_PIPE_DARK, COLOR_PIPE_DARK, COLOR_PIPE_DARK,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_BLACK
};

static const uint16_t s_pipe_body_shadow_row[32] = {
    COLOR_PIPE_BLACK,
    COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW,
    COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW,
    COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW,
    COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW,
    COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW,
    COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW,
    COLOR_PIPE_SHADOW, COLOR_PIPE_SHADOW,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_BLACK
};

static const uint16_t s_pipe_cap_row[36] = {
    COLOR_PIPE_BLACK, COLOR_PIPE_WHITE,
    COLOR_PIPE_LIGHT, COLOR_PIPE_LIGHT, COLOR_PIPE_LIGHT, COLOR_PIPE_LIGHT,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_GREEN, COLOR_PIPE_GREEN,
    COLOR_PIPE_DARK, COLOR_PIPE_DARK, COLOR_PIPE_DARK,
    COLOR_PIPE_DARK, COLOR_PIPE_DARK, COLOR_PIPE_DARK,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_BLACK
};

static const uint16_t s_pipe_cap_lip_row[36] = {
    COLOR_PIPE_BLACK, COLOR_PIPE_WHITE,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP, COLOR_PIPE_DEEP,
    COLOR_PIPE_DEEP,
    COLOR_PIPE_BLACK
};

static void draw_pipe_body(int x, int y, int w, int h, bool is_top) {
    (void)w;
    if (h <= 0) return;
    int x1 = x;
    int x2 = x + PIPE_W;
    if (x1 < 0) x1 = 0;
    if (x2 > EADK_SCREEN_WIDTH) x2 = EADK_SCREEN_WIDTH;
    if (x2 <= x1) return;

    int act_w = x2 - x1;
    int src_offset = x1 - x;
    if (h > 144) h = 144;

    static uint16_t s_body_buf[32 * 144];

    for (int r = 0; r < h; r++) {
        const uint16_t* row_src;
        if (!is_top && r < 2) {
            row_src = s_pipe_body_shadow_row;
        } else if (is_top && r >= h - 2) {
            row_src = s_pipe_body_shadow_row;
        } else {
            row_src = s_pipe_body_row;
        }
        for (int c = 0; c < act_w; c++) {
            s_body_buf[r * act_w + c] = row_src[src_offset + c];
        }
    }

    eadk_rect_t rect = {(uint16_t)x1, (uint16_t)y, (uint16_t)act_w, (uint16_t)h};
    eadk_display_push_rect(rect, s_body_buf);
}

static void draw_pipe_cap(int cx, int cy, int cw, int ch, bool is_top) {
    (void)cw;
    if (ch <= 0) return;
    int x1 = cx;
    int x2 = cx + PIPE_CAP_W;
    if (x1 < 0) x1 = 0;
    if (x2 > EADK_SCREEN_WIDTH) x2 = EADK_SCREEN_WIDTH;
    if (x2 <= x1) return;

    int act_w = x2 - x1;
    int src_offset = x1 - cx;
    if (ch > 14) ch = 14;

    uint16_t cap_buf[36 * 14];

    for (int r = 0; r < ch; r++) {
        const uint16_t* row_src;
        if (r == 0 || r == ch - 1) {
            for (int c = 0; c < act_w; c++) {
                cap_buf[r * act_w + c] = COLOR_PIPE_BLACK;
            }
            continue;
        } else if (is_top && r == ch - 2) {
            row_src = s_pipe_cap_lip_row;
        } else if (!is_top && r == 1) {
            row_src = s_pipe_cap_lip_row;
        } else {
            row_src = s_pipe_cap_row;
        }
        for (int c = 0; c < act_w; c++) {
            cap_buf[r * act_w + c] = row_src[src_offset + c];
        }
    }

    eadk_rect_t rect = {(uint16_t)x1, (uint16_t)cy, (uint16_t)act_w, (uint16_t)ch};
    eadk_display_push_rect(rect, cap_buf);
}

static void draw_full_pipe(const pipe_t* p) {
    if (!p->active) return;
    int px = p->x;
    if (px + PIPE_CAP_W < 0 || px >= EADK_SCREEN_WIDTH) return;

    int gy = p->gap_y;
    int body_x = px + 2;

    /* 1. Tuyau supérieur */
    if (gy - PIPE_CAP_H > PLAY_TOP) {
        draw_pipe_body(body_x, PLAY_TOP, PIPE_W, gy - PIPE_CAP_H - PLAY_TOP, true);
    }
    if (gy > PLAY_TOP) {
        int cap_y = gy - PIPE_CAP_H;
        int cap_h = PIPE_CAP_H;
        if (cap_y < PLAY_TOP) {
            cap_h -= (PLAY_TOP - cap_y);
            cap_y = PLAY_TOP;
        }
        draw_pipe_cap(px, cap_y, PIPE_CAP_W, cap_h, true);
    }

    /* 2. Tuyau inférieur */
    int bot_cap_y = gy + PIPE_GAP;
    if (bot_cap_y < GROUND_Y) {
        int cap_h = PIPE_CAP_H;
        if (bot_cap_y + cap_h > GROUND_Y) cap_h = GROUND_Y - bot_cap_y;
        draw_pipe_cap(px, bot_cap_y, PIPE_CAP_W, cap_h, false);
    }
    int bot_body_y = bot_cap_y + PIPE_CAP_H;
    if (bot_body_y < GROUND_Y) {
        draw_pipe_body(body_x, bot_body_y, PIPE_W, GROUND_Y - bot_body_y, false);
    }
}

/* ========================================================================= */
/* RENDU DE L'OISEAU AVEC TRANSPARENCE ET DÉCOR SOUS-JACENT                  */
/* ========================================================================= */
static void draw_bird_sprite(int by, int frame) {
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
            if (px == B_TR) {
                bird_buf[r * BIRD_W + c] = get_skyline_pixel(BIRD_X + c, by + r);
            } else {
                bird_buf[r * BIRD_W + c] = px;
            }
        }
    }

    eadk_rect_t b_rect = {(uint16_t)BIRD_X, (uint16_t)by, BIRD_W, BIRD_H};
    eadk_display_push_rect(b_rect, bird_buf);
}

static void erase_bird_sprite(int old_by) {
    if (old_by < PLAY_TOP) old_by = PLAY_TOP;
    if (old_by + BIRD_H > GROUND_Y) old_by = GROUND_Y - BIRD_H;
    restore_background_rect(BIRD_X, old_by, BIRD_W, BIRD_H);
}

/* ========================================================================= */
/* RENDU DU SCORE RETRO 3D EN HAUT DE L'ÉCRAN                                */
/* ========================================================================= */
static void draw_score_number(int score, int old_score) {
    /* 1. Effacer la boîte de l'ancien score */
    if (old_score >= 0) {
        char old_str[16];
        snprintf(old_str, sizeof(old_str), "%d", old_score);
        int old_len = 0;
        while (old_str[old_len]) old_len++;
        int old_w = old_len * 10 + (old_len - 1) * 2;
        int old_x = (EADK_SCREEN_WIDTH - old_w) / 2;
        restore_background_rect(old_x - 2, 28, old_w + 4, 16);
    }

    /* 2. Dessiner le nouveau score */
    char str[16];
    snprintf(str, sizeof(str), "%d", score);
    int len = 0;
    while (str[len]) len++;
    int total_w = len * 10 + (len - 1) * 2;
    int cur_x = (EADK_SCREEN_WIDTH - total_w) / 2;

    for (int i = 0; i < len; i++) {
        int d = str[i] - '0';
        if (d >= 0 && d <= 9) {
            uint16_t digit_buf[10 * 14];
            for (int r = 0; r < 14; r++) {
                const char* row = s_digit_map[d][r];
                for (int c = 0; c < 10; c++) {
                    char ch = row[c];
                    if (ch == 'B') digit_buf[r * 10 + c] = COLOR_PIPE_BLACK;
                    else if (ch == 'W') digit_buf[r * 10 + c] = 0xFFFF;
                    else if (ch == 'X') digit_buf[r * 10 + c] = COLOR_CLOUD_SHADOW;
                    else digit_buf[r * 10 + c] = get_skyline_pixel(cur_x + c, 29 + r);
                }
            }
            eadk_rect_t d_rect = {(uint16_t)cur_x, 29, 10, 14};
            eadk_display_push_rect(d_rect, digit_buf);
        }
        cur_x += 12;
    }
}

/* ========================================================================= */
/* ÉCRAN DE GAME OVER ET TABLEAU DES SCORES RETRO                            */
/* ========================================================================= */
static void draw_game_over_scoreboard(int score, int best_score) {
    /* 1. Bannière GAME OVER rétro */
    eadk_rect_t go_box = {75, 45, 170, 26};
    eadk_display_push_rect_uniform(go_box, COLOR_PIPE_BLACK);
    eadk_rect_t go_inner = {77, 47, 166, 22};
    eadk_display_push_rect_uniform(go_inner, 0xFA40); /* Rouge-orange rétro */

    eadk_point_t pt_go = {98, 51};
    eadk_display_draw_string("GAME OVER", pt_go, true, 0xFFFF, 0xFA40);

    /* 2. Plaque du tableau des scores */
    eadk_rect_t plaque_border = {58, 78, 204, 88};
    eadk_display_push_rect_uniform(plaque_border, COLOR_GRASS_SEAM);
    eadk_rect_t plaque_gold = {60, 80, 200, 84};
    eadk_display_push_rect_uniform(plaque_gold, COLOR_GROUND_SAND);

    /* Biseau intérieur */
    eadk_rect_t inner_rim = {63, 83, 194, 78};
    eadk_display_push_rect_uniform(inner_rim, 0xEF75);

    /* Section MÉDAILLE à gauche */
    eadk_point_t pt_med_lbl = {74, 88};
    eadk_display_draw_string("MEDAILLE", pt_med_lbl, false, COLOR_GRASS_SEAM, 0xEF75);

    /* Cercle de la médaille 20x20 */
    eadk_rect_t med_slot = {77, 104, 26, 26};
    eadk_display_push_rect_uniform(med_slot, 0xC5F0);

    uint16_t med_color = 0x8410; /* Pas de médaille */
    const char* med_title = "---";
    if (score >= 40) {
        med_color = 0x7E3F; /* Platine */
        med_title = "Platine";
    } else if (score >= 30) {
        med_color = 0xFE60; /* Or */
        med_title = "Or";
    } else if (score >= 20) {
        med_color = 0xD69A; /* Argent */
        med_title = "Argent";
    } else if (score >= 10) {
        med_color = 0xCA40; /* Bronze */
        med_title = "Bronze";
    }

    if (score >= 10) {
        eadk_rect_t med_disc = {79, 106, 22, 22};
        eadk_display_push_rect_uniform(med_disc, med_color);
        /* Étoile / Reflet */
        eadk_rect_t shine = {82, 109, 4, 4};
        eadk_display_push_rect_uniform(shine, 0xFFFF);
    }
    eadk_point_t pt_med_name = {71, 134};
    eadk_display_draw_string(med_title, pt_med_name, false, COLOR_GRASS_SEAM, 0xEF75);

    /* Séparateur vertical */
    eadk_rect_t div_plaque = {138, 88, 1, 68};
    eadk_display_push_rect_uniform(div_plaque, COLOR_GROUND_STRIPE);

    /* Section SCORE à droite */
    eadk_point_t pt_sc_lbl = {150, 90};
    eadk_display_draw_string("SCORE", pt_sc_lbl, false, COLOR_GRASS_SEAM, 0xEF75);

    char sc_str[16];
    snprintf(sc_str, sizeof(sc_str), "%d", score);
    eadk_point_t pt_sc_val = {160, 104};
    eadk_display_draw_string(sc_str, pt_sc_val, true, COLOR_PIPE_BLACK, 0xEF75);

    /* Section MEILLEUR SCORE */
    eadk_point_t pt_bst_lbl = {150, 122};
    eadk_display_draw_string("RECORD", pt_bst_lbl, false, COLOR_GRASS_SEAM, 0xEF75);

    char bst_str[16];
    snprintf(bst_str, sizeof(bst_str), "%d", best_score);
    eadk_point_t pt_bst_val = {160, 136};
    eadk_display_draw_string(bst_str, pt_bst_val, true, COLOR_PIPE_BLACK, 0xEF75);

    if (score >= best_score && score > 0) {
        eadk_rect_t new_tag = {200, 122, 26, 12};
        eadk_display_push_rect_uniform(new_tag, 0xF800);
        eadk_point_t pt_new = {202, 123};
        eadk_display_draw_string("NEW", pt_new, false, 0xFFFF, 0xF800);
    }

    /* 3. Boutons d'action */
    eadk_rect_t btn_bar = {65, 174, 190, 20};
    eadk_display_push_rect_uniform(btn_bar, COLOR_PIPE_BLACK);
    eadk_rect_t btn_inner = {66, 175, 188, 18};
    eadk_display_push_rect_uniform(btn_inner, 0xFFFF);

    eadk_point_t pt_btn = {75, 179};
    eadk_display_draw_string("OK: Rejouer   |   BACK: Hub", pt_btn, false, 0x028A, 0xFFFF);
}

/* ========================================================================= */
/* APPLICATION FLAPPY BIRD PRINCIPALE                                        */
/* ========================================================================= */
void run_flappy_app(void) {
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    int bird_y = 90 * 10;
    int old_bird_y = 90;
    int bird_vy = 0;
    const int gravity = 2;
    const int flap_power = -22;

    pipe_t pipes[MAX_PIPES];
    for (int i = 0; i < MAX_PIPES; i++) {
        pipes[i].active = false;
        pipes[i].x = 320 + i * 120;
        pipes[i].gap_y = 65 + (int)(eadk_random() % 70);
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

    /* Rendu complet initial du décor (tracé 1 seule fois pour 0 scintillement) */
    eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
    eadk_display_push_rect_uniform(top_bar, 0xFE60);
    eadk_point_t pt_title = {8, 5};
    eadk_display_draw_string("Flappy Bird Arcade", pt_title, false, eadk_color_black, 0xFE60);

    /* Tracé du paysage céleste complet */
    restore_background_rect(0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP);

    /* Tracé du sol texturé */
    draw_retro_ground();

    /* Message d'attente initial */
    eadk_rect_t hint_box = {60, 95, 200, 36};
    eadk_display_push_rect_uniform(hint_box, COLOR_PIPE_BLACK);
    eadk_rect_t hint_inner = {62, 97, 196, 32};
    eadk_display_push_rect_uniform(hint_inner, 0xFFFF);
    eadk_point_t pt_h1 = {78, 101};
    eadk_display_draw_string("Appuyez sur OK ou HAUT", pt_h1, false, 0x0000, 0xFFFF);
    eadk_point_t pt_h2 = {96, 115};
    eadk_display_draw_string("pour vous envoler !", pt_h2, false, 0x3186, 0xFFFF);

    draw_bird_sprite(bird_y / 10, 1);

    while (true) {
        uint64_t frame_start = eadk_timing_millis();
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        /* Mode Panique Furtif universel direct via [Var] */
        if (eadk_keyboard_key_down(kbd, eadk_key_var)) {
            run_panic_calculator();
            while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
            prev_kbd = 0;
            /* Restauration complète du jeu */
            eadk_display_wait_for_vblank();
            eadk_display_push_rect_uniform(top_bar, 0xFE60);
            eadk_display_draw_string("Flappy Bird Arcade", pt_title, false, eadk_color_black, 0xFE60);
            restore_background_rect(0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP);
            draw_retro_ground();
            for (int i = 0; i < MAX_PIPES; i++) {
                draw_full_pipe(&pipes[i]);
            }
            int frame = (bird_vy < -4) ? 0 : (bird_vy > 18 ? 3 : (bird_vy > 6 ? 2 : 1));
            draw_bird_sprite(bird_y / 10, frame);
            draw_score_number(score, -1);
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
                /* Nettoyer et relancer la partie */
                restore_background_rect(0, PLAY_TOP, EADK_SCREEN_WIDTH, GROUND_Y - PLAY_TOP);
                draw_retro_ground();

                bird_y = 90 * 10;
                old_bird_y = 90;
                bird_vy = 0;
                score = 0;
                prev_drawn_score = -1;
                game_over = false;
                started = false;

                for (int i = 0; i < MAX_PIPES; i++) {
                    pipes[i].active = (i < 2);
                    pipes[i].x = 320 + i * 120;
                    pipes[i].gap_y = 65 + (int)(eadk_random() % 70);
                    pipes[i].passed = false;
                }

                draw_bird_sprite(bird_y / 10, 1);

                eadk_display_push_rect_uniform(hint_box, COLOR_PIPE_BLACK);
                eadk_display_push_rect_uniform(hint_inner, 0xFFFF);
                eadk_display_draw_string("Appuyez sur OK ou HAUT", pt_h1, false, 0x0000, 0xFFFF);
                eadk_display_draw_string("pour vous envoler !", pt_h2, false, 0x3186, 0xFFFF);
            }
        } else {
            if (flap) {
                if (!started) {
                    restore_background_rect(hint_box.x, hint_box.y, hint_box.width, hint_box.height);
                    started = true;
                    draw_score_number(score, -1);
                }
                bird_vy = flap_power;
            }

            if (started) {
                /* 1. Physique de l'oiseau */
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

                /* Synchronisation VSync matérielle avant le rendu de la frame */
                eadk_display_wait_for_vblank();

                /* 2. Tuyaux */
                for (int i = 0; i < MAX_PIPES; i++) {
                    if (!pipes[i].active) continue;

                    int old_px = pipes[i].x;
                    pipes[i].x -= PIPE_SPEED;

                    /* Restauration exacte du décor à l'arrière du corps et du chapeau (4 px) */
                    restore_background_strip(old_px + PIPE_W, 4);

                    /* Vérification du score */
                    if (!pipes[i].passed && pipes[i].x + PIPE_W < BIRD_X) {
                        pipes[i].passed = true;
                        score++;
                        if (score > best_score) best_score = score;
                    }

                    /* Recyclage du tuyau */
                    if (pipes[i].x < -PIPE_CAP_W) {
                        int max_x = 0;
                        for (int j = 0; j < MAX_PIPES; j++) {
                            if (pipes[j].active && pipes[j].x > max_x) {
                                max_x = pipes[j].x;
                            }
                        }
                        pipes[i].x = max_x + 120;
                        pipes[i].gap_y = 60 + (int)(eadk_random() % 75);
                        pipes[i].passed = false;
                    }

                    /* Détection de collision précise avec les chapeaux */
                    int px = pipes[i].x;
                    int gy = pipes[i].gap_y;
                    if (BIRD_X + BIRD_W > px + 2 && BIRD_X < px + PIPE_CAP_W - 2) {
                        if (cur_by < gy || cur_by + BIRD_H > gy + PIPE_GAP) {
                            game_over = true;
                        }
                    }

                    /* Rendu du tuyau */
                    draw_full_pipe(&pipes[i]);
                }

                /* 3. Rendu de l'oiseau */
                if (cur_by != old_bird_y) {
                    erase_bird_sprite(old_bird_y);
                    old_bird_y = cur_by;
                }

                /* Choix de la frame d'animation selon la physique */
                int bird_frame;
                if (bird_vy < -4) bird_frame = 0;       /* Battement d'ailes */
                else if (bird_vy > 18) bird_frame = 3;  /* Piqué vertigineux */
                else if (bird_vy > 6) bird_frame = 2;   /* Chute progressive */
                else bird_frame = 1;                    /* Vol plané */

                draw_bird_sprite(cur_by, bird_frame);

                /* 4. Mise à jour du score 3D en haut */
                if (score != prev_drawn_score) {
                    draw_score_number(score, prev_drawn_score);
                    prev_drawn_score = score;
                }

                if (game_over) {
                    draw_game_over_scoreboard(score, best_score);
                }
            }
        }

        prev_kbd = kbd;

        /* Régulation 60 FPS */
        uint64_t elapsed = eadk_timing_millis() - frame_start;
        if (elapsed < 16) {
            eadk_timing_usleep((uint32_t)((16 - elapsed) * 1000));
        }
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
