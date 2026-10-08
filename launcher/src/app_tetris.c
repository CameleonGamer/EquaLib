#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define BOARD_COLS 10
#define BOARD_ROWS 20
#define CELL_SIZE  10
#define BOARD_X    36
#define BOARD_Y    24
#define PANEL_X    150

#define COLOR_APP_BG     0x18C3  /* Fond ardoise foncé */
#define COLOR_BOARD_BG   0x0841  /* Fond plateau noir-bleu */
#define COLOR_GRID_LINE  0x10A2  /* Grille subtile */
#define COLOR_PANEL_BG   0x2124  /* Panneau latéral */
#define COLOR_BORDER_HI  0xFFFF  /* Biseau lumière */
#define COLOR_BORDER_LO  0x0841  /* Biseau ombre */

/* ------------------------------------------------------------------------- */
/* Couleurs 3D des 7 Tétraminos (Biseau clair, base, biseau sombre, centre)  */
/* ------------------------------------------------------------------------- */
typedef struct {
    uint16_t light;
    uint16_t base;
    uint16_t dark;
    uint16_t center;
} block_theme_t;

static const block_theme_t BLOCK_THEMES[8] = {
    {COLOR_GRID_LINE, COLOR_BOARD_BG, COLOR_BOARD_BG, COLOR_BOARD_BG}, /* 0: Vide */
    {0x87FF, 0x073F, 0x03B5, 0xCEBF}, /* 1: I (Cyan) */
    {0xFFE8, 0xFEC0, 0xBA00, 0xFFF4}, /* 2: O (Jaune) */
    {0xE9DF, 0xD01F, 0x8817, 0xFA3F}, /* 3: T (Violet) */
    {0x77EE, 0x072E, 0x04C6, 0xAFEF}, /* 4: S (Vert) */
    {0xFCAD, 0xF8A6, 0x9863, 0xFDCF}, /* 5: Z (Rouge) */
    {0x8E1F, 0x2BEF, 0x124E, 0xBF1F}, /* 6: J (Bleu) */
    {0xFEA8, 0xFC80, 0xB320, 0xFF34}  /* 7: L (Orange) */
};

/* Formes des 7 tétraminos en 4 rotations */
static const int8_t PIECES[7][4][4][2] = {
    /* 0: I */
    {
        {{0,1}, {1,1}, {2,1}, {3,1}},
        {{2,0}, {2,1}, {2,2}, {2,3}},
        {{0,2}, {1,2}, {2,2}, {3,2}},
        {{1,0}, {1,1}, {1,2}, {1,3}}
    },
    /* 1: O */
    {
        {{1,0}, {2,0}, {1,1}, {2,1}},
        {{1,0}, {2,0}, {1,1}, {2,1}},
        {{1,0}, {2,0}, {1,1}, {2,1}},
        {{1,0}, {2,0}, {1,1}, {2,1}}
    },
    /* 2: T */
    {
        {{1,0}, {0,1}, {1,1}, {2,1}},
        {{1,0}, {1,1}, {2,1}, {1,2}},
        {{0,1}, {1,1}, {2,1}, {1,2}},
        {{1,0}, {0,1}, {1,1}, {1,2}}
    },
    /* 3: S */
    {
        {{1,0}, {2,0}, {0,1}, {1,1}},
        {{1,0}, {1,1}, {2,1}, {2,2}},
        {{1,1}, {2,1}, {0,2}, {1,2}},
        {{0,0}, {0,1}, {1,1}, {1,2}}
    },
    /* 4: Z */
    {
        {{0,0}, {1,0}, {1,1}, {2,1}},
        {{2,0}, {1,1}, {2,1}, {1,2}},
        {{0,1}, {1,1}, {1,2}, {2,2}},
        {{1,0}, {0,1}, {1,1}, {0,2}}
    },
    /* 5: J */
    {
        {{0,0}, {0,1}, {1,1}, {2,1}},
        {{1,0}, {2,0}, {1,1}, {1,2}},
        {{0,1}, {1,1}, {2,1}, {2,2}},
        {{1,0}, {1,1}, {0,2}, {1,2}}
    },
    /* 6: L */
    {
        {{2,0}, {0,1}, {1,1}, {2,1}},
        {{1,0}, {1,1}, {1,2}, {2,2}},
        {{0,1}, {1,1}, {2,1}, {0,2}},
        {{0,0}, {1,0}, {1,1}, {1,2}}
    }
};

