#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define BOARD_COLS 10
#define BOARD_ROWS 20
#define CELL_SIZE  9
#define BOARD_X    48
#define BOARD_Y    26
#define PANEL_X    160

/* Couleurs des tétrominoes */
static const uint16_t PIECE_COLORS[8] = {
    0x0000, /* 0: Vide */
    0x07FF, /* 1: I (Cyan) */
    0xFFE0, /* 2: O (Jaune) */
    0xA01F, /* 3: T (Violet) */
    0x07E0, /* 4: S (Vert) */
    0xF800, /* 5: Z (Rouge) */
    0x001F, /* 6: J (Bleu) */
    0xFD20  /* 7: L (Orange) */
};

/* Formes des 7 tétrominoes en 4 rotations (coordonnées x,y de 4 blocs) */
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

static bool check_collision(const uint8_t board[BOARD_ROWS][BOARD_COLS], int piece, int rot, int px, int py) {
    for (int i = 0; i < 4; i++) {
        int x = px + PIECES[piece][rot][i][0];
        int y = py + PIECES[piece][rot][i][1];

        if (x < 0 || x >= BOARD_COLS || y >= BOARD_ROWS) return true;
        if (y >= 0 && board[y][x] != 0) return true;
    }
    return false;
}

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
    bool redraw = true;

    while (true) {
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
            redraw = true;
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
                    }
                }
                cur_piece = (int)(eadk_random() % 7);
                next_piece = (int)(eadk_random() % 7);
                cur_rot = 0;
                cur_x = 3;
                cur_y = 0;
                score = 0;
                lines = 0;
                level = 1;
                game_over = false;
                last_drop_ms = eadk_timing_millis();
                redraw = true;
            }
        } else {
            /* Mouvements horizontaux */
            if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                if (!check_collision(board, cur_piece, cur_rot, cur_x - 1, cur_y)) {
                    cur_x--;
                    redraw = true;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                if (!check_collision(board, cur_piece, cur_rot, cur_x + 1, cur_y)) {
                    cur_x++;
                    redraw = true;
                }
            }

            /* Rotation */
            if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                int next_rot = (cur_rot + 1) % 4;
                if (!check_collision(board, cur_piece, next_rot, cur_x, cur_y)) {
                    cur_rot = next_rot;
                    redraw = true;
                } else if (!check_collision(board, cur_piece, next_rot, cur_x - 1, cur_y)) {
                    cur_x--;
                    cur_rot = next_rot;
                    redraw = true;
                } else if (!check_collision(board, cur_piece, next_rot, cur_x + 1, cur_y)) {
                    cur_x++;
                    cur_rot = next_rot;
                    redraw = true;
                }
            }

            /* Descente rapide (flèche bas) */
            if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (!check_collision(board, cur_piece, cur_rot, cur_x, cur_y + 1)) {
                    cur_y++;
                    score += 1;
                    redraw = true;
                }
            }

            /* Chute instantanée (Hard Drop avec OK ou EXE) */
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                int drop_dist = 0;
                while (!check_collision(board, cur_piece, cur_rot, cur_x, cur_y + 1)) {
                    cur_y++;
                    drop_dist++;
                }
                score += drop_dist * 2;
                last_drop_ms = 0; /* Force le verrouillage immédiat */
                redraw = true;
            }

            /* Gravité automatique */
            int drop_interval = 650 - (level * 50);
            if (drop_interval < 100) drop_interval = 100;

            uint64_t now = eadk_timing_millis();
            if (now - last_drop_ms >= (uint64_t)drop_interval) {
                last_drop_ms = now;

                if (!check_collision(board, cur_piece, cur_rot, cur_x, cur_y + 1)) {
                    cur_y++;
                    redraw = true;
                } else {
                    /* Verrouiller la pièce sur le plateau */
                    for (int i = 0; i < 4; i++) {
                        int x = cur_x + PIECES[cur_piece][cur_rot][i][0];
                        int y = cur_y + PIECES[cur_piece][cur_rot][i][1];
                        if (y >= 0 && y < BOARD_ROWS && x >= 0 && x < BOARD_COLS) {
                            board[y][x] = (uint8_t)(cur_piece + 1);
                        }
                    }

                    /* Suppression des lignes complètes */
                    int cleared = 0;
                    for (int r = BOARD_ROWS - 1; r >= 0; r--) {
                        bool full = true;
                        for (int c = 0; c < BOARD_COLS; c++) {
                            if (board[r][c] == 0) {
                                full = false;
                                break;
                            }
                        }
                        if (full) {
                            cleared++;
                            for (int y = r; y > 0; y--) {
                                for (int c = 0; c < BOARD_COLS; c++) {
                                    board[y][c] = board[y - 1][c];
                                }
                            }
                            for (int c = 0; c < BOARD_COLS; c++) {
                                board[0][c] = 0;
                            }
                            r++; /* Ré-analyser la ligne descendue */
                        }
                    }

                    if (cleared > 0) {
                        lines += cleared;
                        if (cleared == 1) score += 100 * level;
                        else if (cleared == 2) score += 300 * level;
                        else if (cleared == 3) score += 500 * level;
                        else if (cleared >= 4) score += 800 * level;

                        level = 1 + (lines / 10);
                    }

                    /* Prochaine pièce */
                    cur_piece = next_piece;
                    next_piece = (int)(eadk_random() % 7);
                    cur_rot = 0;
                    cur_x = 3;
                    cur_y = 0;

                    if (check_collision(board, cur_piece, cur_rot, cur_x, cur_y)) {
                        game_over = true;
                    }

                    redraw = true;
                }
            }
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;

            /* Fond */
            eadk_display_push_rect_uniform(eadk_screen_rect, 0x18C3);

            /* Barre supérieure */
            eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top_bar, 0xFE60);
            eadk_point_t pt_title = {8, 5};
            eadk_display_draw_string("Tetris NumWorks", pt_title, false, eadk_color_black, 0xFE60);

            /* Cadre du plateau de jeu */
            eadk_rect_t board_border = {
                (uint16_t)(BOARD_X - 2),
                (uint16_t)(BOARD_Y - 2),
                (uint16_t)(BOARD_COLS * CELL_SIZE + 4),
                (uint16_t)(BOARD_ROWS * CELL_SIZE + 4)
            };
            eadk_display_push_rect_uniform(board_border, 0xFFFF);

            eadk_rect_t board_bg = {
                (uint16_t)BOARD_X,
                (uint16_t)BOARD_Y,
                (uint16_t)(BOARD_COLS * CELL_SIZE),
                (uint16_t)(BOARD_ROWS * CELL_SIZE)
            };
            eadk_display_push_rect_uniform(board_bg, 0x0000);

            /* Blocs fixés sur le plateau */
            for (int r = 0; r < BOARD_ROWS; r++) {
                for (int c = 0; c < BOARD_COLS; c++) {
                    uint8_t p = board[r][c];
                    if (p > 0) {
                        eadk_rect_t cell_r = {
                            (uint16_t)(BOARD_X + c * CELL_SIZE + 1),
                            (uint16_t)(BOARD_Y + r * CELL_SIZE + 1),
                            CELL_SIZE - 2,
                            CELL_SIZE - 2
                        };
                        eadk_display_push_rect_uniform(cell_r, PIECE_COLORS[p]);
                    }
                }
            }

            /* Pièce active en mouvement */
            if (!game_over) {
                for (int i = 0; i < 4; i++) {
                    int x = cur_x + PIECES[cur_piece][cur_rot][i][0];
                    int y = cur_y + PIECES[cur_piece][cur_rot][i][1];
                    if (y >= 0 && y < BOARD_ROWS && x >= 0 && x < BOARD_COLS) {
                        eadk_rect_t cell_r = {
                            (uint16_t)(BOARD_X + x * CELL_SIZE + 1),
                            (uint16_t)(BOARD_Y + y * CELL_SIZE + 1),
                            CELL_SIZE - 2,
                            CELL_SIZE - 2
                        };
                        eadk_display_push_rect_uniform(cell_r, PIECE_COLORS[cur_piece + 1]);
                    }
                }
            }

            /* Panneau latéral droit */
            eadk_rect_t panel_bg = {(uint16_t)PANEL_X, (uint16_t)BOARD_Y, 130, (uint16_t)(BOARD_ROWS * CELL_SIZE)};
            eadk_display_push_rect_uniform(panel_bg, 0x2124);

            /* Aperçu de la pièce suivante */
            eadk_point_t pt_nxt = {(uint16_t)(PANEL_X + 12), (uint16_t)(BOARD_Y + 10)};
            eadk_display_draw_string("SUIVANTE :", pt_nxt, false, 0xFE60, 0x2124);

            eadk_rect_t prev_box = {(uint16_t)(PANEL_X + 35), (uint16_t)(BOARD_Y + 28), 44, 44};
            eadk_display_push_rect_uniform(prev_box, 0x0000);

            for (int i = 0; i < 4; i++) {
                int px = PIECES[next_piece][0][i][0];
                int py = PIECES[next_piece][0][i][1];
                eadk_rect_t prev_cell = {
                    (uint16_t)(PANEL_X + 41 + px * 9),
                    (uint16_t)(BOARD_Y + 36 + py * 9),
                    7, 7
                };
                eadk_display_push_rect_uniform(prev_cell, PIECE_COLORS[next_piece + 1]);
            }

            /* Statistiques */
            char buf[32];
            snprintf(buf, sizeof(buf), "Score: %d", score);
            eadk_point_t pt_sc = {(uint16_t)(PANEL_X + 12), (uint16_t)(BOARD_Y + 90)};
            eadk_display_draw_string(buf, pt_sc, false, 0xFFFF, 0x2124);

            snprintf(buf, sizeof(buf), "Lignes: %d", lines);
            eadk_point_t pt_ln = {(uint16_t)(PANEL_X + 12), (uint16_t)(BOARD_Y + 115)};
            eadk_display_draw_string(buf, pt_ln, false, 0xFFFF, 0x2124);

            snprintf(buf, sizeof(buf), "Niveau: %d", level);
            eadk_point_t pt_lv = {(uint16_t)(PANEL_X + 12), (uint16_t)(BOARD_Y + 140)};
            eadk_display_draw_string(buf, pt_lv, false, 0x07E0, 0x2124);

            /* Overlay Game Over */
            if (game_over) {
                eadk_rect_t gov_box = {30, 80, 130, 50};
                eadk_display_push_rect_uniform(gov_box, 0xFFFF);
                eadk_rect_t gov_in = {32, 82, 126, 46};
                eadk_display_push_rect_uniform(gov_in, 0x0000);
                eadk_point_t pt_g1 = {45, 88};
                eadk_display_draw_string("GAME OVER", pt_g1, false, 0xF800, 0x0000);
                eadk_point_t pt_g2 = {38, 106};
                eadk_display_draw_string("OK: Rejouer", pt_g2, false, 0xFFFF, 0x0000);
            }

            /* Barre inférieure */
            eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
            eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("< >: Deplacer | HAUT: Tourner | OK: Chute | Var: Furtif", pt_help, false, 0x4208, eadk_color_white);
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
