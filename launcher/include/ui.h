#ifndef EQUALIB_UI_H
#define EQUALIB_UI_H

#include "eadk.h"
#include "equalib_bundle.h"

#define STATUS_BAR_HEIGHT 18
#define ICON_WIDTH        55
#define ICON_HEIGHT       56
#define GRID_COLS         3
#define GRID_ROWS         2

void ui_init(void);
void ui_clear_screen(eadk_color_t color);
void ui_draw_status_bar(const char * title, bool exam_mode_active);
void ui_draw_app_grid(const equalib_header_t * header, const equalib_app_entry_t * apps, int selected_index);
void ui_draw_string(int x, int y, const char * text, eadk_color_t fg, eadk_color_t bg);
void ui_draw_rect(int x, int y, int w, int h, eadk_color_t color);
void ui_draw_rect_outline(int x, int y, int w, int h, eadk_color_t color);
void ui_draw_default_icon(int x, int y, const char * initial, bool selected);

#endif // EQUALIB_UI_H
