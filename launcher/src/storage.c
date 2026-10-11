#include "storage.h"

/* Stockage persistant alloué en mémoire BSS/DATA légale de l'application */
eq_storage_t g_eq_storage;

eq_storage_t* eq_storage_get_ptr(void) {
    return &g_eq_storage;
}

eq_storage_t* eq_storage_get(void) {
    eq_storage_t* s = &g_eq_storage;
    if (s->magic != EQ_STORAGE_MAGIC || s->checksum != eq_storage_calc_checksum(s)) {
        s->magic = EQ_STORAGE_MAGIC;
        uint32_t init_theme = g_equalib_manifest.flags & 0x0F;
        s->theme = (init_theme < 6) ? (int32_t)init_theme : 0;
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
        for (int i = 0; i < 4; i++) {
            s->reserved[i] = 0;
        }
        s->checksum = eq_storage_calc_checksum(s);
    }
    return s;
}

void eq_storage_commit(void) {
    eq_storage_t* s = &g_eq_storage;
    s->magic = EQ_STORAGE_MAGIC;
    s->checksum = eq_storage_calc_checksum(s);
}
