#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "apps.h"
#include "equalib_manifest.h"

/* Déclarations mini libc */
size_t strlen(const char* s);
int snprintf(char* buf, size_t max, const char* fmt, ...);

/* Symboles officiels EADK requis par Epsilon */
const char eadk_app_name[] __attribute__((section(".rodata.eadk_app_name"))) = "EquaLib";
const uint32_t eadk_api_level __attribute__((section(".rodata.eadk_api_level"))) = 0;

/* Macro RGB565 */
#define RGB565(r, g, b) ((((r) & 0xF8) << 8) | (((g) & 0xFC) << 3) | (((b) & 0xF8) >> 3))

/* Structure d'un Thème Visuel */
typedef struct {
    const char* name;
    uint16_t top_bar;
    uint16_t screen_bg;
    uint16_t card_bg;
    uint16_t card_sel;
    uint16_t accent;
    uint16_t text_primary;
    uint16_t text_muted;
    uint16_t dock_bg;
    uint16_t dock_border;
} theme_t;

static const theme_t g_themes[6] = {
    /* 0: NumWorks Classique */
    {
        .name = "Classique (NumWorks)",
        .top_bar = 0xFE60,     /* Jaune NumWorks #FFBB00 */
        .screen_bg = 0xF7BE,   /* Gris/Creme Epsilon */
        .card_bg = 0xFFFF,     /* Blanc pur */
        .card_sel = 0xFFF0,    /* Blanc/ambre clair */
        .accent = 0xFE60,      /* Jaune or */
        .text_primary = 0x0000,/* Noir */
        .text_muted = 0x7BEF,  /* Gris moyen */
        .dock_bg = 0xFFFF,
        .dock_border = 0xFE60
    },
    /* 1: Sakura (Fleurs roses & pétales) */
    {
        .name = "Sakura (Fleurs Roses)",
        .top_bar = 0xFBAE,     /* Rose vif sakura #F472B6 */
        .screen_bg = 0xFDF7,   /* Rose pastel clair */
        .card_bg = 0xFFFF,     /* Blanc */
        .card_sel = 0xFEDF,    /* Rose poudré */
        .accent = 0xF814,      /* Magenta sakura */
        .text_primary = 0x4808,/* Prune fonce */
        .text_muted = 0xD373,  /* Rose doux */
        .dock_bg = 0xFFFF,
        .dock_border = 0xFBAE
    },
    /* 2: Hacker (Bleu foncé & Cyan Matrix) */
    {
        .name = "Hacker (Cyber Cyan)",
        .top_bar = 0x0154,     /* Bleu cyber sombre */
        .screen_bg = 0x08A5,   /* Bleu nuit matrice */
        .card_bg = 0x0949,     /* Ardoise sombre */
        .card_sel = 0x1293,    /* Bleu electrique */
        .accent = 0x3DFE,      /* Cyan matrix #38BDF8 */
        .text_primary = 0xFFFF,/* Blanc */
        .text_muted = 0x5D7F,  /* Cyan doux */
        .dock_bg = 0x0949,
        .dock_border = 0x3DFE
    },
    /* 3: Abeille (Jaune & Noir avec rayures) */
    {
        .name = "Abeille (Jaune & Noir)",
        .top_bar = 0xFDE0,     /* Jaune miel #FBBF24 */
        .screen_bg = 0x1082,   /* Noir charbon */
        .card_bg = 0x2104,     /* Graphite sombre */
        .card_sel = 0x39E0,    /* Ambre dore */
        .accent = 0xFDE0,      /* Jaune miel */
        .text_primary = 0xFFFF,/* Blanc */
        .text_muted = 0xCE60,  /* Jaune ambre */
        .dock_bg = 0x2104,
        .dock_border = 0xFDE0
    },
    /* 4: Mario (Rouge & Blanc avec logo M) */
    {
        .name = "Mario (Rouge & Blanc)",
        .top_bar = 0xE8A2,     /* Rouge vif Mario #EF4444 */
        .screen_bg = 0x3883,   /* Rouge bordeaux profond */
        .card_bg = 0xFFFF,     /* Blanc éclatant */
        .card_sel = 0xFDAB,    /* Rouge pastel clair */
        .accent = 0xE8A2,      /* Rouge Mario */
        .text_primary = 0x0000,/* Noir */
        .text_muted = 0xC8A2,  /* Rouge brique */
        .dock_bg = 0xFFFF,
        .dock_border = 0xE8A2
    },
    /* 5: GameBoy 8bit (Vert & Gris rétro) */
    {
        .name = "GameBoy (8-Bit Retro)",
        .top_bar = 0x8D63,     /* Olive DMG #8BAC0F */
        .screen_bg = 0x09E2,   /* Vert sombre DMG #0F380F */
        .card_bg = 0x3264,     /* Vert moyen DMG #306230 */
        .card_sel = 0x4B25,    /* Vert clair DMG */
        .accent = 0x9E03,      /* Vert vif DMG #9BBC0F */
        .text_primary = 0xE7EE,/* Vert tres clair #E0F8D0 */
        .text_muted = 0x9E03,  /* Vert DMG */
        .dock_bg = 0x3264,
        .dock_border = 0x9E03
    }
};

/* Modes d'affichage */
enum {
    VIEW_MODE_GALLERY = 0,
    VIEW_MODE_LIST = 1
};

