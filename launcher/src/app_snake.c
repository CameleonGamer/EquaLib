#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define COLS       32
#define ROWS       22
#define CELL_SIZE  8
#define BOARD_X    32
#define BOARD_Y    26
#define MAX_SNAKE  500

typedef enum {
    DIR_UP,
    DIR_DOWN,
    DIR_LEFT,
    DIR_RIGHT
} dir_t;

typedef struct {
    int x;
    int y;
} point_t;

static void spawn_food(point_t* food, const point_t* snake, int len) {
    while (true) {
        food->x = (int)(eadk_random() % COLS);
        food->y = (int)(eadk_random() % ROWS);

        bool on_snake = false;
        for (int i = 0; i < len; i++) {
            if (snake[i].x == food->x && snake[i].y == food->y) {
                on_snake = true;
                break;
            }
        }
        if (!on_snake) break;
    }
}

void run_snake_app(void) {
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    point_t snake[MAX_SNAKE];
    int len = 4;
    dir_t dir = DIR_RIGHT;
    dir_t next_dir = DIR_RIGHT;

    /* Initialisation serpent au centre */
    for (int i = 0; i < len; i++) {
        snake[i].x = 10 - i;
        snake[i].y = 11;
    }

    point_t food;
    spawn_food(&food, snake, len);

    int score = 0;
    int best_score = 0;
    bool game_over = false;
    uint64_t last_move_ms = eadk_timing_millis();

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
                len = 4;
                dir = DIR_RIGHT;
                next_dir = DIR_RIGHT;
                for (int i = 0; i < len; i++) {
                    snake[i].x = 10 - i;
                    snake[i].y = 11;
                }
                spawn_food(&food, snake, len);
                score = 0;
                game_over = false;
                last_move_ms = eadk_timing_millis();
                redraw = true;
            }
        } else {
            /* Entrées directionnelles */
            if (eadk_keyboard_key_down(pressed, eadk_key_up) && dir != DIR_DOWN) {
                next_dir = DIR_UP;
            } else if (eadk_keyboard_key_down(pressed, eadk_key_down) && dir != DIR_UP) {
                next_dir = DIR_DOWN;
            } else if (eadk_keyboard_key_down(pressed, eadk_key_left) && dir != DIR_RIGHT) {
                next_dir = DIR_LEFT;
            } else if (eadk_keyboard_key_down(pressed, eadk_key_right) && dir != DIR_LEFT) {
                next_dir = DIR_RIGHT;
            }

            /* Vitesse variable selon le score */
            int interval = 120 - (score * 2);
            if (interval < 50) interval = 50;

            uint64_t now = eadk_timing_millis();
            if (now - last_move_ms >= (uint64_t)interval) {
                last_move_ms = now;
                dir = next_dir;

                point_t new_head = snake[0];
                if (dir == DIR_UP) new_head.y--;
                else if (dir == DIR_DOWN) new_head.y++;
                else if (dir == DIR_LEFT) new_head.x--;
                else if (dir == DIR_RIGHT) new_head.x++;

                /* Collision murs */
                if (new_head.x < 0 || new_head.x >= COLS ||
                    new_head.y < 0 || new_head.y >= ROWS) {
                    game_over = true;
                }

                /* Collision avec soi-même */
                if (!game_over) {
                    for (int i = 0; i < len; i++) {
                        if (snake[i].x == new_head.x && snake[i].y == new_head.y) {
                            game_over = true;
                            break;
                        }
                    }
                }

                if (!game_over) {
                    /* Avancement du corps */
                    for (int i = len; i > 0; i--) {
                        snake[i] = snake[i - 1];
                    }
                    snake[0] = new_head;

                    /* Nourriture mangée ? */
                    if (new_head.x == food.x && new_head.y == food.y) {
                        score++;
                        if (score > best_score) best_score = score;
                        if (len < MAX_SNAKE - 1) len++;
                        spawn_food(&food, snake, len);
                    }
                }

                redraw = true;
            }
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;

            /* Fond général */
            eadk_display_push_rect_uniform(eadk_screen_rect, 0x18E3);

            /* Barre supérieure */
            eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top_bar, 0xFE60);
            eadk_point_t pt_title = {8, 5};
            eadk_display_draw_string("Snake Classic", pt_title, false, eadk_color_black, 0xFE60);

            char score_str[32];
            snprintf(score_str, sizeof(score_str), "Score: %d  Max: %d", score, best_score);
            eadk_point_t pt_score = {170, 5};
            eadk_display_draw_string(score_str, pt_score, false, eadk_color_black, 0xFE60);

            /* Bordure arène */
            eadk_rect_t arena_border = {
                (uint16_t)(BOARD_X - 2),
                (uint16_t)(BOARD_Y - 2),
                (uint16_t)(COLS * CELL_SIZE + 4),
                (uint16_t)(ROWS * CELL_SIZE + 4)
            };
            eadk_display_push_rect_uniform(arena_border, 0xFFFF);

            eadk_rect_t arena_bg = {
                (uint16_t)BOARD_X,
                (uint16_t)BOARD_Y,
                (uint16_t)(COLS * CELL_SIZE),
                (uint16_t)(ROWS * CELL_SIZE)
            };
            eadk_display_push_rect_uniform(arena_bg, 0x0000);

            /* Nourriture (pomme rouge) */
            eadk_rect_t food_rect = {
                (uint16_t)(BOARD_X + food.x * CELL_SIZE + 1),
                (uint16_t)(BOARD_Y + food.y * CELL_SIZE + 1),
                CELL_SIZE - 2,
                CELL_SIZE - 2
            };
            eadk_display_push_rect_uniform(food_rect, 0xF800);

            /* Serpent */
            for (int i = 0; i < len; i++) {
                uint16_t color = (i == 0) ? 0x07E0 : 0x05E0;
                eadk_rect_t seg = {
                    (uint16_t)(BOARD_X + snake[i].x * CELL_SIZE + 1),
                    (uint16_t)(BOARD_Y + snake[i].y * CELL_SIZE + 1),
                    CELL_SIZE - 2,
                    CELL_SIZE - 2
                };
                eadk_display_push_rect_uniform(seg, color);
            }

            /* Message Game Over */
            if (game_over) {
                eadk_rect_t gov_box = {60, 80, 200, 56};
                eadk_display_push_rect_uniform(gov_box, 0xFFFF);
                eadk_rect_t gov_inner = {62, 82, 196, 52};
                eadk_display_push_rect_uniform(gov_inner, 0x0000);

                eadk_point_t pt_g1 = {95, 88};
                eadk_display_draw_string("GAME OVER", pt_g1, true, 0xF800, 0x0000);
                eadk_point_t pt_g2 = {74, 114};
                eadk_display_draw_string("OK: Rejouer | BACK: Hub", pt_g2, false, 0xFFFF, 0x0000);
            }

            /* Barre inférieure */
            eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
            eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("Fleches: Direction  |  BACK: Hub  |  Var: Furtif", pt_help, false, 0x4208, eadk_color_white);
        }

        eadk_timing_msleep(15);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
