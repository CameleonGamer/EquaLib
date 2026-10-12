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
    int32_t glass_mode;
    int32_t smooth_corners;
    uint32_t reserved[2];
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

extern eq_storage_t g_eq_storage;

eq_storage_t* eq_storage_get_ptr(void);
eq_storage_t* eq_storage_get(void);
void eq_storage_commit(void);

#endif /* EQUALIB_STORAGE_H */
