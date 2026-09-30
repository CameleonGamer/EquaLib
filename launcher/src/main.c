#include "eadk.h"
#include "ui.h"
#include "exam_sim.h"
#include "dispatcher.h"
#include "equalib_bundle.h"

// Métadonnées officielles reconnues par Epsilon / EADK
const char eadk_app_name[] = "EquaLib";
const uint32_t eadk_api_level = 0;

// Section réservée pour le bundle concaténé lors du packaging Web
uint8_t _equalib_bundle_start[1024] __attribute__((section(".equalib_bundle"), aligned(4))) = {0};

int main(void) {
  ui_init();
  exam_sim_init();

  equalib_header_t header;
  equalib_app_entry_t apps[MAX_BUNDLE_APPS];
  dispatcher_init(&header, apps);

  // Activation automatique de la simulation si le drapeau est activé
  if (header.flags & EQUALIB_FLAG_SIMULATE_EXAM) {
    exam_sim_set_active(true);
  }

  int selected_app = 0;
  int app_count = (int)header.app_count;

  ui_clear_screen(EADK_COLOR_WHITE);

  eadk_keyboard_state_t prev_state = 0;
  uint32_t last_back_press_ms = 0;
  bool needs_redraw = true;

  while (true) {
    uint32_t now = eadk_timing_millis();
    exam_sim_tick(now);

    eadk_keyboard_state_t state = eadk_keyboard_scan();

    // Rendu de l'écran si nécessaire
    if (needs_redraw) {
      ui_draw_status_bar("Bibliothèque d'Apps", exam_sim_is_active());
      ui_draw_app_grid(&header, apps, selected_app);
      needs_redraw = false;
    }

    // Détection front montant des touches (appui unique)
    eadk_keyboard_state_t just_pressed = state & ~prev_state;

    if (just_pressed) {
      if (eadk_keyboard_key_down(just_pressed, EADK_KEY_RIGHT)) {
        if (selected_app < app_count - 1) {
          selected_app++;
          needs_redraw = true;
        }
      } else if (eadk_keyboard_key_down(just_pressed, EADK_KEY_LEFT)) {
        if (selected_app > 0) {
          selected_app--;
          needs_redraw = true;
        }
      } else if (eadk_keyboard_key_down(just_pressed, EADK_KEY_DOWN)) {
        if (selected_app + GRID_COLS < app_count) {
          selected_app += GRID_COLS;
          needs_redraw = true;
        }
      } else if (eadk_keyboard_key_down(just_pressed, EADK_KEY_UP)) {
        if (selected_app - GRID_COLS >= 0) {
          selected_app -= GRID_COLS;
          needs_redraw = true;
        }
      } else if (eadk_keyboard_key_down(just_pressed, EADK_KEY_OK)) {
        dispatcher_launch_app(selected_app);
        needs_redraw = true;
      } else if (eadk_keyboard_key_down(just_pressed, EADK_KEY_BACK)) {
        // Détection double appui rapide pour Mode Examen Furtif
        if (now - last_back_press_ms < 500) {
          exam_sim_run_stealth_calculator();
          needs_redraw = true;
        }
        last_back_press_ms = now;
      } else if (eadk_keyboard_key_down(just_pressed, EADK_KEY_TOOLBOX)) {
        // Basculer l'état de la simulation du mode examen (LED ON/OFF)
        exam_sim_set_active(!exam_sim_is_active());
        needs_redraw = true;
      }
    }

    prev_state = state;
    eadk_timing_msleep(20);
  }

  return 0;
}