/* ------------------------------------------------------------------------- */
/* Rendu d'un bloc biseauté 10x10 Pixels                                      */
/* ------------------------------------------------------------------------- */
static void draw_block_10x10(int px, int py, int color_id) {
    const block_theme_t* t = &BLOCK_THEMES[color_id];
    uint16_t buf[CELL_SIZE * CELL_SIZE];

    if (color_id == 0) {
        /* Cellule vide avec bordure quadrillage discrète */
        for (int r = 0; r < CELL_SIZE; r++) {
            for (int c = 0; c < CELL_SIZE; c++) {
                if (r == 0 || c == 0) buf[r * CELL_SIZE + c] = COLOR_GRID_LINE;
                else buf[r * CELL_SIZE + c] = COLOR_BOARD_BG;
            }
        }
    } else {
        /* Bloc 3D authentique biseauté style arcade */
        for (int r = 0; r < CELL_SIZE; r++) {
            for (int c = 0; c < CELL_SIZE; c++) {
                if (r == 0 || c == 0 || (r == 1 && c >= 1 && c <= 8) || (c == 1 && r >= 1 && r <= 8)) {
                    buf[r * CELL_SIZE + c] = t->light;
                } else if (r == CELL_SIZE - 1 || c == CELL_SIZE - 1 || (r == CELL_SIZE - 2 && c >= 1) || (c == CELL_SIZE - 2 && r >= 1)) {
                    buf[r * CELL_SIZE + c] = t->dark;
                } else if (r >= 3 && r <= 6 && c >= 3 && c <= 6) {
                    buf[r * CELL_SIZE + c] = t->center;
                } else {
                    buf[r * CELL_SIZE + c] = t->base;
                }
            }
        }
    }

    eadk_rect_t rect = {(uint16_t)px, (uint16_t)py, CELL_SIZE, CELL_SIZE};
    eadk_display_push_rect(rect, buf);
}

/* Dessin d'une cellule du plateau */
static void draw_board_cell(int c, int r, int color_id) {
    draw_block_10x10(BOARD_X + c * CELL_SIZE, BOARD_Y + r * CELL_SIZE, color_id);
}

/* Détection de collision */
static bool check_collision(const uint8_t board[BOARD_ROWS][BOARD_COLS], int piece, int rot, int px, int py) {
    for (int i = 0; i < 4; i++) {
        int x = px + PIECES[piece][rot][i][0];
        int y = py + PIECES[piece][rot][i][1];

        if (x < 0 || x >= BOARD_COLS || y >= BOARD_ROWS) return true;
        if (y >= 0 && board[y][x] != 0) return true;
    }
    return false;
}

/* Effacer une pièce active à sa position */
static void erase_piece(const uint8_t board[BOARD_ROWS][BOARD_COLS], int piece, int rot, int px, int py) {
    for (int i = 0; i < 4; i++) {
        int x = px + PIECES[piece][rot][i][0];
        int y = py + PIECES[piece][rot][i][1];
        if (x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS) {
            draw_board_cell(x, y, board[y][x]);
        }
    }
}

/* Dessiner une pièce active à sa position */
static void draw_piece(int piece, int rot, int px, int py) {
    for (int i = 0; i < 4; i++) {
        int x = px + PIECES[piece][rot][i][0];
        int y = py + PIECES[piece][rot][i][1];
        if (x >= 0 && x < BOARD_COLS && y >= 0 && y < BOARD_ROWS) {
            draw_board_cell(x, y, piece + 1);
        }
    }
}

