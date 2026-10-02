#ifndef EQ_FONT_H
#define EQ_FONT_H

#include "eadk.h"

void eq_display_draw_string(const char* text, eadk_point_t point,
                            bool large_font, eadk_color_t text_color,
                            eadk_color_t background_color);

#endif /* EQ_FONT_H */