/* État persistant du Launcher */
static int g_current_theme = 0;      /* 0 = Classique, 1 = Sakura, 2 = Hacker, 3 = Abeille, 4 = Mario, 5 = GameBoy */
static int g_view_mode = VIEW_MODE_GALLERY; /* Mode Galerie d'images carrées par défaut */
static bool g_show_tooltips = true;  /* Affichage des raccourcis en bas d'écran */

/* Manifeste dynamique stocké en flash (.rodata), modifiable à chaud lors du packaging */
const equalib_manifest_t g_equalib_manifest __attribute__((used, aligned(4), section(".rodata.equalib_manifest"))) = {
    .magic = EQUALIB_MANIFEST_MAGIC,
    .version = 1,
    .app_count = 10,
    .flags = 0,
    .apps = {
        {"mariokart", "1. Mario Kart", "Jeu / Arcade", "Course Mode 7 3D complete pour N0120", APP_TYPE_MARIOKART, {0,0,0}, 0, 0},
        {"periodique", "2. Tableau Periodique", "Chimie", "118 elements, masses et configurations", APP_TYPE_PERIODIC, {0,0,0}, 0, 0},
        {"fiches", "3. Fiches de Cours", "Revision", "Formulaires Maths, Physique et Chimie", APP_TYPE_COURSES, {0,0,0}, 0, 0},
        {"math_solver", "4. Solveur de Maths", "Algebre", "Polynomes 2nd degre, racines et outils", APP_TYPE_MATH_TOOLS, {0,0,0}, 0, 0},
        {"flappy", "5. Flappy Bird", "Jeu / Arcade", "Flappy Bird en C natif fluide a 60 FPS", APP_TYPE_FLAPPY, {0,0,0}, 0, 0},
        {"2048", "6. 2048 Ultimate", "Jeu / Arcade", "Casse-tete 2048 en C natif 60 FPS", APP_TYPE_2048, {0,0,0}, 0, 0},
        {"snake", "7. Snake Classic", "Jeu / Arcade", "Serpent retro en C natif 60 FPS", APP_TYPE_SNAKE, {0,0,0}, 0, 0},
        {"tetris", "8. Tetris NumWorks", "Jeu / Arcade", "Tetris officiel en C natif 60 FPS", APP_TYPE_TETRIS, {0,0,0}, 0, 0},
        {"demineur", "9. Demineur NW", "Jeu / Arcade", "Demineur complet en C natif 60 FPS", APP_TYPE_MINESWEEPER, {0,0,0}, 0, 0},
        {"settings", "10. Parametres", "Options", "Themes, mode galerie et reglages", APP_TYPE_SETTINGS, {0,0,0}, 0, 0}
    }
};

/* Wrapper d'exécution sécurisé ARM Thumb avec alignement AAPCS et sauvegarde intégrale des registres */
static void __attribute__((noinline)) call_app_entry_safe(uint32_t entry_addr) {
    __asm__ volatile (
        "push {r4-r11, lr}\n"       /* Sauvegarder tous les registres callee-saved */
        "mov r4, sp\n"              /* Mémoriser le pointeur de pile d'origine */
        "lsrs r1, r4, #3\n"         /* Aligner la pile sur 8 octets (requis AAPCS Cortex-M) */
        "lsls r1, r1, #3\n"
        "mov sp, r1\n"
        "blx %0\n"                  /* Appel du point d'entrée natif Thumb */
        "mov sp, r4\n"              /* Restaurer la pile à son adresse exacte */
        "pop {r4-r11, lr}\n"        /* Restaurer tous les registres */
        :
        : "r" (entry_addr)
        : "r0", "r1", "r2", "r3", "ip", "memory", "cc"
    );
}

