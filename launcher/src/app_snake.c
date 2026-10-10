#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

#define COLS         32
#define ROWS         22
#define CELL_SIZE    8
#define BOARD_X      32
#define BOARD_Y      26
#define MAX_SNAKE    500

#define COLOR_ARENA_BG    0x0841  /* Fond arène vert/bleu nuit très sombre */
#define COLOR_ARENA_DOT   0x1082  /* Pointillé discret */
#define COLOR_OUTER_BG    0x18C3  /* Gris ardoise contour */
#define COLOR_BORDER_HI   0xFFFF  /* Biseau haut/gauche */
#define COLOR_BORDER_LO   0x0841  /* Biseau bas/droite */

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

/* ------------------------------------------------------------------------- */
/* Palette et Sprites 8x8 Pixels                                             */
/* ------------------------------------------------------------------------- */
#define S_TR  0x0001 /* Transparent (remplacé par COLOR_ARENA_BG) */
#define S_BK  0x0000 /* Noir contour */
#define S_RD  0xF800 /* Rouge pomme */
#define S_RL  0xFD20 /* Reflet clair pomme */
#define S_RD_DK 0x9000 /* Ombre pomme */
#define S_WT  0xFFFF /* Blanc éclat / oeil */
#define S_BR  0x8A22 /* Brun tige */
#define S_LF  0x2DE0 /* Vert feuille */

#define S_GN  0x4FE0 /* Vert serpent vif */
#define S_GL  0x7FE0 /* Vert clair reflet */
#define S_GD  0x1BA0 /* Vert sombre contour/écaille */
#define S_TG  0xF800 /* Langue rouge */

/* Sprite Pomme 8x8 */
static const uint16_t s_sprite_apple[8][8] = {
    {S_TR, S_TR, S_TR, S_BR, S_LF, S_LF, S_TR, S_TR},
    {S_TR, S_TR, S_BR, S_LF, S_LF, S_TR, S_TR, S_TR},
    {S_TR, S_RD, S_RD, S_RD, S_RD, S_RD, S_RD, S_TR},
    {S_RD, S_WT, S_RL, S_RD, S_RD, S_RD, S_RD, S_RD},
    {S_RD, S_RL, S_RD, S_RD, S_RD, S_RD, S_RD, S_RD},
    {S_RD, S_RD, S_RD, S_RD, S_RD, S_RD, S_RD, S_RD},
    {S_TR, S_RD_DK, S_RD_DK, S_RD_DK, S_RD_DK, S_RD_DK, S_RD_DK, S_TR},
    {S_TR, S_TR, S_RD_DK, S_RD_DK, S_RD_DK, S_RD_DK, S_TR, S_TR}
};

/* Sprite Tête vers la DROITE */
static const uint16_t s_head_right[8][8] = {
    {S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR, S_TR},
    {S_GD, S_GN, S_GL, S_WT, S_BK, S_GN, S_GD, S_TR},
    {S_GD, S_GL, S_GN, S_WT, S_BK, S_GN, S_GD, S_TR},
    {S_GD, S_GN, S_GN, S_GN, S_GN, S_GN, S_GN, S_TG},
    {S_GD, S_GN, S_GN, S_GN, S_GN, S_GN, S_GN, S_TG},
    {S_GD, S_GL, S_GN, S_WT, S_BK, S_GN, S_GD, S_TR},
    {S_GD, S_GN, S_GL, S_WT, S_BK, S_GN, S_GD, S_TR},
    {S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR, S_TR}
};

/* Sprite Tête vers la GAUCHE */
static const uint16_t s_head_left[8][8] = {
    {S_TR, S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR},
    {S_TR, S_GD, S_GN, S_BK, S_WT, S_GL, S_GN, S_GD},
    {S_TR, S_GD, S_GN, S_BK, S_WT, S_GN, S_GL, S_GD},
    {S_TG, S_GN, S_GN, S_GN, S_GN, S_GN, S_GN, S_GD},
    {S_TG, S_GN, S_GN, S_GN, S_GN, S_GN, S_GN, S_GD},
    {S_TR, S_GD, S_GN, S_BK, S_WT, S_GN, S_GL, S_GD},
    {S_TR, S_GD, S_GN, S_BK, S_WT, S_GL, S_GN, S_GD},
    {S_TR, S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR}
};

