#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define GRID_W       9
#define GRID_H       9
#define TOTAL_MINES  10
#define CELL_SIZE    18
#define BOARD_X      79
#define BOARD_Y      50

/* Couleurs Windows 95 authentiques */
#define WIN95_BG         0xC618  /* Gris boîte de dialogue standard */
#define WIN95_HI         0xFFFF  /* Blanc lumière biseau 3D */
#define WIN95_SHADOW     0x8410  /* Gris foncé ombre biseau 3D */
#define WIN95_DARK       0x0000  /* Noir contour extrême */
#define WIN95_INSET_BG   0x0000  /* Noir fond compteur digital */
#define WIN95_LED_RED    0xF800  /* Rouge LED 7 segments */
#define WIN95_FACE_YEL   0xFFE0  /* Jaune smiley */

typedef struct {
    bool has_mine;
    bool is_revealed;
    bool is_flagged;
    uint8_t count;
} cell_t;

/* Couleurs officielles des chiffres 1 à 8 */
static const uint16_t NUM_COLORS[9] = {
    0x0000,
    0x001F, /* 1: Bleu */
    0x0400, /* 2: Vert */
    0xF800, /* 3: Rouge */
    0x0010, /* 4: Bleu nuit */
    0x8000, /* 5: Marron */
    0x0410, /* 6: Sarcelle */
    0x0000, /* 7: Noir */
    0x8410  /* 8: Gris */
};

/* ------------------------------------------------------------------------- */
/* Sprites Authentiques Windows 95 (14x14 Pixels)                            */
/* ------------------------------------------------------------------------- */
#define M_TR 0x0001 /* Transparent */
#define M_BK 0x0000 /* Noir */
#define M_WT 0xFFFF /* Blanc éclat */
#define M_RD 0xF800 /* Rouge */
#define M_OR 0xFA60 /* Orange étincelle */
#define M_GY 0x8410 /* Gris ombre */

/* Sprite Bombe Authentique 14x14 */
static const uint16_t s_sprite_mine[14][14] = {
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_OR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_BK,M_TR,M_TR,M_BK,M_BK,M_BK,M_TR,M_TR,M_BK,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_BK,M_BK,M_WT,M_WT,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR},
    {M_TR,M_BK,M_BK,M_WT,M_WT,M_WT,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR,M_TR},
    {M_BK,M_BK,M_BK,M_WT,M_WT,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR},
    {M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR},
    {M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR},
    {M_TR,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR,M_TR},
    {M_TR,M_TR,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_BK,M_TR,M_TR,M_BK,M_BK,M_BK,M_TR,M_TR,M_BK,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR}
};

/* Sprite Drapeau Rouge Authentique 14x14 */
static const uint16_t s_sprite_flag[14][14] = {
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_RD,M_RD,M_RD,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_RD,M_RD,M_RD,M_RD,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_RD,M_RD,M_RD,M_RD,M_RD,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_RD,M_RD,M_RD,M_RD,M_RD,M_RD,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_RD,M_RD,M_RD,M_RD,M_RD,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_RD,M_RD,M_RD,M_RD,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_RD,M_RD,M_RD,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_BK,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_BK,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_BK,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_BK,M_TR,M_TR,M_TR},
    {M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR,M_TR}
};