/* Exécution d'une application native externe (.bin / .nwa) */
void run_native_app(const char* name, const uint8_t* bin_ptr, uint32_t bin_size) {
    if (!bin_ptr || bin_size < 32) {
        eadk_display_push_rect_uniform(eadk_screen_rect, 0x0000);
        eadk_point_t pt = {20, 100};
        eadk_display_draw_string("Erreur: Binaire introuvable", pt, false, 0xF800, 0x0000);
        eadk_timing_msleep(2000);
        return;
    }

    uint32_t ptr_val = (uint32_t)bin_ptr;
    if (ptr_val < 0x90180000 || ptr_val >= 0x90800000 || (ptr_val + bin_size) > 0x90800000) {
        eadk_display_push_rect_uniform(eadk_screen_rect, 0xFFFF);
        eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 22};
        eadk_display_push_rect_uniform(bar, 0xD800);
        eadk_point_t pt_title = {8, 5};
        eadk_display_draw_string(name ? name : "Application Native", pt_title, false, eadk_color_white, 0xD800);

        eadk_point_t p1 = {12, 40};
        eadk_display_draw_string("Erreur: Adresse Flash invalide !", p1, false, 0xD800, 0xFFFF);
        eadk_point_t p2 = {12, 70};
        eadk_display_draw_string("Le binaire se situe hors de la memoire autorisee.", p2, false, eadk_color_black, 0xFFFF);
        eadk_point_t p3 = {12, 100};
        eadk_display_draw_string("Installez votre pack via le bouton Flash USB.", p3, false, 0x05E0, 0xFFFF);
        eadk_point_t p4 = {12, 180};
        eadk_display_draw_string("[Back] : Revenir au Hub", p4, false, 0xD800, 0xFFFF);

        while (true) {
            eadk_keyboard_state_t k = eadk_keyboard_scan();
            if (eadk_keyboard_key_down(k, eadk_key_back) || eadk_keyboard_key_down(k, eadk_key_home)) break;
            eadk_timing_msleep(20);
        }
        while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
        return;
    }

    uint32_t magic1 = *(const uint32_t*)(bin_ptr + 0);
    uint32_t magic2 = *(const uint32_t*)(bin_ptr + 28);

    if (magic1 == 0xDEC0BEBA && magic2 == 0xDEC0BEBA) {
        uint32_t entry_offset = *(const uint32_t*)(bin_ptr + 20);
        if (entry_offset < 32 || entry_offset >= bin_size - 4) {
            eadk_display_push_rect_uniform(eadk_screen_rect, 0x0000);
            eadk_point_t pt = {20, 100};
            eadk_display_draw_string("Erreur: Point d'entree invalide", pt, false, 0xF800, 0x0000);
            eadk_timing_msleep(2000);
            return;
        }

        while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
        eadk_display_push_rect_uniform(eadk_screen_rect, 0x0000);
        uint32_t entry_addr = ((uint32_t)bin_ptr + entry_offset) | 1;
        call_app_entry_safe(entry_addr);
        while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
        return;
    }

    if (bin_ptr[0] == 0x7F && bin_ptr[1] == 'E' && bin_ptr[2] == 'L' && bin_ptr[3] == 'F') {
        eadk_display_push_rect_uniform(eadk_screen_rect, 0xFFFF);
        eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 22};
        eadk_display_push_rect_uniform(bar, 0xFE60);
        eadk_point_t pt_title = {8, 5};
        eadk_display_draw_string(name ? name : "Application NWA", pt_title, false, eadk_color_black, 0xFE60);

        eadk_point_t p1 = {12, 40};
        eadk_display_draw_string("Application NWA detectee (ELF non lie).", p1, false, eadk_color_black, 0xFFFF);
        eadk_point_t p2 = {12, 70};
        eadk_display_draw_string("Utilisez le Convertisseur NWA sur le site web !", p2, false, 0x05E0, 0xFFFF);
        eadk_point_t p3 = {12, 180};
        eadk_display_draw_string("[Back] : Revenir au Hub", p3, false, 0xD800, 0xFFFF);

        while (true) {
            eadk_keyboard_state_t k = eadk_keyboard_scan();
            if (eadk_keyboard_key_down(k, eadk_key_back) || eadk_keyboard_key_down(k, eadk_key_home)) break;
            eadk_timing_msleep(20);
        }
        while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
        return;
    }

    eadk_display_push_rect_uniform(eadk_screen_rect, 0x0000);
    eadk_point_t pt = {20, 100};
    eadk_display_draw_string("Erreur: Format binaire inconnu", pt, false, 0xF800, 0x0000);
    eadk_timing_msleep(2000);
}

