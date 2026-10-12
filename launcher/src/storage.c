#include "storage.h"

/* Emplacement persistant en AXI SRAM hors de la section .bss
 * (survit à la sortie vers Epsilon et au relancement de l'application)
 */
static eq_storage_t* get_storage_target(void) {
#if PLATFORM_DEVICE
    uintptr_t sp_addr = 0;
    __asm__ volatile("mov %0, sp" : "=r"(sp_addr));
    if (sp_addr >= 0x24000000 && sp_addr <= 0x24050000) {
        /* NumWorks N0120 (STM32H725 AXI SRAM)
         * Zone MPU externe autorisée : [0x240118a4, 0x240218a4].
         * La section .bss se termine vers 0x2401913c.
         * Le pointeur de pile sp débute à 0x240218a4.
         * L'adresse 0x2401D000 est en zone autorisée MPU, 16 Ko au-dessus de .bss
         * et 18 Ko en dessous du haut de la pile, donc jamais écrasée par _start ni par la pile.
         */
        return (eq_storage_t*)0x2401D000;
    } else if (sp_addr >= 0x20000000 && sp_addr <= 0x20040000) {
        /* NumWorks N0110 (STM32F412 SRAM) */
        return (eq_storage_t*)0x2000E000;
    }
#endif
    /* Fallback mémoire locale pour les tests hôte PC / Node.js */
    static eq_storage_t s_local_storage;
    return &s_local_storage;
}

eq_storage_t g_eq_storage;

eq_storage_t* eq_storage_get_ptr(void) {
    return get_storage_target();
}

eq_storage_t* eq_storage_get(void) {
    eq_storage_t* s = get_storage_target();
    if (s->magic != EQ_STORAGE_MAGIC || s->checksum != eq_storage_calc_checksum(s)) {
        s->magic = EQ_STORAGE_MAGIC;
        uint32_t init_theme = g_equalib_manifest.flags & 0x0F;
        s->theme = (init_theme < 7) ? (int32_t)init_theme : 0;
        if (s->theme == 6 && (g_equalib_manifest.wallpaper_size < 153600 || g_equalib_manifest.wallpaper_offset < 0x10000)) {
            s->theme = 0;
        }
        s->view_mode = (g_equalib_manifest.flags & 0x10) ? 1 : 0; /* GALLERY = 0, LIST = 1 */
        s->tooltips = 1;  /* ON */
        s->record_dino = 0;
        s->record_flappy = 0;
        s->record_snake = 0;
        s->record_2048 = 0;
        s->record_tetris = 0;
        s->record_breakout = 0;
        s->record_space_invaders = 0;
        s->record_p4_wins = 0;
        s->record_morpion_wins = 0;
        s->record_pong_wins = 0;
        s->record_minesweeper_wins = 0;
        s->glass_mode = (g_equalib_manifest.flags & MANIFEST_FLAG_GLASS_MODE) ? 1 : 0;
        s->smooth_corners = (g_equalib_manifest.flags & MANIFEST_FLAG_SMOOTH_CORNERS) ? 1 : 0;
        s->last_manifest_flags = g_equalib_manifest.flags;
        s->reserved = 0;
        s->checksum = eq_storage_calc_checksum(s);
    } else {
        /* Si les options du manifeste flashé ont été modifiées depuis le site web */
        if (s->last_manifest_flags != g_equalib_manifest.flags) {
            s->glass_mode = (g_equalib_manifest.flags & MANIFEST_FLAG_GLASS_MODE) ? 1 : 0;
            s->smooth_corners = (g_equalib_manifest.flags & MANIFEST_FLAG_SMOOTH_CORNERS) ? 1 : 0;
            s->view_mode = (g_equalib_manifest.flags & MANIFEST_FLAG_VIEW_MODE_LIST) ? 1 : 0;
            uint32_t m_theme = g_equalib_manifest.flags & MANIFEST_FLAG_THEME_MASK;
            if (m_theme < 7) {
                s->theme = (int32_t)m_theme;
            }
            s->last_manifest_flags = g_equalib_manifest.flags;
            s->checksum = eq_storage_calc_checksum(s);
        }

        /* Si un pack avec fond personnalisé (Thème 6) vient d'être flashé, basculer automatiquement */
        if ((g_equalib_manifest.flags & 0x0F) == 6 &&
            g_equalib_manifest.wallpaper_size >= 153600 &&
            g_equalib_manifest.wallpaper_offset >= 0x10000 &&
            s->theme != 6) {
            s->theme = 6;
            s->checksum = eq_storage_calc_checksum(s);
        } else if (s->theme == 6 && (g_equalib_manifest.wallpaper_size < 153600 || g_equalib_manifest.wallpaper_offset < 0x10000)) {
            /* Si l'ancien stockage conservait le Thème 6 mais que le binaire flashé n'a pas de fond personnalisé */
            uint32_t init_theme = g_equalib_manifest.flags & 0x0F;
            s->theme = (init_theme < 6) ? (int32_t)init_theme : 0;
            s->checksum = eq_storage_calc_checksum(s);
        }
    }
    return s;
}

void eq_storage_commit(void) {
    eq_storage_t* s = get_storage_target();
    s->magic = EQ_STORAGE_MAGIC;
    s->checksum = eq_storage_calc_checksum(s);
}
