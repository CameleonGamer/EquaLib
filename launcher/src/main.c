#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "apps.h"
#include "equalib_manifest.h"
#include "storage.h"
#include "game_icons_data.h"

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

static const theme_t g_themes[7] = {
    /* 0: NumWorks Classique */
    {
        .name = "Classique (NumWorks)",
        .top_bar = 0xFE60,     /* Jaune NumWorks #FFBB00 */
        .screen_bg = 0xF7BE,   /* Gris/Creme Epsilon */
        .card_bg = 0xFFFF,     /* Blanc pur */
        .card_sel = 0xFFF0,    /* Blanc/ambre clair */
        .accent = 0xD340,      /* Ambre dore soutenu #D97706 */
        .text_primary = 0x0000,/* Noir pur */
        .text_muted = 0x632C,  /* Gris moyen ardoise */
        .dock_bg = 0xFFFF,     /* Blanc pur */
        .dock_border = 0xFE60  /* Bordure jaune NumWorks */
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
        .text_muted = 0x9810,  /* Rose moyen */
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
        .text_muted = 0x8800,  /* Rouge brique */
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
    },
    /* 6: Custom (Mon Fond Pixel Art / Image) */
    {
        .name = "Custom (Mon Fond)",
        .top_bar = 0x2124,     /* Ardoise sombre tech */
        .screen_bg = 0x2124,   /* Fond de repli ardoise moderne contrasté */
        .card_bg = 0xFFFF,     /* Blanc pur */
        .card_sel = 0xFEE0,    /* Ambre pastel clair */
        .accent = 0xFE60,      /* Jaune NumWorks #FFBB00 */
        .text_primary = 0x0000,/* Noir pur */
        .text_muted = 0x52AA,  /* Gris ardoise */
        .dock_bg = 0xFFFF,     /* Blanc pur */
        .dock_border = 0xFE60  /* Bordure dorée NumWorks */
    }
};

/* Modes d'affichage */
enum {
    VIEW_MODE_GALLERY = 0,
    VIEW_MODE_LIST = 1
};

static int g_current_theme = 0;      /* 0 = Classique, 1 = Sakura, 2 = Hacker, 3 = Abeille, 4 = Mario, 5 = GameBoy, 6 = Custom */
static int g_view_mode = VIEW_MODE_GALLERY; /* Mode Galerie d'images carrées par défaut */
static bool g_show_tooltips = true;  /* Affichage des raccourcis en bas d'écran */
static bool g_glass_mode = true;     /* Mode Glassmorphism (effet verre dépoli Apple) */
static bool g_smooth_corners = true; /* Bords lisses et coins arrondis */

static void save_persistent_settings(void) {
    eq_storage_t* s = eq_storage_get();
    s->theme = g_current_theme;
    s->view_mode = g_view_mode;
    s->tooltips = g_show_tooltips ? 1 : 0;
    s->glass_mode = g_glass_mode ? 1 : 0;
    s->smooth_corners = g_smooth_corners ? 1 : 0;
    eq_storage_commit();
}

/* Tampon intermédiaire en RAM pour le rendu du fond d'écran.
 * Sur STM32H7 (NumWorks N0120), le contrôleur DMA de l'afficheur ne peut pas lire
 * directement en mémoire OCTOSPI Flash (0x90000000). Le processeur Cortex-M7 copie
 * donc les bandes en AXI-SRAM avant de les pousser au LCD, évitant ainsi tout écran noir.
 */
#define WALLPAPER_BAND_HEIGHT 8
static eadk_color_t s_wallpaper_ram_band[EADK_SCREEN_WIDTH * WALLPAPER_BAND_HEIGHT];

#define EQUALIB_FLASH_BASE 0x90180000UL

static inline uintptr_t get_app_flash_base(void) {
    return EQUALIB_FLASH_BASE;
}

/* Rendu sécurisé du fond d'écran ou fond uni avec vérification MPU et protection anti-HardFault */
static void __attribute__((noinline)) draw_screen_background(const theme_t* cur_th) {
    if (g_current_theme == 6 &&
        g_equalib_manifest.wallpaper_size >= 153600 &&
        g_equalib_manifest.wallpaper_offset >= 0x10000 &&
        g_equalib_manifest.wallpaper_offset <= 0x400000) {

        const uintptr_t flash_base = EQUALIB_FLASH_BASE;
        uint32_t total_app_size = *(const uint32_t*)(flash_base + 24);
        if (g_equalib_manifest.wallpaper_offset + g_equalib_manifest.wallpaper_size <= total_app_size) {
            const eadk_color_t* wp_ptr = (const eadk_color_t*)(flash_base + g_equalib_manifest.wallpaper_offset);
            for (uint16_t y = 0; y < EADK_SCREEN_HEIGHT; y += WALLPAPER_BAND_HEIGHT) {
                eadk_rect_t band_r = {0, y, EADK_SCREEN_WIDTH, WALLPAPER_BAND_HEIGHT};
                const eadk_color_t* src = wp_ptr + ((uint32_t)y * EADK_SCREEN_WIDTH);
                for (int i = 0; i < EADK_SCREEN_WIDTH * WALLPAPER_BAND_HEIGHT; i++) {
                    s_wallpaper_ram_band[i] = src[i];
                }
                eadk_display_push_rect(band_r, s_wallpaper_ram_band);
            }
            return;
        }
    }
    eadk_display_push_rect_uniform(eadk_screen_rect, cur_th->screen_bg);
}

/* ==================== RENDU GLASSMORPHISM & BORDS LISSES ==================== */

/* Mélange 50/50 rapide RGB565 sans débordement de canal (4 instructions ARM) */
static inline uint16_t rgb565_blend_50_50(uint16_t c1, uint16_t c2) {
    return (uint16_t)(((c1 & 0xF7DE) >> 1) + ((c2 & 0xF7DE) >> 1));
}