/* ==================== DESSIN DES ICÔNES PIXEL-ART (24x24) ==================== */
static void draw_app_icon(uint8_t app_type, int cx, int cy, uint16_t accent_col) {
    (void)accent_col;
    if (app_type == APP_TYPE_MARIOKART) {
        /* Kart Mario rouge avec roues noires et casque blanc */
        eadk_rect_t wheel_l = {(uint16_t)(cx - 9), (uint16_t)(cy + 2), 4, 7};
        eadk_rect_t wheel_r = {(uint16_t)(cx + 5), (uint16_t)(cy + 2), 4, 7};
        eadk_rect_t body = {(uint16_t)(cx - 5), (uint16_t)(cy - 2), 10, 10};
        eadk_rect_t nose = {(uint16_t)(cx - 3), (uint16_t)(cy + 8), 6, 3};
        eadk_rect_t helmet = {(uint16_t)(cx - 4), (uint16_t)(cy - 8), 8, 7};
        eadk_rect_t m_badge = {(uint16_t)(cx - 2), (uint16_t)(cy - 7), 4, 3};
        eadk_display_push_rect_uniform(wheel_l, 0x18C3);
        eadk_display_push_rect_uniform(wheel_r, 0x18C3);
        eadk_display_push_rect_uniform(body, 0xE8A2);
        eadk_display_push_rect_uniform(nose, 0xFDE0);
        eadk_display_push_rect_uniform(helmet, 0xFFFF);
        eadk_display_push_rect_uniform(m_badge, 0xE8A2);
    } else if (app_type == APP_TYPE_PERIODIC) {
        /* Fiole de chimie avec liquide cyan et bulles */
        eadk_rect_t neck = {(uint16_t)(cx - 2), (uint16_t)(cy - 9), 4, 6};
        eadk_rect_t lip = {(uint16_t)(cx - 4), (uint16_t)(cy - 10), 8, 2};
        eadk_rect_t flask = {(uint16_t)(cx - 8), (uint16_t)(cy - 3), 16, 12};
        eadk_rect_t liquid = {(uint16_t)(cx - 7), (uint16_t)(cy + 2), 14, 6};
        eadk_rect_t bubble = {(uint16_t)(cx + 1), (uint16_t)(cy - 1), 3, 3};
        eadk_display_push_rect_uniform(lip, 0x7BEF);
        eadk_display_push_rect_uniform(neck, 0x9CF3);
        eadk_display_push_rect_uniform(flask, 0x4A69);
        eadk_display_push_rect_uniform(liquid, 0x05E0);
        eadk_display_push_rect_uniform(bubble, 0xFFFF);
    } else if (app_type == APP_TYPE_COURSES) {
        /* Livre ouvert avec pages blanches et signet doré */
        eadk_rect_t cover = {(uint16_t)(cx - 10), (uint16_t)(cy - 6), 20, 14};
        eadk_rect_t page_l = {(uint16_t)(cx - 9), (uint16_t)(cy - 5), 8, 12};
        eadk_rect_t page_r = {(uint16_t)(cx + 1), (uint16_t)(cy - 5), 8, 12};
        eadk_rect_t spine = {(uint16_t)(cx - 1), (uint16_t)(cy - 7), 2, 15};
        eadk_display_push_rect_uniform(cover, 0x39E0);
        eadk_display_push_rect_uniform(page_l, 0xFFFF);
        eadk_display_push_rect_uniform(page_r, 0xFFFF);
        eadk_display_push_rect_uniform(spine, 0xFE60);
    } else if (app_type == APP_TYPE_MATH_TOOLS) {
        /* Symbole Pi π et racine carrée √ */
        eadk_rect_t top_pi = {(uint16_t)(cx - 8), (uint16_t)(cy - 6), 16, 3};
        eadk_rect_t leg1 = {(uint16_t)(cx - 5), (uint16_t)(cy - 3), 3, 11};
        eadk_rect_t leg2 = {(uint16_t)(cx + 2), (uint16_t)(cy - 3), 3, 11};
        eadk_rect_t foot = {(uint16_t)(cx + 4), (uint16_t)(cy + 6), 3, 2};
        eadk_display_push_rect_uniform(top_pi, 0x3DFE);
        eadk_display_push_rect_uniform(leg1, 0x3DFE);
        eadk_display_push_rect_uniform(leg2, 0x3DFE);
        eadk_display_push_rect_uniform(foot, 0x3DFE);
    } else if (app_type == APP_TYPE_FLAPPY) {
        /* Oiseau Flappy jaune avec aile et bec orange */
        eadk_rect_t bird_body = {(uint16_t)(cx - 7), (uint16_t)(cy - 6), 14, 12};
        eadk_rect_t bird_wing = {(uint16_t)(cx - 8), (uint16_t)(cy - 1), 6, 5};
        eadk_rect_t bird_beak = {(uint16_t)(cx + 5), (uint16_t)(cy - 2), 6, 5};
        eadk_rect_t bird_eye = {(uint16_t)(cx + 1), (uint16_t)(cy - 5), 4, 4};
        eadk_rect_t bird_pupil = {(uint16_t)(cx + 3), (uint16_t)(cy - 4), 2, 2};
        eadk_display_push_rect_uniform(bird_body, 0xFFE0);
        eadk_display_push_rect_uniform(bird_wing, 0xFFFF);
        eadk_display_push_rect_uniform(bird_beak, 0xFBA0);
        eadk_display_push_rect_uniform(bird_eye, 0xFFFF);
        eadk_display_push_rect_uniform(bird_pupil, 0x0000);
    } else if (app_type == APP_TYPE_2048) {
        /* Tuile dorée 2048 */
        eadk_rect_t tile = {(uint16_t)(cx - 9), (uint16_t)(cy - 9), 18, 18};
        eadk_rect_t inner = {(uint16_t)(cx - 7), (uint16_t)(cy - 7), 14, 14};
        eadk_display_push_rect_uniform(tile, 0xFDE0);
        eadk_display_push_rect_uniform(inner, 0xFBE0);
        eadk_point_t p2 = {(uint16_t)(cx - 5), (uint16_t)(cy - 4)};
        eadk_display_draw_string("2K", p2, false, 0xFFFF, 0xFBE0);
    } else if (app_type == APP_TYPE_SNAKE) {
        /* Serpent pixel vert et pomme rouge */
        eadk_rect_t s1 = {(uint16_t)(cx - 8), (uint16_t)(cy + 2), 5, 5};
        eadk_rect_t s2 = {(uint16_t)(cx - 4), (uint16_t)(cy - 3), 5, 5};
        eadk_rect_t s3 = {(uint16_t)(cx), (uint16_t)(cy - 3), 5, 5};
        eadk_rect_t head = {(uint16_t)(cx + 4), (uint16_t)(cy - 7), 5, 5};
        eadk_rect_t apple = {(uint16_t)(cx + 3), (uint16_t)(cy + 2), 4, 4};
        eadk_display_push_rect_uniform(s1, 0x05E0);
        eadk_display_push_rect_uniform(s2, 0x07E0);
        eadk_display_push_rect_uniform(s3, 0x07E0);
        eadk_display_push_rect_uniform(head, 0x2FE0);
        eadk_display_push_rect_uniform(apple, 0xF800);
    } else if (app_type == APP_TYPE_TETRIS) {
        /* Bloc Tetris en T cyan/violet */
        eadk_rect_t b1 = {(uint16_t)(cx - 8), (uint16_t)(cy - 6), 5, 5};
        eadk_rect_t b2 = {(uint16_t)(cx - 2), (uint16_t)(cy - 6), 5, 5};
        eadk_rect_t b3 = {(uint16_t)(cx + 4), (uint16_t)(cy - 6), 5, 5};
        eadk_rect_t b4 = {(uint16_t)(cx - 2), (uint16_t)(cy), 5, 5};
        eadk_display_push_rect_uniform(b1, 0x981F);
        eadk_display_push_rect_uniform(b2, 0x981F);
        eadk_display_push_rect_uniform(b3, 0x981F);
        eadk_display_push_rect_uniform(b4, 0x981F);
    } else if (app_type == APP_TYPE_MINESWEEPER) {
        /* Bombe démineur noire avec mèche rouge */
        eadk_rect_t bomb = {(uint16_t)(cx - 6), (uint16_t)(cy - 4), 12, 12};
        eadk_rect_t fuse = {(uint16_t)(cx + 1), (uint16_t)(cy - 8), 3, 5};
        eadk_rect_t spark = {(uint16_t)(cx + 3), (uint16_t)(cy - 9), 3, 3};
        eadk_rect_t glint = {(uint16_t)(cx - 3), (uint16_t)(cy - 2), 3, 3};
        eadk_display_push_rect_uniform(bomb, 0x18C3);
        eadk_display_push_rect_uniform(fuse, 0x8BE0);
        eadk_display_push_rect_uniform(spark, 0xF800);
        eadk_display_push_rect_uniform(glint, 0xFFFF);
    } else {
        /* Engrenage / Options */
        eadk_rect_t center = {(uint16_t)(cx - 5), (uint16_t)(cy - 5), 10, 10};
        eadk_rect_t tooth_t = {(uint16_t)(cx - 2), (uint16_t)(cy - 8), 4, 3};
        eadk_rect_t tooth_b = {(uint16_t)(cx - 2), (uint16_t)(cy + 5), 4, 3};
        eadk_rect_t tooth_l = {(uint16_t)(cx - 8), (uint16_t)(cy - 2), 3, 4};
        eadk_rect_t tooth_r = {(uint16_t)(cx + 5), (uint16_t)(cy - 2), 3, 4};
        eadk_rect_t hole = {(uint16_t)(cx - 2), (uint16_t)(cy - 2), 4, 4};
        eadk_display_push_rect_uniform(center, 0x7BEF);
        eadk_display_push_rect_uniform(tooth_t, 0x7BEF);
        eadk_display_push_rect_uniform(tooth_b, 0x7BEF);
        eadk_display_push_rect_uniform(tooth_l, 0x7BEF);
        eadk_display_push_rect_uniform(tooth_r, 0x7BEF);
        eadk_display_push_rect_uniform(hole, 0xFFFF);
    }
}