/* ------------------------------------------------------------------------- */
/* Rendu d'une cellule individuelle (relief ou pressée)                      */
/* ------------------------------------------------------------------------- */
static void draw_cell(int r, int c, const cell_t* cell, bool has_cursor, bool exploded_mine) {
    int cx = BOARD_X + c * CELL_SIZE;
    int cy = BOARD_Y + r * CELL_SIZE;

    if (!cell->is_revealed) {
        /* Case non révélée en relief 3D (bouton physique) */
        eadk_rect_t cell_body = {(uint16_t)cx, (uint16_t)cy, CELL_SIZE, CELL_SIZE};
        eadk_display_push_rect_uniform(cell_body, WIN95_BG);

        /* Biseau 2px lumière (haut et gauche) */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)cx, (uint16_t)cy, CELL_SIZE, 2}, WIN95_HI);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)cx, (uint16_t)cy, 2, CELL_SIZE}, WIN95_HI);

        /* Biseau 2px ombre (bas et droite) */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)cx, (uint16_t)(cy + CELL_SIZE - 2), CELL_SIZE, 2}, WIN95_SHADOW);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(cx + CELL_SIZE - 2), (uint16_t)cy, 2, CELL_SIZE}, WIN95_SHADOW);

        /* Drapeau rouge */
        if (cell->is_flagged) {
            uint16_t buf[14 * 14];
            for (int row = 0; row < 14; row++) {
                for (int col = 0; col < 14; col++) {
                    uint16_t p = s_sprite_flag[row][col];
                    buf[row * 14 + col] = (p == M_TR) ? WIN95_BG : p;
                }
            }
            eadk_rect_t flag_r = {(uint16_t)(cx + 2), (uint16_t)(cy + 2), 14, 14};
            eadk_display_push_rect(flag_r, buf);
        }
    } else {
        /* Case révélée (enfoncée / plate) */
        uint16_t bg_col = (exploded_mine) ? WIN95_LED_RED : WIN95_BG;
        eadk_rect_t cell_body = {(uint16_t)cx, (uint16_t)cy, CELL_SIZE, CELL_SIZE};
        eadk_display_push_rect_uniform(cell_body, bg_col);

        /* Contour fin 1px enfoncé */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)cx, (uint16_t)cy, CELL_SIZE, 1}, WIN95_SHADOW);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)cx, (uint16_t)cy, 1, CELL_SIZE}, WIN95_SHADOW);

        if (cell->has_mine) {
            /* Bombe */
            uint16_t buf[14 * 14];
            for (int row = 0; row < 14; row++) {
                for (int col = 0; col < 14; col++) {
                    uint16_t p = s_sprite_mine[row][col];
                    buf[row * 14 + col] = (p == M_TR) ? bg_col : p;
                }
            }
            eadk_rect_t mine_r = {(uint16_t)(cx + 2), (uint16_t)(cy + 2), 14, 14};
            eadk_display_push_rect(mine_r, buf);
        } else if (cell->count > 0) {
            /* Chiffre 1 à 8 */
            char ch[2] = {'0' + cell->count, '\0'};
            eadk_point_t pt = {(uint16_t)(cx + 6), (uint16_t)(cy + 3)};
            eadk_display_draw_string(ch, pt, true, NUM_COLORS[cell->count], bg_col);
        }
    }

    /* Cadre de surbrillance du curseur (2px jaune vif ou bleu) */
    if (has_cursor) {
        uint16_t cur_col = 0xFE60; /* Jaune or NumWorks */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(cx + 2), (uint16_t)(cy + 2), (uint16_t)(CELL_SIZE - 4), 2}, cur_col);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(cx + 2), (uint16_t)(cy + CELL_SIZE - 4), (uint16_t)(CELL_SIZE - 4), 2}, cur_col);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(cx + 2), (uint16_t)(cy + 2), 2, (uint16_t)(CELL_SIZE - 4)}, cur_col);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(cx + CELL_SIZE - 4), (uint16_t)(cy + 2), 2, (uint16_t)(CELL_SIZE - 4)}, cur_col);
    }
}

/* ------------------------------------------------------------------------- */
/* Bouton Smiley Authentique Windows 95 (Normal, Choc, Victoire, Mort)      */
/* ------------------------------------------------------------------------- */
typedef enum { SMILEY_NORMAL, SMILEY_SHOCKED, SMILEY_WIN, SMILEY_LOSE } smiley_t;