/* Mélange 75/25 rapide RGB565 (75% c1 + 25% c2) pour effet verre dépoli translucide Apple */
static inline uint16_t rgb565_blend_75_25(uint16_t c1, uint16_t c2) {
    return rgb565_blend_50_50(c1, rgb565_blend_50_50(c1, c2));
}

/* Calcul du contraste adaptatif (noir ou blanc) selon la luminance RGB565 */
static inline eadk_color_t get_contrast_text_color(eadk_color_t bg_color) {
    uint32_t r = (bg_color >> 11) & 0x1F;
    uint32_t g = (bg_color >> 5) & 0x3F;
    uint32_t b = bg_color & 0x1F;
    uint32_t brightness = r * 3 + g * 2 + b;
    return (brightness > 115) ? 0x0000 : 0xFFFF;
}

static inline const eadk_color_t* get_wallpaper_flash_ptr(void) {
    if (g_current_theme == 6 &&
        g_equalib_manifest.wallpaper_size >= 153600 &&
        g_equalib_manifest.wallpaper_offset >= 0x10000 &&
        g_equalib_manifest.wallpaper_offset <= 0x400000) {
        return (const eadk_color_t*)(EQUALIB_FLASH_BASE + g_equalib_manifest.wallpaper_offset);
    }
    return NULL;
}

static inline eadk_color_t get_bg_pixel(int px, int py, const theme_t* th, const eadk_color_t* wp_ptr) {
    if (wp_ptr && px >= 0 && px < EADK_SCREEN_WIDTH && py >= 0 && py < EADK_SCREEN_HEIGHT) {
        return wp_ptr[(uint32_t)py * EADK_SCREEN_WIDTH + px];
    }
    return th->screen_bg;
}

static eadk_color_t s_styled_line_buf[EADK_SCREEN_WIDTH];

/* Tracé d'un conteneur stylisé (Mode Glass Apple et/ou Bords Lisses arrondis) */
static void __attribute__((noinline)) draw_styled_container(
    int x, int y, int w, int h,
    bool is_sel,
    eadk_color_t card_color,
    eadk_color_t border_color,
    const theme_t* theme,
    const eadk_color_t* wp_ptr
) {
    if (w <= 0 || h <= 0 || w > EADK_SCREEN_WIDTH) return;

    /* Masque d'arrondi de rayon R=6 px pour de superbes bords lisses */
    static const uint8_t corner_indents[6] = { 5, 3, 2, 1, 1, 0 };

    for (int r = 0; r < h; r++) {
        int py = y + r;
        int ind = 0;
        if (g_smooth_corners && h >= 16) {
            if (r < 6) ind = corner_indents[r];
            else if (r >= h - 6) ind = corner_indents[h - 1 - r];
        } else if (g_smooth_corners && h >= 10) {
            if (r < 3) ind = corner_indents[r + 3];
            else if (r >= h - 3) ind = corner_indents[h - 1 - r + 3];
        }

        int x_start = ind;
        int x_end = w - 1 - ind;

        for (int c = 0; c < w; c++) {
            int px = x + c;
            eadk_color_t bg_pix = get_bg_pixel(px, py, theme, wp_ptr);

            if (c < x_start || c > x_end) {
                /* Pixel en dehors de l'arrondi du conteneur : afficher le fond sous-jacent */
                s_styled_line_buf[c] = bg_pix;
                continue;
            }

            /* Détection des pixels de bordure */
            bool is_border = false;
            bool is_specular = false;

            if (r == 0 || r == h - 1) {
                is_border = true;
                if (r == 0 && g_glass_mode) is_specular = true;
            } else if (c == x_start || c == x_end) {
                is_border = true;
                if (c == x_start && g_glass_mode && r < h - 2) is_specular = true;
            } else if (is_sel && (r == 1 || r == h - 2 || c == x_start + 1 || c == x_end - 1)) {
                /* Bordure élargie à 2px pour l'élément actif sélectionné */
                is_border = true;
            }

            if (is_border) {
                if (is_sel) {
                    s_styled_line_buf[c] = border_color;
                } else if (is_specular) {
                    /* Liséré spéculaire supérieur façon Apple Glass : reflet blanc pur éclatant */
                    s_styled_line_buf[c] = 0xFFFF;
                } else if (g_glass_mode) {
                    /* Bordure translucide lumineuse façon verre biseauté */
                    s_styled_line_buf[c] = rgb565_blend_50_50(0xFFFF, bg_pix);
                } else {
                    s_styled_line_buf[c] = border_color;
                }
            } else {
                /* Corps du conteneur : mélange verre dépoli 50/50 ou couleur pleine */
                if (g_glass_mode) {
                    s_styled_line_buf[c] = rgb565_blend_50_50(card_color, bg_pix);
                } else {
                    s_styled_line_buf[c] = card_color;
                }
            }
        }

        eadk_rect_t row_rect = {(uint16_t)x, (uint16_t)py, (uint16_t)w, 1};
        eadk_display_push_rect(row_rect, s_styled_line_buf);
    }
}

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

