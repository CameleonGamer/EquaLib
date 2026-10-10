#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"
#include "storage.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define BOARD_SIZE  4
#define CELL_SIZE   40
#define CELL_GAP    5
#define BOARD_W     (BOARD_SIZE * CELL_SIZE + (BOARD_SIZE + 1) * CELL_GAP)
#define BOARD_X     ((EADK_SCREEN_WIDTH - BOARD_W) / 2)
#define BOARD_Y     28

#define COLOR_APP_BG      0xF7BE  /* Beige clair officiel 2048 */
#define COLOR_CONTAINER   0xB555  /* Conteneur ardoise-marron */
#define COLOR_EMPTY_CELL  0xC5F7  /* Cellule vide */
#define COLOR_TEXT_DARK   0x736C  /* Texte sombre pour 2 et 4 */
#define COLOR_TEXT_LIGHT  0xFFFF  /* Texte blanc pour 8+ */

typedef struct {
    uint16_t bg;
    uint16_t text;
    uint16_t highlight;
    uint16_t shadow;
} tile_theme_t;

static tile_theme_t get_tile_theme(int val) {
    tile_theme_t t;
    switch (val) {
        case 0:
            t.bg = COLOR_EMPTY_CELL; t.text = COLOR_EMPTY_CELL;
            t.highlight = COLOR_EMPTY_CELL; t.shadow = COLOR_EMPTY_CELL;
            break;
        case 2:
            t.bg = 0xEF7B; t.text = COLOR_TEXT_DARK;
            t.highlight = 0xF7BC; t.shadow = 0xDE56;
            break;
        case 4:
            t.bg = 0xEF58; t.text = COLOR_TEXT_DARK;
            t.highlight = 0xF79A; t.shadow = 0xDE35;
            break;
        case 8:
            t.bg = 0xF58F; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFDCF; t.shadow = 0xCA4B;
            break;
        case 16:
            t.bg = 0xF4AC; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFD4E; t.shadow = 0xC968;
            break;
        case 32:
            t.bg = 0xF3EC; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFCAC; t.shadow = 0xC287;
            break;
        case 64:
            t.bg = 0xF2E7; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFBCA; t.shadow = 0xC1C3;
            break;
        case 128:
            t.bg = 0xEE6E; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFF74; t.shadow = 0xBD29;
            break;
        case 256:
            t.bg = 0xEE6C; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFF72; t.shadow = 0xBD27;
            break;
        case 512:
            t.bg = 0xEE4A; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFF50; t.shadow = 0xBD05;
            break;
        case 1024:
            t.bg = 0xEE27; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFF2D; t.shadow = 0xBCE2;
            break;
        case 2048:
            t.bg = 0xEE05; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0xFF40; t.shadow = 0xBA00;
            break;
        default:
            t.bg = 0x39E6; t.text = COLOR_TEXT_LIGHT;
            t.highlight = 0x5AE9; t.shadow = 0x2104;
            break;
    }
    return t;
}

