#ifndef EADK_H
#define EQUALIB_EADK_H

#include <stdint.h>
#include <stdbool.h>

#define EADK_SCREEN_WIDTH  320
#define EADK_SCREEN_HEIGHT 240

typedef uint16_t eadk_color_t;

typedef struct {
  int16_t x;
  int16_t y;
} eadk_point_t;

typedef struct {
  int16_t x;
  int16_t y;
  int16_t width;
  int16_t height;
} eadk_rect_t;

// Encodage RGB565
static inline eadk_color_t eadk_color_rgb(uint8_t r, uint8_t g, uint8_t b) {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

#define EADK_COLOR_WHITE      0xFFFF
#define EADK_COLOR_BLACK      0x0000
#define EADK_COLOR_NUMWORKS   0xFE60 // Jaune officiel NumWorks ~RGB(255, 187, 0)
#define EADK_COLOR_RED        0xF800
#define EADK_COLOR_GREEN      0x07E0
#define EADK_COLOR_BLUE       0x001F
#define EADK_COLOR_GRAY_LIGHT 0xEF5D
#define EADK_COLOR_GRAY_DARK  0x4208
#define EADK_COLOR_TEXT       0x18C3

// Clavier NumWorks
typedef uint64_t eadk_keyboard_state_t;

typedef enum {
  EADK_KEY_LEFT = 0,
  EADK_KEY_UP = 1,
  EADK_KEY_DOWN = 2,
  EADK_KEY_RIGHT = 3,
  EADK_KEY_OK = 4,
  EADK_KEY_BACK = 5,
  EADK_KEY_HOME = 6,
  EADK_KEY_ONOFF = 7,
  EADK_KEY_SHIFT = 12,
  EADK_KEY_ALPHA = 13,
  EADK_KEY_XNT = 14,
  EADK_KEY_VAR = 15,
  EADK_KEY_TOOLBOX = 16,
  EADK_KEY_BACKSPACE = 17,
  EADK_KEY_EXP = 18,
  EADK_KEY_LN = 19,
  EADK_KEY_LOG = 20,
  EADK_KEY_IMAGINARY = 21,
  EADK_KEY_COMMA = 22,
  EADK_KEY_POWER = 23,
  EADK_KEY_SINE = 24,
  EADK_KEY_COSINE = 25,
  EADK_KEY_TANGENT = 26,
  EADK_KEY_PI = 27,
  EADK_KEY_SQRT = 28,
  EADK_KEY_SQUARE = 29,
  EADK_KEY_SEVEN = 30,
  EADK_KEY_EIGHT = 31,
  EADK_KEY_NINE = 32,
  EADK_KEY_LEFT_PARENTHESIS = 33,
  EADK_KEY_RIGHT_PARENTHESIS = 34,
  EADK_KEY_FOUR = 36,
  EADK_KEY_FIVE = 37,
  EADK_KEY_SIX = 38,
  EADK_KEY_MULTIPLICATION = 39,
  EADK_KEY_DIVISION = 40,
  EADK_KEY_ONE = 42,
  EADK_KEY_TWO = 43,
  EADK_KEY_THREE = 44,
  EADK_KEY_PLUS = 45,
  EADK_KEY_MINUS = 46,
  EADK_KEY_ZERO = 48,
  EADK_KEY_DOT = 49,
  EADK_KEY_EE = 50,
  EADK_KEY_ANS = 51,
  EADK_KEY_EXE = 52
} eadk_key_t;

// Fonctions graphiques et système
void eadk_display_push_rect(eadk_rect_t rect, const eadk_color_t * pixels);
void eadk_display_push_rect_uniform(eadk_rect_t rect, eadk_color_t color);
void eadk_display_wait_for_vblank(void);

eadk_keyboard_state_t eadk_keyboard_scan(void);
static inline bool eadk_keyboard_key_down(eadk_keyboard_state_t state, eadk_key_t key) {
  return (state >> key) & 1;
}

uint32_t eadk_timing_millis(void);
void eadk_timing_msleep(uint32_t ms);

#endif // EQUALIB_EADK_H