/* ==================== DESSIN DES ICÔNES PIXEL-ART (20x20) ==================== */
static void draw_bitmap_icon_20x20(int cx, int cy, const uint16_t* colors, const uint8_t* mask) {
    int start_x = cx - 10;
    int start_y = cy - 10;
    for (int y = 0; y < 20; y++) {
        int py = start_y + y;
        if (py < 0 || py >= EADK_SCREEN_HEIGHT) continue;
        int run_start = -1;
        for (int x = 0; x < 20; x++) {
            int bit_idx = y * 20 + x;
            bool opaque = (mask[bit_idx / 8] & (1 << (bit_idx % 8))) != 0;
            if (opaque) {
                if (run_start == -1) run_start = x;
            } else {
                if (run_start != -1) {
                    eadk_rect_t r = {(uint16_t)(start_x + run_start), (uint16_t)py, (uint16_t)(x - run_start), 1};
                    eadk_display_push_rect(r, &colors[y * 20 + run_start]);
                    run_start = -1;
                }
            }
        }
        if (run_start != -1) {
            eadk_rect_t r = {(uint16_t)(start_x + run_start), (uint16_t)py, (uint16_t)(20 - run_start), 1};
            eadk_display_push_rect(r, &colors[y * 20 + run_start]);
        }
    }
}

static void draw_app_icon(uint8_t app_type, int cx, int cy, uint16_t accent_col) {
    (void)accent_col;
    if (app_type == APP_TYPE_MARIOKART) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_mariokart_rgb, s_icon_mariokart_mask);
    } else if (app_type == APP_TYPE_FLAPPY) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_flappy_rgb, s_icon_flappy_mask);
    } else if (app_type == APP_TYPE_2048) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_2048_rgb, s_icon_2048_mask);
    } else if (app_type == APP_TYPE_SNAKE) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_snake_rgb, s_icon_snake_mask);
    } else if (app_type == APP_TYPE_TETRIS) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_tetris_rgb, s_icon_tetris_mask);
    } else if (app_type == APP_TYPE_MINESWEEPER) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_minesweeper_rgb, s_icon_minesweeper_mask);
    } else if (app_type == APP_TYPE_DINO) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_dino_rgb, s_icon_dino_mask);
    } else if (app_type == APP_TYPE_SPACE_INVADERS) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_space_invaders_rgb, s_icon_space_invaders_mask);
    } else if (app_type == APP_TYPE_BREAKOUT) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_breakout_rgb, s_icon_breakout_mask);
    } else if (app_type == APP_TYPE_PUISSANCE4) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_puissance4_rgb, s_icon_puissance4_mask);
    } else if (app_type == APP_TYPE_MORPION) {
        draw_bitmap_icon_20x20(cx, cy, s_icon_morpion_rgb, s_icon_morpion_mask);
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
    } else if (app_type == APP_TYPE_PYTHON) {
        /* Logo Python bleu & jaune */
        eadk_rect_t py_top = {(uint16_t)(cx - 6), (uint16_t)(cy - 8), 12, 7};
        eadk_rect_t py_bot = {(uint16_t)(cx - 6), (uint16_t)(cy), 12, 7};
        eadk_rect_t eye_t = {(uint16_t)(cx - 3), (uint16_t)(cy - 6), 2, 2};
        eadk_rect_t eye_b = {(uint16_t)(cx + 2), (uint16_t)(cy + 3), 2, 2};
        eadk_display_push_rect_uniform(py_top, 0x341F); /* Bleu Python */
        eadk_display_push_rect_uniform(py_bot, 0xFDE0); /* Jaune Python */
        eadk_display_push_rect_uniform(eye_t, 0xFFFF);
        eadk_display_push_rect_uniform(eye_b, 0x0000);
    } else if (app_type == APP_TYPE_NATIVE_EXEC) {
        /* Puce ARM / Processeur avec broches */
        eadk_rect_t chip = {(uint16_t)(cx - 7), (uint16_t)(cy - 7), 14, 14};
        eadk_rect_t pin_l = {(uint16_t)(cx - 10), (uint16_t)(cy - 5), 3, 10};
        eadk_rect_t pin_r = {(uint16_t)(cx + 7), (uint16_t)(cy - 5), 3, 10};
        eadk_rect_t core = {(uint16_t)(cx - 3), (uint16_t)(cy - 3), 6, 6};
        eadk_display_push_rect_uniform(chip, 0x2124);
        eadk_display_push_rect_uniform(pin_l, 0xFDE0);
        eadk_display_push_rect_uniform(pin_r, 0xFDE0);
        eadk_display_push_rect_uniform(core, 0x07E0);
    } else if (app_type == APP_TYPE_TEXT_VIEWER) {
        /* Document texte */
        eadk_rect_t doc = {(uint16_t)(cx - 7), (uint16_t)(cy - 9), 14, 18};
        eadk_rect_t l1 = {(uint16_t)(cx - 5), (uint16_t)(cy - 6), 10, 2};
        eadk_rect_t l2 = {(uint16_t)(cx - 5), (uint16_t)(cy - 2), 10, 2};
        eadk_rect_t l3 = {(uint16_t)(cx - 5), (uint16_t)(cy + 2), 7, 2};
        eadk_display_push_rect_uniform(doc, 0xFFFF);
        eadk_display_push_rect_uniform(l1, 0x3DFE);
        eadk_display_push_rect_uniform(l2, 0x3DFE);
        eadk_display_push_rect_uniform(l3, 0x3DFE);
    } else if (app_type == APP_TYPE_SETTINGS) {
        /* Engrenage Paramètres */
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
    } else if (app_type == APP_TYPE_PONG) {
        /* Deux raquettes et une balle rétro */
        eadk_rect_t p1 = {(uint16_t)(cx - 8), (uint16_t)(cy - 7), 3, 14};
        eadk_rect_t p2 = {(uint16_t)(cx + 5), (uint16_t)(cy - 3), 3, 14};
        eadk_rect_t ball = {(uint16_t)(cx - 1), (uint16_t)(cy - 2), 3, 3};
        eadk_display_push_rect_uniform(p1, 0x3DFE);
        eadk_display_push_rect_uniform(p2, 0xFA80);
        eadk_display_push_rect_uniform(ball, 0xFFFF);
    } else {
        /* Application générique / Boîte d'outils */
        eadk_rect_t box = {(uint16_t)(cx - 7), (uint16_t)(cy - 7), 14, 14};
        eadk_rect_t top = {(uint16_t)(cx - 5), (uint16_t)(cy - 9), 10, 3};
        eadk_rect_t inner = {(uint16_t)(cx - 4), (uint16_t)(cy - 4), 8, 8};
        eadk_display_push_rect_uniform(box, 0xFE60);
        eadk_display_push_rect_uniform(top, 0xD340);
        eadk_display_push_rect_uniform(inner, 0xFFFF);
    }
}