/* Rendu de l'aperçu de la pièce suivante dans le panneau latéral */
static void draw_next_preview(int next_p) {
    int box_x = PANEL_X + 16;
    int box_y = BOARD_Y + 28;
    int box_w = 48;
    int box_h = 42;

    eadk_rect_t p_bg = {(uint16_t)box_x, (uint16_t)box_y, (uint16_t)box_w, (uint16_t)box_h};
    eadk_display_push_rect_uniform(p_bg, COLOR_BOARD_BG);

    /* Encadrement de l'aperçu */
    eadk_rect_t p_border = {(uint16_t)(box_x - 1), (uint16_t)(box_y - 1), (uint16_t)(box_w + 2), (uint16_t)(box_h + 2)};
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(box_x-1), (uint16_t)(box_y-1), (uint16_t)(box_w+2), 1}, COLOR_BORDER_HI);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(box_x-1), (uint16_t)(box_y-1), 1, (uint16_t)(box_h+2)}, COLOR_BORDER_HI);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(box_x-1), (uint16_t)(box_y+box_h), (uint16_t)(box_w+2), 1}, COLOR_BORDER_LO);
    eadk_display_push_rect_uniform((eadk_rect_t){(uint16_t)(box_x+box_w), (uint16_t)(box_y-1), 1, (uint16_t)(box_h+2)}, COLOR_BORDER_LO);

    int off_x = box_x + 8;
    int off_y = box_y + 11;
    if (next_p == 0) { off_x -= 5; off_y -= 5; } /* I centré */
    else if (next_p == 1) { off_x -= 5; }          /* O centré */

    for (int i = 0; i < 4; i++) {
        int bx = off_x + PIECES[next_p][0][i][0] * CELL_SIZE;
        int by = off_y + PIECES[next_p][0][i][1] * CELL_SIZE;
        draw_block_10x10(bx, by, next_p + 1);
    }
}

/* Mise à jour des textes du panneau latéral */
static void update_panel_stats(int score, int lines, int level) {
    char buf[24];

    /* Score */
    snprintf(buf, sizeof(buf), "%d", score);
    eadk_rect_t sc_bg = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 95), 110, 16};
    eadk_display_push_rect_uniform(sc_bg, COLOR_PANEL_BG);
    eadk_point_t pt_sc = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 95)};
    eadk_display_draw_string(buf, pt_sc, true, 0xFFFF, COLOR_PANEL_BG);

    /* Lignes */
    snprintf(buf, sizeof(buf), "%d", lines);
    eadk_rect_t li_bg = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 135), 110, 14};
    eadk_display_push_rect_uniform(li_bg, COLOR_PANEL_BG);
    eadk_point_t pt_li = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 135)};
    eadk_display_draw_string(buf, pt_li, false, 0xFFFF, COLOR_PANEL_BG);

    /* Niveau */
    snprintf(buf, sizeof(buf), "%d", level);
    eadk_rect_t lv_bg = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 172), 110, 14};
    eadk_display_push_rect_uniform(lv_bg, COLOR_PANEL_BG);
    eadk_point_t pt_lv = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 172)};
    eadk_display_draw_string(buf, pt_lv, false, 0xFFFF, COLOR_PANEL_BG);
}