/* ------------------------------------------------------------------------- */
/* Rendu d'une tuile individuelle 40x40 avec biseau et coins arrondis        */
/* ------------------------------------------------------------------------- */
static void draw_tile(int r, int c, int val) {
    int tx = BOARD_X + CELL_GAP + c * (CELL_SIZE + CELL_GAP);
    int ty = BOARD_Y + CELL_GAP + r * (CELL_SIZE + CELL_GAP);

    tile_theme_t t = get_tile_theme(val);

    /* 1. Remplissage principal */
    eadk_rect_t tile_box = {(uint16_t)tx, (uint16_t)ty, CELL_SIZE, CELL_SIZE};
    eadk_display_push_rect_uniform(tile_box, t.bg);

    if (val > 0) {
        /* Biseau haut et gauche éclairé */
        eadk_rect_t hl_top = {(uint16_t)(tx + 1), (uint16_t)ty, (uint16_t)(CELL_SIZE - 2), 1};
        eadk_display_push_rect_uniform(hl_top, t.highlight);
        eadk_rect_t hl_left = {(uint16_t)tx, (uint16_t)(ty + 1), 1, (uint16_t)(CELL_SIZE - 2)};
        eadk_display_push_rect_uniform(hl_left, t.highlight);

        /* Biseau bas et droite sombre */
        eadk_rect_t sh_bot = {(uint16_t)(tx + 1), (uint16_t)(ty + CELL_SIZE - 1), (uint16_t)(CELL_SIZE - 2), 1};
        eadk_display_push_rect_uniform(sh_bot, t.shadow);
        eadk_rect_t sh_right = {(uint16_t)(tx + CELL_SIZE - 1), (uint16_t)(ty + 1), 1, (uint16_t)(CELL_SIZE - 2)};
        eadk_display_push_rect_uniform(sh_right, t.shadow);

        if (val == 2048) {
            eadk_rect_t gold_rim = {(uint16_t)(tx + 2), (uint16_t)(ty + 2), (uint16_t)(CELL_SIZE - 4), 1};
            eadk_display_push_rect_uniform(gold_rim, 0xFFE0);
        }

        /* Coins arrondis */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)tx, (uint16_t)ty, 1, 1}, COLOR_CONTAINER);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(tx + CELL_SIZE - 1), (uint16_t)ty, 1, 1}, COLOR_CONTAINER);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)tx, (uint16_t)(ty + CELL_SIZE - 1), 1, 1}, COLOR_CONTAINER);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(tx + CELL_SIZE - 1), (uint16_t)(ty + CELL_SIZE - 1), 1, 1}, COLOR_CONTAINER);

        /* Texte du nombre centré */
        char val_str[12];
        int str_len = snprintf(val_str, sizeof(val_str), "%d", val);
        if (str_len < 0) str_len = 0;

        bool use_large = (str_len <= 2);
        int char_w = use_large ? 12 : 6;
        int text_w = str_len * char_w;
        int text_x = tx + (CELL_SIZE - text_w) / 2;
        int text_y = ty + (use_large ? 12 : 16);

        eadk_point_t pt = {(uint16_t)text_x, (uint16_t)text_y};
        eadk_display_draw_string(val_str, pt, use_large, t.text, t.bg);
    } else {
        /* Coins arrondis pour cellule vide */
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)tx, (uint16_t)ty, 1, 1}, COLOR_CONTAINER);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(tx + CELL_SIZE - 1), (uint16_t)ty, 1, 1}, COLOR_CONTAINER);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)tx, (uint16_t)(ty + CELL_SIZE - 1), 1, 1}, COLOR_CONTAINER);
        eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(tx + CELL_SIZE - 1), (uint16_t)(ty + CELL_SIZE - 1), 1, 1}, COLOR_CONTAINER);
    }
}

/* ------------------------------------------------------------------------- */
/* Glissement et fusion d'une rangée de 4 éléments vers la gauche            */
/* ------------------------------------------------------------------------- */
static bool slide_row_left(int row[4], int* score) {
    int orig[4];
    for (int i = 0; i < 4; i++) orig[i] = row[i];

    /* 1. Compacter vers la gauche (ignorer les 0) */
    int compact[4] = {0};
    int w = 0;
    for (int i = 0; i < 4; i++) {
        if (row[i] != 0) compact[w++] = row[i];
    }

    /* 2. Fusionner les tuiles identiques adjacentes */
    int merged[4] = {0};
    int m = 0;
    for (int i = 0; i < w; i++) {
        if (i + 1 < w && compact[i] == compact[i + 1]) {
            merged[m] = compact[i] * 2;
            *score += merged[m];
            m++;
            i++; /* Sauter la tuile fusionnée */
        } else {
            merged[m++] = compact[i];
        }
    }

    /* 3. Réécrire la ligne */
    bool changed = false;
    for (int i = 0; i < 4; i++) {
        row[i] = merged[i];
        if (row[i] != orig[i]) changed = true;
    }
    return changed;
}

