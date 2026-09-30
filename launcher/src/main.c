#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

// Symboles officiels requis par Epsilon
const char eadk_app_name[] __attribute__((section(".rodata.eadk_app_name"))) = "EquaLib";
const uint32_t eadk_api_level __attribute__((section(".rodata.eadk_api_level"))) = 0;

#define COLOR_NUMWORKS 0xFE60 // Jaune officiel ~RGB(255, 187, 0)
#define COLOR_GRAY_BG  0xF7BE
#define COLOR_CARD_BG  0xFFFF
#define COLOR_CARD_SEL 0xFFF0
#define COLOR_TEXT_MUTED 0x7BEF

// Simulation du mode examen
static bool s_exam_mode = false;
static uint64_t s_last_pulse_ms = 0;
static bool s_led_state = false;

// STM32H725 GPIOB pour LED (NumWorks N0120)
#define STM32H7_GPIOB_BSRR ((volatile uint32_t *)0x58020418)

static void set_led_hardware(bool on) {
  #if defined(__arm__)
  volatile uint32_t * bsrr = STM32H7_GPIOB_BSRR;
  if (on) {
    *bsrr = (1 << 0);
  } else {
    *bsrr = (1 << 16);
  }
  #else
  (void)on;
  #endif
}

static void exam_tick(uint64_t now) {
  if (!s_exam_mode) return;
  uint64_t diff = now - s_last_pulse_ms;
  if (!s_led_state && diff >= 1000) {
    s_last_pulse_ms = now;
    s_led_state = true;
    set_led_hardware(true);
  } else if (s_led_state && diff >= 120) {
    s_led_state = false;
    set_led_hardware(false);
  }
}

// Liste des applications de la bibliothèque EquaLib
typedef struct {
  const char * name;
  const char * category;
  const char * desc;
} app_item_t;

static const app_item_t s_apps[] = {
  {"1. KhiCAS", "Calcul Formel", "Integrales, derivees, algebre"},
  {"2. Mario Kart", "Jeu / Arcade", "Course Mode 7 pour N0120"},
  {"3. Tableau Periodique", "Chimie", "Proprietes des elements"},
  {"4. Fiches de Cours", "Revision", "Syntheses et formules"},
  {"5. Peanut-GB", "Emulateur", "GameBoy classique pour N0120"}
};
#define APP_COUNT (sizeof(s_apps) / sizeof(s_apps[0]))

// Écran factice de calculatrice pour le Mode Panique Furtif
static void run_panic_calculator(void) {
  s_exam_mode = true;
  eadk_display_push_rect_uniform(eadk_screen_rect, eadk_color_white);

  // Bandeau jaune officiel
  eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 18};
  eadk_display_push_rect_uniform(bar, COLOR_NUMWORKS);

  eadk_point_t p_status = {8, 3};
  eadk_display_draw_string("[EXAMEN ACTIF]", p_status, false, eadk_color_red, COLOR_NUMWORKS);

  eadk_point_t p_calc = {120, 3};
  eadk_display_draw_string("Calculs", p_calc, false, eadk_color_black, COLOR_NUMWORKS);

  // Historique de calculs
  eadk_rect_t box1 = {10, 30, EADK_SCREEN_WIDTH - 20, 45};
  eadk_display_push_rect_uniform(box1, 0xEF5D);

  eadk_point_t p_expr = {20, 38};
  eadk_display_draw_string("cos(pi/3) + ln(e^2)", p_expr, false, eadk_color_black, 0xEF5D);

  eadk_point_t p_res = {EADK_SCREEN_WIDTH - 50, 56};
  eadk_display_draw_string("2.5", p_res, false, eadk_color_black, 0xEF5D);

  // Ligne active
  eadk_rect_t box2 = {10, 85, EADK_SCREEN_WIDTH - 20, 30};
  eadk_display_push_rect_uniform(box2, 0xEF5D);
  eadk_point_t p_cur = {20, 93};
  eadk_display_draw_string("> _", p_cur, false, eadk_color_black, 0xEF5D);

  while (true) {
    uint64_t now = eadk_timing_millis();
    exam_tick(now);

    eadk_keyboard_state_t kbd = eadk_keyboard_scan();

    // Combinaison secrète de sortie : Shift + Home ou Toolbox + Back
    bool shift = eadk_keyboard_key_down(kbd, eadk_key_shift);
    bool home = eadk_keyboard_key_down(kbd, eadk_key_home);
    bool toolbox = eadk_keyboard_key_down(kbd, eadk_key_toolbox);
    bool back = eadk_keyboard_key_down(kbd, eadk_key_back);

    if ((shift && home) || (toolbox && back)) {
      break;
    }
    eadk_timing_msleep(20);
  }
}

