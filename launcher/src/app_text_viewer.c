#include <eadk.h>
#include "apps.h"
#include <stdint.h>
#include <stdbool.h>

#define COLOR_NUMWORKS 0xFE60
#define COLOR_CARD_BG  0xFFFF
#define COLOR_GRAY_BG  0xF7BE

#define LINES_PER_PAGE 9
#define MAX_CHARS_PER_LINE 40

void run_text_viewer_app(const char* title, const char* text_data, uint32_t text_size) {
    if (!text_data || text_size == 0) {
        text_data = "# Fichier vide ou non disponible.\n";
        text_size = 35;
    }

    /* Debounce initial */
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    int cur_page = 0;
    bool redraw = true;
    eadk_keyboard_state_t prev_kbd = 0;

    bool full_redraw = true;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_right) || eadk_keyboard_key_down(pressed, eadk_key_down)) {
            cur_page++;
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_left) || eadk_keyboard_key_down(pressed, eadk_key_up)) {
            if (cur_page > 0) {
                cur_page--;
                redraw = true;
            }
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;

            if (full_redraw) {
                full_redraw = false;
                eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_GRAY_BG);

                /* Barre superieure */
                eadk_rect_t top = {0, 0, EADK_SCREEN_WIDTH, 22};
                eadk_display_push_rect_uniform(top, COLOR_NUMWORKS);
                eadk_point_t pt_title = {10, 5};
                eadk_display_draw_string(title ? title : "Notes & Scripts", pt_title, false, eadk_color_black, COLOR_NUMWORKS);

                /* Pied de page */
                eadk_rect_t bottom = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
                eadk_display_push_rect_uniform(bottom, eadk_color_white);
                eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
                eadk_display_draw_string("< >: Page  |  BACK: Hub", pt_help, false, 0x4208, eadk_color_white);
            }

            /* Boite principale */
            eadk_rect_t box = {10, 28, EADK_SCREEN_WIDTH - 20, 192};
            eadk_display_push_rect_uniform(box, COLOR_CARD_BG);

            /* Recherche des lignes à afficher pour la page courante */
            uint32_t offset = 0;
            int line_count = 0;
            int start_line = cur_page * LINES_PER_PAGE;

            // Défilement jusqu'à la première ligne de la page
            while (offset < text_size && line_count < start_line) {
                if (text_data[offset] == '\n') line_count++;
                offset++;
            }

            // Si la page dépasse le texte, on revient en arrière
            if (offset >= text_size && cur_page > 0) {
                cur_page--;
                redraw = true;
                continue;
            }

            // Affichage des lignes de la page
            for (int l = 0; l < LINES_PER_PAGE && offset < text_size; l++) {
                char line_buf[MAX_CHARS_PER_LINE + 1];
                int c = 0;
                while (offset < text_size && text_data[offset] != '\n' && c < MAX_CHARS_PER_LINE) {
                    char ch = text_data[offset++];
                    if (ch >= 32 && ch <= 126) {
                        line_buf[c++] = ch;
                    } else if (ch == '\t') {
                        line_buf[c++] = ' ';
                    }
                }
                line_buf[c] = '\0';
                if (offset < text_size && text_data[offset] == '\n') offset++;

                eadk_point_t pt_line = {18, (uint16_t)(36 + l * 18)};
                eadk_display_draw_string(line_buf, pt_line, false, 0x18C3, COLOR_CARD_BG);
            }
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