/* Sprite Tête vers le HAUT */
static const uint16_t s_head_up[8][8] = {
    {S_TR, S_TR, S_TG, S_TG, S_TG, S_TR, S_TR, S_TR},
    {S_TR, S_GD, S_GN, S_GN, S_GN, S_GN, S_GD, S_TR},
    {S_GD, S_WT, S_WT, S_GN, S_GN, S_WT, S_WT, S_GD},
    {S_GD, S_BK, S_BK, S_GN, S_GN, S_BK, S_BK, S_GD},
    {S_GD, S_GL, S_GN, S_GN, S_GN, S_GN, S_GL, S_GD},
    {S_GD, S_GN, S_GN, S_GN, S_GN, S_GN, S_GN, S_GD},
    {S_GD, S_GD, S_GN, S_GN, S_GN, S_GN, S_GD, S_GD},
    {S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR}
};

/* Sprite Tête vers le BAS */
static const uint16_t s_head_down[8][8] = {
    {S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR},
    {S_GD, S_GD, S_GN, S_GN, S_GN, S_GN, S_GD, S_GD},
    {S_GD, S_GN, S_GN, S_GN, S_GN, S_GN, S_GN, S_GD},
    {S_GD, S_GL, S_GN, S_GN, S_GN, S_GN, S_GL, S_GD},
    {S_GD, S_BK, S_BK, S_GN, S_GN, S_BK, S_BK, S_GD},
    {S_GD, S_WT, S_WT, S_GN, S_GN, S_WT, S_WT, S_GD},
    {S_TR, S_GD, S_GN, S_GN, S_GN, S_GN, S_GD, S_TR},
    {S_TR, S_TR, S_TG, S_TG, S_TG, S_TR, S_TR, S_TR}
};

/* Sprite Corps écailleux 8x8 */
static const uint16_t s_body_cell[8][8] = {
    {S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR},
    {S_GD, S_GL, S_GL, S_GN, S_GN, S_GL, S_GL, S_GD},
    {S_GD, S_GL, S_GN, S_GN, S_GN, S_GN, S_GL, S_GD},
    {S_GD, S_GN, S_GN, S_GD, S_GD, S_GN, S_GN, S_GD},
    {S_GD, S_GN, S_GN, S_GD, S_GD, S_GN, S_GN, S_GD},
    {S_GD, S_GL, S_GN, S_GN, S_GN, S_GN, S_GL, S_GD},
    {S_GD, S_GL, S_GL, S_GN, S_GN, S_GL, S_GL, S_GD},
    {S_TR, S_GD, S_GD, S_GD, S_GD, S_GD, S_GD, S_TR}
};

/* ------------------------------------------------------------------------- */
/* Fonctions de tracé de cellules individuelles 8x8                          */
/* ------------------------------------------------------------------------- */
static void draw_sprite_8x8(int cell_x, int cell_y, const uint16_t sprite[8][8]) {
    uint16_t buf[64];
    for (int r = 0; r < 8; r++) {
        for (int c = 0; c < 8; c++) {
            uint16_t p = sprite[r][c];
            buf[r * 8 + c] = (p == S_TR) ? COLOR_ARENA_BG : p;
        }
    }
    eadk_rect_t rect = {(uint16_t)(BOARD_X + cell_x * CELL_SIZE), (uint16_t)(BOARD_Y + cell_y * CELL_SIZE), CELL_SIZE, CELL_SIZE};
    eadk_display_push_rect(rect, buf);
}

static void clear_cell_8x8(int cell_x, int cell_y) {
    eadk_rect_t rect = {(uint16_t)(BOARD_X + cell_x * CELL_SIZE), (uint16_t)(BOARD_Y + cell_y * CELL_SIZE), CELL_SIZE, CELL_SIZE};
    eadk_display_push_rect_uniform(rect, COLOR_ARENA_BG);
}

static void draw_head(int cell_x, int cell_y, dir_t dir) {
    if (dir == DIR_RIGHT) draw_sprite_8x8(cell_x, cell_y, s_head_right);
    else if (dir == DIR_LEFT) draw_sprite_8x8(cell_x, cell_y, s_head_left);
    else if (dir == DIR_UP) draw_sprite_8x8(cell_x, cell_y, s_head_up);
    else draw_sprite_8x8(cell_x, cell_y, s_head_down);
}

