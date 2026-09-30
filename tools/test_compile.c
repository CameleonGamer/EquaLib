#include <eadk.h>

const char eadk_app_name[] __attribute__((section(".rodata.eadk_app_name"))) = "EquaLib";
const uint32_t eadk_api_level __attribute__((section(".rodata.eadk_api_level"))) = 0;

// Icône par défaut (vide ou NWI)
const uint8_t eadk_app_icon[] __attribute__((section(".rodata.eadk_app_icon"))) = {
  0x01, 0x00, 0x37, 0x00, 0x38, 0x00, 0x00, 0x00
};

int main(void) {
  // Fond blanc
  eadk_display_push_rect_uniform(eadk_screen_rect, eadk_color_white);

  // Bandeau supérieur NumWorks
  eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 20};
  eadk_display_push_rect_uniform(bar, 0xFE60); // Jaune NumWorks

  // Texte
  eadk_point_t p_title = {10, 4};
  eadk_display_draw_string("EquaLib - N0120 Launcher", p_title, false, eadk_color_black, 0xFE60);

  eadk_point_t p_msg = {20, 50};
  eadk_display_draw_string("Bienvenue sur EquaLib !", p_msg, true, eadk_color_black, eadk_color_white);

  eadk_point_t p_msg2 = {20, 80};
  eadk_display_draw_string("1. KhiCAS (Calcul Formel)", p_msg2, false, eadk_color_black, eadk_color_white);

  eadk_point_t p_msg3 = {20, 100};
  eadk_display_draw_string("2. Tableau Periodique", p_msg3, false, eadk_color_black, eadk_color_white);

  eadk_point_t p_msg4 = {20, 120};
  eadk_display_draw_string("3. Fiches de Cours", p_msg4, false, eadk_color_black, eadk_color_white);

  eadk_point_t p_msg5 = {20, 180};
  eadk_display_draw_string("Appuyez sur BACK pour quitter.", p_msg5, false, 0x7BEF, eadk_color_white);

  // Boucle principale
  while (true) {
    eadk_keyboard_state_t state = eadk_keyboard_scan();
    if (eadk_keyboard_key_down(state, eadk_key_back) || eadk_keyboard_key_down(state, eadk_key_home)) {
      break;
    }
    eadk_timing_msleep(20);
  }

  return 0;
}
