#include <eadk.h>
#include <stdio.h>
#include "apps.h"
#include <string.h>

#define COLOR_NUMWORKS 0xFE60
#define COLOR_CARD_BG  0xFFFF
#define COLOR_GRAY_BG  0xF7BE
#define COLOR_DARK_BG  0x2124

typedef struct {
    uint8_t z;
    const char* sym;
    const char* name;
    const char* mass;
    const char* category;
    const char* config;
    eadk_color_t color;
} element_info_t;

static const element_info_t s_elements[] = {
    {1, "H", "Hydrogene", "1.008", "Non-metal", "1s1", 0x3D3F},
    {2, "He", "Helium", "4.003", "Gaz noble", "1s2", 0x9BFF},
    {3, "Li", "Lithium", "6.94", "Alcalin", "[He] 2s1", 0xF940},
    {4, "Be", "Berylium", "9.012", "Alcalino-terreux", "[He] 2s2", 0xFCE0},
    {5, "B", "Bore", "10.81", "Metalloide", "[He] 2s2 2p1", 0x7E0B},
    {6, "C", "Carbone", "12.011", "Non-metal", "[He] 2s2 2p2", 0x3D3F},
    {7, "N", "Azote", "14.007", "Non-metal", "[He] 2s2 2p3", 0x3D3F},
    {8, "O", "Oxygene", "15.999", "Non-metal", "[He] 2s2 2p4", 0x3D3F},
    {9, "F", "Fluor", "18.998", "Halogene", "[He] 2s2 2p5", 0x07F9},
    {10, "Ne", "Neon", "20.180", "Gaz noble", "[He] 2s2 2p6", 0x9BFF},
    {11, "Na", "Sodium", "22.990", "Alcalin", "[Ne] 3s1", 0xF940},
    {12, "Mg", "Magnesium", "24.305", "Alcalino-terreux", "[Ne] 3s2", 0xFCE0},
    {13, "Al", "Aluminium", "26.982", "Metal pauvre", "[Ne] 3s2 3p1", 0xAD75},
    {14, "Si", "Silicium", "28.085", "Metalloide", "[Ne] 3s2 3p2", 0x7E0B},
    {15, "P", "Phosphore", "30.974", "Non-metal", "[Ne] 3s2 3p3", 0x3D3F},
    {16, "S", "Soufre", "32.06", "Non-metal", "[Ne] 3s2 3p4", 0x3D3F},
    {17, "Cl", "Chlore", "35.45", "Halogene", "[Ne] 3s2 3p5", 0x07F9},
    {18, "Ar", "Argon", "39.948", "Gaz noble", "[Ne] 3s2 3p6", 0x9BFF},
    {19, "K", "Potassium", "39.098", "Alcalin", "[Ar] 4s1", 0xF940},
    {20, "Ca", "Calcium", "40.078", "Alcalino-terreux", "[Ar] 4s2", 0xFCE0},
    {21, "Sc", "Scandium", "44.956", "Transition", "[Ar] 3d1 4s2", 0xC618},
    {22, "Ti", "Titane", "47.867", "Transition", "[Ar] 3d2 4s2", 0xC618},
    {23, "V", "Vanadium", "50.942", "Transition", "[Ar] 3d3 4s2", 0xC618},
    {24, "Cr", "Chrome", "51.996", "Transition", "[Ar] 3d5 4s1", 0xC618},
    {25, "Mn", "Manganese", "54.938", "Transition", "[Ar] 3d5 4s2", 0xC618},
    {26, "Fe", "Fer", "55.845", "Transition", "[Ar] 3d6 4s2", 0xC618},
    {27, "Co", "Cobalt", "58.933", "Transition", "[Ar] 3d7 4s2", 0xC618},
    {28, "Ni", "Nickel", "58.693", "Transition", "[Ar] 3d8 4s2", 0xC618},
    {29, "Cu", "Cuivre", "63.546", "Transition", "[Ar] 3d10 4s1", 0xC618},
    {30, "Zn", "Zinc", "65.38", "Transition", "[Ar] 3d10 4s2", 0xC618},
    {35, "Br", "Brome", "79.904", "Halogene", "[Ar] 3d10 4s2 4p5", 0x07F9},
    {47, "Ag", "Argent", "107.87", "Transition", "[Kr] 4d10 5s1", 0xC618},
    {53, "I", "Iode", "126.90", "Halogene", "[Kr] 4d10 5s2 5p5", 0x07F9},
    {79, "Au", "Or", "196.97", "Transition", "[Xe] 4f14 5d10 6s1", 0xC618},
    {80, "Hg", "Mercure", "200.59", "Transition", "[Xe] 4f14 5d10 6s2", 0xC618},
    {82, "Pb", "Plomb", "207.2", "Metal pauvre", "[Xe] 4f14 5d10 6s2 6p2", 0xAD75},
    {92, "U", "Uranium", "238.03", "Actinide", "[Rn] 5f3 6d1 7s2", 0x8115}
};

