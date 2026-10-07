#ifndef EQUALIB_MANIFEST_H
#define EQUALIB_MANIFEST_H

#include <stdint.h>
#include <stddef.h>

#define EQUALIB_MANIFEST_MAGIC 0x4C415145 // "EQAL" in little-endian

#define APP_TYPE_MARIOKART   1
#define APP_TYPE_PERIODIC    2
#define APP_TYPE_COURSES     3
#define APP_TYPE_MATH_TOOLS  4
#define APP_TYPE_STEALTH     5
#define APP_TYPE_TEXT_VIEWER  6
#define APP_TYPE_FLAPPY      7
#define APP_TYPE_2048        8
#define APP_TYPE_SNAKE       9
#define APP_TYPE_TETRIS      10
#define APP_TYPE_MINESWEEPER 11

#define MAX_MANIFEST_APPS 12

#pragma pack(push, 1)

typedef struct {
    char id[16];
    char name[32];
    char category[20];
    char desc[64];
    uint8_t app_type;
    uint8_t reserved[3];
    uint32_t data_offset;
    uint32_t data_size;
} equalib_manifest_app_t;

typedef struct {
    uint32_t magic;       // 0x4C415145 ("EQAL")
    uint32_t version;     // 1
    uint32_t app_count;   // 1 to 12
    uint32_t flags;       // Flags globaux
    equalib_manifest_app_t apps[MAX_MANIFEST_APPS];
} equalib_manifest_t;

#pragma pack(pop)

extern const equalib_manifest_t g_equalib_manifest;

#endif // EQUALIB_MANIFEST_H