/* ==================== RENDU DU MODE GALERIE (TUILES CARRÉES) ==================== */
static void draw_gallery_card(int app_index, int col, int row, bool is_sel, const theme_t* theme) {
    int card_w = 88;
    int card_h = 70;
    int x = 16 + col * (card_w + 12);
    int y = 28 + row * (card_h + 8);

    /* Fond de la tuile carrée */
    eadk_rect_t card = {(uint16_t)x, (uint16_t)y, (uint16_t)card_w, (uint16_t)card_h};
    eadk_display_push_rect_uniform(card, is_sel ? theme->card_sel : theme->card_bg);

    /* Bordure : 2px lumineux si sélectionné, sinon bordure fine */
    uint16_t border_col = is_sel ? theme->accent : theme->screen_bg;
    eadk_rect_t b_top = {(uint16_t)x, (uint16_t)y, (uint16_t)card_w, (uint16_t)(is_sel ? 2 : 1)};
    eadk_rect_t b_bot = {(uint16_t)x, (uint16_t)(y + card_h - (is_sel ? 2 : 1)), (uint16_t)card_w, (uint16_t)(is_sel ? 2 : 1)};
    eadk_rect_t b_lft = {(uint16_t)x, (uint16_t)y, (uint16_t)(is_sel ? 2 : 1), (uint16_t)card_h};
    eadk_rect_t b_rgt = {(uint16_t)(x + card_w - (is_sel ? 2 : 1)), (uint16_t)y, (uint16_t)(is_sel ? 2 : 1), (uint16_t)card_h};
    eadk_display_push_rect_uniform(b_top, border_col);
    eadk_display_push_rect_uniform(b_bot, border_col);
    eadk_display_push_rect_uniform(b_lft, border_col);
    eadk_display_push_rect_uniform(b_rgt, border_col);

    /* Icône centrée dans la carte */
    int icon_cx = x + card_w / 2;
    int icon_cy = y + 26;
    const equalib_manifest_app_t* app = &g_equalib_manifest.apps[app_index];
    draw_app_icon(app->app_type, icon_cx, icon_cy, theme->accent);

    /* Nom court de l'application sous l'icône */
    char short_name[14];
    const char* full_name = (const char*)app->name;
    const char* p = full_name;
    while (*p && (*p == ' ' || (*p >= '0' && *p <= '9') || *p == '.')) p++;
    int sn_i = 0;
    while (*p && sn_i < 12) {
        short_name[sn_i++] = *p++;
    }
    short_name[sn_i] = '\0';

    int txt_len = (int)strlen(short_name);
    int txt_x = x + (card_w - txt_len * 7) / 2;
    if (txt_x < x + 3) txt_x = x + 3;
    eadk_point_t p_lbl = {(uint16_t)txt_x, (uint16_t)(y + 52)};
    eadk_display_draw_string(short_name, p_lbl, false, is_sel ? theme->accent : theme->text_primary, is_sel ? theme->card_sel : theme->card_bg);
}

