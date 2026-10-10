const fs = require('fs');

const fontSrc = fs.readFileSync('launcher/src/eq_font.c', 'utf8');
const header = `#include <stdint.h>
#include <stdbool.h>

#define EADK_SCREEN_WIDTH 320
#define EADK_SCREEN_HEIGHT 240

typedef uint16_t eadk_color_t;
typedef struct { uint16_t x; uint16_t y; } eadk_point_t;
typedef struct { uint16_t x; uint16_t y; uint16_t width; uint16_t height; } eadk_rect_t;

void eadk_display_push_rect(eadk_rect_t rect, const eadk_color_t* pixels);
`;

const fontClean = fontSrc.replace('#include "eq_font.h"', header)
                         .replace(/eq_display_draw_string/g, 'eadk_display_draw_string');

fs.writeFileSync('tools/eadk_font.c', fontClean);
console.log('Written tools/eadk_font.c successfully!');