static void draw_body(int cell_x, int cell_y) {
    draw_sprite_8x8(cell_x, cell_y, s_body_cell);
}

static void draw_apple(int cell_x, int cell_y) {
    draw_sprite_8x8(cell_x, cell_y, s_sprite_apple);
}

/* ------------------------------------------------------------------------- */
/* Génération de la nourriture                                               */
/* ------------------------------------------------------------------------- */
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

/* ------------------------------------------------------------------------- */
/* Application Snake Classic Principale                                      */
/* ------------------------------------------------------------------------- */
void run_snake_app(void) {
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    point_t snake[MAX_SNAKE];
    int len = 4;
    dir_t dir = DIR_RIGHT;
    dir_t next_dir = DIR_RIGHT;
    dir_t queued_dir = DIR_RIGHT;
    bool has_queued = false;

    for (int i = 0; i < len; i++) {
        snake[i].x = 10 - i;
        snake[i].y = 11;
    }

    point_t food;
    spawn_food(&food, snake, len);

    int score = 0;
    int best_score = 0;
    int prev_drawn_score = -1;
    bool game_over = false;
    uint64_t last_move_ms = eadk_timing_millis();

    eadk_keyboard_state_t prev_kbd = 0;

    /* Rendu complet initial de l'arène (UNE SEULE FOIS pour 0 scintillement) */
    eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_OUTER_BG);

    /* Barre supérieure */
    eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
    eadk_display_push_rect_uniform(top_bar, 0xFE60);
    eadk_point_t pt_title = {8, 5};
    eadk_display_draw_string("Snake Classic", pt_title, false, eadk_color_black, 0xFE60);

    /* Bordure biseautée de l'arène */
    eadk_rect_t border_box = {
        (uint16_t)(BOARD_X - 2),
        (uint16_t)(BOARD_Y - 2),
        (uint16_t)(COLS * CELL_SIZE + 4),
        (uint16_t)(ROWS * CELL_SIZE + 4)
    };
    eadk_display_push_rect_uniform(border_box, COLOR_BORDER_HI);

    eadk_rect_t arena_bg = {
        (uint16_t)BOARD_X,
        (uint16_t)BOARD_Y,
        (uint16_t)(COLS * CELL_SIZE),
        (uint16_t)(ROWS * CELL_SIZE)
    };
    eadk_display_push_rect_uniform(arena_bg, COLOR_ARENA_BG);

    /* Barre inférieure d'aide */
    eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
    eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);
    eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
    eadk_display_draw_string("Fleches: Direction  |  BACK: Hub", pt_help, false, 0x4208, eadk_color_white);

    /* Dessin initial du serpent et de la pomme */
    draw_head(snake[0].x, snake[0].y, dir);
    for (int i = 1; i < len; i++) {
        draw_body(snake[i].x, snake[i].y);
    }
    draw_apple(food.x, food.y);

    while (true) {
        uint64_t frame_start = eadk_timing_millis();

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
                /* Nettoyer l'arène */
                eadk_display_push_rect_uniform(arena_bg, COLOR_ARENA_BG);

                len = 4;
                dir = DIR_RIGHT;
                next_dir = DIR_RIGHT;
                has_queued = false;
                for (int i = 0; i < len; i++) {
                    snake[i].x = 10 - i;
                    snake[i].y = 11;
                }
                spawn_food(&food, snake, len);
                score = 0;
                prev_drawn_score = -1;
                game_over = false;
                last_move_ms = eadk_timing_millis();

                draw_head(snake[0].x, snake[0].y, dir);
                for (int i = 1; i < len; i++) {
                    draw_body(snake[i].x, snake[i].y);
                }
                draw_apple(food.x, food.y);
            }
        } else {
            /* File d'attente d'entrées pour réactivité arcade */
            dir_t input_cand = dir;
            bool got_input = false;

            if (eadk_keyboard_key_down(pressed, eadk_key_up)) { input_cand = DIR_UP; got_input = true; }
            else if (eadk_keyboard_key_down(pressed, eadk_key_down)) { input_cand = DIR_DOWN; got_input = true; }
            else if (eadk_keyboard_key_down(pressed, eadk_key_left)) { input_cand = DIR_LEFT; got_input = true; }
            else if (eadk_keyboard_key_down(pressed, eadk_key_right)) { input_cand = DIR_RIGHT; got_input = true; }

            if (got_input) {
                dir_t check_against = next_dir;
                bool is_opposite = (input_cand == DIR_UP && check_against == DIR_DOWN) ||
                                  (input_cand == DIR_DOWN && check_against == DIR_UP) ||
                                  (input_cand == DIR_LEFT && check_against == DIR_RIGHT) ||
                                  (input_cand == DIR_RIGHT && check_against == DIR_LEFT);
                if (!is_opposite) {
                    if (next_dir == dir) {
                        next_dir = input_cand;
                    } else {
                        queued_dir = input_cand;
                        has_queued = true;
                    }
                }
            }

            /* Vitesse progressive selon le score */
            int interval = 110 - (score * 2);
            if (interval < 45) interval = 45;

            uint64_t now = eadk_timing_millis();
            if (now - last_move_ms >= (uint64_t)interval) {
                last_move_ms = now;

                dir = next_dir;
                if (has_queued) {
                    next_dir = queued_dir;
                    has_queued = false;
                }

                point_t new_head = snake[0];
                if (dir == DIR_UP) new_head.y--;
                else if (dir == DIR_DOWN) new_head.y++;
                else if (dir == DIR_LEFT) new_head.x--;
                else if (dir == DIR_RIGHT) new_head.x++;

                /* Collision bordures */
                if (new_head.x < 0 || new_head.x >= COLS ||
                    new_head.y < 0 || new_head.y >= ROWS) {
                    game_over = true;
                }

                /* Collision corps */
                if (!game_over) {
                    for (int i = 0; i < len; i++) {
                        if (snake[i].x == new_head.x && snake[i].y == new_head.y) {
                            game_over = true;
                            break;
                        }
                    }
                }

                if (!game_over) {
                    bool ate = (new_head.x == food.x && new_head.y == food.y);
                    point_t old_tail = snake[len - 1];

                    /* Avance du corps */
                    for (int i = len; i > 0; i--) {
                        snake[i] = snake[i - 1];
                    }
                    snake[0] = new_head;

                    /* 1. Effacer l'ancienne queue si on n'a pas mangé */
                    if (!ate) {
                        clear_cell_8x8(old_tail.x, old_tail.y);
                    } else {
                        if (len < MAX_SNAKE - 1) len++;
                        score++;
                        if (score > best_score) best_score = score;
                        spawn_food(&food, snake, len);
                        draw_apple(food.x, food.y);
                    }

                    /* 2. Remplacer l'ancienne tête par un corps */
                    draw_body(snake[1].x, snake[1].y);

                    /* 3. Dessiner la nouvelle tête */
                    draw_head(new_head.x, new_head.y, dir);
                } else {
                    /* Fenêtre Game Over */
                    eadk_rect_t gov_box = {60, 80, 200, 56};
                    eadk_display_push_rect_uniform(gov_box, 0xFFFF);
                    eadk_rect_t gov_inner = {62, 82, 196, 52};
                    eadk_display_push_rect_uniform(gov_inner, 0x0000);

                    eadk_point_t pt_g1 = {95, 88};
                    eadk_display_draw_string("GAME OVER", pt_g1, true, 0xF800, 0x0000);
                    eadk_point_t pt_g2 = {74, 114};
                    eadk_display_draw_string("OK: Rejouer | BACK: Hub", pt_g2, false, 0xFFFF, 0x0000);
                }
            }
        }

        /* Mise à jour du score uniquement lorsqu'il change */
        if (score != prev_drawn_score) {
            prev_drawn_score = score;
            char score_str[32];
            snprintf(score_str, sizeof(score_str), "Score: %d  Max: %d", score, best_score);

            eadk_rect_t score_bg = {170, 0, 145, 22};
            eadk_display_push_rect_uniform(score_bg, 0xFE60);

            eadk_point_t pt_score = {175, 5};
            eadk_display_draw_string(score_str, pt_score, false, eadk_color_black, 0xFE60);
        }

        prev_kbd = kbd;

        /* Pause fluide pour scruter le clavier sans surcharger le processeur */
        eadk_timing_msleep(10);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
