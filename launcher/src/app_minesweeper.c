#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define GRID_W     9
#define GRID_H     9
#define TOTAL_MINES 10
#define CELL_SIZE  18
#define BOARD_X    79
#define BOARD_Y    32

typedef struct {
    bool has_mine;
    bool is_revealed;
    bool is_flagged;
    uint8_t count;
} cell_t;

static const uint16_t NUM_COLORS[9] = {
    0xFFFF, /* 0: rien */
    0x001F, /* 1: Bleu */
    0x0460, /* 2: Vert */
    0xF800, /* 3: Rouge */
    0x0010, /* 4: Bleu nuit */
    0x8000, /* 5: Marron */
    0x0410, /* 6: Sarcelle */
    0x0000, /* 7: Noir */
    0x7BEF  /* 8: Gris */
};

static void init_mines(cell_t grid[GRID_H][GRID_W], int safe_r, int safe_c) {
    int placed = 0;
    while (placed < TOTAL_MINES) {
        int r = (int)(eadk_random() % GRID_H);
        int c = (int)(eadk_random() % GRID_W);

        /* Ne pas placer sur ou autour du premier clic pour garantir une zone d'ouverture */
        if (r >= safe_r - 1 && r <= safe_r + 1 && c >= safe_c - 1 && c <= safe_c + 1) {
            continue;
        }

        if (!grid[r][c].has_mine) {
            grid[r][c].has_mine = true;
            placed++;
        }
    }

    /* Calcul des mines adjacentes */
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
    /* File d'attente statique pour éviter tout dépassement de pile récursif */
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
    int revealed_count = 0;
    int flags_count = 0;
    bool first_click = true;
    bool game_over = false;
    bool win = false;

    uint64_t start_time = 0;
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

        if (game_over || win) {
            if (eadk_keyboard_key_down(pressed, eadk_key_ok) ||
                eadk_keyboard_key_down(pressed, eadk_key_exe)) {
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
                revealed_count = 0;
                flags_count = 0;
                first_click = true;
                game_over = false;
                win = false;
                start_time = 0;
                redraw = true;
            }
        } else {
            /* Navigation curseur */
            if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                if (cursor_c > 0) { cursor_c--; redraw = true; }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                if (cursor_c < GRID_W - 1) { cursor_c++; redraw = true; }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                if (cursor_r > 0) { cursor_r--; redraw = true; }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (cursor_r < GRID_H - 1) { cursor_r++; redraw = true; }
            }

            /* Révélation d'une case (OK / EXE) */
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
                        /* Révéler toutes les mines */
                        for (int r = 0; r < GRID_H; r++) {
                            for (int c = 0; c < GRID_W; c++) {
                                if (grid[r][c].has_mine) grid[r][c].is_revealed = true;
                            }
                        }
                    } else {
                        grid[cursor_r][cursor_c].is_revealed = true;
                        revealed_count++;

                        if (grid[cursor_r][cursor_c].count == 0) {
                            reveal_empty(grid, cursor_r, cursor_c, &revealed_count);
                        }

                        if (revealed_count >= (GRID_W * GRID_H - TOTAL_MINES)) {
                            win = true;
                        }
                    }
                    redraw = true;
                }
            }

            /* Poser / Retirer un drapeau (Toolbox, Shift ou Ans) */
            if (eadk_keyboard_key_down(pressed, eadk_key_toolbox) ||
                eadk_keyboard_key_down(pressed, eadk_key_shift) ||
                eadk_keyboard_key_down(pressed, eadk_key_ans)) {
                if (!grid[cursor_r][cursor_c].is_revealed) {
                    grid[cursor_r][cursor_c].is_flagged = !grid[cursor_r][cursor_c].is_flagged;
                    if (grid[cursor_r][cursor_c].is_flagged) flags_count++;
                    else flags_count--;
                    redraw = true;
                }
            }
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;

            /* Fond */
            eadk_display_push_rect_uniform(eadk_screen_rect, 0xC618);

            /* Barre supérieure */
            eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top_bar, 0xFE60);
            eadk_point_t pt_title = {8, 5};
            eadk_display_draw_string("Demineur NumWorks", pt_title, false, eadk_color_black, 0xFE60);

            /* Compteur de mines et chrono */
            char stat_buf[32];
            int elapsed = first_click ? 0 : (int)((eadk_timing_millis() - start_time) / 1000);
            snprintf(stat_buf, sizeof(stat_buf), "Mines: %d  Temps: %ds", TOTAL_MINES - flags_count, elapsed);
            eadk_point_t pt_st = {170, 5};
            eadk_display_draw_string(stat_buf, pt_st, false, eadk_color_black, 0xFE60);

            /* Cadre de la grille */
            eadk_rect_t grid_border = {
                (uint16_t)(BOARD_X - 2),
                (uint16_t)(BOARD_Y - 2),
                (uint16_t)(GRID_W * CELL_SIZE + 4),
                (uint16_t)(GRID_H * CELL_SIZE + 4)
            };
            eadk_display_push_rect_uniform(grid_border, 0x7BEF);

            /* Cellules */
            for (int r = 0; r < GRID_H; r++) {
                for (int c = 0; c < GRID_W; c++) {
                    int cx = BOARD_X + c * CELL_SIZE;
                    int cy = BOARD_Y + r * CELL_SIZE;

                    eadk_rect_t cell_rect = {(uint16_t)cx, (uint16_t)cy, CELL_SIZE, CELL_SIZE};

                    if (!grid[r][c].is_revealed) {
                        /* Case non révélée en relief */
                        eadk_display_push_rect_uniform(cell_rect, 0xBDF7);

                        /* Bordure supérieure et gauche claire */
                        eadk_rect_t top_l = {(uint16_t)cx, (uint16_t)cy, CELL_SIZE, 1};
                        eadk_display_push_rect_uniform(top_l, 0xFFFF);
                        eadk_rect_t left_l = {(uint16_t)cx, (uint16_t)cy, 1, CELL_SIZE};
                        eadk_display_push_rect_uniform(left_l, 0xFFFF);

                        /* Bordure inférieure et droite sombre */
                        eadk_rect_t bot_l = {(uint16_t)cx, (uint16_t)(cy + CELL_SIZE - 1), CELL_SIZE, 1};
                        eadk_display_push_rect_uniform(bot_l, 0x7BEF);
                        eadk_rect_t right_l = {(uint16_t)(cx + CELL_SIZE - 1), (uint16_t)cy, 1, CELL_SIZE};
                        eadk_display_push_rect_uniform(right_l, 0x7BEF);

                        if (grid[r][c].is_flagged) {
                            /* Drapeau rouge */
                            eadk_rect_t flag_p = {(uint16_t)(cx + 4), (uint16_t)(cy + 4), 10, 7};
                            eadk_display_push_rect_uniform(flag_p, 0xF800);
                            eadk_rect_t mast = {(uint16_t)(cx + 12), (uint16_t)(cy + 4), 2, 11};
                            eadk_display_push_rect_uniform(mast, 0x0000);
                        }
                    } else {
                        /* Case révélée (plate) */
                        if (grid[r][c].has_mine) {
                            /* Mine explosée */
                            eadk_display_push_rect_uniform(cell_rect, 0xF800);
                            eadk_rect_t mine_dot = {(uint16_t)(cx + 4), (uint16_t)(cy + 4), 10, 10};
                            eadk_display_push_rect_uniform(mine_dot, 0x0000);
                        } else {
                            eadk_display_push_rect_uniform(cell_rect, 0xE73C);

                            /* Contour discret */
                            eadk_rect_t border_d = {(uint16_t)cx, (uint16_t)cy, CELL_SIZE, 1};
                            eadk_display_push_rect_uniform(border_d, 0xAD55);

                            if (grid[r][c].count > 0) {
                                char ch[2] = {'0' + grid[r][c].count, '\0'};
                                eadk_point_t pt_num = {(uint16_t)(cx + 6), (uint16_t)(cy + 4)};
                                eadk_display_draw_string(ch, pt_num, false, NUM_COLORS[grid[r][c].count], 0xE73C);
                            }
                        }
                    }

                    /* Curseur de sélection */
                    if (r == cursor_r && c == cursor_c) {
                        /* Cadre jaune/orange vif */
                        eadk_rect_t c_top = {(uint16_t)cx, (uint16_t)cy, CELL_SIZE, 2};
                        eadk_display_push_rect_uniform(c_top, 0xFE60);
                        eadk_rect_t c_bot = {(uint16_t)cx, (uint16_t)(cy + CELL_SIZE - 2), CELL_SIZE, 2};
                        eadk_display_push_rect_uniform(c_bot, 0xFE60);
                        eadk_rect_t c_l = {(uint16_t)cx, (uint16_t)cy, 2, CELL_SIZE};
                        eadk_display_push_rect_uniform(c_l, 0xFE60);
                        eadk_rect_t c_r = {(uint16_t)(cx + CELL_SIZE - 2), (uint16_t)cy, 2, CELL_SIZE};
                        eadk_display_push_rect_uniform(c_r, 0xFE60);
                    }
                }
            }

            /* Fin de partie / Victoire */
            if (win) {
                eadk_rect_t w_box = {60, 85, 200, 52};
                eadk_display_push_rect_uniform(w_box, 0x0000);
                eadk_rect_t w_in = {62, 87, 196, 48};
                eadk_display_push_rect_uniform(w_in, 0xFFFF);
                eadk_point_t pt_w1 = {85, 93};
                eadk_display_draw_string("VICTOIRE ! BRAVO !", pt_w1, false, 0x0460, 0xFFFF);
                eadk_point_t pt_w2 = {68, 114};
                eadk_display_draw_string("OK: Rejouer | BACK: Hub", pt_w2, false, 0x028A, 0xFFFF);
            } else if (game_over) {
                eadk_rect_t l_box = {60, 85, 200, 52};
                eadk_display_push_rect_uniform(l_box, 0x0000);
                eadk_rect_t l_in = {62, 87, 196, 48};
                eadk_display_push_rect_uniform(l_in, 0xFFFF);
                eadk_point_t pt_l1 = {100, 93};
                eadk_display_draw_string("BOOM ! PERDU", pt_l1, false, 0xF800, 0xFFFF);
                eadk_point_t pt_l2 = {68, 114};
                eadk_display_draw_string("OK: Rejouer | BACK: Hub", pt_l2, false, 0x028A, 0xFFFF);
            }

            /* Barre inférieure */
            eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
            eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("OK: Creuser | Shift/Toolbox: Drapeau | Var: Furtif", pt_help, false, 0x4208, eadk_color_white);
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