/* ==================== RENDU DU MODE LISTE ==================== */
static void draw_list_card(int app_index, int v_slot, bool is_sel, const theme_t* theme) {
    int start_y = 28;
    int card_h = 34;
    int card_w = EADK_SCREEN_WIDTH - 16;
    int y = start_y + v_slot * (card_h + 5);

    eadk_rect_t card = {8, (uint16_t)y, (uint16_t)card_w, (uint16_t)card_h};
    eadk_display_push_rect_uniform(card, is_sel ? theme->card_sel : theme->card_bg);

    if (is_sel) {
        eadk_rect_t accent = {8, (uint16_t)y, 4, (uint16_t)card_h};
        eadk_display_push_rect_uniform(accent, theme->accent);
    }

    const equalib_manifest_app_t* cur_app = &g_equalib_manifest.apps[app_index];

    /* Petite icône sur la gauche */
    draw_app_icon(cur_app->app_type, 22, y + 17, theme->accent);

    eadk_point_t p_name = {36, (uint16_t)(y + 4)};
    eadk_display_draw_string((const char*)cur_app->name, p_name, false, is_sel ? theme->accent : theme->text_primary, is_sel ? theme->card_sel : theme->card_bg);

    eadk_point_t p_cat = {(uint16_t)(EADK_SCREEN_WIDTH - 110), (uint16_t)(y + 4)};
    eadk_display_draw_string((const char*)cur_app->category, p_cat, false, theme->text_muted, is_sel ? theme->card_sel : theme->card_bg);

    eadk_point_t p_desc = {36, (uint16_t)(y + 19)};
    eadk_display_draw_string((const char*)cur_app->desc, p_desc, false, theme->text_muted, is_sel ? theme->card_sel : theme->card_bg);
}

/* ==================== BANDEAU ACTIF BAS AU CENTRE ==================== */
static void draw_bottom_active_dock(int app_index, const theme_t* theme) {
    const equalib_manifest_app_t* app = &g_equalib_manifest.apps[app_index];
    int dock_x = 16;
    int dock_y = 188;
    int dock_w = 288;
    int dock_h = 24;

    /* Fond du dock */
    eadk_rect_t dock = {(uint16_t)dock_x, (uint16_t)dock_y, (uint16_t)dock_w, (uint16_t)dock_h};
    eadk_display_push_rect_uniform(dock, theme->dock_bg);

    /* Bordure lumineuse */
    eadk_rect_t d_top = {(uint16_t)dock_x, (uint16_t)dock_y, (uint16_t)dock_w, 1};
    eadk_rect_t d_bot = {(uint16_t)dock_x, (uint16_t)(dock_y + dock_h - 1), (uint16_t)dock_w, 1};
    eadk_rect_t d_lft = {(uint16_t)dock_x, (uint16_t)dock_y, 1, (uint16_t)dock_h};
    eadk_rect_t d_rgt = {(uint16_t)(dock_x + dock_w - 1), (uint16_t)dock_y, 1, (uint16_t)dock_h};
    eadk_display_push_rect_uniform(d_top, theme->dock_border);
    eadk_display_push_rect_uniform(d_bot, theme->dock_border);
    eadk_display_push_rect_uniform(d_lft, theme->dock_border);
    eadk_display_push_rect_uniform(d_rgt, theme->dock_border);

    /* Nom de l'application à gauche */
    eadk_point_t p_app = {(uint16_t)(dock_x + 10), (uint16_t)(dock_y + 5)};
    eadk_display_draw_string((const char*)app->name, p_app, false, theme->accent, theme->dock_bg);

    /* Catégorie alignée à droite (si elle ne chevauche pas le nom) */
    int name_len = (int)strlen((const char*)app->name);
    int cat_len = (int)strlen((const char*)app->category);
    int cat_x = dock_x + dock_w - (cat_len * 7) - 10;
    if (cat_x > dock_x + 10 + (name_len * 7) + 10) {
        eadk_point_t p_cat = {(uint16_t)cat_x, (uint16_t)(dock_y + 5)};
        eadk_display_draw_string((const char*)app->category, p_cat, false, theme->text_muted, theme->dock_bg);
    }
}

/* ==================== DÉCORATIONS VISUELLES DES THÈMES ==================== */
static void draw_theme_decorations(const theme_t* theme) {
    if (g_current_theme == 1) {
        /* Sakura : pétales rose pastel */
        eadk_rect_t p1 = {10, 10, 3, 3}; eadk_display_push_rect_uniform(p1, 0xFBAE);
        eadk_rect_t p2 = {305, 12, 3, 3}; eadk_display_push_rect_uniform(p2, 0xFBAE);
        eadk_rect_t p3 = {15, 225, 4, 4}; eadk_display_push_rect_uniform(p3, 0xFBAE);
        eadk_rect_t p4 = {295, 222, 3, 3}; eadk_display_push_rect_uniform(p4, 0xFBAE);
    } else if (g_current_theme == 2) {
        /* Hacker : points cyan matrix */
        eadk_rect_t d1 = {2, 2, 2, 2}; eadk_display_push_rect_uniform(d1, 0x3DFE);
        eadk_rect_t d2 = {316, 2, 2, 2}; eadk_display_push_rect_uniform(d2, 0x3DFE);
        eadk_rect_t d3 = {2, 236, 2, 2}; eadk_display_push_rect_uniform(d3, 0x3DFE);
        eadk_rect_t d4 = {316, 236, 2, 2}; eadk_display_push_rect_uniform(d4, 0x3DFE);
    } else if (g_current_theme == 4) {
        /* Mario : logo 'M' blanc/rouge dans la barre */
        eadk_point_t p_m = {305, 5};
        eadk_display_draw_string("M", p_m, false, 0xFFFF, theme->top_bar);
    }
}

