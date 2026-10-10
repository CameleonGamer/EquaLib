#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"
#include "storage.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define P4_COLS 7
#define P4_ROWS 6

#define P4_TOP_BAR     22
#define P4_BOARD_X     48
#define P4_BOARD_Y     46
#define P4_CELL_W      32
#define P4_CELL_H      24
#define P4_BOARD_W     (P4_COLS * P4_CELL_W) /* 224 */
#define P4_BOARD_H     (P4_ROWS * P4_CELL_H) /* 144 */

#define COLOR_P4_BG      0x0821 /* Fond bleu nuit rétro */
#define COLOR_P4_BOARD   0x11FD /* Bleu marine classique Puissance 4 */
#define COLOR_P4_BORDER  0x3DFE /* Bordure cyan néon */
#define COLOR_HOLE_BG    0x0000 /* Trou vide noir */
#define COLOR_P1         0xFFE0 /* Jaune vif P1 */
#define COLOR_P1_HI      0xFFFF /* Blanc éclat */
#define COLOR_P1_DK      0xCE60 /* Ombre jaune */
#define COLOR_P2         0xF800 /* Rouge vif P2 / IA */
#define COLOR_P2_HI      0xFD20 /* Reflet clair rouge */
#define COLOR_P2_DK      0x9000 /* Ombre rouge */
#define COLOR_WIN_GOLD   0xFFF0 /* Or éclat pour victoire */

/* Dessin d'un disque circulaire plein de rayon 8 (diamètre 17) */
static void draw_circle_token(int cx, int cy, uint16_t main_col, uint16_t hi_col) {
    for (int dy = -8; dy <= 8; dy++) {
        int dx_max = 8;
        if (dy == -8 || dy == 8) dx_max = 4;
        else if (dy == -7 || dy == 7) dx_max = 6;
        else if (dy == -6 || dy == 6) dx_max = 7;

        int x = cx - dx_max;
        int y = cy + dy;
        int w = dx_max * 2 + 1;
        eadk_rect_t line = {(uint16_t)x, (uint16_t)y, (uint16_t)w, 1};
        eadk_display_push_rect_uniform(line, main_col);
    }
    if (hi_col != main_col) {
        eadk_rect_t glint = {(uint16_t)(cx - 4), (uint16_t)(cy - 4), 3, 2};
        eadk_display_push_rect_uniform(glint, hi_col);
    }
}

static void draw_empty_hole(int c, int r) {
    int cx = P4_BOARD_X + c * P4_CELL_W + (P4_CELL_W / 2);
    int cy = P4_BOARD_Y + r * P4_CELL_H + (P4_CELL_H / 2);
    draw_circle_token(cx, cy, COLOR_HOLE_BG, COLOR_HOLE_BG);
}

static void draw_board_token(int c, int r, uint8_t player, bool win_highlight) {
    int cx = P4_BOARD_X + c * P4_CELL_W + (P4_CELL_W / 2);
    int cy = P4_BOARD_Y + r * P4_CELL_H + (P4_CELL_H / 2);

    if (player == 0) {
        draw_circle_token(cx, cy, COLOR_HOLE_BG, COLOR_HOLE_BG);
    } else if (win_highlight) {
        draw_circle_token(cx, cy, COLOR_WIN_GOLD, 0xFFFF);
        eadk_rect_t core = {(uint16_t)(cx - 3), (uint16_t)(cy - 3), 7, 7};
        eadk_display_push_rect_uniform(core, (player == 1) ? COLOR_P1 : COLOR_P2);
    } else if (player == 1) {
        draw_circle_token(cx, cy, COLOR_P1, COLOR_P1_HI);
    } else {
        draw_circle_token(cx, cy, COLOR_P2, COLOR_P2_HI);
    }
}