static void draw_smiley(smiley_t state) {
    int sx = 148;
    int sy = 26;
    int sw = 24;

    /* Bouton en relief 3D */
    eadk_rect_t s_box = {(uint16_t)sx, (uint16_t)sy, (uint16_t)sw, (uint16_t)sw};
    eadk_display_push_rect_uniform(s_box, WIN95_BG);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)sx, (uint16_t)sy, (uint16_t)sw, 2}, WIN95_HI);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)sx, (uint16_t)sy, 2, (uint16_t)sw}, WIN95_HI);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)sx, (uint16_t)(sy + sw - 2), (uint16_t)sw, 2}, WIN95_SHADOW);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + sw - 2), (uint16_t)sy, 2, (uint16_t)sw}, WIN95_SHADOW);

    /* Visage jaune */
    eadk_rect_t face = {(uint16_t)(sx + 4), (uint16_t)(sy + 4), 16, 16};
    eadk_display_push_rect_uniform(face, WIN95_FACE_YEL);

    /* Yeux et bouche selon l'état */
    if (state == SMILEY_NORMAL) {
        /* Deux yeux et sourire */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 7), (uint16_t)(sy + 8), 2, 3}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 15), (uint16_t)(sy + 8), 2, 3}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 8), (uint16_t)(sy + 15), 8, 2}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 7), (uint16_t)(sy + 14), 2, 2}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 15), (uint16_t)(sy + 14), 2, 2}, WIN95_DARK);
    } else if (state == SMILEY_SHOCKED) {
        /* Yeux écarquillés et bouche ronde :o */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 7), (uint16_t)(sy + 8), 2, 3}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 15), (uint16_t)(sy + 8), 2, 3}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 10), (uint16_t)(sy + 13), 4, 4}, WIN95_DARK);
    } else if (state == SMILEY_WIN) {
        /* Lunettes de soleil cool B) */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 6), (uint16_t)(sy + 7), 12, 4}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 7), (uint16_t)(sy + 11), 3, 2}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 14), (uint16_t)(sy + 11), 3, 2}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 9), (uint16_t)(sy + 15), 6, 2}, WIN95_DARK);
    } else if (state == SMILEY_LOSE) {
        /* Yeux en X et bouche triste */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 7), (uint16_t)(sy + 8), 3, 3}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 14), (uint16_t)(sy + 8), 3, 3}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 8), (uint16_t)(sy + 15), 8, 2}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 7), (uint16_t)(sy + 16), 2, 2}, WIN95_DARK);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(sx + 15), (uint16_t)(sy + 16), 2, 2}, WIN95_DARK);
    }
}

/* ------------------------------------------------------------------------- */
/* Compteur Digital 7 Segments Authentique (Mines & Temps)                   */
/* ------------------------------------------------------------------------- */
static void draw_digital_counter(int x, int y, int value) {
    if (value < 0) value = 0;
    if (value > 999) value = 999;

    /* Cadre enfoncé noir */
    eadk_rect_t box = {(uint16_t)x, (uint16_t)y, 42, 22};
    eadk_display_push_rect_uniform(box, WIN95_INSET_BG);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)x, (uint16_t)y, 42, 1}, WIN95_SHADOW);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)x, (uint16_t)y, 1, 22}, WIN95_SHADOW);

    char str[8];
    snprintf(str, sizeof(str), "%03d", value);
    eadk_point_t pt = {(uint16_t)(x + 4), (uint16_t)(y + 3)};
    eadk_display_draw_string(str, pt, true, WIN95_LED_RED, WIN95_INSET_BG);
}

/* ------------------------------------------------------------------------- */
/* Logique de Génération et Flood-Fill                                       */
/* ------------------------------------------------------------------------- */
static void init_mines(cell_t grid[GRID_H][GRID_W], int safe_r, int safe_c) {
    int placed = 0;
    while (placed < TOTAL_MINES) {
        int r = (int)(eadk_random() % GRID_H);
        int c = (int)(eadk_random() % GRID_W);

        /* Zone d'ouverture garantie autour du premier clic */
        if (r >= safe_r - 1 && r <= safe_r + 1 && c >= safe_c - 1 && c <= safe_c + 1) {
            continue;
        }

        if (!grid[r][c].has_mine) {
            grid[r][c].has_mine = true;
            placed++;
        }
    }

    for (int r = 0; r < GRID_H; r++) {
        for (int c = 0; c < GRID_W; c++) {
            if (grid[r][c].has_mine) continue;
            uint8_t cnt = 0;
            for (int dr = -1; dr <= 1; dr++) {
                for (int dc = -1; dc <= 1; dc++) {
                    int nr = r + dr;
                    int nc = c + dc;
                    if (nr >= 0 && nr < GRID_H && nc >= 0 && nc < GRID_W) {
                        if (grid[nr][nc].has_mine) cnt++;
                    }
                }
            }
            grid[r][c].count = cnt;
        }
    }
}