/* ==================== MENU DES PARAMÈTRES & THÈMES ==================== */
static void run_settings_screen(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    int sel_item = 0;
    bool redraw = true;
    eadk_keyboard_state_t prev = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || 
            eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(pressed, eadk_key_ok)) {
            break;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
            if (sel_item > 0) { sel_item--; redraw = true; }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
            if (sel_item < 3) { sel_item++; redraw = true; }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
            if (sel_item == 0) {
                g_view_mode = (g_view_mode == VIEW_MODE_GALLERY) ? VIEW_MODE_LIST : VIEW_MODE_GALLERY;
                redraw = true;
            } else if (sel_item == 1) {
                g_show_tooltips = !g_show_tooltips;
                redraw = true;
            } else if (sel_item == 2) {
                g_current_theme = (g_current_theme + 5) % 6;
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
            if (sel_item == 0) {
                g_view_mode = (g_view_mode == VIEW_MODE_GALLERY) ? VIEW_MODE_LIST : VIEW_MODE_GALLERY;
                redraw = true;
            } else if (sel_item == 1) {
                g_show_tooltips = !g_show_tooltips;
                redraw = true;
            } else if (sel_item == 2) {
                g_current_theme = (g_current_theme + 1) % 6;
                redraw = true;
            }
        }

        prev = kbd;

        if (redraw) {
            redraw = false;
            const theme_t* th = &g_themes[g_current_theme];

            /* Fond et barre */
            eadk_display_push_rect_uniform(eadk_screen_rect, th->screen_bg);
            eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(bar, th->top_bar);
            eadk_point_t p_t = {8, 5};
            eadk_display_draw_string("Parametres & Themes EquaLib", p_t, false, th->text_primary, th->top_bar);

            /* Cadre paramètres */
            for (int i = 0; i < 4; i++) {
                int y = 35 + i * 40;
                bool is_s = (i == sel_item);
                eadk_rect_t c = {16, (uint16_t)y, 288, 32};
                eadk_display_push_rect_uniform(c, is_s ? th->card_sel : th->card_bg);

                if (is_s) {
                    eadk_rect_t acc = {16, (uint16_t)y, 4, 32};
                    eadk_display_push_rect_uniform(acc, th->accent);
                }

                if (i == 0) {
                    eadk_point_t p1 = {26, (uint16_t)(y + 10)};
                    eadk_display_draw_string("Mode d'Affichage :", p1, false, th->text_primary, is_s ? th->card_sel : th->card_bg);
                    eadk_point_t p2 = {180, (uint16_t)(y + 10)};
                    eadk_display_draw_string(g_view_mode == VIEW_MODE_GALLERY ? "< GALERIE >" : "< LISTE >", p2, false, th->accent, is_s ? th->card_sel : th->card_bg);
                } else if (i == 1) {
                    eadk_point_t p1 = {26, (uint16_t)(y + 10)};
                    eadk_display_draw_string("Raccourcis / Tooltips :", p1, false, th->text_primary, is_s ? th->card_sel : th->card_bg);
                    eadk_point_t p2 = {200, (uint16_t)(y + 10)};
                    eadk_display_draw_string(g_show_tooltips ? "< OUI >" : "< NON >", p2, false, th->accent, is_s ? th->card_sel : th->card_bg);
                } else if (i == 2) {
                    eadk_point_t p1 = {26, (uint16_t)(y + 4)};
                    eadk_display_draw_string("Theme Visuel :", p1, false, th->text_primary, is_s ? th->card_sel : th->card_bg);
                    eadk_point_t p2 = {26, (uint16_t)(y + 17)};
                    eadk_display_draw_string(th->name, p2, false, th->accent, is_s ? th->card_sel : th->card_bg);
                } else if (i == 3) {
                    eadk_point_t p1 = {26, (uint16_t)(y + 10)};
                    eadk_display_draw_string("[ OK / Back ] : Valider & Revenir", p1, false, th->accent, is_s ? th->card_sel : th->card_bg);
                }
            }

            /* Pied d'écran */
            if (g_show_tooltips) {
                eadk_rect_t bot = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
                eadk_display_push_rect_uniform(bot, th->card_bg);
                eadk_point_t p_h = {8, EADK_SCREEN_HEIGHT - 13};
                eadk_display_draw_string("Fleches: Changer | OK / Back: Sauvegarder", p_h, false, th->text_muted, th->card_bg);
            }
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}

/* ==================== POINT D'ENTRÉE PRINCIPAL DU HUB ==================== */
int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    uint32_t total_apps = g_equalib_manifest.app_count;
    if (g_equalib_manifest.magic != EQUALIB_MANIFEST_MAGIC || total_apps == 0 || total_apps > MAX_MANIFEST_APPS) {
        total_apps = 5;
    }

    int selected = 0;
    int scroll_offset = 0;
    bool redraw = true;
    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        /* Sortie complète de l'application vers Epsilon */
        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off) ||
            eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        /* Touche Paramètres : Toolbox, Var ou touche 0 */
        if (eadk_keyboard_key_down(pressed, eadk_key_toolbox) || 
            eadk_keyboard_key_down(pressed, eadk_key_var)) {
            run_settings_screen();
            redraw = true;
            prev_kbd = 0;
            continue;
        }

        /* Navigation */
        if (g_view_mode == VIEW_MODE_GALLERY) {
            /* Navigation en grille 3 colonnes x 2 rangées */
            if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                if (selected < (int)total_apps - 1) {
                    selected++;
                    redraw = true;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                if (selected > 0) {
                    selected--;
                    redraw = true;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (selected + 3 < (int)total_apps) {
                    selected += 3;
                    redraw = true;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                if (selected - 3 >= 0) {
                    selected -= 3;
                    redraw = true;
                }
            }
        } else {
            /* Navigation en liste verticale */
            if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (selected < (int)total_apps - 1) {
                    selected++;
                    if (selected >= scroll_offset + 4) scroll_offset = selected - 3;
                    redraw = true;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                if (selected > 0) {
                    selected--;
                    if (selected < scroll_offset) scroll_offset = selected;
                    redraw = true;
                }
            }
        }

        /* Touche OK / Exe : Lancement de l'application */
        if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            const equalib_manifest_app_t* app = &g_equalib_manifest.apps[selected];
            uint8_t type = app->app_type;

            if (type == APP_TYPE_MARIOKART) run_mariokart_app();
            else if (type == APP_TYPE_PERIODIC) run_periodic_table_app();
            else if (type == APP_TYPE_COURSES) run_courses_app();
            else if (type == APP_TYPE_MATH_TOOLS) run_math_tools_app();
            else if (type == APP_TYPE_FLAPPY) run_flappy_app();
            else if (type == APP_TYPE_2048) run_2048_app();
            else if (type == APP_TYPE_SNAKE) run_snake_app();
            else if (type == APP_TYPE_TETRIS) run_tetris_app();
            else if (type == APP_TYPE_MINESWEEPER) run_minesweeper_app();
            else if (type == APP_TYPE_SETTINGS) run_settings_screen();
            else if (type == APP_TYPE_NATIVE_EXEC) {
                const uint8_t* bin_ptr = (app->data_size > 0) ? (const uint8_t*)(0x90180000 + app->data_offset) : NULL;
                run_native_app((const char*)app->name, bin_ptr, app->data_size);
            } else if (type == APP_TYPE_PYTHON || type == APP_TYPE_TEXT_VIEWER) {
                const char* data_ptr = (app->data_size > 0) ? (const char*)(0x90180000 + app->data_offset) : NULL;
                if (data_ptr && app->data_size >= 4 && (
                    (*(const uint32_t*)data_ptr == 0xDEC0BEBA) ||
                    (data_ptr[0] == 0x7F && data_ptr[1] == 'E' && data_ptr[2] == 'L' && data_ptr[3] == 'F'))) {
                    run_native_app((const char*)app->name, (const uint8_t*)data_ptr, app->data_size);
                } else if (type == APP_TYPE_PYTHON || (data_ptr && app->data_size > 0 &&
                    (data_ptr[0] == '#' || data_ptr[0] == 'i' || data_ptr[0] == 'd' || data_ptr[0] == 'f' || data_ptr[0] == 'k'))) {
                    run_python_app((const char*)app->name, data_ptr, app->data_size);
                } else {
                    run_text_viewer_app((const char*)app->name, data_ptr, app->data_size);
                }
            }

            while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
            prev_kbd = 0;
            redraw = true;
        }

        prev_kbd = kbd;

        /* Rendu graphique complet */
        if (redraw) {
            redraw = false;
            const theme_t* cur_th = &g_themes[g_current_theme];

            /* Fond général de l'écran LCD */
            eadk_display_push_rect_uniform(eadk_screen_rect, cur_th->screen_bg);

            /* Barre supérieure officielle */
            eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top_bar, cur_th->top_bar);

            eadk_point_t p_title = {8, 5};
            eadk_display_draw_string("EquaLib Hub (Cameleon & Gemini)", p_title, false, cur_th->text_primary, cur_th->top_bar);

            /* Badge du mode actuel dans la barre supérieure */
            eadk_point_t p_badge = {(uint16_t)(EADK_SCREEN_WIDTH - 65), 5};
            eadk_display_draw_string(g_view_mode == VIEW_MODE_GALLERY ? "[Galerie]" : "[Liste]", p_badge, false, cur_th->text_primary, cur_th->top_bar);

            /* Décorations de thème */
            draw_theme_decorations(cur_th);

            /* Contenu : Galerie ou Liste */
            if (g_view_mode == VIEW_MODE_GALLERY) {
                /* Galerie : grille 3x2 (6 tuiles visibles par page) */
                int page = selected / 6;
                int page_start = page * 6;
                for (int slot = 0; slot < 6; slot++) {
                    int app_idx = page_start + slot;
                    if (app_idx < (int)total_apps) {
                        int col = slot % 3;
                        int row = slot / 3;
                        draw_gallery_card(app_idx, col, row, app_idx == selected, cur_th);
                    }
                }
            } else {
                /* Liste : 4 cartes verticales */
                int visible_count = 4;
                if (visible_count > (int)total_apps - scroll_offset) {
                    visible_count = (int)total_apps - scroll_offset;
                }
                for (int v = 0; v < visible_count; v++) {
                    int i = scroll_offset + v;
                    draw_list_card(i, v, i == selected, cur_th);
                }
            }

            /* Bandeau En bas au centre : nom et catégorie de l'application active */
            draw_bottom_active_dock(selected, cur_th);

            /* Pied de page avec raccourcis (Tooltips) si activés */
            if (g_show_tooltips) {
                eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
                eadk_display_push_rect_uniform(bottom_bar, cur_th->card_bg);

                eadk_point_t p_help = {8, EADK_SCREEN_HEIGHT - 13};
                eadk_display_draw_string("OK: Lancer | Toolbox: Options | Back: Epsilon", p_help, false, cur_th->text_muted, cur_th->card_bg);
            }
        }

        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    return 0;
}
