#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"
#include "storage.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define MORP_TOP_BAR    22
#define MORP_CELL_SZ    44
#define MORP_LINE_THICK 4
#define MORP_BOARD_SZ   (3 * MORP_CELL_SZ + 2 * MORP_LINE_THICK) /* 140 */
#define MORP_BOARD_X    ((EADK_SCREEN_WIDTH - MORP_BOARD_SZ) / 2) /* 90 */
#define MORP_BOARD_Y    46

#define COLOR_MORP_BG     0x0821 /* Fond bleu nuit rétro */
#define COLOR_GRID_LINE   0x3DFE /* Cyan néon grille */
#define COLOR_CELL_BG     0x10A3 /* Fond cellule ardoise sombre */
#define COLOR_CELL_SEL    0x1945 /* Fond cellule sélectionnée */
#define COLOR_SEL_BORDER  0xFFE0 /* Bordure sélection jaune */
#define COLOR_X           0x3DFE /* Croix X cyan */
#define COLOR_X_HI        0xFFFF /* Reflet X blanc */
#define COLOR_O           0xFA80 /* Rond O corail */
#define COLOR_O_HI        0xFD20 /* Reflet O clair */
#define COLOR_WIN_GOLD    0xFFF0 /* Or victoire */

static int get_cell_left(int c) {
    return MORP_BOARD_X + c * (MORP_CELL_SZ + MORP_LINE_THICK);
}

static int get_cell_top(int r) {
    return MORP_BOARD_Y + r * (MORP_CELL_SZ + MORP_LINE_THICK);
}

static void draw_x_symbol(int cx, int cy, uint16_t color) {
    int rad = 13;
    for (int d = -rad; d <= rad; d++) {
        for (int t = -1; t <= 1; t++) {
            /* Diagonale 1: x - y */
            eadk_rect_t p1 = {(uint16_t)(cx + d + t), (uint16_t)(cy + d), 1, 1};
            eadk_display_push_rect_uniform(p1, color);
            /* Diagonale 2: x + y */
            eadk_rect_t p2 = {(uint16_t)(cx + d + t), (uint16_t)(cy - d), 1, 1};
            eadk_display_push_rect_uniform(p2, color);
        }
    }
}

static void draw_o_symbol(int cx, int cy, uint16_t color) {
    int r_out = 14;
    int r_in = 8;
    for (int dy = -r_out; dy <= r_out; dy++) {
        for (int dx = -r_out; dx <= r_out; dx++) {
            int d2 = dx * dx + dy * dy;
            if (d2 <= r_out * r_out && d2 >= r_in * r_in) {
                eadk_rect_t px = {(uint16_t)(cx + dx), (uint16_t)(cy + dy), 1, 1};
                eadk_display_push_rect_uniform(px, color);
            }
        }
    }
}

static void draw_single_cell(int r, int c, uint8_t mark, bool is_sel, bool is_win) {
    int x = get_cell_left(c);
    int y = get_cell_top(r);

    uint16_t bg = is_win ? 0x2280 : (is_sel ? COLOR_CELL_SEL : COLOR_CELL_BG);
    eadk_rect_t cell_rect = {(uint16_t)x, (uint16_t)y, MORP_CELL_SZ, MORP_CELL_SZ};
    eadk_display_push_rect_uniform(cell_rect, bg);

    if (is_sel && !is_win) {
        /* Bordure de sélection 2px */
        eadk_rect_t b_top = {(uint16_t)x, (uint16_t)y, MORP_CELL_SZ, 2};
        eadk_rect_t b_bot = {(uint16_t)x, (uint16_t)(y + MORP_CELL_SZ - 2), MORP_CELL_SZ, 2};
        eadk_rect_t b_lft = {(uint16_t)x, (uint16_t)y, 2, MORP_CELL_SZ};
        eadk_rect_t b_rgt = {(uint16_t)(x + MORP_CELL_SZ - 2), (uint16_t)y, 2, MORP_CELL_SZ};
        eadk_display_push_rect_uniform(b_top, COLOR_SEL_BORDER);
        eadk_display_push_rect_uniform(b_bot, COLOR_SEL_BORDER);
        eadk_display_push_rect_uniform(b_lft, COLOR_SEL_BORDER);
        eadk_display_push_rect_uniform(b_rgt, COLOR_SEL_BORDER);
    }

    int cx = x + (MORP_CELL_SZ / 2);
    int cy = y + (MORP_CELL_SZ / 2);

    if (mark == 1) {
        draw_x_symbol(cx, cy, is_win ? COLOR_WIN_GOLD : COLOR_X);
    } else if (mark == 2) {
        draw_o_symbol(cx, cy, is_win ? COLOR_WIN_GOLD : COLOR_O);
    }
}