/* Dessin du curseur colonne */
static void draw_cursor(int col, uint8_t player, bool erase) {
    int cx = P4_BOARD_X + col * P4_CELL_W + (P4_CELL_W / 2);
    eadk_rect_t clear_zone = {(uint16_t)(P4_BOARD_X), 26, (uint16_t)P4_BOARD_W, 18};
    if (erase) {
        eadk_display_push_rect_uniform(clear_zone, COLOR_P4_BG);
        return;
    }
    eadk_display_push_rect_uniform(clear_zone, COLOR_P4_BG);

    uint16_t col_arrow = (player == 1) ? COLOR_P1 : COLOR_P2;
    /* Flèche vers le bas */
    for (int i = 0; i < 7; i++) {
        int w = 13 - (i * 2);
        if (w < 1) w = 1;
        int x = cx - (w / 2);
        int y = 29 + i;
        eadk_rect_t arr_line = {(uint16_t)x, (uint16_t)y, (uint16_t)w, 1};
        eadk_display_push_rect_uniform(arr_line, col_arrow);
    }
}

/* Recherche de victoire (4 alignés) */
static bool check_win(const uint8_t grid[P4_ROWS][P4_COLS], uint8_t player, int win_coords[4][2]) {
    /* 1. Lignes horizontales */
    for (int r = 0; r < P4_ROWS; r++) {
        for (int c = 0; c <= P4_COLS - 4; c++) {
            if (grid[r][c] == player && grid[r][c+1] == player &&
                grid[r][c+2] == player && grid[r][c+3] == player) {
                if (win_coords) {
                    for (int k = 0; k < 4; k++) {
                        win_coords[k][0] = c + k;
                        win_coords[k][1] = r;
                    }
                }
                return true;
            }
        }
    }
    /* 2. Lignes verticales */
    for (int c = 0; c < P4_COLS; c++) {
        for (int r = 0; r <= P4_ROWS - 4; r++) {
            if (grid[r][c] == player && grid[r+1][c] == player &&
                grid[r+2][c] == player && grid[r+3][c] == player) {
                if (win_coords) {
                    for (int k = 0; k < 4; k++) {
                        win_coords[k][0] = c;
                        win_coords[k][1] = r + k;
                    }
                }
                return true;
            }
        }
    }
    /* 3. Diagonale bas-droite */
    for (int r = 0; r <= P4_ROWS - 4; r++) {
        for (int c = 0; c <= P4_COLS - 4; c++) {
            if (grid[r][c] == player && grid[r+1][c+1] == player &&
                grid[r+2][c+2] == player && grid[r+3][c+3] == player) {
                if (win_coords) {
                    for (int k = 0; k < 4; k++) {
                        win_coords[k][0] = c + k;
                        win_coords[k][1] = r + k;
                    }
                }
                return true;
            }
        }
    }
    /* 4. Diagonale haut-droite */
    for (int r = 3; r < P4_ROWS; r++) {
        for (int c = 0; c <= P4_COLS - 4; c++) {
            if (grid[r][c] == player && grid[r-1][c+1] == player &&
                grid[r-2][c+2] == player && grid[r-3][c+3] == player) {
                if (win_coords) {
                    for (int k = 0; k < 4; k++) {
                        win_coords[k][0] = c + k;
                        win_coords[k][1] = r - k;
                    }
                }
                return true;
            }
        }
    }
    return false;
}

static int get_lowest_row(const uint8_t grid[P4_ROWS][P4_COLS], int col) {
    if (col < 0 || col >= P4_COLS) return -1;
    for (int r = P4_ROWS - 1; r >= 0; r--) {
        if (grid[r][col] == 0) return r;
    }
    return -1;
}