#define ELEM_COUNT (sizeof(s_elements) / sizeof(s_elements[0]))

void run_periodic_table_app(void) {
    int cur_idx = 0;
    bool redraw = true;
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
    eadk_keyboard_state_t prev_kbd = 0;

    bool full_redraw = true;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        /* Mode Panique Furtif universel direct via [Var] */
        if (eadk_keyboard_key_down(kbd, eadk_key_var)) {
            run_panic_calculator();
            while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
            prev_kbd = 0;
            full_redraw = true;
            redraw = true;
            continue;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
            if (cur_idx < (int)ELEM_COUNT - 1) {
                cur_idx++;
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
            if (cur_idx > 0) {
                cur_idx--;
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
            if (cur_idx + 5 < (int)ELEM_COUNT) {
                cur_idx += 5;
            } else {
                cur_idx = (int)ELEM_COUNT - 1;
            }
            redraw = true;
        } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
            if (cur_idx - 5 >= 0) {
                cur_idx -= 5;
            } else {
                cur_idx = 0;
            }
            redraw = true;
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;
            const element_info_t* el = &s_elements[cur_idx];

            eadk_display_wait_for_vblank();

            if (full_redraw) {
                full_redraw = false;
                eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_GRAY_BG);

                /* Barre superieure */
                eadk_rect_t top = {0, 0, EADK_SCREEN_WIDTH, 22};
                eadk_display_push_rect_uniform(top, COLOR_NUMWORKS);
                eadk_point_t pt_title = {10, 5};
                eadk_display_draw_string("Tableau Periodique des Elements", pt_title, false, eadk_color_black, COLOR_NUMWORKS);

                /* Barre d'aide en bas */
                eadk_rect_t bottom = {0, EADK_SCREEN_HEIGHT - 18, EADK_SCREEN_WIDTH, 18};
                eadk_display_push_rect_uniform(bottom, eadk_color_white);
                eadk_point_t pt_help = {10, EADK_SCREEN_HEIGHT - 14};
                eadk_display_draw_string("< > : Naviguer  |  BACK : Retour menu", pt_help, false, 0x4208, eadk_color_white);
            }

            /* Carte principale de l'element */
            eadk_rect_t main_box = {16, 32, EADK_SCREEN_WIDTH - 32, 175};
            eadk_display_push_rect_uniform(main_box, COLOR_CARD_BG);

            /* Ruban de couleur de categorie */
            eadk_rect_t cat_ribbon = {16, 32, EADK_SCREEN_WIDTH - 32, 6};
            eadk_display_push_rect_uniform(cat_ribbon, el->color);

            /* Numero atomique Z */
            char z_str[16];
            snprintf(z_str, sizeof(z_str), "Z = %d", el->z);
            eadk_point_t pt_z = {30, 48};
            eadk_display_draw_string(z_str, pt_z, false, 0x632C, COLOR_CARD_BG);

            /* Grand Symbole */
            eadk_point_t pt_sym = {30, 68};
            eadk_display_draw_string(el->sym, pt_sym, true, el->color, COLOR_CARD_BG);

            /* Nom */
            eadk_point_t pt_nom = {110, 70};
            eadk_display_draw_string(el->name, pt_nom, true, eadk_color_black, COLOR_CARD_BG);

            /* Categorie */
            eadk_point_t pt_cat = {110, 95};
            eadk_display_draw_string(el->category, pt_cat, false, el->color, COLOR_CARD_BG);

            /* Ligne separateur */
            eadk_rect_t sep = {30, 118, EADK_SCREEN_WIDTH - 60, 1};
            eadk_display_push_rect_uniform(sep, 0xDEFB);

            /* Masse molaire */
            char mass_str[32];
            snprintf(mass_str, sizeof(mass_str), "Masse : %s g/mol", el->mass);
            eadk_point_t pt_mass = {30, 128};
            eadk_display_draw_string(mass_str, pt_mass, false, eadk_color_black, COLOR_CARD_BG);

            /* Configuration electronique */
            char conf_str[48];
            snprintf(conf_str, sizeof(conf_str), "Config : %s", el->config);
            eadk_point_t pt_conf = {30, 148};
            eadk_display_draw_string(conf_str, pt_conf, false, 0x2124, COLOR_CARD_BG);

            /* Index element */
            char nav_str[24];
            snprintf(nav_str, sizeof(nav_str), "< %d / %d >", cur_idx + 1, (int)ELEM_COUNT);
            eadk_point_t pt_nav = {130, 180};
            eadk_display_draw_string(nav_str, pt_nav, false, 0x7BEF, COLOR_CARD_BG);
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
