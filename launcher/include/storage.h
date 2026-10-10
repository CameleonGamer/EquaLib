#ifndef EQUALIB_STORAGE_H
#define EQUALIB_STORAGE_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include "equalib_manifest.h"

#define EQ_STORAGE_MAGIC 0x45515356 /* "EQSV" */

#pragma pack(push, 4)
typedef struct {
    uint32_t magic;
    uint32_t checksum;
    int32_t theme;
    int32_t view_mode;
    int32_t tooltips;
    int32_t record_dino;
    int32_t record_flappy;
    int32_t record_snake;
    int32_t record_2048;
    int32_t record_tetris;
    int32_t record_breakout;
    int32_t record_space_invaders;
    int32_t record_p4_wins;
    int32_t record_morpion_wins;
    int32_t record_pong_wins;
    int32_t record_minesweeper_wins;
    uint32_t reserved[4];
} eq_storage_t;
#pragma pack(pop)

static inline uint32_t eq_storage_calc_checksum(const eq_storage_t* s) {
    uint32_t chk = 0xA5A55A5A;
    const uint32_t* p = (const uint32_t*)s;
    size_t count = sizeof(eq_storage_t) / sizeof(uint32_t);
    for (size_t i = 2; i < count; i++) {
        chk ^= p[i];
        chk = (chk << 3) | (chk >> 29);
    }
    return chk;
}

static inline eq_storage_t* eq_storage_get_ptr(void) {
#if defined(__arm__) || defined(__thumb__)
    uint32_t sp_val;
    __asm__ volatile ("mov %0, sp" : "=r"(sp_val));
    if ((sp_val & 0xFF000000) == 0x24000000) {
        return (eq_storage_t*)0x24038000; /* N0120 AXI-SRAM sécurisé */
    } else {
        return (eq_storage_t*)0x20028000; /* N0110 SRAM sécurisé */
    }
#else
    static eq_storage_t s_pc_storage;
    return &s_pc_storage;
#endif
}

static inline eq_storage_t* eq_storage_get(void) {
    eq_storage_t* s = eq_storage_get_ptr();
    if (s->magic != EQ_STORAGE_MAGIC || s->checksum != eq_storage_calc_checksum(s)) {
#if defined(__arm__) || defined(__thumb__)
        /* Vérification si un enregistrement valide existait à l'ancienne adresse 0x2404F000 */
        eq_storage_t* legacy = (eq_storage_t*)0x2404F000;
        if (legacy->magic == EQ_STORAGE_MAGIC && legacy->checksum == eq_storage_calc_checksum(legacy)) {
            *s = *legacy;
            return s;
        }
#endif
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
        for (int i = 0; i < 4; i++) s->reserved[i] = 0;
        s->checksum = eq_storage_calc_checksum(s);
    }
    return s;
}

static inline void eq_storage_commit(void) {
    eq_storage_t* s = eq_storage_get_ptr();
    s->magic = EQ_STORAGE_MAGIC;
    s->checksum = eq_storage_calc_checksum(s);
}

#endif /* EQUALIB_STORAGE_H */