/* Évaluation heuristique pour IA Minimax */
static int eval_window(uint8_t a, uint8_t b, uint8_t c, uint8_t d, uint8_t ai_p, uint8_t human_p) {
    int ai_c = (a == ai_p) + (b == ai_p) + (c == ai_p) + (d == ai_p);
    int empty_c = (a == 0) + (b == 0) + (c == 0) + (d == 0);
    int hu_c = (a == human_p) + (b == human_p) + (c == human_p) + (d == human_p);

    if (ai_c == 4) return 10000;
    if (ai_c == 3 && empty_c == 1) return 100;
    if (ai_c == 2 && empty_c == 2) return 10;
    if (hu_c == 3 && empty_c == 1) return -120;
    if (hu_c == 2 && empty_c == 2) return -10;
    return 0;
}

static int score_position(const uint8_t grid[P4_ROWS][P4_COLS], uint8_t ai_p, uint8_t human_p) {
    int score = 0;
    /* Préférence colonne centrale */
    for (int r = 0; r < P4_ROWS; r++) {
        if (grid[r][3] == ai_p) score += 6;
        else if (grid[r][3] == human_p) score -= 6;
    }
    /* Horizontale */
    for (int r = 0; r < P4_ROWS; r++) {
        for (int c = 0; c <= P4_COLS - 4; c++) {
            score += eval_window(grid[r][c], grid[r][c+1], grid[r][c+2], grid[r][c+3], ai_p, human_p);
        }
    }
    /* Verticale */
    for (int c = 0; c < P4_COLS; c++) {
        for (int r = 0; r <= P4_ROWS - 4; r++) {
            score += eval_window(grid[r][c], grid[r+1][c], grid[r+2][c], grid[r+3][c], ai_p, human_p);
        }
    }
    /* Diagonales */
    for (int r = 0; r <= P4_ROWS - 4; r++) {
        for (int c = 0; c <= P4_COLS - 4; c++) {
            score += eval_window(grid[r][c], grid[r+1][c+1], grid[r+2][c+2], grid[r+3][c+3], ai_p, human_p);
        }
    }
    for (int r = 3; r < P4_ROWS; r++) {
        for (int c = 0; c <= P4_COLS - 4; c++) {
            score += eval_window(grid[r][c], grid[r-1][c+1], grid[r-2][c+2], grid[r-3][c+3], ai_p, human_p);
        }
    }
    return score;
}

static int minimax_p4(uint8_t grid[P4_ROWS][P4_COLS], int depth, int alpha, int beta, bool is_ai) {
    if (check_win(grid, 2, NULL)) return 100000 - depth;
    if (check_win(grid, 1, NULL)) return -100000 + depth;
    if (depth <= 0) return score_position(grid, 2, 1);

    /* Match nul ? */
    bool full = true;
    for (int c = 0; c < P4_COLS; c++) {
        if (grid[0][c] == 0) { full = false; break; }
    }
    if (full) return 0;

    int col_order[7] = {3, 2, 4, 1, 5, 0, 6};

    if (is_ai) {
        int max_eval = -999999;
        for (int i = 0; i < P4_COLS; i++) {
            int c = col_order[i];
            int r = get_lowest_row(grid, c);
            if (r != -1) {
                grid[r][c] = 2;
                int ev = minimax_p4(grid, depth - 1, alpha, beta, false);
                grid[r][c] = 0;
                if (ev > max_eval) max_eval = ev;
                if (ev > alpha) alpha = ev;
                if (beta <= alpha) break;
            }
        }
        return max_eval;
    } else {
        int min_eval = 999999;
        for (int i = 0; i < P4_COLS; i++) {
            int c = col_order[i];
            int r = get_lowest_row(grid, c);
            if (r != -1) {
                grid[r][c] = 1;
                int ev = minimax_p4(grid, depth - 1, alpha, beta, true);
                grid[r][c] = 0;
                if (ev < min_eval) min_eval = ev;
                if (ev < beta) beta = ev;
                if (beta <= alpha) break;
            }
        }
        return min_eval;
    }
}