/* ------------------------------------------------------------------------- */
/* Génération d'une nouvelle tuile (2 ou 4) sur une case vide                */
/* ------------------------------------------------------------------------- */
static void spawn_tile(int grid[BOARD_SIZE][BOARD_SIZE]) {
    int empty_r[16];
    int empty_c[16];
    int empty_cnt = 0;

    for (int r = 0; r < BOARD_SIZE; r++) {
        for (int c = 0; c < BOARD_SIZE; c++) {
            if (grid[r][c] == 0) {
                empty_r[empty_cnt] = r;
                empty_c[empty_cnt] = c;
                empty_cnt++;
            }
        }
    }

    if (empty_cnt > 0) {
        int idx = (int)(eadk_random() % (uint32_t)empty_cnt);
        grid[empty_r[idx]][empty_c[idx]] = ((eadk_random() % 10) == 0) ? 4 : 2;
    }
}

/* ------------------------------------------------------------------------- */
/* Vérification si un mouvement est encore possible                          */
/* ------------------------------------------------------------------------- */
static bool can_move(const int grid[BOARD_SIZE][BOARD_SIZE]) {
    for (int r = 0; r < BOARD_SIZE; r++) {
        for (int c = 0; c < BOARD_SIZE; c++) {
            if (grid[r][c] == 0) return true;
            if (c + 1 < BOARD_SIZE && grid[r][c] == grid[r][c + 1]) return true;
            if (r + 1 < BOARD_SIZE && grid[r][c] == grid[r + 1][c]) return true;
        }
    }
    return false;
}

