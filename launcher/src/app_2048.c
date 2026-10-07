#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define BOARD_SIZE 4
#define CELL_SIZE  38
#define CELL_GAP   5
#define BOARD_X    70
#define BOARD_Y    30

typedef struct {
    uint16_t bg;
    uint16_t fg;
} tile_color_t;

static tile_color_t get_tile_color(int val) {
    tile_color_t c;
    switch (val) {
        case 0:    c.bg = 0xCE79; c.fg = 0x0000; break;
        case 2:    c.bg = 0xEEE4; c.fg = 0x2104; break;
        case 4:    c.bg = 0xEDE2; c.fg = 0x2104; break;
        case 8:    c.bg = 0xF44C; c.fg = 0xFFFF; break;
        case 16:   c.bg = 0xF3A7; c.fg = 0xFFFF; break;
        case 32:   c.bg = 0xF2C6; c.fg = 0xFFFF; break;
        case 64:   c.bg = 0xF1E4; c.fg = 0xFFFF; break;
        case 128:  c.bg = 0xED4C; c.fg = 0xFFFF; break;
        case 256:  c.bg = 0xED0A; c.fg = 0xFFFF; break;
        case 512:  c.bg = 0xECA8; c.fg = 0xFFFF; break;
        case 1024: c.bg = 0xEC66; c.fg = 0xFFFF; break;
        case 2048: c.bg = 0xEC03; c.fg = 0xFFFF; break;
        default:   c.bg = 0x39E7; c.fg = 0xFFFF; break;
    }
    return c;
}

static void spawn_tile(int grid[BOARD_SIZE][BOARD_SIZE]) {
    int empty_r[BOARD_SIZE * BOARD_SIZE];
    int empty_c[BOARD_SIZE * BOARD_SIZE];
    int empty_count = 0;

    for (int r = 0; r < BOARD_SIZE; r++) {
        for (int c = 0; c < BOARD_SIZE; c++) {
            if (grid[r][c] == 0) {
                empty_r[empty_count] = r;
                empty_c[empty_count] = c;
                empty_count++;
            }
        }
    }

    if (empty_count > 0) {
        int idx = (int)(eadk_random() % empty_count);
        int val = ((eadk_random() % 10) == 0) ? 4 : 2;
        grid[empty_r[idx]][empty_c[idx]] = val;
    }
}

static bool can_move(int grid[BOARD_SIZE][BOARD_SIZE]) {
    for (int r = 0; r < BOARD_SIZE; r++) {
        for (int c = 0; c < BOARD_SIZE; c++) {
            if (grid[r][c] == 0) return true;
            if (c + 1 < BOARD_SIZE && grid[r][c] == grid[r][c + 1]) return true;
            if (r + 1 < BOARD_SIZE && grid[r][c] == grid[r + 1][c]) return true;
        }
    }
    return false;
}

static bool slide_left(int grid[BOARD_SIZE][BOARD_SIZE], int* score) {
    bool moved = false;
    for (int r = 0; r < BOARD_SIZE; r++) {
        int line[BOARD_SIZE] = {0};
        int idx = 0;

        for (int c = 0; c < BOARD_SIZE; c++) {
            if (grid[r][c] != 0) {
                line[idx++] = grid[r][c];
            }
        }

        for (int i = 0; i < BOARD_SIZE - 1; i++) {
            if (line[i] != 0 && line[i] == line[i + 1]) {
                line[i] *= 2;
                *score += line[i];
                line[i + 1] = 0;
                i++;
            }
        }

        int final_line[BOARD_SIZE] = {0};
        idx = 0;
        for (int i = 0; i < BOARD_SIZE; i++) {
            if (line[i] != 0) {
                final_line[idx++] = line[i];
            }
        }

        for (int c = 0; c < BOARD_SIZE; c++) {
            if (grid[r][c] != final_line[c]) {
                moved = true;
                grid[r][c] = final_line[c];
            }
        }
    }
    return moved;
}

static void rotate_grid(int grid[BOARD_SIZE][BOARD_SIZE]) {
    int temp[BOARD_SIZE][BOARD_SIZE];
    for (int r = 0; r < BOARD_SIZE; r++) {
        for (int c = 0; c < BOARD_SIZE; c++) {
            temp[c][BOARD_SIZE - 1 - r] = grid[r][c];
        }
    }
    for (int r = 0; r < BOARD_SIZE; r++) {
        for (int c = 0; c < BOARD_SIZE; c++) {
            grid[r][c] = temp[r][c];
        }
    }
}