int main(int argc, char* argv[]) {
  (void)argc;
  (void)argv;

  int selected = 0;
  bool redraw = true;
  uint64_t last_back_press = 0;
  eadk_keyboard_state_t prev_kbd = 0;

  while (true) {
    uint64_t now = eadk_timing_millis();
    exam_tick(now);

    eadk_keyboard_state_t kbd = eadk_keyboard_scan();

    // Sortie de l'application via Home ou On/Off
    if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
      break;
    }

    // Détection d'un appui ponctuel (front montant)
    eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

    if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
      if (selected < (int)APP_COUNT - 1) {
        selected++;
        redraw = true;
      }
    } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
      if (selected > 0) {
        selected--;
        redraw = true;
      }
    } else if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
      // Écran de confirmation / exécution de l'application sélectionnée
      eadk_display_push_rect_uniform(eadk_screen_rect, eadk_color_white);
      
      eadk_rect_t hbar = {0, 0, EADK_SCREEN_WIDTH, 20};
      eadk_display_push_rect_uniform(hbar, COLOR_NUMWORKS);

      eadk_point_t p_t = {10, 4};
      eadk_display_draw_string(s_apps[selected].name, p_t, false, eadk_color_black, COLOR_NUMWORKS);

      eadk_point_t p_m1 = {20, 60};
      eadk_display_draw_string("Application en cours d'execution :", p_m1, false, eadk_color_black, eadk_color_white);

      eadk_point_t p_m2 = {20, 85};
      eadk_display_draw_string(s_apps[selected].name, p_m2, true, eadk_color_black, eadk_color_white);

      eadk_point_t p_m3 = {20, 115};
      eadk_display_draw_string(s_apps[selected].desc, p_m3, false, COLOR_TEXT_MUTED, eadk_color_white);

      eadk_point_t p_m4 = {20, 190};
      eadk_display_draw_string("Appuyez sur BACK pour revenir au menu.", p_m4, false, 0x0000, eadk_color_white);

      eadk_timing_msleep(300);
      while (true) {
        uint64_t sub_now = eadk_timing_millis();
        exam_tick(sub_now);

        eadk_keyboard_state_t sub_kbd = eadk_keyboard_scan();
        if (eadk_keyboard_key_down(sub_kbd, eadk_key_back) || eadk_keyboard_key_down(sub_kbd, eadk_key_home)) {
          break;
        }
        eadk_timing_msleep(20);
      }
      redraw = true;
    } else if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
      // Détection double appui rapide pour Mode Panique Furtif
      if (now - last_back_press < 400) {
        run_panic_calculator();
        redraw = true;
      }
      last_back_press = now;
    } else if (eadk_keyboard_key_down(pressed, eadk_key_toolbox)) {
      // Basculer la simulation de la LED Examen
      s_exam_mode = !s_exam_mode;
      if (!s_exam_mode) {
        s_led_state = false;
        set_led_hardware(false);
      }
      redraw = true;
    }

    prev_kbd = kbd;

    // Rendu graphique
    if (redraw) {
      eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_GRAY_BG);

      // Barre supérieure
      eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 20};
      eadk_display_push_rect_uniform(top_bar, s_exam_mode ? eadk_color_red : COLOR_NUMWORKS);

      eadk_point_t p_title = {8, 4};
      eadk_color_t title_fg = s_exam_mode ? eadk_color_white : eadk_color_black;
      eadk_color_t title_bg = s_exam_mode ? eadk_color_red : COLOR_NUMWORKS;
      eadk_display_draw_string("EquaLib - N0120 Hub", p_title, false, title_fg, title_bg);

      eadk_point_t p_exam_badge = {EADK_SCREEN_WIDTH - 85, 4};
      eadk_display_draw_string(s_exam_mode ? "LED 1Hz: ON" : "LED: OFF", p_exam_badge, false, title_fg, title_bg);

      // Liste des applications
      int start_y = 28;
      int card_h = 36;
      int card_w = EADK_SCREEN_WIDTH - 16;

      for (int i = 0; i < (int)APP_COUNT; i++) {
        int y = start_y + i * (card_h + 5);
        bool is_sel = (i == selected);

        eadk_rect_t card = {8, (uint16_t)y, (uint16_t)card_w, (uint16_t)card_h};
        eadk_display_push_rect_uniform(card, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

        // Barre d'accentuation à gauche de la carte sélectionnée
        if (is_sel) {
          eadk_rect_t accent = {8, (uint16_t)y, 4, (uint16_t)card_h};
          eadk_display_push_rect_uniform(accent, COLOR_NUMWORKS);
        }

        eadk_point_t p_name = {20, (uint16_t)(y + 5)};
        eadk_display_draw_string(s_apps[i].name, p_name, false, eadk_color_black, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

        eadk_point_t p_cat = {(uint16_t)(EADK_SCREEN_WIDTH - 105), (uint16_t)(y + 5)};
        eadk_display_draw_string(s_apps[i].category, p_cat, false, COLOR_TEXT_MUTED, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);

        eadk_point_t p_desc = {20, (uint16_t)(y + 20)};
        eadk_display_draw_string(s_apps[i].desc, p_desc, false, 0x52AA, is_sel ? COLOR_CARD_SEL : COLOR_CARD_BG);
      }

      // Pied de page / guide
      eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
      eadk_display_push_rect_uniform(bottom_bar, eadk_color_white);

      eadk_point_t p_help = {8, EADK_SCREEN_HEIGHT - 13};
      eadk_display_draw_string("OK: Ouvrir | Toolbox: LED Examen | Backx2: Furtif", p_help, false, eadk_color_black, eadk_color_white);

      redraw = false;
    }

    eadk_timing_msleep(20);
  }

  set_led_hardware(false);
  return 0;
}