static void draw_board_grid(void) {
    /* Deux lignes verticales */
    int v1_x = MORP_BOARD_X + MORP_CELL_SZ;
    int v2_x = MORP_BOARD_X + 2 * MORP_CELL_SZ + MORP_LINE_THICK;
    eadk_rect_t lv1 = {(uint16_t)v1_x, MORP_BOARD_Y, MORP_LINE_THICK, MORP_BOARD_SZ};
    eadk_rect_t lv2 = {(uint16_t)v2_x, MORP_BOARD_Y, MORP_LINE_THICK, MORP_BOARD_SZ};
    eadk_display_push_rect_uniform(lv1, COLOR_GRID_LINE);
    eadk_display_push_rect_uniform(lv2, COLOR_GRID_LINE);

    /* Deux lignes horizontales */
    int h1_y = MORP_BOARD_Y + MORP_CELL_SZ;
    int h2_y = MORP_BOARD_Y + 2 * MORP_CELL_SZ + MORP_LINE_THICK;
    eadk_rect_t lh1 = {MORP_BOARD_X, (uint16_t)h1_y, MORP_BOARD_SZ, MORP_LINE_THICK};
    eadk_rect_t lh2 = {MORP_BOARD_X, (uint16_t)h2_y, MORP_BOARD_SZ, MORP_LINE_THICK};
    eadk_display_push_rect_uniform(lh1, COLOR_GRID_LINE);
    eadk_display_push_rect_uniform(lh2, COLOR_GRID_LINE);
}

/* Vérification de fin de partie : 0 = en cours, 1 = P1 gagne, 2 = P2 gagne, 3 = match nul */
static int check_morpion_winner(const uint8_t grid[3][3], int win_cells[3][2]) {
    /* Lignes horizontales */
    for (int r = 0; r < 3; r++) {
        if (grid[r][0] != 0 && grid[r][0] == grid[r][1] && grid[r][1] == grid[r][2]) {
            if (win_cells) {
                for (int c = 0; c < 3; c++) { win_cells[c][0] = r; win_cells[c][1] = c; }
            }
            return grid[r][0];
        }
    }
    /* Colonnes verticales */
    for (int c = 0; c < 3; c++) {
        if (grid[0][c] != 0 && grid[0][c] == grid[1][c] && grid[1][c] == grid[2][c]) {
            if (win_cells) {
                for (int r = 0; r < 3; r++) { win_cells[r][0] = r; win_cells[r][1] = c; }
            }
            return grid[0][c];
        }
    }
    /* Diagonale principale */
    if (grid[0][0] != 0 && grid[0][0] == grid[1][1] && grid[1][1] == grid[2][2]) {
        if (win_cells) {
            win_cells[0][0] = 0; win_cells[0][1] = 0;
            win_cells[1][0] = 1; win_cells[1][1] = 1;
            win_cells[2][0] = 2; win_cells[2][1] = 2;
        }
        return grid[0][0];
    }
    /* Diagonale secondaire */
    if (grid[0][2] != 0 && grid[0][2] == grid[1][1] && grid[1][1] == grid[2][0]) {
        if (win_cells) {
            win_cells[0][0] = 0; win_cells[0][1] = 2;
            win_cells[1][0] = 1; win_cells[1][1] = 1;
            win_cells[2][0] = 2; win_cells[2][1] = 0;
        }
        return grid[0][2];
    }

    /* Grille pleine ? */
    for (int r = 0; r < 3; r++) {
        for (int c = 0; c < 3; c++) {
            if (grid[r][c] == 0) return 0; /* Partie non terminée */
        }
    }
    return 3; /* Match nul */
}

/* Minimax imbattable pour Morpion 3x3 */
static int minimax_morpion(uint8_t grid[3][3], int depth, bool is_ai) {
    int w = check_morpion_winner(grid, NULL);
    if (w == 2) return 10 - depth; /* Victoire IA */
    if (w == 1) return depth - 10; /* Victoire Humain */
    if (w == 3) return 0;          /* Nul */

    if (is_ai) {
        int best = -100;
        for (int r = 0; r < 3; r++) {
            for (int c = 0; c < 3; c++) {
                if (grid[r][c] == 0) {
                    grid[r][c] = 2;
                    int val = minimax_morpion(grid, depth + 1, false);
                    grid[r][c] = 0;
                    if (val > best) best = val;
                }
            }
        }
        return best;
    } else {
        int best = 100;
        for (int r = 0; r < 3; r++) {
            for (int c = 0; c < 3; c++) {
                if (grid[r][c] == 0) {
                    grid[r][c] = 1;
                    int val = minimax_morpion(grid, depth + 1, true);
                    grid[r][c] = 0;
                    if (val < best) best = val;
                }
            }
        }
        return best;
    }
}