/* ==================== RENDU DU MODE GALERIE (TUILES CARRÉES) ==================== */
static void draw_gallery_card(int app_index, int col, int row, bool is_sel, const theme_t* theme) {
    if (app_index < 0 || app_index >= (int)g_equalib_manifest.app_count) return;
    int card_w = 88;
    int card_h = 70;
    int x = 16 + col * (card_w + 12);
    int y = 28 + row * (card_h + 8);

    const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
    eadk_color_t base_card_col = is_sel ? theme->card_sel : theme->card_bg;
    eadk_color_t border_col = is_sel ? theme->accent : (g_glass_mode ? rgb565_blend_50_50(theme->card_bg, theme->screen_bg) : theme->screen_bg);

    draw_styled_container(x, y, card_w, card_h, is_sel, base_card_col, border_col, theme, wp_ptr);

    /* Icône centrée dans la carte */
    int icon_cx = x + card_w / 2;
    int icon_cy = y + 26;
    const equalib_manifest_app_t* app = &g_equalib_manifest.apps[app_index];
    draw_app_icon(app->app_type, icon_cx, icon_cy, theme->accent);

    /* Nom court de l'application sous l'icône : retire uniquement le numéro d'ordre '1. ', '2. ', etc. */
    const char* p = (const char*)app->name;
    while (*p >= '0' && *p <= '9') p++;
    if (*p == '.' || *p == ' ') {
        while (*p == '.' || *p == ' ') p++;
    } else {
        p = (const char*)app->name;
    }
    if (*p == '\0') p = (const char*)app->name;

    char short_name[14];
    int sn_i = 0;
    while (*p && sn_i < 12) {
        short_name[sn_i++] = *p++;
    }
    short_name[sn_i] = '\0';
    if (sn_i == 0) {
        short_name[0] = 'A'; short_name[1] = 'p'; short_name[2] = 'p'; short_name[3] = '\0';
        sn_i = 3;
    }

    int txt_len = sn_i;
    int txt_x = x + (card_w - txt_len * 6) / 2;
    if (txt_x < x + 3) txt_x = x + 3;

    eadk_color_t text_bg = base_card_col;
    if (g_glass_mode) {
        text_bg = rgb565_blend_50_50(base_card_col, get_bg_pixel(txt_x + (txt_len * 3), y + 54, theme, wp_ptr));
    }
    eadk_color_t text_col = get_contrast_text_color(text_bg);

    eadk_point_t p_lbl = {(uint16_t)txt_x, (uint16_t)(y + 52)};
    eadk_display_draw_string(short_name, p_lbl, false, text_col, text_bg);
}

/* ==================== RENDU DU MODE LISTE ==================== */
static void draw_list_card(int app_index, int v_slot, bool is_sel, const theme_t* theme) {
    if (app_index < 0 || app_index >= (int)g_equalib_manifest.app_count) return;
    int start_y = 28;
    int card_h = 34;
    int card_w = EADK_SCREEN_WIDTH - 16;
    int y = start_y + v_slot * (card_h + 5);

    const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
    eadk_color_t base_card_col = is_sel ? theme->card_sel : theme->card_bg;
    eadk_color_t border_col = is_sel ? theme->accent : (g_glass_mode ? rgb565_blend_50_50(theme->card_bg, theme->screen_bg) : theme->screen_bg);

    draw_styled_container(8, y, card_w, card_h, is_sel, base_card_col, border_col, theme, wp_ptr);

    if (is_sel) {
        int acc_x = g_smooth_corners ? 10 : 8;
        eadk_rect_t accent = {(uint16_t)acc_x, (uint16_t)(y + 4), 3, (uint16_t)(card_h - 8)};
        eadk_display_push_rect_uniform(accent, theme->accent);
    }

    const equalib_manifest_app_t* cur_app = &g_equalib_manifest.apps[app_index];

    /* Petite icône sur la gauche */
    draw_app_icon(cur_app->app_type, 22, y + 17, theme->accent);

    eadk_color_t text_bg = base_card_col;
    if (g_glass_mode) {
        text_bg = rgb565_blend_50_50(base_card_col, get_bg_pixel(80, y + 17, theme, wp_ptr));
    }
    eadk_color_t text_col = get_contrast_text_color(text_bg);

    eadk_point_t p_name = {36, (uint16_t)(y + 4)};
    eadk_display_draw_string((const char*)cur_app->name, p_name, false, text_col, text_bg);

    eadk_point_t p_cat = {(uint16_t)(EADK_SCREEN_WIDTH - 110), (uint16_t)(y + 4)};
    eadk_display_draw_string((const char*)cur_app->category, p_cat, false, theme->accent, text_bg);

    eadk_point_t p_desc = {36, (uint16_t)(y + 19)};
    eadk_color_t desc_col = (text_col == 0x0000) ? 0x52AA : theme->text_muted;
    eadk_display_draw_string((const char*)cur_app->desc, p_desc, false, desc_col, text_bg);
}