void run_2048_app(void) {
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    int grid[BOARD_SIZE][BOARD_SIZE] = {0};
    int score = 0;
    int best_score = 0;
    bool game_over = false;

    spawn_tile(grid);
    spawn_tile(grid);

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
                for (int r = 0; r < BOARD_SIZE; r++) {
                    for (int c = 0; c < BOARD_SIZE; c++) {
                        grid[r][c] = 0;
                    }
                }
                score = 0;
                game_over = false;
                spawn_tile(grid);
                spawn_tile(grid);
                redraw = true;
            }
        } else {
            bool moved = false;

            if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                moved = slide_left(grid, &score);
            } else if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                rotate_grid(grid);
                rotate_grid(grid);
                moved = slide_left(grid, &score);
                rotate_grid(grid);
                rotate_grid(grid);
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                rotate_grid(grid);
                rotate_grid(grid);
                rotate_grid(grid);
                moved = slide_left(grid, &score);
                rotate_grid(grid);
            } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                rotate_grid(grid);
                moved = slide_left(grid, &score);
                rotate_grid(grid);
                rotate_grid(grid);
                rotate_grid(grid);
            }

            if (moved) {
                if (score > best_score) best_score = score;
                spawn_tile(grid);
                if (!can_move(grid)) {
                    game_over = true;
                }
                redraw = true;
            }
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;

            /* Fond d'écran */
            eadk_display_push_rect_uniform(eadk_screen_rect, 0xF7BE);

            /* Barre supérieure */
            eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top_bar, 0xFE60);
            eadk_point_t pt_title = {8, 5};
            eadk_display_draw_string("2048 Ultimate", pt_title, false, eadk_color_black, 0xFE60);

            char score_str[32];
            snprintf(score_str, sizeof(score_str), "Score: %d  Max: %d", score, best_score);
            eadk_point_t pt_score = {160, 5};
            eadk_display_draw_string(score_str, pt_score, false, eadk_color_black, 0xFE60);

            /* Conteneur de la grille 2048 */
            int total_board_w = BOARD_SIZE * CELL_SIZE + (BOARD_SIZE + 1) * CELL_GAP;
            eadk_rect_t board_bg = {
                (uint16_t)(BOARD_X - CELL_GAP),
                (uint16_t)(BOARD_Y - CELL_GAP),
                (uint16_t)total_board_w,
                (uint16_t)total_board_w
            };
            eadk_display_push_rect_uniform(board_bg, 0x9492); /* Slate foncé */

            /* Tuiles */
            for (int r = 0; r < BOARD_SIZE; r++) {
                for (int c = 0; c < BOARD_SIZE; c++) {
                    int val = grid[r][c];
                    tile_color_t tc = get_tile_color(val);

                    int tx = BOARD_X + c * (CELL_SIZE + CELL_GAP);
                    int ty = BOARD_Y + r * (CELL_SIZE + CELL_GAP);

                    eadk_rect_t cell_rect = {(uint16_t)tx, (uint16_t)ty, CELL_SIZE, CELL_SIZE};
                    eadk_display_push_rect_uniform(cell_rect, tc.bg);

                    if (val > 0) {
                        char num_str[12];
                        snprintf(num_str, sizeof(num_str), "%d", val);
                        int len = 0;
                        while (num_str[len]) len++;

                        /* Centrage du texte */
                        int text_x = tx + (CELL_SIZE - len * 7) / 2;
                        int text_y = ty + (CELL_SIZE - 10) / 2;

                        eadk_point_t pt_num = {(uint16_t)text_x, (uint16_t)text_y};
                        eadk_display_draw_string(num_str, pt_num, false, tc.fg, tc.bg);
                    }
                }
            }

            /* Overlay Game Over */
            if (game_over) {
                eadk_rect_t gov_box = {50, 80, 220, 60};
                eadk_display_push_rect_uniform(gov_box, 0x0000);
                eadk_rect_t gov_inner = {52, 82, 216, 56};
                eadk_display_push_rect_uniform(gov_inner, 0xFFFF);

                eadk_point_t pt_g1 = {85, 90};
                eadk_display_draw_string("PARTIE TERMINEE !", pt_g1, false, 0xF800, 0xFFFF);
                eadk_point_t pt_g2 = {68, 112};
                eadk_display_draw_string("OK: Recommencer | BACK: Hub", pt_g2, false, 0x028A, 0xFFFF);
            }

            /* Barre inférieure */
            eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
            eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("Fleches: Deplacer  |  BACK: Hub  |  Var: Furtif", pt_help, false, 0x4208, eadk_color_white);
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