static int find_best_ai_move(uint8_t grid[P4_ROWS][P4_COLS]) {
    /* 1. Victoire immédiate ? */
    for (int c = 0; c < P4_COLS; c++) {
        int r = get_lowest_row(grid, c);
        if (r != -1) {
            grid[r][c] = 2;
            if (check_win(grid, 2, NULL)) {
                grid[r][c] = 0;
                return c;
            }
            grid[r][c] = 0;
        }
    }
    /* 2. Bloquer victoire immédiate joueur 1 ? */
    for (int c = 0; c < P4_COLS; c++) {
        int r = get_lowest_row(grid, c);
        if (r != -1) {
            grid[r][c] = 1;
            if (check_win(grid, 1, NULL)) {
                grid[r][c] = 0;
                return c;
            }
            grid[r][c] = 0;
        }
    }

    /* 3. Minimax profondeur 4 */
    int col_order[7] = {3, 2, 4, 1, 5, 0, 6};
    int best_c = -1;
    for (int i = 0; i < P4_COLS; i++) {
        if (get_lowest_row(grid, col_order[i]) != -1) {
            best_c = col_order[i];
            break;
        }
    }
    int max_val = -999999;

    for (int i = 0; i < P4_COLS; i++) {
        int c = col_order[i];
        int r = get_lowest_row(grid, c);
        if (r != -1) {
            grid[r][c] = 2;
            int val = minimax_p4(grid, 4, -999999, 999999, false);
            grid[r][c] = 0;
            if (val > max_val) {
                max_val = val;
                best_c = c;
            }
        }
    }
    return best_c;
}

