#include "exam_sim.h"
#include "ui.h"
#include <string.h>

static bool s_exam_active = false;
static uint32_t s_last_pulse_ms = 0;
static bool s_led_is_on = false;

// Registres matériels STM32 pour accès direct GPIO
// Note : STM32H725 (N0120) vs STM32F730 (N0110)
#define STM32F7_GPIOB_BSRR ((volatile uint32_t *)0x40020418)
#define STM32H7_GPIOB_BSRR ((volatile uint32_t *)0x58020418)

void exam_sim_set_hardware_led(bool r, bool g, bool b) {
  // Tentative d'écriture registre bas-niveau si l'accès MPU est toléré
  // Sur NumWorks, la broche LED rouge est traditionnellement sur GPIOB pin 0 ou 1
  (void)g;
  (void)b;

  // Pulse sur le bus STM32
  // En cas d'exception mémoire sur firmware ultra-verrouillé, l'environnement EADK continue sans crash
  #if defined(__arm__)
  volatile uint32_t * bsrr = STM32H7_GPIOB_BSRR;
  if (r) {
    *bsrr = (1 << 0); // Set
  } else {
    *bsrr = (1 << (0 + 16)); // Reset
  }
  #else
  (void)r;
  #endif
}

void exam_sim_init(void) {
  s_exam_active = false;
  s_last_pulse_ms = 0;
  s_led_is_on = false;
  exam_sim_set_hardware_led(false, false, false);
}

void exam_sim_set_active(bool active) {
  s_exam_active = active;
  if (!active) {
    s_led_is_on = false;
    exam_sim_set_hardware_led(false, false, false);
  }
}

bool exam_sim_is_active(void) {
  return s_exam_active;
}

void exam_sim_tick(uint32_t now_ms) {
  if (!s_exam_active) return;

  // Cycle officiel NumWorks : Période de 1000 ms (1 Hz)
  // LED allumée pendant ~120 ms, puis éteinte pendant ~880 ms
  uint32_t elapsed = now_ms - s_last_pulse_ms;

  if (!s_led_is_on && elapsed >= 1000) {
    s_last_pulse_ms = now_ms;
    s_led_is_on = true;
    exam_sim_set_hardware_led(true, false, false); // Allumer rouge
  } else if (s_led_is_on && elapsed >= 120) {
    s_led_is_on = false;
    exam_sim_set_hardware_led(false, false, false); // Éteindre
  }
}

/**
 * @brief Calculatrice de secours / écran furtif en mode examen
 */
void exam_sim_run_stealth_calculator(void) {
  exam_sim_set_active(true);
  ui_clear_screen(EADK_COLOR_WHITE);
  ui_draw_status_bar("Calculs", true);

  char input_buffer[64] = "3*14 + 42";
  char result_buffer[64] = "136.2";
  int cursor_pos = (int)strlen(input_buffer);

  // Rendu initial de l'écran officiel de calcul
  ui_draw_rect(10, 30, EADK_SCREEN_WIDTH - 20, 45, EADK_COLOR_GRAY_LIGHT);
  ui_draw_string(15, 36, input_buffer, EADK_COLOR_BLACK, EADK_COLOR_GRAY_LIGHT);
  ui_draw_string(EADK_SCREEN_WIDTH - 60, 56, result_buffer, EADK_COLOR_BLACK, EADK_COLOR_GRAY_LIGHT);

  ui_draw_string(15, 90, "ans = 136.2", EADK_COLOR_GRAY_DARK, EADK_COLOR_WHITE);

  // Ligne de saisie active
  ui_draw_rect(10, 120, EADK_SCREEN_WIDTH - 20, 24, EADK_COLOR_GRAY_LIGHT);
  ui_draw_string(15, 128, "> _", EADK_COLOR_BLACK, EADK_COLOR_GRAY_LIGHT);

  bool running = true;
  eadk_keyboard_state_t prev_state = 0;

  while (running) {
    uint32_t now = eadk_timing_millis();
    exam_sim_tick(now);

    eadk_keyboard_state_t state = eadk_keyboard_scan();

    // Combinaison de sortie secrète : Shift + Home ou Toolbox + Back
    bool shift_pressed = eadk_keyboard_key_down(state, EADK_KEY_SHIFT);
    bool home_pressed = eadk_keyboard_key_down(state, EADK_KEY_HOME);
    bool toolbox_pressed = eadk_keyboard_key_down(state, EADK_KEY_TOOLBOX);
    bool back_pressed = eadk_keyboard_key_down(state, EADK_KEY_BACK);

    if ((shift_pressed && home_pressed) || (toolbox_pressed && back_pressed)) {
      running = false;
      break;
    }

    // Gestion simple des touches numériques de base pour faire illusion
    if (!prev_state) {
      if (eadk_keyboard_key_down(state, EADK_KEY_ONE)) {
        if (cursor_pos < 60) { input_buffer[cursor_pos++] = '1'; input_buffer[cursor_pos] = '\0'; }
      } else if (eadk_keyboard_key_down(state, EADK_KEY_PLUS)) {
        if (cursor_pos < 60) { input_buffer[cursor_pos++] = '+'; input_buffer[cursor_pos] = '\0'; }
      } else if (eadk_keyboard_key_down(state, EADK_KEY_EXE)) {
        strcpy(result_buffer, "Ans");
      }
    }
    prev_state = state;

    eadk_timing_msleep(20);
  }

  // Fin du mode furtif : réinitialiser l'écran
  ui_clear_screen(EADK_COLOR_WHITE);
}
