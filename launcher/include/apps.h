#ifndef EQUALIB_APPS_H
#define EQUALIB_APPS_H

#include <stdint.h>
#include <stddef.h>

void run_mariokart_app(void);
void run_periodic_table_app(void);
void run_courses_app(void);
void run_math_tools_app(void);
void run_text_viewer_app(const char* title, const char* text_data, uint32_t text_size);
void run_flappy_app(void);
void run_2048_app(void);
void run_snake_app(void);
void run_tetris_app(void);
void run_minesweeper_app(void);
void run_python_app(const char* title, const char* script_code, uint32_t script_len);
void run_pong_app(void);
void run_dino_app(void);
void run_space_invaders_app(void);
void run_breakout_app(void);
void run_puissance4_app(void);
void run_morpion_app(void);

#endif // EQUALIB_APPS_H