/* ------------------------------------------------------------------------- */
/* Application Tetris Principale                                             */
/* ------------------------------------------------------------------------- */
void run_tetris_app(void) {
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    uint8_t board[BOARD_ROWS][BOARD_COLS] = {{0}};

    int cur_piece = (int)(eadk_random() % 7);
    int next_piece = (int)(eadk_random() % 7);
    int cur_rot = 0;
    int cur_x = 3;
    int cur_y = 0;

    int score = 0;
    int lines = 0;
    int level = 1;
    bool game_over = false;

    uint64_t last_drop_ms = eadk_timing_millis();
    eadk_keyboard_state_t prev_kbd = 0;

    /* Rendu complet initial (UNE SEULE FOIS pour 0 scintillement) */
    eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_APP_BG);

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
    eadk_display_push_rect_uniform(top_bar, 0xFE60);
    eadk_point_t pt_title = {8, 5};
    eadk_display_draw_string("Tetris NumWorks", pt_title, false, eadk_color_black, 0xFE60);

    /* Cadre 3D du plateau */
    eadk_rect_t board_frame = {
        (uint16_t)(BOARD_X - 3),
        (uint16_t)(BOARD_Y - 3),
        (uint16_t)(BOARD_COLS * CELL_SIZE + 6),
        (uint16_t)(BOARD_ROWS * CELL_SIZE + 6)
    };
    eadk_display_push_rect_uniform(board_frame, COLOR_BORDER_HI);
    eadk_rect_t board_inner = {
        (uint16_t)BOARD_X,
        (uint16_t)BOARD_Y,
        (uint16_t)(BOARD_COLS * CELL_SIZE),
        (uint16_t)(BOARD_ROWS * CELL_SIZE)
    };
    eadk_display_push_rect_uniform(board_inner, COLOR_BOARD_BG);

    /* Tracé de la grille initiale */
    for (int r = 0; r < BOARD_ROWS; r++) {
        for (int c = 0; c < BOARD_COLS; c++) {
            draw_board_cell(c, r, 0);
        }
    }

    /* Panneau latéral droit */
    eadk_rect_t panel_bg = {(uint16_t)PANEL_X, (uint16_t)BOARD_Y, 134, (uint16_t)(BOARD_ROWS * CELL_SIZE)};
    eadk_display_push_rect_uniform(panel_bg, COLOR_PANEL_BG);

    /* Titres des sections dans le panneau */
    eadk_point_t pt_nxt = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 10)};
    eadk_display_draw_string("SUIVANT :", pt_nxt, false, 0xFE60, COLOR_PANEL_BG);

    eadk_point_t pt_tsc = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 80)};
    eadk_display_draw_string("SCORE :", pt_tsc, false, 0x9CD3, COLOR_PANEL_BG);

    eadk_point_t pt_tli = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 120)};
    eadk_display_draw_string("LIGNES :", pt_tli, false, 0x9CD3, COLOR_PANEL_BG);

    eadk_point_t pt_tlv = {(uint16_t)(PANEL_X + 16), (uint16_t)(BOARD_Y + 158)};
    eadk_display_draw_string("NIVEAU :", pt_tlv, false, 0x9CD3, COLOR_PANEL_BG);

    /* Barre inférieure */
    eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
    eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
    eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
    eadk_display_draw_string("< >: Deplacer  |  HAUT: Tourner  |  BAS: Chute  |  Var: Furtif", pt_help, false, 0x4208, eadk_color_white);

    /* Affichage initial */
    draw_next_preview(next_piece);
    update_panel_stats(score, lines, level);
    draw_piece(cur_piece, cur_rot, cur_x, cur_y);

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
            eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_APP_BG);
            eadk_display_push_rect_uniform(top_bar, 0xFE60);
            eadk_display_draw_string("Tetris NumWorks", pt_title, false, eadk_color_black, 0xFE60);
            eadk_display_push_rect_uniform(board_frame, COLOR_BORDER_HI);
            eadk_display_push_rect_uniform(panel_bg, COLOR_PANEL_BG);
            eadk_display_draw_string("SUIVANT :", pt_nxt, false, 0xFE60, COLOR_PANEL_BG);
            eadk_display_draw_string("SCORE :", pt_tsc, false, 0x9CD3, COLOR_PANEL_BG);
            eadk_display_draw_string("LIGNES :", pt_tli, false, 0x9CD3, COLOR_PANEL_BG);
            eadk_display_draw_string("NIVEAU :", pt_tlv, false, 0x9CD3, COLOR_PANEL_BG);
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
            eadk_display_draw_string("< >: Deplacer  |  HAUT: Tourner  |  BAS: Chute  |  Var: Furtif", pt_help, false, 0x4208, eadk_color_white);
            for (int r = 0; r < BOARD_ROWS; r++) {
                for (int c = 0; c < BOARD_COLS; c++) {
                    draw_board_cell(c, r, board[r][c]);
                }
            }
            draw_next_preview(next_piece);
            update_panel_stats(score, lines, level);
            if (!game_over) draw_piece(cur_piece, cur_rot, cur_x, cur_y);
            continue;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        if (game_over) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                for (int r = 0; r < BOARD_ROWS; r++) {
                    for (int c = 0; c < BOARD_COLS; c++) {
                        board[r][c] = 0;
                        draw_board_cell(c, r, 0);
                    }
                }
                score = 0;
                lines = 0;
                level = 1;
                cur_piece = (int)(eadk_random() % 7);
                next_piece = (int)(eadk_random() % 7);
                cur_rot = 0;
                cur_x = 3;
                cur_y = 0;
                game_over = false;
                last_drop_ms = eadk_timing_millis();

                draw_next_preview(next_piece);
                update_panel_stats(score, lines, level);
                draw_piece(cur_piece, cur_rot, cur_x, cur_y);
            }
        } else {
            /* 1. Déplacements horizontaux */
            if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                if (!check_collision(board, cur_piece, cur_rot, cur_x - 1, cur_y)) {
                    eadk_display_wait_for_vblank();
                    erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                    cur_x--;
                    draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                if (!check_collision(board, cur_piece, cur_rot, cur_x + 1, cur_y)) {
                    eadk_display_wait_for_vblank();
                    erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                    cur_x++;
                    draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                }
            }

            /* 2. Rotation */
            if (eadk_keyboard_key_down(pressed, eadk_key_up) ||
                eadk_keyboard_key_down(pressed, eadk_key_ok)) {
                int next_rot = (cur_rot + 1) % 4;
                if (!check_collision(board, cur_piece, next_rot, cur_x, cur_y)) {
                    eadk_display_wait_for_vblank();
                    erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                    cur_rot = next_rot;
                    draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                } else if (!check_collision(board, cur_piece, next_rot, cur_x - 1, cur_y)) {
                    /* Wall kick gauche */
                    eadk_display_wait_for_vblank();
                    erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                    cur_x--;
                    cur_rot = next_rot;
                    draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                } else if (!check_collision(board, cur_piece, next_rot, cur_x + 1, cur_y)) {
                    /* Wall kick droite */
                    eadk_display_wait_for_vblank();
                    erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                    cur_x++;
                    cur_rot = next_rot;
                    draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                }
            }

            /* 3. Soft Drop (flèche bas) */
            if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (!check_collision(board, cur_piece, cur_rot, cur_x, cur_y + 1)) {
                    eadk_display_wait_for_vblank();
                    erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                    cur_y++;
                    score += 1;
                    draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                }
            }

            /* 4. Hard Drop (EXE ou Espace) */
            if (eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                int drop_dist = 0;
                erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                while (!check_collision(board, cur_piece, cur_rot, cur_x, cur_y + 1)) {
                    cur_y++;
                    drop_dist++;
                }
                score += drop_dist * 2;
                eadk_display_wait_for_vblank();
                draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                last_drop_ms = 0; /* Force le verrouillage immédiat */
            }

            /* 5. Gravité automatique cadencée */
            int drop_interval = 600 - (level * 45);
            if (drop_interval < 90) drop_interval = 90;

            uint64_t now = eadk_timing_millis();
            if (now - last_drop_ms >= (uint64_t)drop_interval) {
                last_drop_ms = now;

                if (!check_collision(board, cur_piece, cur_rot, cur_x, cur_y + 1)) {
                    eadk_display_wait_for_vblank();
                    erase_piece(board, cur_piece, cur_rot, cur_x, cur_y);
                    cur_y++;
                    draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                } else {
                    /* Verrouillage de la pièce */
                    for (int i = 0; i < 4; i++) {
                        int x = cur_x + PIECES[cur_piece][cur_rot][i][0];
                        int y = cur_y + PIECES[cur_piece][cur_rot][i][1];
                        if (y >= 0 && y < BOARD_ROWS && x >= 0 && x < BOARD_COLS) {
                            board[y][x] = (uint8_t)(cur_piece + 1);
                        }
                    }

                    /* Détection des lignes complètes */
                    int cleared = 0;
                    for (int r = BOARD_ROWS - 1; r >= 0; r--) {
                        bool full = true;
                        for (int c = 0; c < BOARD_COLS; c++) {
                            if (board[r][c] == 0) { full = false; break; }
                        }
                        if (full) {
                            cleared++;
                            /* Flash blanc de la ligne */
                            eadk_rect_t flash_r = {(uint16_t)BOARD_X, (uint16_t)(BOARD_Y + r * CELL_SIZE), (uint16_t)(BOARD_COLS * CELL_SIZE), CELL_SIZE};
                            eadk_display_push_rect_uniform(flash_r, 0xFFFF);
                            eadk_timing_msleep(25);

                            /* Décalage des rangées */
                            for (int y = r; y > 0; y--) {
                                for (int c = 0; c < BOARD_COLS; c++) {
                                    board[y][c] = board[y - 1][c];
                                }
                            }
                            for (int c = 0; c < BOARD_COLS; c++) {
                                board[0][c] = 0;
                            }
                            r++;
                        }
                    }

                    /* Redessiner le plateau si des lignes ont été éliminées */
                    if (cleared > 0) {
                        lines += cleared;
                        if (cleared == 1) score += 100 * level;
                        else if (cleared == 2) score += 300 * level;
                        else if (cleared == 3) score += 500 * level;
                        else if (cleared >= 4) score += 800 * level;

                        level = 1 + (lines / 10);

                        eadk_display_wait_for_vblank();
                        for (int r = 0; r < BOARD_ROWS; r++) {
                            for (int c = 0; c < BOARD_COLS; c++) {
                                draw_board_cell(c, r, board[r][c]);
                            }
                        }
                        update_panel_stats(score, lines, level);
                    }

                    /* Pièce suivante */
                    cur_piece = next_piece;
                    next_piece = (int)(eadk_random() % 7);
                    cur_rot = 0;
                    cur_x = 3;
                    cur_y = 0;

                    draw_next_preview(next_piece);

                    if (check_collision(board, cur_piece, cur_rot, cur_x, cur_y)) {
                        game_over = true;
                        /* Message Game Over */
                        eadk_rect_t gov_box = {45, 90, 230, 60};
                        eadk_display_push_rect_uniform(gov_box, 0xFFFF);
                        eadk_rect_t gov_inner = {47, 92, 226, 56};
                        eadk_display_push_rect_uniform(gov_inner, 0x0000);

                        eadk_point_t pt_g1 = {110, 98};
                        eadk_display_draw_string("GAME OVER", pt_g1, true, 0xF800, 0x0000);
                        eadk_point_t pt_g2 = {68, 126};
                        eadk_display_draw_string("OK: Rejouer  |  BACK: Hub", pt_g2, false, 0xFFFF, 0x0000);
                    } else {
                        draw_piece(cur_piece, cur_rot, cur_x, cur_y);
                    }
                }
            }
        }

        prev_kbd = kbd;

        /* Pause fluide pour scruter le clavier sans surcharger le processeur */
        eadk_timing_msleep(10);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