/* ==================== BANDEAU ACTIF BAS AU CENTRE ==================== */
static void draw_bottom_active_dock(int app_index, const theme_t* theme) {
    if (app_index < 0 || app_index >= (int)g_equalib_manifest.app_count) {
        app_index = 0;
    }
    const equalib_manifest_app_t* app = &g_equalib_manifest.apps[app_index];
    int dock_x = 16;
    int dock_y = 188;
    int dock_w = 288;
    int dock_h = 24;

    const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
    draw_styled_container(dock_x, dock_y, dock_w, dock_h, false, theme->dock_bg, theme->dock_border, theme, wp_ptr);

    eadk_color_t dock_text_bg = theme->dock_bg;
    if (g_glass_mode) {
        dock_text_bg = rgb565_blend_50_50(theme->dock_bg, get_bg_pixel(dock_x + 100, dock_y + 12, theme, wp_ptr));
    }
    eadk_color_t dock_text_col = get_contrast_text_color(dock_text_bg);

    /* Nom de l'application à gauche avec contraste maximal */
    char safe_name[33];
    int ni = 0;
    while (app->name[ni] && ni < 32) {
        safe_name[ni] = app->name[ni];
        ni++;
    }
    safe_name[ni] = '\0';
    if (ni == 0) {
        safe_name[0] = 'A'; safe_name[1] = 'p'; safe_name[2] = 'p'; safe_name[3] = '\0';
        ni = 3;
    }

    eadk_point_t p_app = {(uint16_t)(dock_x + 8), (uint16_t)(dock_y + 6)};
    eadk_display_draw_string(safe_name, p_app, false, dock_text_col, dock_text_bg);

    /* Catégorie alignée à droite */
    char safe_cat[21];
    int ci = 0;
    while (app->category[ci] && ci < 20) {
        safe_cat[ci] = app->category[ci];
        ci++;
    }
    safe_cat[ci] = '\0';
    int cat_len = ci;
    int cat_x = dock_x + dock_w - (cat_len * 6) - 8;
    if (cat_x > dock_x + 8 + (ni * 6) + 8) {
        eadk_point_t p_cat = {(uint16_t)cat_x, (uint16_t)(dock_y + 6)};
        eadk_display_draw_string(safe_cat, p_cat, false, theme->accent, dock_text_bg);
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

/* Rendu d'une rangée du menu Paramètres (6 rangées au total) */
static void draw_settings_row(int i, bool is_s, const theme_t* th) {
    int y = 28 + i * 30;
    int row_w = 288;
    int row_h = 26;

    const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
    eadk_color_t base_bg = is_s ? th->card_sel : th->card_bg;
    eadk_color_t border_col = is_s ? th->accent : (g_glass_mode ? rgb565_blend_50_50(th->card_bg, th->screen_bg) : th->screen_bg);

    draw_styled_container(16, y, row_w, row_h, is_s, base_bg, border_col, th, wp_ptr);

    eadk_color_t text_bg = base_bg;
    if (g_glass_mode) {
        text_bg = rgb565_blend_50_50(base_bg, get_bg_pixel(100, y + 13, th, wp_ptr));
    }
    eadk_color_t text_col = get_contrast_text_color(text_bg);

    if (is_s) {
        int acc_x = g_smooth_corners ? 20 : 16;
        eadk_rect_t acc = {(uint16_t)acc_x, (uint16_t)(y + 3), 3, (uint16_t)(row_h - 6)};
        eadk_display_push_rect_uniform(acc, th->accent);
    }

    if (i == 0) {
        eadk_point_t p1 = {26, (uint16_t)(y + 8)};
        eadk_display_draw_string("Mode d'Affichage :", p1, false, text_col, text_bg);
        eadk_point_t p2 = {180, (uint16_t)(y + 8)};
        eadk_display_draw_string(g_view_mode == VIEW_MODE_GALLERY ? "< GALERIE >" : "< LISTE >", p2, false, th->accent, text_bg);
    } else if (i == 1) {
        eadk_point_t p1 = {26, (uint16_t)(y + 8)};
        eadk_display_draw_string("Effet Verre (Apple Glass) :", p1, false, text_col, text_bg);
        eadk_point_t p2 = {220, (uint16_t)(y + 8)};
        eadk_display_draw_string(g_glass_mode ? "< OUI >" : "< NON >", p2, false, th->accent, text_bg);
    } else if (i == 2) {
        eadk_point_t p1 = {26, (uint16_t)(y + 8)};
        eadk_display_draw_string("Coins Arrondis / Lisses :", p1, false, text_col, text_bg);
        eadk_point_t p2 = {220, (uint16_t)(y + 8)};
        eadk_display_draw_string(g_smooth_corners ? "< OUI >" : "< NON >", p2, false, th->accent, text_bg);
    } else if (i == 3) {
        eadk_point_t p1 = {26, (uint16_t)(y + 4)};
        eadk_display_draw_string("Theme Visuel :", p1, false, text_col, text_bg);
        eadk_point_t p2 = {26, (uint16_t)(y + 14)};
        eadk_display_draw_string(th->name, p2, false, th->accent, text_bg);
    } else if (i == 4) {
        eadk_point_t p1 = {26, (uint16_t)(y + 8)};
        eadk_display_draw_string("Raccourcis / Tooltips :", p1, false, text_col, text_bg);
        eadk_point_t p2 = {200, (uint16_t)(y + 8)};
        eadk_display_draw_string(g_show_tooltips ? "< OUI >" : "< NON >", p2, false, th->accent, text_bg);
    } else if (i == 5) {
        eadk_point_t p1 = {26, (uint16_t)(y + 8)};
        eadk_display_draw_string("[ OK / Back ] : Valider & Revenir", p1, false, th->accent, text_bg);
    }
}

/* ==================== MENU DES PARAMÈTRES & THÈMES ==================== */
static void run_settings_screen(void) {
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);

    /* Contrôle d'intégrité mémoire (7 thèmes : 0 à 6) */
    if (g_current_theme < 0 || g_current_theme >= 7) g_current_theme = 0;
    if (g_view_mode != VIEW_MODE_GALLERY && g_view_mode != VIEW_MODE_LIST) g_view_mode = VIEW_MODE_GALLERY;

    int sel_item = 0;
    bool full_redraw = true;
    eadk_keyboard_state_t prev = 0;

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev;

        if (eadk_keyboard_key_down(pressed, eadk_key_back) || 
            eadk_keyboard_key_down(kbd, eadk_key_home) ||
            (eadk_keyboard_key_down(pressed, eadk_key_ok) && sel_item == 5)) {
            break;
        }

        int old_sel = sel_item;
        const theme_t* th = &g_themes[g_current_theme];

        if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
            if (sel_item > 0) {
                sel_item--;
                draw_settings_row(old_sel, false, th);
                draw_settings_row(sel_item, true, th);
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
            if (sel_item < 5) {
                sel_item++;
                draw_settings_row(old_sel, false, th);
                draw_settings_row(sel_item, true, th);
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
            if (sel_item == 0) {
                g_view_mode = (g_view_mode == VIEW_MODE_GALLERY) ? VIEW_MODE_LIST : VIEW_MODE_GALLERY;
                draw_settings_row(0, true, th);
                save_persistent_settings();
            } else if (sel_item == 1) {
                g_glass_mode = !g_glass_mode;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 2) {
                g_smooth_corners = !g_smooth_corners;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 3) {
                g_current_theme = (g_current_theme + 6) % 7;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 4) {
                g_show_tooltips = !g_show_tooltips;
                full_redraw = true;
                save_persistent_settings();
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
            if (sel_item == 0) {
                g_view_mode = (g_view_mode == VIEW_MODE_GALLERY) ? VIEW_MODE_LIST : VIEW_MODE_GALLERY;
                draw_settings_row(0, true, th);
                save_persistent_settings();
            } else if (sel_item == 1) {
                g_glass_mode = !g_glass_mode;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 2) {
                g_smooth_corners = !g_smooth_corners;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 3) {
                g_current_theme = (g_current_theme + 1) % 7;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 4) {
                g_show_tooltips = !g_show_tooltips;
                full_redraw = true;
                save_persistent_settings();
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            if (sel_item == 0) {
                g_view_mode = (g_view_mode == VIEW_MODE_GALLERY) ? VIEW_MODE_LIST : VIEW_MODE_GALLERY;
                draw_settings_row(0, true, th);
                save_persistent_settings();
            } else if (sel_item == 1) {
                g_glass_mode = !g_glass_mode;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 2) {
                g_smooth_corners = !g_smooth_corners;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 3) {
                g_current_theme = (g_current_theme + 1) % 7;
                full_redraw = true;
                save_persistent_settings();
            } else if (sel_item == 4) {
                g_show_tooltips = !g_show_tooltips;
                full_redraw = true;
                save_persistent_settings();
            }
        }

        prev = kbd;

        if (full_redraw) {
            full_redraw = false;
            th = &g_themes[g_current_theme];
            save_persistent_settings();

            /* Fond général de l'écran LCD : Fond personnalisé RGB565 ou couleur de fond du thème */
            draw_screen_background(th);

            /* Barre supérieure officielle (avec effet verre dépoli si actif) */
            eadk_color_t bar_text_bg = th->top_bar;
            if (g_glass_mode) {
                const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
                for (int r = 0; r < 22; r++) {
                    for (int c = 0; c < EADK_SCREEN_WIDTH; c++) {
                        eadk_color_t bg_pix = get_bg_pixel(c, r, th, wp_ptr);
                        if (r == 21) {
                            /* Liséré inférieur blanc translucide fin 1px façon Apple Glass */
                            s_styled_line_buf[c] = rgb565_blend_50_50(th->top_bar, 0xFFFF);
                        } else {
                            s_styled_line_buf[c] = rgb565_blend_50_50(th->top_bar, bg_pix);
                        }
                    }
                    eadk_rect_t r_line = {0, (uint16_t)r, EADK_SCREEN_WIDTH, 1};
                    eadk_display_push_rect(r_line, s_styled_line_buf);
                }
                bar_text_bg = rgb565_blend_50_50(th->top_bar, get_bg_pixel(50, 10, th, wp_ptr));
            } else {
                eadk_rect_t bar = {0, 0, EADK_SCREEN_WIDTH, 22};
                eadk_display_push_rect_uniform(bar, th->top_bar);
            }
            eadk_color_t bar_text_col = get_contrast_text_color(bar_text_bg);

            eadk_point_t p_t = {8, 5};
            eadk_display_draw_string("Parametres & Themes EquaLib", p_t, false, bar_text_col, bar_text_bg);

            /* Cadre paramètres (6 rangées) */
            for (int i = 0; i < 6; i++) {
                draw_settings_row(i, i == sel_item, th);
            }

            /* Pied d'écran */
            if (g_show_tooltips) {
                eadk_color_t bot_bg = th->card_bg;
                if (g_glass_mode) {
                    const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
                    for (int r = EADK_SCREEN_HEIGHT - 16; r < EADK_SCREEN_HEIGHT; r++) {
                        for (int c = 0; c < EADK_SCREEN_WIDTH; c++) {
                            eadk_color_t bg_pix = get_bg_pixel(c, r, th, wp_ptr);
                            if (r == EADK_SCREEN_HEIGHT - 16) {
                                /* Liséré supérieur blanc translucide fin 1px façon Apple Glass */
                                s_styled_line_buf[c] = rgb565_blend_50_50(th->card_bg, 0xFFFF);
                            } else {
                                s_styled_line_buf[c] = rgb565_blend_50_50(th->card_bg, bg_pix);
                            }
                        }
                        eadk_rect_t r_line = {0, (uint16_t)r, EADK_SCREEN_WIDTH, 1};
                        eadk_display_push_rect(r_line, s_styled_line_buf);
                    }
                    bot_bg = rgb565_blend_50_50(th->card_bg, get_bg_pixel(100, EADK_SCREEN_HEIGHT - 8, th, wp_ptr));
                } else {
                    eadk_rect_t bot = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
                    eadk_display_push_rect_uniform(bot, th->card_bg);
                }
                eadk_color_t bot_text_col = get_contrast_text_color(bot_bg);
                eadk_point_t p_h = {8, EADK_SCREEN_HEIGHT - 13};
                eadk_display_draw_string("Fleches: Changer | OK / Back: Sauvegarder", p_h, false, (bot_text_col == 0x0000) ? 0x52AA : th->text_muted, bot_bg);
            }
        }

        eadk_timing_msleep(20);
    }

    save_persistent_settings();
    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}

/* ==================== POINT D'ENTRÉE PRINCIPAL DU HUB ==================== */
int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    /* Restauration de l'état persistant depuis le stockage AXI-SRAM haut */
    eq_storage_t* st = eq_storage_get();
    g_current_theme = st->theme;
    if (g_current_theme == 6 && (g_equalib_manifest.wallpaper_size < 153600 || g_equalib_manifest.wallpaper_offset < 0x10000)) {
        g_current_theme = 0;
    }
    g_view_mode = st->view_mode;
    g_show_tooltips = (st->tooltips != 0);
    g_glass_mode = (st->glass_mode != 0);
    g_smooth_corners = (st->smooth_corners != 0);

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    uint32_t total_apps = g_equalib_manifest.app_count;
    if (g_equalib_manifest.magic != EQUALIB_MANIFEST_MAGIC || total_apps == 0 || total_apps > MAX_MANIFEST_APPS) {
        total_apps = 16;
    }

    int selected = 0;
    int old_selected = -1;
    int scroll_offset = 0;
    int old_scroll_offset = -1;
    bool full_redraw = true;
    eadk_keyboard_state_t prev_kbd = 0;

    while (true) {
        /* Sanitarisation stricte à chaque itération */
        if (g_current_theme < 0 || g_current_theme >= 7) g_current_theme = 0;
        if (g_view_mode != VIEW_MODE_GALLERY && g_view_mode != VIEW_MODE_LIST) g_view_mode = VIEW_MODE_GALLERY;
        if (selected < 0) selected = 0;
        if (selected >= (int)total_apps) selected = (int)total_apps - 1;

        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        /* Sortie complète de l'application vers Epsilon */
        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off) ||
            eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        /* Touche Paramètres : Toolbox ou Var */
        if (eadk_keyboard_key_down(pressed, eadk_key_toolbox) || 
            eadk_keyboard_key_down(pressed, eadk_key_var)) {
            run_settings_screen();
            full_redraw = true;
            prev_kbd = 0;
            continue;
        }

        /* Navigation */
        if (g_view_mode == VIEW_MODE_GALLERY) {
            /* Navigation en grille 3 colonnes x 2 rangées */
            if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                if (selected < (int)total_apps - 1) {
                    selected++;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                if (selected > 0) {
                    selected--;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (selected + 3 < (int)total_apps) {
                    selected += 3;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                if (selected - 3 >= 0) {
                    selected -= 3;
                }
            }
        } else {
            /* Navigation en liste verticale */
            if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (selected < (int)total_apps - 1) {
                    selected++;
                    if (selected >= scroll_offset + 4) scroll_offset = selected - 3;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                if (selected > 0) {
                    selected--;
                    if (selected < scroll_offset) scroll_offset = selected;
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
            else if (type == APP_TYPE_PONG) run_pong_app();
            else if (type == APP_TYPE_DINO) run_dino_app();
            else if (type == APP_TYPE_SPACE_INVADERS) run_space_invaders_app();
            else if (type == APP_TYPE_BREAKOUT) run_breakout_app();
            else if (type == APP_TYPE_PUISSANCE4) run_puissance4_app();
            else if (type == APP_TYPE_MORPION) run_morpion_app();
            else if (type == APP_TYPE_SETTINGS) run_settings_screen();
            else if (type == APP_TYPE_NATIVE_EXEC) {
                uintptr_t flash_base = get_app_flash_base();
                const uint8_t* bin_ptr = (app->data_size > 0) ? (const uint8_t*)(flash_base + app->data_offset) : NULL;
                run_native_app((const char*)app->name, bin_ptr, app->data_size);
            } else if (type == APP_TYPE_PYTHON || type == APP_TYPE_TEXT_VIEWER) {
                uintptr_t flash_base = get_app_flash_base();
                const char* data_ptr = (app->data_size > 0) ? (const char*)(flash_base + app->data_offset) : NULL;
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
            full_redraw = true;
            old_selected = -1;
            continue;
        }

        prev_kbd = kbd;

        const theme_t* cur_th = &g_themes[g_current_theme];

        /* Rendu graphique propre */
        if (full_redraw) {
            full_redraw = false;

            /* Fond général de l'écran LCD : Fond personnalisé RGB565 si actif, sinon couleur unie */
            draw_screen_background(cur_th);

            /* Barre supérieure officielle (avec effet verre dépoli si actif) */
            eadk_color_t bar_text_bg = cur_th->top_bar;
            if (g_glass_mode) {
                const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
                for (int r = 0; r < 22; r++) {
                    for (int c = 0; c < EADK_SCREEN_WIDTH; c++) {
                        eadk_color_t bg_pix = get_bg_pixel(c, r, cur_th, wp_ptr);
                        if (r == 21) {
                            /* Liséré inférieur blanc translucide fin 1px façon Apple Glass */
                            s_styled_line_buf[c] = rgb565_blend_50_50(cur_th->top_bar, 0xFFFF);
                        } else {
                            s_styled_line_buf[c] = rgb565_blend_50_50(cur_th->top_bar, bg_pix);
                        }
                    }
                    eadk_rect_t r_line = {0, (uint16_t)r, EADK_SCREEN_WIDTH, 1};
                    eadk_display_push_rect(r_line, s_styled_line_buf);
                }
                bar_text_bg = rgb565_blend_50_50(cur_th->top_bar, get_bg_pixel(50, 10, cur_th, wp_ptr));
            } else {
                eadk_rect_t top_bar = {0, 0, EADK_SCREEN_WIDTH, 22};
                eadk_display_push_rect_uniform(top_bar, cur_th->top_bar);
            }
            eadk_color_t bar_text_col = get_contrast_text_color(bar_text_bg);

            eadk_point_t p_title = {8, 5};
            eadk_display_draw_string("EquaLib Hub (Cameleon & Gemini)", p_title, false, bar_text_col, bar_text_bg);

            /* Badge du mode actuel dans la barre supérieure */
            eadk_point_t p_badge = {(uint16_t)(EADK_SCREEN_WIDTH - 65), 5};
            eadk_display_draw_string(g_view_mode == VIEW_MODE_GALLERY ? "[Galerie]" : "[Liste]", p_badge, false, bar_text_col, bar_text_bg);

            /* Décorations de thème */
            draw_theme_decorations(cur_th);

            /* Contenu : Galerie ou Liste */
            if (g_view_mode == VIEW_MODE_GALLERY) {
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
                int visible_count = 4;
                if (visible_count > (int)total_apps - scroll_offset) {
                    visible_count = (int)total_apps - scroll_offset;
                }
                for (int v = 0; v < visible_count; v++) {
                    int i = scroll_offset + v;
                    draw_list_card(i, v, i == selected, cur_th);
                }
            }

            draw_bottom_active_dock(selected, cur_th);

            if (g_show_tooltips) {
                eadk_color_t bot_bg = cur_th->card_bg;
                if (g_glass_mode) {
                    const eadk_color_t* wp_ptr = get_wallpaper_flash_ptr();
                    for (int r = EADK_SCREEN_HEIGHT - 16; r < EADK_SCREEN_HEIGHT; r++) {
                        for (int c = 0; c < EADK_SCREEN_WIDTH; c++) {
                            eadk_color_t bg_pix = get_bg_pixel(c, r, cur_th, wp_ptr);
                            if (r == EADK_SCREEN_HEIGHT - 16) {
                                /* Liséré supérieur blanc translucide fin 1px façon Apple Glass */
                                s_styled_line_buf[c] = rgb565_blend_50_50(cur_th->card_bg, 0xFFFF);
                            } else {
                                s_styled_line_buf[c] = rgb565_blend_50_50(cur_th->card_bg, bg_pix);
                            }
                        }
                        eadk_rect_t r_line = {0, (uint16_t)r, EADK_SCREEN_WIDTH, 1};
                        eadk_display_push_rect(r_line, s_styled_line_buf);
                    }
                    bot_bg = rgb565_blend_50_50(cur_th->card_bg, get_bg_pixel(100, EADK_SCREEN_HEIGHT - 8, cur_th, wp_ptr));
                } else {
                    eadk_rect_t bottom_bar = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
                    eadk_display_push_rect_uniform(bottom_bar, cur_th->card_bg);
                }
                eadk_color_t bot_text_col = get_contrast_text_color(bot_bg);

                eadk_point_t p_help = {8, EADK_SCREEN_HEIGHT - 13};
                eadk_display_draw_string("OK: Lancer | Toolbox: Options | Back: Epsilon", p_help, false, (bot_text_col == 0x0000) ? 0x52AA : cur_th->text_muted, bot_bg);
            }
            old_selected = selected;
            old_scroll_offset = scroll_offset;
        } else if (selected != old_selected || scroll_offset != old_scroll_offset) {
            /* Rendu incrémental 100% sans scintillement */
            if (g_view_mode == VIEW_MODE_GALLERY) {
                if (selected / 6 == old_selected / 6) {
                    int old_slot = old_selected % 6;
                    int new_slot = selected % 6;
                    draw_gallery_card(old_selected, old_slot % 3, old_slot / 3, false, cur_th);
                    draw_gallery_card(selected, new_slot % 3, new_slot / 3, true, cur_th);
                    draw_bottom_active_dock(selected, cur_th);
                    old_selected = selected;
                } else {
                    full_redraw = true;
                }
            } else {
                if (scroll_offset == old_scroll_offset) {
                    draw_list_card(old_selected, old_selected - scroll_offset, false, cur_th);
                    draw_list_card(selected, selected - scroll_offset, true, cur_th);
                    draw_bottom_active_dock(selected, cur_th);
                    old_selected = selected;
                } else {
                    if (g_current_theme == 6) {
                        full_redraw = true;
                    } else {
                        eadk_rect_t list_zone = {8, 28, EADK_SCREEN_WIDTH - 16, 155};
                        eadk_display_push_rect_uniform(list_zone, cur_th->screen_bg);
                        int visible_count = 4;
                        if (visible_count > (int)total_apps - scroll_offset) {
                            visible_count = (int)total_apps - scroll_offset;
                        }
                        for (int v = 0; v < visible_count; v++) {
                            int i = scroll_offset + v;
                            draw_list_card(i, v, i == selected, cur_th);
                        }
                        draw_bottom_active_dock(selected, cur_th);
                        old_selected = selected;
                        old_scroll_offset = scroll_offset;
                    }
                }
            }
        }

        eadk_timing_msleep(20);
    }

    save_persistent_settings();
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
    return 0;
}
