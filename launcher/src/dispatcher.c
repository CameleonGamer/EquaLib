#include "dispatcher.h"
#include "ui.h"
#include "exam_sim.h"
#include <string.h>

// Symboles définis par le linker ou zone de recherche en flash
extern uint8_t _equalib_bundle_start[];

static equalib_header_t s_active_header;
static equalib_app_entry_t s_active_apps[MAX_BUNDLE_APPS];
static bool s_has_bundle = false;

// Table d'applications par défaut si aucun bundle externe n'est concaténé (Mode Standalone/Démo)
static const equalib_app_entry_t s_demo_apps[4] = {
  {
    .name = "KhiCAS",
    .binary_offset = 0,
    .binary_size = 0,
    .entrypoint_offset = 0,
    .flags = 0
  },
  {
    .name = "Periodique",
    .binary_offset = 0,
    .binary_size = 0,
    .entrypoint_offset = 0,
    .flags = 0
  },
  {
    .name = "Notes / Cours",
    .binary_offset = 0,
    .binary_size = 0,
    .entrypoint_offset = 0,
    .flags = 0
  },
  {
    .name = "GameBoy",
    .binary_offset = 0,
    .binary_size = 0,
    .entrypoint_offset = 0,
    .flags = 0
  }
};

bool dispatcher_init(equalib_header_t * out_header, equalib_app_entry_t * out_apps) {
  // Recherche de la signature EquaLib
  const equalib_header_t * potential_header = (const equalib_header_t *)_equalib_bundle_start;

  if (potential_header && 
      potential_header->magic_0 == EQUALIB_MAGIC_0 && 
      potential_header->magic_1 == EQUALIB_MAGIC_1) {
    memcpy(&s_active_header, potential_header, sizeof(equalib_header_t));
    
    // Lecture des entrées
    const equalib_app_entry_t * raw_apps = (const equalib_app_entry_t *)((uintptr_t)potential_header + sizeof(equalib_header_t));
    int count = (int)s_active_header.app_count;
    if (count > MAX_BUNDLE_APPS) count = MAX_BUNDLE_APPS;

    memcpy(s_active_apps, raw_apps, count * sizeof(equalib_app_entry_t));
    s_has_bundle = true;
  } else {
    // Fallback mode démonstration / catalogue par défaut
    s_active_header.magic_0 = EQUALIB_MAGIC_0;
    s_active_header.magic_1 = EQUALIB_MAGIC_1;
    s_active_header.version = 1;
    s_active_header.app_count = 4;
    s_active_header.flags = EQUALIB_FLAG_PANIC_ENABLED;
    s_active_header.exam_blink_period_ms = 1000;
    
    memcpy(s_active_apps, s_demo_apps, sizeof(s_demo_apps));
    s_has_bundle = false;
  }

  if (out_header) memcpy(out_header, &s_active_header, sizeof(equalib_header_t));
  if (out_apps) memcpy(out_apps, s_active_apps, sizeof(s_active_apps));

  return s_has_bundle;
}

int dispatcher_launch_app(int app_index) {
  if (app_index < 0 || app_index >= (int)s_active_header.app_count) {
    return -1;
  }

  const equalib_app_entry_t * app = &s_active_apps[app_index];

  // Si l'application possède un point d'entrée binaire valide
  if (app->binary_size > 0 && app->entrypoint_offset != 0) {
    uintptr_t entry_addr = (uintptr_t)_equalib_bundle_start + app->binary_offset + app->entrypoint_offset;
    void (*app_entry)(void) = (void (*)(void))entry_addr;

    // Nettoyage écran avant exécution de l'application fille
    ui_clear_screen(EADK_COLOR_BLACK);

    // Saut d'exécution vers l'application
    app_entry();

    // Au retour de l'application, on réinitialise l'affichage EquaLib
    ui_clear_screen(EADK_COLOR_WHITE);
    return 0;
  } else {
    // Mode simulation / démo
    ui_clear_screen(EADK_COLOR_WHITE);
    ui_draw_status_bar(app->name, exam_sim_is_active());

    char msg[64];
    strcpy(msg, "Lancement de ");
    strcat(msg, app->name);
    ui_draw_string(20, 80, msg, EADK_COLOR_BLACK, EADK_COLOR_WHITE);
    ui_draw_string(20, 110, "Appuyez sur Back pour quitter...", EADK_COLOR_GRAY_DARK, EADK_COLOR_WHITE);

    // Boucle d'attente d'appui sur Back
    eadk_timing_msleep(300);
    while (true) {
      uint32_t now = eadk_timing_millis();
      exam_sim_tick(now);

      eadk_keyboard_state_t state = eadk_keyboard_scan();
      if (eadk_keyboard_key_down(state, EADK_KEY_BACK)) {
        break;
      }
      eadk_timing_msleep(20);
    }
    eadk_timing_msleep(200);

    ui_clear_screen(EADK_COLOR_WHITE);
    return 0;
  }
}