void run_puissance4_app(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    eq_storage_t* store = eq_storage_get();
    int record_wins = store->record_p4_wins;

    bool vs_ai = true; /* true = 1P vs IA, false = 2 Joueurs */
    uint8_t grid[P4_ROWS][P4_COLS] = {{0}};
    int cur_col = 3;
    uint8_t cur_player = 1; /* 1 = Jaune, 2 = Rouge */
    bool game_over = false;
    int win_coords[4][2] = {{-1,-1},{-1,-1},{-1,-1},{-1,-1}};
    int winner = 0; /* 0 = nul, 1 = P1, 2 = P2/IA */

    /* Tracé initial statique complet */
    eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_P4_BG);

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, P4_TOP_BAR};
    eadk_display_push_rect_uniform(top_bar, 0x10A2);
    eadk_point_t p_title = {8, 4};
    eadk_display_draw_string("Puissance 4 Arcade (Minimax AI)", p_title, false, 0xFFFF, 0x10A2);

    /* Plateau bleu */
    eadk_rect_t board_rect = {P4_BOARD_X, P4_BOARD_Y, P4_BOARD_W, P4_BOARD_H};
    eadk_display_push_rect_uniform(board_rect, COLOR_P4_BOARD);

    /* Bordures 3D du plateau */
    eadk_rect_t b_top = {P4_BOARD_X, P4_BOARD_Y, P4_BOARD_W, 2};
    eadk_rect_t b_bot = {P4_BOARD_X, P4_BOARD_Y + P4_BOARD_H - 2, P4_BOARD_W, 2};
    eadk_rect_t b_lft = {P4_BOARD_X, P4_BOARD_Y, 2, P4_BOARD_H};
    eadk_rect_t b_rgt = {P4_BOARD_X + P4_BOARD_W - 2, P4_BOARD_Y, 2, P4_BOARD_H};
    eadk_display_push_rect_uniform(b_top, COLOR_P4_BORDER);
    eadk_display_push_rect_uniform(b_bot, COLOR_P4_BORDER);
    eadk_display_push_rect_uniform(b_lft, COLOR_P4_BORDER);
    eadk_display_push_rect_uniform(b_rgt, COLOR_P4_BORDER);

    /* Trous vides */
    for (int r = 0; r < P4_ROWS; r++) {
        for (int c = 0; c < P4_COLS; c++) {
            draw_empty_hole(c, r);
        }
    }

    /* Curseur initial */
    draw_cursor(cur_col, cur_player, false);

    /* HUD Bas d'écran */
    char hud_buf[64];
    snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
    eadk_point_t p_hud = {16, 196};
    eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_P4_BG);

    eadk_rect_t bot_help = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
    eadk_display_push_rect_uniform(bot_help, 0x10A2);
    eadk_point_t p_hlp = {8, EADK_SCREEN_HEIGHT - 13};
    eadk_display_draw_string("Gauche/Droite: Colonne | OK: Lacher | Var: Mode | Back: Hub", p_hlp, false, 0x9CD3, 0x10A2);

    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || eadk_keyboard_key_down(kbd, eadk_key_home)) {
            break;
        }

        /* Touche Var ou Toolbox : Bascule Mode 1P vs IA / 2 Joueurs */
        if (eadk_keyboard_key_down(pressed, eadk_key_var) || eadk_keyboard_key_down(pressed, eadk_key_toolbox)) {
            vs_ai = !vs_ai;
            eadk_rect_t clr_hud = {16, 196, 288, 14};
            eadk_display_push_rect_uniform(clr_hud, COLOR_P4_BG);
            snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
            eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_P4_BG);
        }

        if (game_over) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                /* Réinitialisation de la partie */
                for (int r = 0; r < P4_ROWS; r++) {
                    for (int c = 0; c < P4_COLS; c++) {
                        grid[r][c] = 0;
                        draw_empty_hole(c, r);
                    }
                }
                game_over = false;
                winner = 0;
                cur_player = 1;
                cur_col = 3;
                draw_cursor(cur_col, cur_player, false);

                eadk_rect_t clr_hud = {16, 196, 288, 14};
                eadk_display_push_rect_uniform(clr_hud, COLOR_P4_BG);
                snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
                eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_P4_BG);
            }
            prev_kbd = kbd;
            eadk_timing_msleep(20);
            continue;
        }

        /* Déplacement du curseur */
        if (eadk_keyboard_key_down(pressed, eadk_key_left) || eadk_keyboard_key_down(pressed, eadk_key_four)) {
            if (cur_col > 0) {
                cur_col--;
                draw_cursor(cur_col, cur_player, false);
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_right) || eadk_keyboard_key_down(pressed, eadk_key_six)) {
            if (cur_col < P4_COLS - 1) {
                cur_col++;
                draw_cursor(cur_col, cur_player, false);
            }
        }

        /* Lâcher un jeton (Joueur humain) */
        if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe) ||
            eadk_keyboard_key_down(pressed, eadk_key_down) || eadk_keyboard_key_down(pressed, eadk_key_two)) {
            int target_r = get_lowest_row(grid, cur_col);
            if (target_r != -1) {
                /* Animation fluide de descente du jeton */
                for (int r = 0; r <= target_r; r++) {
                    draw_board_token(cur_col, r, cur_player, false);
                    eadk_timing_msleep(22);
                    if (r < target_r) {
                        draw_empty_hole(cur_col, r);
                    }
                }
                grid[target_r][cur_col] = cur_player;

                /* Vérification de victoire */
                if (check_win(grid, cur_player, win_coords)) {
                    game_over = true;
                    winner = cur_player;
                    if (winner == 1 && vs_ai) {
                        record_wins++;
                        store->record_p4_wins = record_wins;
                        eq_storage_commit();
                    }
                    /* Mise en valeur des 4 jetons gagnants */
                    for (int k = 0; k < 4; k++) {
                        draw_board_token(win_coords[k][0], win_coords[k][1], cur_player, true);
                    }
                } else {
                    /* Match nul ? */
                    bool is_full = true;
                    for (int c = 0; c < P4_COLS; c++) {
                        if (grid[0][c] == 0) { is_full = false; break; }
                    }
                    if (is_full) {
                        game_over = true;
                        winner = 0;
                    } else {
                        /* Tour suivant */
                        cur_player = (cur_player == 1) ? 2 : 1;
                        draw_cursor(cur_col, cur_player, false);

                        /* Si c'est au tour de l'IA (Mode 1P) */
                        if (vs_ai && cur_player == 2 && !game_over) {
                            /* Bref temps de réflexion visuel */
                            eadk_rect_t clr_hud = {16, 196, 288, 14};
                            eadk_display_push_rect_uniform(clr_hud, COLOR_P4_BG);
                            eadk_point_t p_think = {16, 196};
                            eadk_display_draw_string("L'IA reflechit a son coup...", p_think, false, COLOR_P2, COLOR_P4_BG);
                            eadk_timing_msleep(150);

                            int ai_col = find_best_ai_move(grid);
                            int ai_r = (ai_col >= 0 && ai_col < P4_COLS) ? get_lowest_row(grid, ai_col) : -1;
                            if (ai_r == -1) {
                                for (int c = 0; c < P4_COLS; c++) {
                                    int tr = get_lowest_row(grid, c);
                                    if (tr != -1) { ai_col = c; ai_r = tr; break; }
                                }
                            }
                            if (ai_r != -1) {
                                cur_col = ai_col;
                                draw_cursor(cur_col, cur_player, false);

                                for (int r = 0; r <= ai_r; r++) {
                                    draw_board_token(ai_col, r, 2, false);
                                    eadk_timing_msleep(22);
                                    if (r < ai_r) {
                                        draw_empty_hole(ai_col, r);
                                    }
                                }
                                grid[ai_r][ai_col] = 2;

                                if (check_win(grid, 2, win_coords)) {
                                    game_over = true;
                                    winner = 2;
                                    for (int k = 0; k < 4; k++) {
                                        draw_board_token(win_coords[k][0], win_coords[k][1], 2, true);
                                    }
                                } else {
                                    bool full_ai = true;
                                    for (int c = 0; c < P4_COLS; c++) {
                                        if (grid[0][c] == 0) { full_ai = false; break; }
                                    }
                                    if (full_ai) {
                                        game_over = true;
                                        winner = 0;
                                    } else {
                                        cur_player = 1;
                                        draw_cursor(cur_col, cur_player, false);
                                    }
                                }
                            }
                            /* Restaurer HUD */
                            eadk_display_push_rect_uniform(clr_hud, COLOR_P4_BG);
                            snprintf(hud_buf, sizeof(hud_buf), "VICTOIRES: %02d   MODE: %s", record_wins, vs_ai ? "1P (vs IA)" : "2 Joueurs");
                            eadk_display_draw_string(hud_buf, p_hud, false, 0xFFFF, COLOR_P4_BG);

                            /* Vider les touches pressées pendant la réflexion de l'IA */
                            while (eadk_keyboard_scan() != 0) eadk_timing_msleep(15);
                            prev_kbd = eadk_keyboard_scan();
                        }
                    }
                }
            }
        }

        /* Message de fin de partie */
        if (game_over) {
            eadk_rect_t banner_box = {30, 85, 260, 60};
            eadk_display_push_rect_uniform(banner_box, 0x10A2);
            eadk_rect_t banner_inner = {32, 87, 256, 56};
            eadk_display_push_rect_uniform(banner_inner, 0x0000);

            if (winner == 1) {
                eadk_point_t p_w = {60, 95};
                eadk_display_draw_string(vs_ai ? "VICTOIRE ! VOUS GAGNEZ !" : "JOUEUR 1 A GAGNE !", p_w, false, COLOR_P1, 0x0000);
            } else if (winner == 2) {
                eadk_point_t p_w = {65, 95};
                eadk_display_draw_string(vs_ai ? "L'IA A GAGNE CE DUEL !" : "JOUEUR 2 A GAGNE !", p_w, false, COLOR_P2, 0x0000);
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