static void find_best_ai_morpion(uint8_t grid[3][3], int* best_r, int* best_c) {
    int max_val = -100;
    *best_r = -1;
    *best_c = -1;

    for (int r = 0; r < 3; r++) {
        for (int c = 0; c < 3; c++) {
            if (grid[r][c] == 0) {
                if (*best_r == -1) { *best_r = r; *best_c = c; }
                grid[r][c] = 2;
                int val = minimax_morpion(grid, 0, false);
                grid[r][c] = 0;
                if (val > max_val) {
                    max_val = val;
                    *best_r = r;
                    *best_c = c;
                }
            }
        }
    }
}

void run_morpion_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    eq_storage_t* store = eq_storage_get();
    int record_wins = store->record_morpion_wins;

    bool vs_ai = true; /* true = 1P vs IA Minimax, false = 2 Joueurs */
    uint8_t grid[3][3] = {{0}};
    int sel_r = 1;
    int sel_c = 1;
    uint8_t cur_player = 1; /* 1 = X (Cyan), 2 = O (Rouge) */
    bool game_over = false;
    int winner = 0;
    int win_cells[3][2] = {{-1,-1},{-1,-1},{-1,-1}};

    /* Tracé complet initial */
    eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_MORP_BG);

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, MORP_TOP_BAR};
    eadk_display_push_rect_uniform(top_bar, 0x10A2);
    eadk_point_t p_title = {8, 4};
    eadk_display_draw_string("Morpion Tic-Tac-Toe (Minimax Imbattable)", p_title, false, 0xFFFF, 0x10A2);

    /* Lignes de la grille */
    draw_board_grid();

    /* Cellules initiales */
    for (int r = 0; r < 3; r++) {
        for (int c = 0; c < 3; c++) {
            draw_single_cell(r, c, grid[r][c], (r == sel_r && c == sel_c), false);
        }
    }

    /* HUD Informations */
    char hud_buf[64];
    snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
    eadk_point_t p_hud = {16, 196};
    eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_MORP_BG);

    /* Pied d'écran */
    eadk_rect_t bot_help = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
    eadk_display_push_rect_uniform(bot_help, 0x10A2);
    eadk_point_t p_hlp = {8, EADK_SCREEN_HEIGHT - 13};
    eadk_display_draw_string("Fleches: Curseur | OK: Poser | Var: Mode 1P/2P | Back: Hub", p_hlp, false, 0x9CD3, 0x10A2);

    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || eadk_keyboard_key_down(kbd, eadk_key_home)) {
            break;
        }

        /* Touche Var ou Toolbox : Mode 1P / 2P */
        if (eadk_keyboard_key_down(pressed, eadk_key_var) || eadk_keyboard_key_down(pressed, eadk_key_toolbox)) {
            vs_ai = !vs_ai;
            eadk_rect_t clr_hud = {16, 196, 288, 14};
            eadk_display_push_rect_uniform(clr_hud, COLOR_MORP_BG);
            snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
            eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_MORP_BG);
        }

        if (game_over) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                /* Relancer une partie */
                for (int r = 0; r < 3; r++) {
                    for (int c = 0; c < 3; c++) {
                        grid[r][c] = 0;
                    }
                }
                game_over = false;
                winner = 0;
                cur_player = 1;
                sel_r = 1;
                sel_c = 1;

                draw_board_grid();
                for (int r = 0; r < 3; r++) {
                    for (int c = 0; c < 3; c++) {
                        draw_single_cell(r, c, 0, (r == sel_r && c == sel_c), false);
                    }
                }

                eadk_rect_t clr_hud = {16, 196, 288, 14};
                eadk_display_push_rect_uniform(clr_hud, COLOR_MORP_BG);
                snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
                eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_MORP_BG);
            }
            prev_kbd = kbd;
            eadk_timing_msleep(20);
            continue;
        }

        /* Déplacement du curseur 2D */
        int old_r = sel_r;
        int old_c = sel_c;

        if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
            if (sel_r > 0) sel_r--;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
            if (sel_r < 2) sel_r++;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
            if (sel_c > 0) sel_c--;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
            if (sel_c < 2) sel_c++;
        }

        if (old_r != sel_r || old_c != sel_c) {
            draw_single_cell(old_r, old_c, grid[old_r][old_c], false, false);
            draw_single_cell(sel_r, sel_c, grid[sel_r][sel_c], true, false);
        }

        /* Poser un symbole */
        if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            if (grid[sel_r][sel_c] == 0) {
                grid[sel_r][sel_c] = cur_player;
                draw_single_cell(sel_r, sel_c, cur_player, true, false);

                winner = check_morpion_winner(grid, win_cells);
                if (winner != 0) {
                    game_over = true;
                    if (winner == 1 && vs_ai) {
                        record_wins++;
                        store->record_morpion_wins = record_wins;
                        eq_storage_commit();
                    }
                    if (winner == 1 || winner == 2) {
                        for (int k = 0; k < 3; k++) {
                            draw_single_cell(win_cells[k][0], win_cells[k][1], winner, false, true);
                        }
                    }
                } else {
                    cur_player = (cur_player == 1) ? 2 : 1;

                    /* Tour de l'IA (Mode 1P) */
                    if (vs_ai && cur_player == 2 && !game_over) {
                        eadk_rect_t clr_hud = {16, 196, 288, 14};
                        eadk_display_push_rect_uniform(clr_hud, COLOR_MORP_BG);
                        eadk_point_t p_think = {16, 196};
                        eadk_display_draw_string("L'IA calcule son coup...", p_think, false, COLOR_O, COLOR_MORP_BG);
                        eadk_timing_msleep(150);

                        int ai_r = -1, ai_c = -1;
                        find_best_ai_morpion(grid, &ai_r, &ai_c);
                        if (ai_r < 0 || ai_r > 2 || ai_c < 0 || ai_c > 2 || grid[ai_r][ai_c] != 0) {
                            for (int r = 0; r < 3; r++) {
                                for (int c = 0; c < 3; c++) {
                                    if (grid[r][c] == 0) { ai_r = r; ai_c = c; break; }
                                }
                                if (ai_r != -1) break;
                            }
                        }

                        if (ai_r != -1) {
                            draw_single_cell(sel_r, sel_c, grid[sel_r][sel_c], false, false);
                            sel_r = ai_r;
                            sel_c = ai_c;
                            grid[ai_r][ai_c] = 2;
                            draw_single_cell(ai_r, ai_c, 2, true, false);

                            winner = check_morpion_winner(grid, win_cells);
                            if (winner != 0) {
                                game_over = true;
                                if (winner == 2) {
                                    for (int k = 0; k < 3; k++) {
                                        draw_single_cell(win_cells[k][0], win_cells[k][1], 2, false, true);
                                    }
                                }
                            } else {
                                cur_player = 1;
                            }
                        }

                        /* Restaurer HUD */
                        eadk_display_push_rect_uniform(clr_hud, COLOR_MORP_BG);
                        snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
                        eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_MORP_BG);

                        /* Vider les touches pressées pendant le calcul IA */
                        while (eadk_keyboard_scan() != 0) eadk_timing_msleep(15);
                        prev_kbd = eadk_keyboard_scan();
                    }
                }
            }
        }

        /* Message Game Over */
        if (game_over) {
            eadk_rect_t box = {30, 85, 260, 60};
            eadk_display_push_rect_uniform(box, 0x10A2);
            eadk_rect_t inner = {32, 87, 256, 56};
            eadk_display_push_rect_uniform(inner, 0x0000);

            if (winner == 1) {
                eadk_point_t p_w = {60, 95};
                eadk_display_draw_string(vs_ai ? "VICTOIRE ! VOUS GAGNEZ !" : "LE JOUEUR 1 A GAGNE !", p_w, false, COLOR_X, 0x0000);
            } else if (winner == 2) {
                eadk_point_t p_w = {65, 95};
                eadk_display_draw_string(vs_ai ? "L'IA A GAGNE CE DUEL !" : "LE JOUEUR 2 A GAGNE !", p_w, false, COLOR_O, 0x0000);
            } else {
                eadk_point_t p_w = {100, 95};
                eadk_display_draw_string("MATCH NUL !", p_w, false, 0xFFFF, 0x0000);
            }
            eadk_point_t p_res = {55, 120};
            eadk_display_draw_string("OK: Rejouer | Back: Quitter", p_res, false, 0x9CD3, 0x0000);
        }

        prev_kbd = kbd;
        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}