static void reveal_empty(cell_t grid[GRID_H][GRID_W], int start_r, int start_c, int* revealed_count) {
    uint8_t queue_r[GRID_W * GRID_H];
    uint8_t queue_c[GRID_W * GRID_H];
    int head = 0;
    int tail = 0;

    queue_r[tail] = (uint8_t)start_r;
    queue_c[tail] = (uint8_t)start_c;
    tail++;

    while (head < tail) {
        int r = queue_r[head];
        int c = queue_c[head];
        head++;

        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                int nr = r + dr;
                int nc = c + dc;
                if (nr >= 0 && nr < GRID_H && nc >= 0 && nc < GRID_W) {
                    if (!grid[nr][nc].is_revealed && !grid[nr][nc].is_flagged && !grid[nr][nc].has_mine) {
                        grid[nr][nc].is_revealed = true;
                        (*revealed_count)++;
                        draw_cell(nr, nc, &grid[nr][nc], false, false);
                        if (grid[nr][nc].count == 0) {
                            queue_r[tail] = (uint8_t)nr;
                            queue_c[tail] = (uint8_t)nc;
                            tail++;
                        }
                    }
                }
            }
        }
    }
}

/* ------------------------------------------------------------------------- */
/* Application Démineur NumWorks Principale                                  */
/* ------------------------------------------------------------------------- */
void run_minesweeper_app(void) {
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    cell_t grid[GRID_H][GRID_W];
    for (int r = 0; r < GRID_H; r++) {
        for (int c = 0; c < GRID_W; c++) {
            grid[r][c].has_mine = false;
            grid[r][c].is_revealed = false;
            grid[r][c].is_flagged = false;
            grid[r][c].count = 0;
        }
    }

    int cursor_r = 4;
    int cursor_c = 4;
    int prev_cursor_r = 4;
    int prev_cursor_c = 4;

    int revealed_count = 0;
    int flags_count = 0;
    int hit_mine_r = -1;
    int hit_mine_c = -1;

    bool first_click = true;
    bool game_over = false;
    bool win = false;

    uint64_t start_time = 0;
    int prev_elapsed = -1;
    int prev_mines_left = -1;

    eadk_keyboard_state_t prev_kbd = 0;

    /* Rendu complet initial de la fenêtre Windows 95 (UNE SEULE FOIS pour 0 scintillement) */
    eadk_display_push_rect_uniform(eadk_screen_rect, WIN95_BG);

    /* Barre supérieure de l'application */
    eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
    eadk_display_push_rect_uniform(top_bar, 0xFE60);
    eadk_point_t pt_title = {8, 5};
    eadk_display_draw_string("Demineur NumWorks (Win95)", pt_title, false, eadk_color_black, 0xFE60);

    /* Encadrement global du démineur Windows 95 */
    int frame_x = BOARD_X - 6;
    int frame_y = 22;
    int frame_w = GRID_W * CELL_SIZE + 12;
    int frame_h = (BOARD_Y + GRID_H * CELL_SIZE + 6) - frame_y;

    /* Biseau extérieur 3D */
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)frame_x, (uint16_t)frame_y, (uint16_t)frame_w, 2}, WIN95_HI);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)frame_x, (uint16_t)frame_y, 2, (uint16_t)frame_h}, WIN95_HI);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)frame_x, (uint16_t)(frame_y + frame_h - 2), (uint16_t)frame_w, 2}, WIN95_SHADOW);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(frame_x + frame_w - 2), (uint16_t)frame_y, 2, (uint16_t)frame_h}, WIN95_SHADOW);

    /* Cadre intérieur de la grille (enfoncé) */
    int gb_x = BOARD_X - 3;
    int gb_y = BOARD_Y - 3;
    int gb_w = GRID_W * CELL_SIZE + 6;
    int gb_h = GRID_H * CELL_SIZE + 6;
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)gb_x, (uint16_t)gb_y, (uint16_t)gb_w, 2}, WIN95_SHADOW);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)gb_x, (uint16_t)gb_y, 2, (uint16_t)gb_h}, WIN95_SHADOW);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)gb_x, (uint16_t)(gb_y + gb_h - 2), (uint16_t)gb_w, 2}, WIN95_HI);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(gb_x + gb_w - 2), (uint16_t)gb_y, 2, (uint16_t)gb_h}, WIN95_HI);

    /* Barre inférieure */
    eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
    eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
    eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
    eadk_display_draw_string("OK: Reveler  |  Toolbox: Drapeau  |  BACK: Hub  |  Var: Furtif", pt_help, false, 0x4208, eadk_color_white);

    /* Compteurs et Smiley */
    draw_digital_counter(BOARD_X, 27, TOTAL_MINES - flags_count);
    draw_smiley(SMILEY_NORMAL);
    draw_digital_counter(BOARD_X + GRID_W * CELL_SIZE - 42, 27, 0);

    /* Tracé de toutes les cellules initiales */
    for (int r = 0; r < GRID_H; r++) {
        for (int c = 0; c < GRID_W; c++) {
            draw_cell(r, c, &grid[r][c], (r == cursor_r && c == cursor_c), false);
        }
    }

    while (true) {
        uint64_t frame_start = eadk_timing_millis();

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
            /* Forcer le rafraîchissement complet */
            eadk_display_push_rect_uniform(eadk_screen_rect, WIN95_BG);
            eadk_display_push_rect_uniform(top_bar, 0xFE60);
            eadk_display_draw_string("Demineur NumWorks (Win95)", pt_title, false, eadk_color_black, 0xFE60);
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
            eadk_display_draw_string("OK: Reveler  |  Toolbox: Drapeau  |  BACK: Hub  |  Var: Furtif", pt_help, false, 0x4208, eadk_color_white);
            draw_smiley(win ? SMILEY_WIN : (game_over ? SMILEY_LOSE : SMILEY_NORMAL));
            prev_elapsed = -1;
            prev_mines_left = -1;
            for (int r = 0; r < GRID_H; r++) {
                for (int c = 0; c < GRID_W; c++) {
                    draw_cell(r, c, &grid[r][c], (r == cursor_r && c == cursor_c), (r == hit_mine_r && c == hit_mine_c));
                }
            }
            continue;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        if (game_over || win) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                /* Réinitialisation complète */
                for (int r = 0; r < GRID_H; r++) {
                    for (int c = 0; c < GRID_W; c++) {
                        grid[r][c].has_mine = false;
                        grid[r][c].is_revealed = false;
                        grid[r][c].is_flagged = false;
                        grid[r][c].count = 0;
                    }
                }
                cursor_r = 4;
                cursor_c = 4;
                prev_cursor_r = 4;
                prev_cursor_c = 4;
                revealed_count = 0;
                flags_count = 0;
                first_click = true;
                game_over = false;
                win = false;
                hit_mine_r = -1;
                hit_mine_c = -1;
                start_time = 0;
                prev_elapsed = -1;
                prev_mines_left = -1;

                draw_smiley(SMILEY_NORMAL);
                for (int r = 0; r < GRID_H; r++) {
                    for (int c = 0; c < GRID_W; c++) {
                        draw_cell(r, c, &grid[r][c], (r == cursor_r && c == cursor_c), false);
                    }
                }
            }
        } else {
            /* 1. Déplacement du curseur (Dirty-Cell : mise à jour de 2 cellules uniquement !) */
            prev_cursor_r = cursor_r;
            prev_cursor_c = cursor_c;

            if (eadk_keyboard_key_down(pressed, eadk_key_up) && cursor_r > 0) cursor_r--;
            else if (eadk_keyboard_key_down(pressed, eadk_key_down) && cursor_r < GRID_H - 1) cursor_r++;
            else if (eadk_keyboard_key_down(pressed, eadk_key_left) && cursor_c > 0) cursor_c--;
            else if (eadk_keyboard_key_down(pressed, eadk_key_right) && cursor_c < GRID_W - 1) cursor_c++;

            if (cursor_r != prev_cursor_r || cursor_c != prev_cursor_c) {
                draw_cell(prev_cursor_r, prev_cursor_c, &grid[prev_cursor_r][prev_cursor_c], false, false);
                draw_cell(cursor_r, cursor_c, &grid[cursor_r][cursor_c], true, false);
            }

            /* 2. Révélation d'une cellule */
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                if (!grid[cursor_r][cursor_c].is_flagged && !grid[cursor_r][cursor_c].is_revealed) {
                    if (first_click) {
                        init_mines(grid, cursor_r, cursor_c);
                        first_click = false;
                        start_time = eadk_timing_millis();
                    }

                    if (grid[cursor_r][cursor_c].has_mine) {
                        game_over = true;
                        hit_mine_r = cursor_r;
                        hit_mine_c = cursor_c;
                        draw_smiley(SMILEY_LOSE);

                        /* Révéler toutes les mines */
                        for (int r = 0; r < GRID_H; r++) {
                            for (int c = 0; c < GRID_W; c++) {
                                if (grid[r][c].has_mine) {
                                    grid[r][c].is_revealed = true;
                                    draw_cell(r, c, &grid[r][c], (r == cursor_r && c == cursor_c), (r == hit_mine_r && c == hit_mine_c));
                                }
                            }
                        }
                    } else {
                        grid[cursor_r][cursor_c].is_revealed = true;
                        revealed_count++;
                        draw_cell(cursor_r, cursor_c, &grid[cursor_r][cursor_c], true, false);

                        if (grid[cursor_r][cursor_c].count == 0) {
                            reveal_empty(grid, cursor_r, cursor_c, &revealed_count);
                        }

                        if (revealed_count >= (GRID_W * GRID_H - TOTAL_MINES)) {
                            win = true;
                            draw_smiley(SMILEY_WIN);
                        }
                    }
                }
            }

            /* 3. Poser / Retirer un drapeau */
            if (eadk_keyboard_key_down(pressed, eadk_key_toolbox) ||
                eadk_keyboard_key_down(pressed, eadk_key_shift) ||
                eadk_keyboard_key_down(pressed, eadk_key_ans)) {
                if (!grid[cursor_r][cursor_c].is_revealed) {
                    grid[cursor_r][cursor_c].is_flagged = !grid[cursor_r][cursor_c].is_flagged;
                    if (grid[cursor_r][cursor_c].is_flagged) flags_count++;
                    else flags_count--;
                    draw_cell(cursor_r, cursor_c, &grid[cursor_r][cursor_c], true, false);
                }
            }
        }

        /* 4. Mise à jour des compteurs digitaux uniquement en cas de changement */
        int cur_mines_left = TOTAL_MINES - flags_count;
        if (cur_mines_left != prev_mines_left) {
            prev_mines_left = cur_mines_left;
            draw_digital_counter(BOARD_X, 27, cur_mines_left);
        }

        int cur_elapsed = first_click ? 0 : (int)((eadk_timing_millis() - start_time) / 1000);
        if (cur_elapsed != prev_elapsed && !game_over && !win) {
            prev_elapsed = cur_elapsed;
            draw_digital_counter(BOARD_X + GRID_W * CELL_SIZE - 42, 27, cur_elapsed);
        }

        prev_kbd = kbd;

        /* Pause fluide pour scruter le clavier sans surcharger le processeur */
        eadk_timing_msleep(15);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