/* ------------------------------------------------------------------------- */
/* Application 2048 Ultimate Principale                                      */
/* ------------------------------------------------------------------------- */
void run_2048_app(void) {
    int wait_cycles = 0;
    while (eadk_keyboard_scan() != 0 && wait_cycles < 25) {
        eadk_timing_msleep(20);
        wait_cycles++;
    }

    int grid[BOARD_SIZE][BOARD_SIZE] = {{0}};
    int score = 0;
    int best_score = eq_storage_get()->record_2048;
    int prev_drawn_score = -1;
    bool game_over = false;

    eadk_keyboard_state_t prev_kbd = 0;

    /* Rendu complet initial */
    eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_APP_BG);

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
    eadk_display_push_rect_uniform(top_bar, 0xFE60);
    eadk_point_t pt_title = {8, 5};
    eadk_display_draw_string("2048 Ultimate", pt_title, false, eadk_color_black, 0xFE60);

    /* Conteneur principal de la grille */
    eadk_rect_t container_box = {
        (uint16_t)BOARD_X,
        (uint16_t)BOARD_Y,
        (uint16_t)BOARD_W,
        (uint16_t)BOARD_W
    };
    eadk_display_push_rect_uniform(container_box, COLOR_CONTAINER);

    /* Biseau du conteneur */
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)BOARD_X, (uint16_t)BOARD_Y, (uint16_t)BOARD_W, 1}, 0x9CD3);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)BOARD_X, (uint16_t)BOARD_Y, 1, (uint16_t)BOARD_W}, 0x9CD3);

    /* Barre inférieure */
    eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
    eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
    eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
    eadk_display_draw_string("Fleches: Glisser  |  OK: Rejouer  |  BACK: Hub", pt_help, false, 0x4208, eadk_color_white);

    /* Initialisation du plateau */
    spawn_tile(grid);
    spawn_tile(grid);

    for (int r = 0; r < BOARD_SIZE; r++) {
        for (int c = 0; c < BOARD_SIZE; c++) {
            draw_tile(r, c, grid[r][c]);
        }
    }

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

        if (game_over) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                for (int r = 0; r < BOARD_SIZE; r++) {
                    for (int c = 0; c < BOARD_SIZE; c++) {
                        grid[r][c] = 0;
                    }
                }
                score = 0;
                prev_drawn_score = -1;
                game_over = false;
                spawn_tile(grid);
                spawn_tile(grid);
                for (int r = 0; r < BOARD_SIZE; r++) {
                    for (int c = 0; c < BOARD_SIZE; c++) {
                        draw_tile(r, c, grid[r][c]);
                    }
                }
            }
        } else {
            bool moved = false;

            if (eadk_keyboard_key_down(pressed, eadk_key_left) ||
                eadk_keyboard_key_down(pressed, eadk_key_four)) {
                for (int r = 0; r < BOARD_SIZE; r++) {
                    if (slide_row_left(grid[r], &score)) moved = true;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_right) ||
                       eadk_keyboard_key_down(pressed, eadk_key_six)) {
                for (int r = 0; r < BOARD_SIZE; r++) {
                    int rev[4] = {grid[r][3], grid[r][2], grid[r][1], grid[r][0]};
                    if (slide_row_left(rev, &score)) {
                        grid[r][0] = rev[3];
                        grid[r][1] = rev[2];
                        grid[r][2] = rev[1];
                        grid[r][3] = rev[0];
                        moved = true;
                    }
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up) ||
                       eadk_keyboard_key_down(pressed, eadk_key_eight)) {
                for (int c = 0; c < BOARD_SIZE; c++) {
                    int col[4] = {grid[0][c], grid[1][c], grid[2][c], grid[3][c]};
                    if (slide_row_left(col, &score)) {
                        grid[0][c] = col[0];
                        grid[1][c] = col[1];
                        grid[2][c] = col[2];
                        grid[3][c] = col[3];
                        moved = true;
                    }
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_down) ||
                       eadk_keyboard_key_down(pressed, eadk_key_two)) {
                for (int c = 0; c < BOARD_SIZE; c++) {
                    int col[4] = {grid[3][c], grid[2][c], grid[1][c], grid[0][c]};
                    if (slide_row_left(col, &score)) {
                        grid[0][c] = col[3];
                        grid[1][c] = col[2];
                        grid[2][c] = col[1];
                        grid[3][c] = col[0];
                        moved = true;
                    }
                }
            }

            if (moved) {
                if (score > best_score) {
                    best_score = score;
                    eq_storage_get()->record_2048 = best_score;
                    eq_storage_commit();
                }
                spawn_tile(grid);
                for (int r = 0; r < BOARD_SIZE; r++) {
                    for (int c = 0; c < BOARD_SIZE; c++) {
                        draw_tile(r, c, grid[r][c]);
                    }
                }

                if (!can_move(grid)) {
                    game_over = true;
                    eadk_rect_t gov_box = {55, 95, 210, 56};
                    eadk_display_push_rect_uniform(gov_box, 0xFFFF);
                    eadk_rect_t gov_inner = {57, 97, 206, 52};
                    eadk_display_push_rect_uniform(gov_inner, 0x0000);

                    eadk_point_t pt_g1 = {106, 103};
                    eadk_display_draw_string("GAME OVER", pt_g1, true, 0xF800, 0x0000);
                    eadk_point_t pt_g2 = {74, 129};
                    eadk_display_draw_string("OK: Rejouer | BACK: Hub", pt_g2, false, 0xFFFF, 0x0000);
                }
            }
        }

        /* Mise à jour du score si nécessaire */
        if (score != prev_drawn_score) {
            prev_drawn_score = score;
            char score_str[32];
            snprintf(score_str, sizeof(score_str), "Score: %d  Max: %d", score, best_score);

            eadk_rect_t score_bg = {160, 0, 155, 22};
            eadk_display_push_rect_uniform(score_bg, 0xFE60);

            eadk_point_t pt_score = {165, 5};
            eadk_display_draw_string(score_str, pt_score, false, eadk_color_black, 0xFE60);
        }

        prev_kbd = kbd;
        eadk_timing_msleep(20);
    }

    int exit_cycles = 0;
    while (eadk_keyboard_scan() != 0 && exit_cycles < 25) {
        eadk_timing_msleep(20);
        exit_cycles++;
    }
}
