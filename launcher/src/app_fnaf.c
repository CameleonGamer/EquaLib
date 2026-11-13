#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "app_fnaf.h"
#include "apps.h"
#include "storage.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);

/* =========================================================================
 * Five Nights at Freddy's 1 - Moteur EADK C pour NumWorks
 * 100% conforme aux mécaniques et timings officiels de Scott Cawthon
 * ========================================================================= */

#define COLOR_FNAF_BLACK       0x0000
#define COLOR_FNAF_WHITE       0xFFFF
#define COLOR_FNAF_DARK_GREY   0x2104
#define COLOR_FNAF_MED_GREY    0x4A69
#define COLOR_FNAF_LIGHT_GREY  0x8410
#define COLOR_FNAF_RED         0xF800
#define COLOR_FNAF_DARK_RED    0x6000
#define COLOR_FNAF_GREEN       0x07E0
#define COLOR_FNAF_BRIGHT_LED  0x2FE4
#define COLOR_FNAF_CYAN        0x07FF
#define COLOR_FNAF_YELLOW      0xFFE0
#define COLOR_FREDDY_BROWN     0x79A2
#define COLOR_FREDDY_DARK      0x4180
#define COLOR_BONNIE_PURPLE    0x6198
#define COLOR_BONNIE_DARK      0x38B0
#define COLOR_CHICA_YELLOW     0xFE24
#define COLOR_CHICA_ORANGE     0xFC40
#define COLOR_FOXY_RED         0xB880
#define COLOR_FOXY_DARK        0x5820

/* Minuteurs officiels Scott Cawthon (en millisecondes) */
#define AI_CHECK_BONNIE_MS   4970
#define AI_CHECK_CHICA_MS    4980
#define AI_CHECK_FOXY_MS     5010
#define AI_CHECK_FREDDY_MS   3020

#define HOUR_DURATION_MS     55000 /* ~55 secondes par heure de nuit */
#define FOXY_SPRINT_LIMIT_MS 2600  /* 2.6s pour fermer la porte gauche */

static fnaf_game_t g_fnaf;

/* Générateur pseudo-aléatoire XorShift32 ultra-rapide pour neige TV */
static inline uint32_t xorshift32(uint32_t* state) {
    uint32_t x = *state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *state = x;
    return x;
}

static inline int fnaf_rand(int min, int max) {
    if (min >= max) return min;
    uint32_t r = xorshift32(&g_fnaf.rng_state);
    return min + (int)(r % (uint32_t)(max - min + 1));
}

/* =========================================================================
 * RENDU GRAPHIQUE BARE-METAL (320x240 RGB565)
 * ========================================================================= */

/* Dessin de rectangles pleins */
static void fnaf_fill_rect(int x, int y, int w, int h, uint16_t color) {
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > FNAF_SCREEN_WIDTH) w = FNAF_SCREEN_WIDTH - x;
    if (y + h > FNAF_SCREEN_HEIGHT) h = FNAF_SCREEN_HEIGHT - y;
    if (w <= 0 || h <= 0) return;
    eadk_rect_t rect = {(uint16_t)x, (uint16_t)y, (uint16_t)w, (uint16_t)h};
    eadk_display_push_rect_uniform(rect, color);
}

/* Neige CRT TV procédurale haute vitesse (60 FPS, aucun tampon lourd en RAM) */
static void fnaf_draw_tv_snow(int x, int y, int w, int h, int density) {
    /* Ligne par ligne pour ne pas saturer la pile */
    static eadk_color_t line_buf[320];
    if (w > 320) w = 320;
    for (int j = 0; j < h; j += 2) {
        for (int i = 0; i < w; i++) {
            uint32_t r = xorshift32(&g_fnaf.rng_state);
            if ((int)(r & 0xFF) < density) {
                uint8_t grey = (uint8_t)(r >> 8) & 0x1F;
                line_buf[i] = (eadk_color_t)((grey << 11) | (grey << 6) | grey);
            } else {
                line_buf[i] = COLOR_FNAF_BLACK;
            }
        }
        eadk_rect_t r_band = {(uint16_t)x, (uint16_t)(y + j), (uint16_t)w, 2};
        eadk_display_push_rect(r_band, line_buf);
    }
}

/* Animation du ventilateur de bureau (3 pales en rotation) */
static void fnaf_draw_fan(int cx, int cy, uint8_t frame) {
    /* Cage du ventilateur */
    fnaf_fill_rect(cx - 18, cy - 18, 36, 36, COLOR_FNAF_DARK_GREY);
    fnaf_fill_rect(cx - 16, cy - 16, 32, 32, 0x18C3);
    fnaf_fill_rect(cx - 2, cy - 16, 4, 32, COLOR_FNAF_MED_GREY);
    fnaf_fill_rect(cx - 16, cy - 2, 32, 4, COLOR_FNAF_MED_GREY);

    /* Pales selon l'image */
    if (frame == 0) {
        fnaf_fill_rect(cx - 4, cy - 14, 8, 12, COLOR_FNAF_LIGHT_GREY);
        fnaf_fill_rect(cx - 4, cy + 2, 8, 12, COLOR_FNAF_LIGHT_GREY);
        fnaf_fill_rect(cx - 14, cy - 4, 12, 8, COLOR_FNAF_LIGHT_GREY);
    } else if (frame == 1) {
        fnaf_fill_rect(cx - 12, cy - 12, 10, 10, COLOR_FNAF_LIGHT_GREY);
        fnaf_fill_rect(cx + 2, cy + 2, 10, 10, COLOR_FNAF_LIGHT_GREY);
        fnaf_fill_rect(cx + 2, cy - 12, 10, 10, COLOR_FNAF_LIGHT_GREY);
    } else {
        fnaf_fill_rect(cx - 14, cy - 4, 28, 8, COLOR_FNAF_LIGHT_GREY);
        fnaf_fill_rect(cx - 4, cy - 14, 8, 28, COLOR_FNAF_LIGHT_GREY);
    }

    /* Moyeu central et pied */
    fnaf_fill_rect(cx - 5, cy - 5, 10, 10, COLOR_FNAF_WHITE);
    fnaf_fill_rect(cx - 3, cy + 18, 6, 12, COLOR_FNAF_DARK_GREY);
    fnaf_fill_rect(cx - 10, cy + 30, 20, 4, COLOR_FNAF_MED_GREY);
}

/* Dessin de Bonnie à la porte gauche (lumière allumée) */
static void fnaf_draw_door_bonnie(int x, int y) {
    /* Silhouette violette menaçante de Bonnie */
    fnaf_fill_rect(x + 10, y + 20, 50, 90, COLOR_BONNIE_DARK);
    /* Tête */
    fnaf_fill_rect(x + 16, y + 26, 38, 38, COLOR_BONNIE_PURPLE);
    /* Oreilles de lapin */
    fnaf_fill_rect(x + 18, y - 10, 8, 36, COLOR_BONNIE_PURPLE);
    fnaf_fill_rect(x + 40, y - 12, 8, 38, COLOR_BONNIE_PURPLE);
    fnaf_fill_rect(x + 20, y - 6, 4, 28, 0x937F);
    fnaf_fill_rect(x + 42, y - 8, 4, 30, 0x937F);
    /* Museau */
    fnaf_fill_rect(x + 22, y + 44, 26, 16, 0x827F);
    fnaf_fill_rect(x + 32, y + 46, 6, 5, COLOR_FNAF_BLACK);
    /* Dents d'endosquelette */
    fnaf_fill_rect(x + 24, y + 56, 22, 5, COLOR_FNAF_WHITE);
    /* Yeux perçants / Pupilles luisantes */
    fnaf_fill_rect(x + 20, y + 34, 10, 9, 0x8010);
    fnaf_fill_rect(x + 38, y + 34, 10, 9, 0x8010);
    fnaf_fill_rect(x + 23, y + 36, 4, 4, COLOR_FNAF_WHITE);
    fnaf_fill_rect(x + 41, y + 36, 4, 4, COLOR_FNAF_WHITE);
}

/* Dessin de Chica à la fenêtre droite (lumière allumée) */
static void fnaf_draw_window_chica(int x, int y) {
    /* Corps jaune de Chica derrière la vitre */
    fnaf_fill_rect(x + 10, y + 20, 52, 90, COLOR_CHICA_ORANGE);
    /* Tête */
    fnaf_fill_rect(x + 14, y + 24, 44, 42, COLOR_CHICA_YELLOW);
    /* Plumes sur la tête */
    fnaf_fill_rect(x + 32, y + 6, 8, 18, COLOR_CHICA_YELLOW);
    fnaf_fill_rect(x + 26, y + 10, 6, 14, COLOR_CHICA_YELLOW);
    /* Grand bec orange béant */
    fnaf_fill_rect(x + 20, y + 46, 32, 18, 0xFA40);
    fnaf_fill_rect(x + 24, y + 54, 24, 8, COLOR_FNAF_BLACK);
    /* Dents métalliques à l'intérieur du bec */
    fnaf_fill_rect(x + 26, y + 56, 20, 4, COLOR_FNAF_WHITE);
    /* Yeux violets écarquillés */
    fnaf_fill_rect(x + 18, y + 32, 12, 12, COLOR_FNAF_WHITE);
    fnaf_fill_rect(x + 38, y + 32, 12, 12, COLOR_FNAF_WHITE);
    fnaf_fill_rect(x + 22, y + 35, 6, 6, 0x801F);
    fnaf_fill_rect(x + 42, y + 35, 6, 6, 0x801F);
    /* Bavoir "LET'S EAT!!!" */
    fnaf_fill_rect(x + 18, y + 66, 36, 24, COLOR_FNAF_WHITE);
    fnaf_fill_rect(x + 20, y + 72, 32, 3, COLOR_FOXY_RED);
}

/* Rendu du Bureau (Office View) avec panoramique 3 angles */
static void fnaf_render_office(void) {
    int pan = g_fnaf.view_pan; // 0 = Gauche, 1 = Centre, 2 = Droite
    int offset_x = (pan == 0) ? 0 : ((pan == 1) ? -50 : -100);

    /* 1. Murs arrières et rayures industrielles */
    fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, 170, 0x2124);
    /* Bandeau de rayures de chantier jaune & noir */
    for (int x = -20; x < FNAF_SCREEN_WIDTH + 40; x += 30) {
        fnaf_fill_rect(x + (offset_x % 30), 150, 16, 12, COLOR_FNAF_YELLOW);
        fnaf_fill_rect(x + 16 + (offset_x % 30), 150, 14, 12, COLOR_FNAF_BLACK);
    }

    /* 2. Sol en damier noir et blanc rétro */
    fnaf_fill_rect(0, 162, FNAF_SCREEN_WIDTH, 78, 0x18E3);
    for (int y = 166; y < FNAF_SCREEN_HEIGHT; y += 14) {
        for (int x = (offset_x % 28) - 28; x < FNAF_SCREEN_WIDTH + 28; x += 28) {
            int chk = ((x / 28) + (y / 14)) & 1;
            fnaf_fill_rect(x, y, 14, 14, chk ? COLOR_FNAF_MED_GREY : COLOR_FNAF_BLACK);
        }
    }

    /* 3. Vue selon l'angle de vision */
    if (pan == 0 || pan == 1) {
        /* PORTE GAUCHE & BOUTONS */
        int door_l_x = 20 + offset_x;
        fnaf_fill_rect(door_l_x, 20, 70, 146, COLOR_FNAF_BLACK); // Embrasure
        
        /* Bonnie visible si lumière allumée et présent */
        if (g_fnaf.light_left_on && g_fnaf.bonnie_loc == LOC_DOOR_LEFT) {
            fnaf_draw_door_bonnie(door_l_x, 30);
        }

        /* Porte motorisée (si fermée) */
        if (g_fnaf.door_left_closed) {
            fnaf_fill_rect(door_l_x, 20, 70, 146, COLOR_FNAF_MED_GREY);
            for (int l = 30; l < 160; l += 12) {
                fnaf_fill_rect(door_l_x, l, 70, 2, COLOR_FNAF_DARK_GREY);
            }
            /* Bandes de sécurité en bas de porte */
            fnaf_fill_rect(door_l_x, 150, 70, 16, COLOR_FNAF_YELLOW);
            fnaf_fill_rect(door_l_x + 10, 150, 14, 16, COLOR_FNAF_BLACK);
            fnaf_fill_rect(door_l_x + 35, 150, 14, 16, COLOR_FNAF_BLACK);
            fnaf_fill_rect(door_l_x + 60, 150, 10, 16, COLOR_FNAF_BLACK);
        }

        /* Boîtier de contrôle Porte/Lumière Gauche */
        int panel_l_x = door_l_x + 75;
        fnaf_fill_rect(panel_l_x, 60, 24, 60, COLOR_FNAF_DARK_GREY);
        /* Bouton Porte G (Haut) */
        uint16_t col_d_l = g_fnaf.door_left_closed ? COLOR_FNAF_RED : COLOR_FNAF_BRIGHT_LED;
        fnaf_fill_rect(panel_l_x + 4, 66, 16, 20, col_d_l);
        /* Bouton Lumière G (Bas) */
        uint16_t col_l_l = g_fnaf.light_left_on ? COLOR_FNAF_WHITE : 0x4208;
        fnaf_fill_rect(panel_l_x + 4, 94, 16, 20, col_l_l);
    }

    if (pan == 1 || pan == 0 || pan == 2) {
        /* CENTRE DU BUREAU */
        int desk_x = 120 + offset_x;
        /* Poster "CELEBRATE!" au mur */
        fnaf_fill_rect(desk_x + 10, 24, 75, 48, COLOR_FNAF_WHITE);
        fnaf_fill_rect(desk_x + 12, 26, 71, 44, 0x18E3);
        eadk_point_t pt_cel = {(uint16_t)(desk_x + 18), 30};
        eadk_display_draw_string("CELEBRATE!", pt_cel, false, COLOR_FNAF_YELLOW, 0x18E3);
        /* Petites têtes stylisées de Freddy, Bonnie, Chica sur le poster */
        fnaf_fill_rect(desk_x + 22, 42, 14, 14, COLOR_BONNIE_PURPLE);
        fnaf_fill_rect(desk_x + 41, 40, 16, 16, COLOR_FREDDY_BROWN);
        fnaf_fill_rect(desk_x + 61, 42, 14, 14, COLOR_CHICA_YELLOW);
        /* Chapeau de Freddy sur le poster */
        fnaf_fill_rect(desk_x + 45, 36, 8, 4, COLOR_FNAF_BLACK);

        /* Bureau métallique */
        fnaf_fill_rect(desk_x - 30, 130, 160, 40, 0x2965);
        fnaf_fill_rect(desk_x - 35, 128, 170, 4, COLOR_FNAF_MED_GREY);

        /* Écrans de contrôle et fils sur le bureau */
        fnaf_fill_rect(desk_x - 15, 96, 32, 32, COLOR_FNAF_BLACK);
        fnaf_fill_rect(desk_x - 13, 98, 28, 28, 0x0180);
        fnaf_fill_rect(desk_x - 25, 120, 8, 8, COLOR_FNAF_WHITE); // Boule de papier

        /* Gobelet rayé avec paille */
        fnaf_fill_rect(desk_x + 75, 108, 14, 22, COLOR_FOXY_RED);
        fnaf_fill_rect(desk_x + 77, 114, 10, 4, COLOR_FNAF_WHITE);
        fnaf_fill_rect(desk_x + 82, 98, 3, 10, COLOR_FNAF_YELLOW); // Paille

        /* Ventilateur animé tournant en continu */
        fnaf_draw_fan(desk_x + 36, 110, g_fnaf.fan_frame);
    }

    if (pan == 1 || pan == 2) {
        /* PORTE DROITE, FENÊTRE & BOUTONS */
        int door_r_x = 230 + offset_x;
        
        /* Boîtier de contrôle Porte/Lumière Droite */
        int panel_r_x = door_r_x - 30;
        fnaf_fill_rect(panel_r_x, 60, 24, 60, COLOR_FNAF_DARK_GREY);
        /* Bouton Porte D (Haut) */
        uint16_t col_d_r = g_fnaf.door_right_closed ? COLOR_FNAF_RED : COLOR_FNAF_BRIGHT_LED;
        fnaf_fill_rect(panel_r_x + 4, 66, 16, 20, col_d_r);
        /* Bouton Lumière D (Bas) */
        uint16_t col_l_r = g_fnaf.light_right_on ? COLOR_FNAF_WHITE : 0x4208;
        fnaf_fill_rect(panel_r_x + 4, 94, 16, 20, col_l_r);

        /* Fenêtre de droite */
        fnaf_fill_rect(door_r_x - 2, 20, 36, 60, COLOR_FNAF_BLACK);
        fnaf_fill_rect(door_r_x, 22, 32, 56, g_fnaf.light_right_on ? 0x2184 : 0x0841);
        if (g_fnaf.light_right_on && g_fnaf.chica_loc == LOC_DOOR_RIGHT) {
            fnaf_draw_window_chica(door_r_x - 14, 16);
        }

        /* Embrasure Porte Droite */
        fnaf_fill_rect(door_r_x + 40, 20, 70, 146, COLOR_FNAF_BLACK);

        /* Porte motorisée Droite (si fermée) */
        if (g_fnaf.door_right_closed) {
            fnaf_fill_rect(door_r_x + 40, 20, 70, 146, COLOR_FNAF_MED_GREY);
            for (int l = 30; l < 160; l += 12) {
                fnaf_fill_rect(door_r_x + 40, l, 70, 2, COLOR_FNAF_DARK_GREY);
            }
            /* Bandes de sécurité en bas de porte */
            fnaf_fill_rect(door_r_x + 40, 150, 70, 16, COLOR_FNAF_YELLOW);
            fnaf_fill_rect(door_r_x + 50, 150, 14, 16, COLOR_FNAF_BLACK);
            fnaf_fill_rect(door_r_x + 75, 150, 14, 16, COLOR_FNAF_BLACK);
        }
    }

    /* 4. Barre d'état HUD (Heure, Nuit, Énergie & Usage) */
    /* Heure & Nuit en haut à droite */
    char time_str[16];
    const char* am_pm = (g_fnaf.hour == 0) ? "12 AM" : ((g_fnaf.hour == 1) ? "1 AM" : ((g_fnaf.hour == 2) ? "2 AM" : ((g_fnaf.hour == 3) ? "3 AM" : ((g_fnaf.hour == 4) ? "4 AM" : "5 AM"))));
    snprintf(time_str, sizeof(time_str), "%s", am_pm);
    eadk_point_t pt_time = {265, 8};
    eadk_display_draw_string(time_str, pt_time, true, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);

    char night_str[16];
    snprintf(night_str, sizeof(night_str), "Nuit %d", g_fnaf.night);
    eadk_point_t pt_night = {268, 30};
    eadk_display_draw_string(night_str, pt_night, false, COLOR_FNAF_LIGHT_GREY, COLOR_FNAF_BLACK);

    /* Énergie restante en bas à gauche */
    char pwr_str[24];
    snprintf(pwr_str, sizeof(pwr_str), "Batterie: %d%%", (int)g_fnaf.power_percent);
    eadk_point_t pt_pwr = {10, 205};
    eadk_display_draw_string(pwr_str, pt_pwr, false, (g_fnaf.power_percent > 20) ? COLOR_FNAF_WHITE : COLOR_FNAF_RED, COLOR_FNAF_BLACK);

    /* Barres d'usage (1 à 5 barres vertes/jaunes/rouges) */
    eadk_point_t pt_usg = {10, 222};
    eadk_display_draw_string("Usage:", pt_usg, false, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);
    for (int b = 0; b < 5; b++) {
        uint16_t b_col = (b < g_fnaf.power_usage_bars) ? ((b < 2) ? COLOR_FNAF_GREEN : ((b < 4) ? COLOR_FNAF_YELLOW : COLOR_FNAF_RED)) : 0x18C3;
        fnaf_fill_rect(58 + b * 10, 222, 7, 12, b_col);
    }

    /* Bouton d'ouverture du moniteur en bas au centre */
    fnaf_fill_rect(105, 224, 110, 16, 0x1082);
    eadk_point_t pt_mon = {112, 226};
    eadk_display_draw_string("[^] MONITEUR", pt_mon, false, COLOR_FNAF_WHITE, 0x1082);
}

/* =========================================================================
 * MONITEUR DE CAMÉRAS DE SURVEILLANCE & MINIMAP
 * ========================================================================= */

typedef struct {
    int x;
    int y;
    int w;
    int h;
    const char* label;
    const char* title;
} fnaf_cam_info_t;

static const fnaf_cam_info_t s_cams[CAM_COUNT] = {
    { 230,  88, 32, 16, "1A", "CAM 1A - SCENE PRINCIPALE" },
    { 220, 114, 32, 16, "1B", "CAM 1B - SALLE A MANGER" },
    { 192, 134, 32, 16, "1C", "CAM 1C - CRIQUE PIRATE" },
    { 208, 160, 32, 16, "2A", "CAM 2A - COULOIR OUEST" },
    { 208, 198, 32, 16, "2B", "CAM 2B - COIN COULOIR OUEST" },
    { 178, 186, 32, 16, " 3", "CAM 3 - PLACARD A BALAIS" },
    { 258, 160, 32, 16, "4A", "CAM 4A - COULOIR EST" },
    { 258, 198, 32, 16, "4B", "CAM 4B - COIN COULOIR EST" },
    { 170, 110, 32, 16, " 5", "CAM 5 - COULISSES" },
    { 280, 180, 32, 16, " 6", "CAM 6 - CUISINE (AUDIO SEUL)" },
    { 282, 118, 32, 16, " 7", "CAM 7 - TOILETTES" }
};

/* Rendu de la vue caméra sélectionnée */
static void fnaf_render_camera_view(fnaf_cam_id_t cam) {
    /* Fond de la caméra sombre */
    fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, COLOR_FNAF_BLACK);

    /* Rendu spécifique selon la caméra */
    switch (cam) {
        case CAM_1A: // Show Stage (Scène)
            fnaf_fill_rect(20, 40, 180, 140, 0x18A3); // Rideaux
            fnaf_fill_rect(10, 170, 200, 40, 0x2965); // Estrade
            /* Bonnie (Gauche) */
            if (g_fnaf.bonnie_loc == LOC_STAGE) {
                fnaf_fill_rect(35, 75, 30, 95, COLOR_BONNIE_PURPLE);
                fnaf_fill_rect(42, 50, 6, 25, COLOR_BONNIE_PURPLE); // Oreille
                fnaf_fill_rect(52, 50, 6, 25, COLOR_BONNIE_PURPLE);
                fnaf_fill_rect(40, 85, 20, 14, 0x827F);
                fnaf_fill_rect(42, 80, 4, 4, 0x8010); // Yeux
                fnaf_fill_rect(54, 80, 4, 4, 0x8010);
                /* Guitare rouge */
                fnaf_fill_rect(58, 110, 12, 35, COLOR_FOXY_RED);
            }
            /* Freddy (Milieu) */
            if (g_fnaf.freddy_loc == LOC_STAGE) {
                fnaf_fill_rect(90, 70, 36, 100, COLOR_FREDDY_BROWN);
                fnaf_fill_rect(98, 48, 20, 16, COLOR_FNAF_BLACK); // Haut de forme
                fnaf_fill_rect(92, 62, 32, 4, COLOR_FNAF_BLACK);
                fnaf_fill_rect(98, 80, 20, 14, COLOR_FREDDY_DARK);
                fnaf_fill_rect(96, 75, 5, 5, 0x03FF); // Yeux bleus perçants
                fnaf_fill_rect(115, 75, 5, 5, 0x03FF);
                /* Microphone */
                fnaf_fill_rect(84, 105, 8, 16, COLOR_FNAF_LIGHT_GREY);
            }
            /* Chica (Droite) */
            if (g_fnaf.chica_loc == LOC_STAGE) {
                fnaf_fill_rect(145, 75, 32, 95, COLOR_CHICA_YELLOW);
                fnaf_fill_rect(156, 56, 8, 20, COLOR_CHICA_YELLOW); // Crête
                fnaf_fill_rect(152, 88, 18, 12, COLOR_CHICA_ORANGE); // Bec
                fnaf_fill_rect(150, 80, 5, 5, 0x801F); // Yeux
                fnaf_fill_rect(165, 80, 5, 5, 0x801F);
                /* Bavoir blanc */
                fnaf_fill_rect(149, 105, 24, 20, COLOR_FNAF_WHITE);
            }
            break;

        case CAM_1C: // Pirate Cove
            fnaf_fill_rect(30, 40, 160, 160, 0x3086); // Rideaux mauves aux étoiles
            fnaf_fill_rect(20, 180, 180, 20, 0x18C3);
            /* Panneau */
            fnaf_fill_rect(40, 170, 70, 24, 0x52AA);
            eadk_point_t pt_cov = {44, 174};
            if (g_fnaf.foxy_stage >= 3) {
                eadk_display_draw_string("IT'S ME", pt_cov, false, COLOR_FNAF_RED, 0x52AA);
            } else {
                eadk_display_draw_string("HORS SERV", pt_cov, false, COLOR_FNAF_WHITE, 0x52AA);
            }

            /* État de Foxy */
            if (g_fnaf.foxy_stage == 0) {
                // Totalement caché derrière les rideaux fermés
                fnaf_fill_rect(70, 40, 80, 140, 0x48A8);
            } else if (g_fnaf.foxy_stage == 1) {
                // Foxy entrouvre et jette un œil
                fnaf_fill_rect(85, 70, 28, 40, COLOR_FOXY_RED);
                fnaf_fill_rect(92, 78, 6, 6, COLOR_FNAF_YELLOW); // Œil luisant
                fnaf_fill_rect(104, 78, 6, 6, COLOR_FNAF_BLACK); // Cache-œil
            } else if (g_fnaf.foxy_stage == 2) {
                // Foxy sorti en posture d'attaque
                fnaf_fill_rect(70, 65, 42, 90, COLOR_FOXY_RED);
                fnaf_fill_rect(76, 50, 30, 28, COLOR_FOXY_RED);
                fnaf_fill_rect(80, 68, 22, 14, COLOR_FOXY_DARK); // Mâchoire
                fnaf_fill_rect(82, 58, 6, 6, COLOR_FNAF_YELLOW);
                fnaf_fill_rect(98, 58, 6, 6, COLOR_FNAF_BLACK);
                fnaf_fill_rect(65, 110, 8, 30, COLOR_FNAF_LIGHT_GREY); // Crochet
            } else {
                // Crique vide ! Foxy sprinte !
                eadk_point_t pt_run = {40, 90};
                eadk_display_draw_string("CRIQUE VIDE !", pt_run, true, COLOR_FNAF_RED, COLOR_FNAF_BLACK);
            }
            break;

        case CAM_2A: // West Hall (Sprint de Foxy)
            fnaf_fill_rect(20, 20, 180, 180, 0x18C3);
            fnaf_fill_rect(50, 40, 120, 140, 0x0841);
            if (g_fnaf.foxy_stage == 3) {
                /* Animation sprint de Foxy dans le couloir */
                int spr_x = 70 + ((g_fnaf.hour_timer_ms / 100) % 3) * 15;
                fnaf_fill_rect(spr_x, 80, 40, 70, COLOR_FOXY_RED);
                fnaf_fill_rect(spr_x + 8, 65, 24, 20, COLOR_FOXY_RED);
                fnaf_fill_rect(spr_x + 12, 70, 5, 5, COLOR_FNAF_YELLOW);
                fnaf_fill_rect(spr_x + 28, 95, 10, 15, COLOR_FNAF_LIGHT_GREY);
                eadk_point_t pt_warn = {30, 30};
                eadk_display_draw_string("ALERTE: SPRINT FOXY !", pt_warn, false, COLOR_FNAF_RED, COLOR_FNAF_BLACK);
            } else if (g_fnaf.bonnie_loc == LOC_WEST_HALL) {
                fnaf_fill_rect(80, 75, 40, 90, COLOR_BONNIE_PURPLE);
            }
            break;

        case CAM_6: // Kitchen (Cuisine - Audio Only)
            fnaf_fill_rect(10, 30, 200, 170, COLOR_FNAF_BLACK);
            fnaf_draw_tv_snow(10, 30, 200, 170, 160);
            eadk_point_t pt_k1 = {25, 80};
            eadk_display_draw_string("- CAMERA DESACTIVEE -", pt_k1, false, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);
            eadk_point_t pt_k2 = {45, 105};
            eadk_display_draw_string("[ AUDIO ACTIF ]", pt_k2, false, COLOR_FNAF_GREEN, COLOR_FNAF_BLACK);
            if (g_fnaf.chica_loc == LOC_KITCHEN) {
                eadk_point_t pt_k3 = {30, 130};
                eadk_display_draw_string("* Casseroles & Bruits *", pt_k3, false, COLOR_FNAF_YELLOW, COLOR_FNAF_BLACK);
            } else if (g_fnaf.freddy_loc == LOC_KITCHEN) {
                eadk_point_t pt_k3 = {35, 130};
                eadk_display_draw_string("* Boite a Musique *", pt_k3, false, COLOR_FNAF_CYAN, COLOR_FNAF_BLACK);
            }
            break;

        default: // Autres caméras avec couloirs et silhouettes
            fnaf_fill_rect(20, 30, 180, 170, 0x18A3);
            fnaf_fill_rect(40, 50, 140, 130, 0x0841);
            if ((cam == CAM_5 && g_fnaf.bonnie_loc == LOC_BACKSTAGE) ||
                (cam == CAM_2B && g_fnaf.bonnie_loc == LOC_WEST_CORNER) ||
                (cam == CAM_3 && g_fnaf.bonnie_loc == LOC_SUPPLY_CLOSET)) {
                /* Bonnie présent */
                fnaf_fill_rect(80, 70, 48, 90, COLOR_BONNIE_PURPLE);
                fnaf_fill_rect(90, 85, 8, 8, COLOR_FNAF_WHITE);
                fnaf_fill_rect(110, 85, 8, 8, COLOR_FNAF_WHITE);
            } else if ((cam == CAM_7 && g_fnaf.chica_loc == LOC_RESTROOMS) ||
                       (cam == CAM_4A && g_fnaf.chica_loc == LOC_EAST_HALL) ||
                       (cam == CAM_4B && g_fnaf.chica_loc == LOC_EAST_CORNER)) {
                /* Chica présente */
                fnaf_fill_rect(80, 70, 48, 90, COLOR_CHICA_YELLOW);
                fnaf_fill_rect(92, 90, 24, 16, COLOR_CHICA_ORANGE);
            } else if ((cam == CAM_4A && g_fnaf.freddy_loc == LOC_EAST_HALL) ||
                       (cam == CAM_4B && g_fnaf.freddy_loc == LOC_EAST_CORNER) ||
                       (cam == CAM_1B && g_fnaf.freddy_loc == LOC_DINING)) {
                /* Freddy présent dans l'ombre */
                fnaf_fill_rect(85, 75, 45, 90, COLOR_FREDDY_DARK);
                fnaf_fill_rect(95, 85, 6, 6, 0x03FF); // Yeux phosphorescents
                fnaf_fill_rect(115, 85, 6, 6, 0x03FF);
            }
            break;
    }

    /* Légère neige statique sur le flux vidéo */
    fnaf_draw_tv_snow(0, 0, 220, 220, 25);

    /* Point rouge REC clignotant en haut à gauche */
    if ((g_fnaf.hour_timer_ms / 500) & 1) {
        fnaf_fill_rect(12, 10, 10, 10, COLOR_FNAF_RED);
        eadk_point_t pt_rec = {26, 8};
        eadk_display_draw_string("REC", pt_rec, false, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);
    }

    /* Titre de la caméra active en haut */
    eadk_point_t pt_title = {12, 24};
    eadk_display_draw_string(s_cams[cam].title, pt_title, false, COLOR_FNAF_GREEN, COLOR_FNAF_BLACK);

    /* 2. MINIMAP DE FREDDY FAZBEAR'S PIZZA (Sur la droite) */
    fnaf_fill_rect(215, 60, 103, 175, 0x0821);
    fnaf_fill_rect(216, 61, 101, 173, COLOR_FNAF_BLACK);

    /* Tracé du plan de masse du restaurant */
    fnaf_fill_rect(225, 70, 75, 2, COLOR_FNAF_MED_GREY);
    fnaf_fill_rect(225, 70, 2, 70, COLOR_FNAF_MED_GREY);
    fnaf_fill_rect(300, 70, 2, 70, COLOR_FNAF_MED_GREY);
    fnaf_fill_rect(238, 140, 2, 80, COLOR_FNAF_MED_GREY);
    fnaf_fill_rect(285, 140, 2, 80, COLOR_FNAF_MED_GREY);
    /* Bureau du joueur sur la carte */
    fnaf_fill_rect(248, 205, 26, 18, 0x2945);
    eadk_point_t pt_you = {250, 208};
    eadk_display_draw_string("VOUS", pt_you, false, COLOR_FNAF_YELLOW, 0x2945);

    /* Boutons des 11 caméras */
    for (int i = 0; i < CAM_COUNT; i++) {
        const fnaf_cam_info_t* c = &s_cams[i];
        bool is_act = (i == (int)cam);
        uint16_t b_border = is_act ? COLOR_FNAF_GREEN : COLOR_FNAF_MED_GREY;
        uint16_t b_fill = is_act ? 0x12A2 : COLOR_FNAF_DARK_GREY;
        fnaf_fill_rect(c->x - 1, c->y - 1, c->w + 2, c->h + 2, b_border);
        fnaf_fill_rect(c->x, c->y, c->w, c->h, b_fill);
        eadk_point_t p_lbl = {(uint16_t)(c->x + 4), (uint16_t)(c->y + 2)};
        eadk_display_draw_string(c->label, p_lbl, false, is_act ? COLOR_FNAF_WHITE : COLOR_FNAF_LIGHT_GREY, b_fill);
    }

    /* Heure et Batterie en superposition */
    char mini_hud[32];
    const char* am_pm = (g_fnaf.hour == 0) ? "12 AM" : ((g_fnaf.hour == 1) ? "1 AM" : ((g_fnaf.hour == 2) ? "2 AM" : ((g_fnaf.hour == 3) ? "3 AM" : ((g_fnaf.hour == 4) ? "4 AM" : "5 AM"))));
    snprintf(mini_hud, sizeof(mini_hud), "%s  %d%%", am_pm, (int)g_fnaf.power_percent);
    eadk_point_t pt_mh = {10, 222};
    eadk_display_draw_string(mini_hud, pt_mh, false, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);

    /* Bouton pour fermer le moniteur */
    fnaf_fill_rect(105, 222, 105, 16, 0x1082);
    eadk_point_t pt_cmon = {112, 224};
    eadk_display_draw_string("[v] FERMER", pt_cmon, false, COLOR_FNAF_WHITE, 0x1082);
}

/* =========================================================================
 * INTELLIGENCE ARTIFICIELLE & CYCLES DE MOUVEMENT (SCOTT CAWTHON)
 * ========================================================================= */

static void fnaf_ai_update(uint32_t dt_ms) {
    if (g_fnaf.state != FNAF_STATE_OFFICE) return;

    /* 1. BONNIE THE BUNNY (Chaque 4.97 secondes) */
    g_fnaf.bonnie_timer_ms += dt_ms;
    if (g_fnaf.bonnie_timer_ms >= AI_CHECK_BONNIE_MS) {
        g_fnaf.bonnie_timer_ms = 0;
        if (g_fnaf.ai_bonnie > 0 && fnaf_rand(1, 20) <= g_fnaf.ai_bonnie) {
            /* Mouvement selon la trajectoire officielle */
            switch (g_fnaf.bonnie_loc) {
                case LOC_STAGE:
                    g_fnaf.bonnie_loc = LOC_DINING;
                    break;
                case LOC_DINING:
                    g_fnaf.bonnie_loc = (fnaf_rand(0, 1) == 0) ? LOC_BACKSTAGE : LOC_WEST_HALL;
                    break;
                case LOC_BACKSTAGE:
                    g_fnaf.bonnie_loc = LOC_WEST_HALL;
                    break;
                case LOC_WEST_HALL:
                    g_fnaf.bonnie_loc = (fnaf_rand(0, 1) == 0) ? LOC_SUPPLY_CLOSET : LOC_WEST_CORNER;
                    break;
                case LOC_SUPPLY_CLOSET:
                    g_fnaf.bonnie_loc = LOC_WEST_CORNER;
                    break;
                case LOC_WEST_CORNER:
                    g_fnaf.bonnie_loc = LOC_DOOR_LEFT;
                    break;
                case LOC_DOOR_LEFT:
                    if (!g_fnaf.door_left_closed) {
                        /* Pénètre dans le bureau ! */
                        g_fnaf.bonnie_loc = LOC_IN_OFFICE;
                    } else {
                        /* Bloqué par la porte -> Recule dans le couloir */
                        g_fnaf.bonnie_loc = LOC_DINING;
                    }
                    break;
                case LOC_IN_OFFICE:
                    /* Bonnie est déjà dans le bureau, prépare le jumpscare dès que le moniteur se baisse */
                    if (!g_fnaf.monitor_up) {
                        g_fnaf.state = FNAF_STATE_JUMPSCARE;
                        g_fnaf.scare_type = SCARE_BONNIE;
                        g_fnaf.scare_timer_ms = 0;
                    }
                    break;
                default:
                    break;
            }
        }
    }

    /* 2. CHICA THE CHICKEN (Chaque 4.98 secondes) */
    g_fnaf.chica_timer_ms += dt_ms;
    if (g_fnaf.chica_timer_ms >= AI_CHECK_CHICA_MS) {
        g_fnaf.chica_timer_ms = 0;
        if (g_fnaf.ai_chica > 0 && fnaf_rand(1, 20) <= g_fnaf.ai_chica) {
            switch (g_fnaf.chica_loc) {
                case LOC_STAGE:
                    g_fnaf.chica_loc = LOC_DINING;
                    break;
                case LOC_DINING:
                    g_fnaf.chica_loc = (fnaf_rand(0, 1) == 0) ? LOC_RESTROOMS : LOC_KITCHEN;
                    break;
                case LOC_RESTROOMS:
                case LOC_KITCHEN:
                    g_fnaf.chica_loc = LOC_EAST_HALL;
                    break;
                case LOC_EAST_HALL:
                    g_fnaf.chica_loc = LOC_EAST_CORNER;
                    break;
                case LOC_EAST_CORNER:
                    g_fnaf.chica_loc = LOC_DOOR_RIGHT;
                    break;
                case LOC_DOOR_RIGHT:
                    if (!g_fnaf.door_right_closed) {
                        g_fnaf.chica_loc = LOC_IN_OFFICE;
                    } else {
                        g_fnaf.chica_loc = LOC_DINING;
                    }
                    break;
                case LOC_IN_OFFICE:
                    if (!g_fnaf.monitor_up) {
                        g_fnaf.state = FNAF_STATE_JUMPSCARE;
                        g_fnaf.scare_type = SCARE_CHICA;
                        g_fnaf.scare_timer_ms = 0;
                    }
                    break;
                default:
                    break;
            }
        }
    }

    /* 3. FOXY THE PIRATE (Chaque 5.01 secondes) */
    /* Regarder les caméras (surtout Pirate Cove) ralentit ou bloque Foxy */
    if (!g_fnaf.monitor_up || g_fnaf.active_cam != CAM_1C) {
        g_fnaf.foxy_timer_ms += dt_ms;
        if (g_fnaf.foxy_timer_ms >= AI_CHECK_FOXY_MS) {
            g_fnaf.foxy_timer_ms = 0;
            if (g_fnaf.ai_foxy > 0 && fnaf_rand(1, 20) <= g_fnaf.ai_foxy) {
                if (g_fnaf.foxy_stage < 3) {
                    g_fnaf.foxy_stage++;
                    if (g_fnaf.foxy_stage == 3) {
                        g_fnaf.foxy_sprint_timer = 0;
                    }
                }
            }
        }
    }

    /* Sprint de Foxy une fois la scène 3 atteinte */
    if (g_fnaf.foxy_stage == 3) {
        g_fnaf.foxy_sprint_timer += dt_ms;
        if (g_fnaf.foxy_sprint_timer >= FOXY_SPRINT_LIMIT_MS) {
            /* Foxy arrive à la porte gauche ! */
            if (g_fnaf.door_left_closed) {
                /* Porte fermée : Foxy cogne bruyamment et recule à Pirate Cove */
                g_fnaf.foxy_bang_count++;
                float drain = 1.0f + 5.0f * (float)(g_fnaf.foxy_bang_count - 1);
                g_fnaf.power_percent -= drain;
                if (g_fnaf.power_percent < 0.0f) g_fnaf.power_percent = 0.0f;
                g_fnaf.foxy_stage = (fnaf_rand(0, 1) == 0) ? 0 : 1;
                g_fnaf.foxy_sprint_timer = 0;
            } else {
                /* Porte ouverte : Jumpscare immédiat de Foxy ! */
                g_fnaf.state = FNAF_STATE_JUMPSCARE;
                g_fnaf.scare_type = SCARE_FOXY;
                g_fnaf.scare_timer_ms = 0;
            }
        }
    }

    /* 4. FREDDY FAZBEAR (Chaque 3.02 secondes) */
    /* Freddy ne bouge que lorsque Bonnie et Chica ont quitté la scène */
    if (g_fnaf.bonnie_loc != LOC_STAGE && g_fnaf.chica_loc != LOC_STAGE) {
        /* Regarder la caméra où se trouve Freddy le fige sur place */
        bool freddy_watched = (g_fnaf.monitor_up &&
            ((g_fnaf.freddy_loc == LOC_STAGE && g_fnaf.active_cam == CAM_1A) ||
             (g_fnaf.freddy_loc == LOC_DINING && g_fnaf.active_cam == CAM_1B) ||
             (g_fnaf.freddy_loc == LOC_RESTROOMS && g_fnaf.active_cam == CAM_7) ||
             (g_fnaf.freddy_loc == LOC_KITCHEN && g_fnaf.active_cam == CAM_6) ||
             (g_fnaf.freddy_loc == LOC_EAST_HALL && g_fnaf.active_cam == CAM_4A) ||
             (g_fnaf.freddy_loc == LOC_EAST_CORNER && g_fnaf.active_cam == CAM_4B)));

        if (!freddy_watched) {
            g_fnaf.freddy_timer_ms += dt_ms;
            if (g_fnaf.freddy_timer_ms >= AI_CHECK_FREDDY_MS) {
                g_fnaf.freddy_timer_ms = 0;
                if (g_fnaf.ai_freddy > 0 && fnaf_rand(1, 20) <= g_fnaf.ai_freddy) {
                    switch (g_fnaf.freddy_loc) {
                        case LOC_STAGE:
                            g_fnaf.freddy_loc = LOC_DINING;
                            break;
                        case LOC_DINING:
                            g_fnaf.freddy_loc = LOC_RESTROOMS;
                            break;
                        case LOC_RESTROOMS:
                            g_fnaf.freddy_loc = LOC_KITCHEN;
                            break;
                        case LOC_KITCHEN:
                            g_fnaf.freddy_loc = LOC_EAST_HALL;
                            break;
                        case LOC_EAST_HALL:
                            g_fnaf.freddy_loc = LOC_EAST_CORNER;
                            break;
                        case LOC_EAST_CORNER:
                            if (!g_fnaf.door_right_closed) {
                                /* Freddy s'infiltre dans le bureau ! */
                                g_fnaf.freddy_loc = LOC_IN_OFFICE;
                            }
                            break;
                        case LOC_IN_OFFICE:
                            if (!g_fnaf.monitor_up) {
                                g_fnaf.state = FNAF_STATE_JUMPSCARE;
                                g_fnaf.scare_type = SCARE_FREDDY_OFFICE;
                                g_fnaf.scare_timer_ms = 0;
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
        }
    }

    /* 5. DÉCHARGE DE BATTERIE */
    /* Calcul de l'usage : 1 (base fan) + portes + lumières + moniteur */
    uint8_t usage = 1;
    if (g_fnaf.door_left_closed) usage++;
    if (g_fnaf.door_right_closed) usage++;
    if (g_fnaf.light_left_on) usage++;
    if (g_fnaf.light_right_on) usage++;
    if (g_fnaf.monitor_up) usage++;
    if (usage > 5) usage = 5;
    g_fnaf.power_usage_bars = usage;

    /* Taux de consommation selon Scott Cawthon */
    float drain_per_sec = 0.1f * (float)usage;
    g_fnaf.power_percent -= (drain_per_sec * ((float)dt_ms / 1000.0f));
    if (g_fnaf.power_percent <= 0.0f) {
        g_fnaf.power_percent = 0.0f;
        /* PANNE TOTALE D'ÉLECTRICITÉ (Blackout) */
        g_fnaf.state = FNAF_STATE_POWER_OUT;
        g_fnaf.door_left_closed = false;
        g_fnaf.door_right_closed = false;
        g_fnaf.light_left_on = false;
        g_fnaf.light_right_on = false;
        g_fnaf.monitor_up = false;
        g_fnaf.blackout_timer = 0;
        g_fnaf.toreador_flashing = true;
    }

    /* 6. HORLOGE DE NUIT (12 AM -> 6 AM) */
    g_fnaf.hour_timer_ms += dt_ms;
    if (g_fnaf.hour_timer_ms >= HOUR_DURATION_MS) {
        g_fnaf.hour_timer_ms = 0;
        g_fnaf.hour++;
        /* Boost d'IA à 2 AM, 3 AM, 4 AM (règles Scott Cawthon) */
        if (g_fnaf.hour == 2) {
            g_fnaf.ai_bonnie += 1;
        } else if (g_fnaf.hour == 3) {
            g_fnaf.ai_bonnie += 1;
            g_fnaf.ai_chica += 1;
            g_fnaf.ai_foxy += 1;
        } else if (g_fnaf.hour == 4) {
            g_fnaf.ai_bonnie += 1;
            g_fnaf.ai_chica += 1;
            g_fnaf.ai_foxy += 1;
        }

        if (g_fnaf.hour >= 6) {
            /* VICTOIRE 6 AM ! */
            g_fnaf.state = FNAF_STATE_6AM_WIN;
            g_fnaf.win_timer_ms = 0;
        }
    }
}

/* =========================================================================
 * RENDU DES JUMPSCARES & ÉCRANS SPÉCIAUX
 * ========================================================================= */

static void fnaf_render_jumpscare(uint32_t timer_ms) {
    /* Tremblement d'écran et flash */
    int shake_x = fnaf_rand(-6, 6);
    int shake_y = fnaf_rand(-6, 6);
    fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, (timer_ms % 100 < 50) ? COLOR_FNAF_BLACK : COLOR_FNAF_RED);

    int cx = (FNAF_SCREEN_WIDTH / 2) + shake_x;
    int cy = (FNAF_SCREEN_HEIGHT / 2) + shake_y;

    if (g_fnaf.scare_type == SCARE_BONNIE) {
        /* Bonnie bondit en avant mâchoire tremblante */
        fnaf_fill_rect(cx - 70, cy - 80, 140, 160, COLOR_BONNIE_PURPLE);
        fnaf_fill_rect(cx - 50, cy - 130, 25, 60, COLOR_BONNIE_PURPLE);
        fnaf_fill_rect(cx + 25, cy - 130, 25, 60, COLOR_BONNIE_PURPLE);
        fnaf_fill_rect(cx - 45, cy - 20, 90, 40, COLOR_FNAF_BLACK); // Bouche béante
        fnaf_fill_rect(cx - 35, cy - 10, 70, 15, COLOR_FNAF_WHITE); // Dents
        fnaf_fill_rect(cx - 40, cy - 50, 20, 20, COLOR_FNAF_WHITE); // Yeux fous
        fnaf_fill_rect(cx + 20, cy - 50, 20, 20, COLOR_FNAF_WHITE);
        fnaf_fill_rect(cx - 32, cy - 42, 6, 6, COLOR_FNAF_BLACK);
        fnaf_fill_rect(cx + 28, cy - 42, 6, 6, COLOR_FNAF_BLACK);
    } else if (g_fnaf.scare_type == SCARE_CHICA) {
        /* Chica secoue la tête avec férocité */
        fnaf_fill_rect(cx - 75, cy - 70, 150, 150, COLOR_CHICA_YELLOW);
        fnaf_fill_rect(cx - 15, cy - 110, 30, 45, COLOR_CHICA_YELLOW);
        fnaf_fill_rect(cx - 55, cy - 15, 110, 50, COLOR_CHICA_ORANGE); // Grand bec
        fnaf_fill_rect(cx - 40, cy - 5, 80, 30, COLOR_FNAF_BLACK);
        fnaf_fill_rect(cx - 30, cy + 5, 60, 12, COLOR_FNAF_WHITE); // Dents endosquelette
        fnaf_fill_rect(cx - 50, cy - 50, 25, 25, COLOR_FNAF_WHITE);
        fnaf_fill_rect(cx + 25, cy - 50, 25, 25, COLOR_FNAF_WHITE);
        fnaf_fill_rect(cx - 40, cy - 40, 8, 8, 0x801F);
        fnaf_fill_rect(cx + 35, cy - 40, 8, 8, 0x801F);
    } else if (g_fnaf.scare_type == SCARE_FOXY) {
        /* Foxy passe la tête par la porte en hurlant */
        fnaf_fill_rect(cx - 80, cy - 65, 160, 140, COLOR_FOXY_RED);
        fnaf_fill_rect(cx - 50, cy + 10, 100, 50, COLOR_FOXY_DARK);
        fnaf_fill_rect(cx - 40, cy + 20, 80, 30, COLOR_FNAF_BLACK);
        fnaf_fill_rect(cx - 35, cy + 25, 70, 10, COLOR_FNAF_YELLOW); // Dents dorées
        fnaf_fill_rect(cx - 45, cy - 35, 22, 22, COLOR_FNAF_YELLOW);
        fnaf_fill_rect(cx + 25, cy - 35, 25, 25, COLOR_FNAF_BLACK); // Cache-œil
    } else {
        /* Freddy Fazbear (Bureau ou Panne d'énergie) */
        fnaf_fill_rect(cx - 75, cy - 75, 150, 155, COLOR_FREDDY_BROWN);
        fnaf_fill_rect(cx - 30, cy - 120, 60, 48, COLOR_FNAF_BLACK); // Haut de forme
        fnaf_fill_rect(cx - 50, cy - 75, 100, 10, COLOR_FNAF_BLACK);
        fnaf_fill_rect(cx - 50, cy, 100, 50, COLOR_FREDDY_DARK); // Museau
        fnaf_fill_rect(cx - 35, cy + 15, 70, 25, COLOR_FNAF_BLACK);
        fnaf_fill_rect(cx - 30, cy + 20, 60, 12, COLOR_FNAF_WHITE);
        fnaf_fill_rect(cx - 45, cy - 45, 22, 22, 0x03FF); // Yeux bleus
        fnaf_fill_rect(cx + 25, cy - 45, 22, 22, 0x03FF);
    }

    /* Bruit de neige parasite */
    fnaf_draw_tv_snow(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, 40);
}

/* Rendu de la Panne d'énergie (Freddy Toreador Music Box) */
static void fnaf_render_power_out(void) {
    fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, COLOR_FNAF_BLACK);

    /* Yeux et museau clignotants de Freddy dans la porte gauche */
    if (g_fnaf.toreador_flashing) {
        int fx = 35;
        int fy = 65;
        fnaf_fill_rect(fx, fy, 60, 70, 0x2100);
        /* Yeux bleus lumineux qui clignotent au rythme du Toreador */
        if ((g_fnaf.blackout_timer / 250) & 1) {
            fnaf_fill_rect(fx + 10, fy + 15, 10, 10, 0x07FF);
            fnaf_fill_rect(fx + 40, fy + 15, 10, 10, 0x07FF);
            fnaf_fill_rect(fx + 12, fy + 17, 6, 6, COLOR_FNAF_WHITE);
            fnaf_fill_rect(fx + 42, fy + 17, 6, 6, COLOR_FNAF_WHITE);
        }
        /* Dents phosphorescentes */
        fnaf_fill_rect(fx + 15, fy + 45, 30, 8, 0x8410);
    }

    eadk_point_t pt_dark = {110, 110};
    eadk_display_draw_string("* Toreador March *", pt_dark, false, COLOR_FNAF_MED_GREY, COLOR_FNAF_BLACK);
}

/* Rendu de l'écran 6 AM (Victoire) */
static void fnaf_render_6am_win(uint32_t timer_ms) {
    fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, COLOR_FNAF_BLACK);

    /* Animation de transition : 5 AM -> 6 AM */
    int y_num = 95;
    if (timer_ms < 1500) {
        eadk_point_t p5 = {130, (uint16_t)y_num};
        eadk_display_draw_string("5:59 AM", p5, true, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);
    } else {
        /* Chiffre 6 en grand et feux d'artifice */
        eadk_point_t p6 = {130, (uint16_t)y_num};
        eadk_display_draw_string("6:00 AM", p6, true, COLOR_FNAF_YELLOW, COLOR_FNAF_BLACK);

        eadk_point_t p_cheer = {85, 140};
        eadk_display_draw_string("* ENFANTS EN JOIE ! *", p_cheer, false, COLOR_FNAF_GREEN, COLOR_FNAF_BLACK);

        char nxt_buf[48];
        if (g_fnaf.night < 5) {
            snprintf(nxt_buf, sizeof(nxt_buf), "Nuit %d Survécue ! [OK: Nuit %d]", g_fnaf.night, g_fnaf.night + 1);
        } else if (g_fnaf.night == 5) {
            snprintf(nxt_buf, sizeof(nxt_buf), "CHÈQUE DE PAIE REÇU : 120.00$ !");
        } else {
            snprintf(nxt_buf, sizeof(nxt_buf), "VOUS AVEZ SURVÉCU A L'ENFER !");
        }
        eadk_point_t p_nxt = {40, 175};
        eadk_display_draw_string(nxt_buf, p_nxt, false, COLOR_FNAF_CYAN, COLOR_FNAF_BLACK);
    }
}

/* Rendu de l'écran Game Over (Écran statique et texte sanglant) */
static void fnaf_render_game_over(void) {
    fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, COLOR_FNAF_BLACK);
    fnaf_draw_tv_snow(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, 190);

    /* Texte GAME OVER en rouge sang */
    eadk_point_t pt_go = {100, 100};
    eadk_display_draw_string("GAME OVER", pt_go, true, COLOR_FNAF_RED, COLOR_FNAF_BLACK);

    eadk_point_t pt_rst = {65, 145};
    eadk_display_draw_string("[OK] : Réessayer | [Back] : Menu", pt_rst, false, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);
}

/* Initialisation d'une nouvelle nuit selon le niveau */
static void fnaf_init_night(uint8_t night_num) {
    g_fnaf.state = FNAF_STATE_OFFICE;
    g_fnaf.night = night_num;
    g_fnaf.hour = 0;
    g_fnaf.hour_timer_ms = 0;
    g_fnaf.power_percent = 100.0f;
    g_fnaf.power_usage_bars = 1;
    g_fnaf.view_pan = 1; // Vue centrale
    g_fnaf.door_left_closed = false;
    g_fnaf.door_right_closed = false;
    g_fnaf.light_left_on = false;
    g_fnaf.light_right_on = false;
    g_fnaf.monitor_up = false;
    g_fnaf.active_cam = CAM_1A;

    /* Positions initiales sur la scène */
    g_fnaf.bonnie_loc = LOC_STAGE;
    g_fnaf.chica_loc = LOC_STAGE;
    g_fnaf.freddy_loc = LOC_STAGE;
    g_fnaf.foxy_stage = 0;
    g_fnaf.foxy_bang_count = 0;

    g_fnaf.bonnie_timer_ms = 0;
    g_fnaf.chica_timer_ms = 0;
    g_fnaf.foxy_timer_ms = 0;
    g_fnaf.freddy_timer_ms = 0;

    /* Niveaux d'IA officiels de Scott Cawthon */
    if (night_num == 1) {
        g_fnaf.ai_freddy = 0;
        g_fnaf.ai_bonnie = 0;
        g_fnaf.ai_chica = 0;
        g_fnaf.ai_foxy = 0;
    } else if (night_num == 2) {
        g_fnaf.ai_freddy = 0;
        g_fnaf.ai_bonnie = 3;
        g_fnaf.ai_chica = 1;
        g_fnaf.ai_foxy = 1;
    } else if (night_num == 3) {
        g_fnaf.ai_freddy = 1;
        g_fnaf.ai_bonnie = 0;
        g_fnaf.ai_chica = 5;
        g_fnaf.ai_foxy = 2;
    } else if (night_num == 4) {
        g_fnaf.ai_freddy = 2;
        g_fnaf.ai_bonnie = 2;
        g_fnaf.ai_chica = 4;
        g_fnaf.ai_foxy = 6;
    } else if (night_num == 5) {
        g_fnaf.ai_freddy = 3;
        g_fnaf.ai_bonnie = 5;
        g_fnaf.ai_chica = 7;
        g_fnaf.ai_foxy = 5;
    } else if (night_num == 6) {
        g_fnaf.ai_freddy = 4;
        g_fnaf.ai_bonnie = 10;
        g_fnaf.ai_chica = 12;
        g_fnaf.ai_foxy = 6;
    }
}

/* =========================================================================
 * BOUCLE PRINCIPALE DE L'APPLICATION FNAF
 * ========================================================================= */

void run_fnaf_app(void) {
    /* Initialisation du générateur RNG */
    g_fnaf.rng_state = 0x1337C0DE ^ (uint32_t)eadk_timing_millis();
    if (g_fnaf.rng_state == 0) g_fnaf.rng_state = 0xDEADBEEF;

    /* État initial : Menu Titre */
    g_fnaf.state = FNAF_STATE_TITLE;
    g_fnaf.night = 1;
    g_fnaf.ai_freddy = 20;
    g_fnaf.ai_bonnie = 20;
    g_fnaf.ai_chica = 20;
    g_fnaf.ai_foxy = 20;
    g_fnaf.custom_selected_bot = 0;

    int title_sel = 0; // 0 = Nouvelle Partie, 1 = Continuer, 2 = Custom Night (20/20/20/20)

    eadk_keyboard_state_t prev_kbd = eadk_keyboard_scan();

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        /* Quitter sur Touche Home / On/Off */
        if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        /* 1. ÉCRAN TITRE */
        if (g_fnaf.state == FNAF_STATE_TITLE) {
            fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, COLOR_FNAF_BLACK);

            /* Silhouette de Freddy twitchant dans l'obscurité */
            int twitch_x = (fnaf_rand(0, 20) == 0) ? fnaf_rand(-3, 3) : 0;
            fnaf_fill_rect(180 + twitch_x, 30, 90, 160, COLOR_FREDDY_DARK);
            fnaf_fill_rect(205 + twitch_x, 10, 40, 30, COLOR_FNAF_BLACK);
            fnaf_fill_rect(195 + twitch_x, 36, 60, 6, COLOR_FNAF_BLACK);
            /* Yeux de Freddy clignant */
            if (fnaf_rand(0, 5) > 0) {
                fnaf_fill_rect(200 + twitch_x, 50, 10, 10, 0x03FF);
                fnaf_fill_rect(235 + twitch_x, 50, 10, 10, 0x03FF);
                fnaf_fill_rect(202 + twitch_x, 52, 4, 4, COLOR_FNAF_WHITE);
                fnaf_fill_rect(237 + twitch_x, 52, 4, 4, COLOR_FNAF_WHITE);
            }

            /* Lignes de scan statique CRT */
            fnaf_draw_tv_snow(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, 15);

            /* Titre officiel */
            eadk_point_t pt_t1 = {20, 30};
            eadk_display_draw_string("Five Nights", pt_t1, true, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);
            eadk_point_t pt_t2 = {20, 55};
            eadk_display_draw_string("at Freddy's", pt_t2, true, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);

            /* Options du menu */
            const char* opt0 = "Nouvelle Partie (Nuit 1)";
            const char* opt1 = "Continuer (Nuit 5)";
            const char* opt2 = "Custom Night (20/20/20/20)";

            eadk_point_t p_o0 = {30, 120};
            eadk_display_draw_string(opt0, p_o0, false, (title_sel == 0) ? COLOR_FNAF_YELLOW : COLOR_FNAF_LIGHT_GREY, COLOR_FNAF_BLACK);
            eadk_point_t p_o1 = {30, 145};
            eadk_display_draw_string(opt1, p_o1, false, (title_sel == 1) ? COLOR_FNAF_YELLOW : COLOR_FNAF_LIGHT_GREY, COLOR_FNAF_BLACK);
            eadk_point_t p_o2 = {30, 170};
            eadk_display_draw_string(opt2, p_o2, false, (title_sel == 2) ? COLOR_FNAF_YELLOW : COLOR_FNAF_LIGHT_GREY, COLOR_FNAF_BLACK);

            /* Flèche de sélection */
            eadk_point_t p_arr = {14, (uint16_t)(120 + title_sel * 25)};
            eadk_display_draw_string(">", p_arr, false, COLOR_FNAF_YELLOW, COLOR_FNAF_BLACK);

            eadk_point_t p_cred = {20, 215};
            eadk_display_draw_string("(c) Scott Cawthon - Port NumWorks", p_cred, false, COLOR_FNAF_MED_GREY, COLOR_FNAF_BLACK);

            /* Contrôles menu */
            if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                title_sel = (title_sel + 1) % 3;
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                title_sel = (title_sel + 2) % 3;
            } else if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                if (title_sel == 0) {
                    fnaf_init_night(1);
                } else if (title_sel == 1) {
                    fnaf_init_night(5);
                } else {
                    g_fnaf.state = FNAF_STATE_CUSTOM_NIGHT;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
                break; // Retour au lanceur
            }
        }
        /* 2. MENU CUSTOM NIGHT (20/20/20/20) */
        else if (g_fnaf.state == FNAF_STATE_CUSTOM_NIGHT) {
            fnaf_fill_rect(0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT, COLOR_FNAF_BLACK);

            eadk_point_t p_cn_t = {60, 20};
            eadk_display_draw_string("PERSONNALISER LA NUIT 7", p_cn_t, true, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);

            /* Cadres des 4 animatroniques */
            const char* bot_names[4] = { "Freddy", "Bonnie", "Chica", "Foxy" };
            uint8_t bot_vals[4] = { g_fnaf.ai_freddy, g_fnaf.ai_bonnie, g_fnaf.ai_chica, g_fnaf.ai_foxy };
            uint16_t bot_cols[4] = { COLOR_FREDDY_BROWN, COLOR_BONNIE_PURPLE, COLOR_CHICA_YELLOW, COLOR_FOXY_RED };

            for (int b = 0; b < 4; b++) {
                int bx = 20 + b * 72;
                int by = 60;
                bool is_sel = (g_fnaf.custom_selected_bot == b);
                fnaf_fill_rect(bx, by, 64, 90, is_sel ? COLOR_FNAF_YELLOW : COLOR_FNAF_DARK_GREY);
                fnaf_fill_rect(bx + 2, by + 2, 60, 86, COLOR_FNAF_BLACK);

                /* Icône bot */
                fnaf_fill_rect(bx + 12, by + 8, 40, 40, bot_cols[b]);

                /* Nom */
                eadk_point_t p_bn = {(uint16_t)(bx + 8), (uint16_t)(by + 52)};
                eadk_display_draw_string(bot_names[b], p_bn, false, COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);

                /* Niveau d'IA (0 à 20) */
                char val_str[8];
                snprintf(val_str, sizeof(val_str), "< %02d >", bot_vals[b]);
                eadk_point_t p_bv = {(uint16_t)(bx + 6), (uint16_t)(by + 70)};
                eadk_display_draw_string(val_str, p_bv, false, is_sel ? COLOR_FNAF_YELLOW : COLOR_FNAF_GREEN, COLOR_FNAF_BLACK);
            }

            /* Bouton DÉMARRER */
            bool start_sel = (g_fnaf.custom_selected_bot == 4);
            fnaf_fill_rect(90, 170, 140, 28, start_sel ? COLOR_FNAF_YELLOW : 0x18C3);
            fnaf_fill_rect(92, 172, 136, 24, COLOR_FNAF_BLACK);
            eadk_point_t p_st = {112, 176};
            eadk_display_draw_string("LANCER LA NUIT !", p_st, false, start_sel ? COLOR_FNAF_YELLOW : COLOR_FNAF_WHITE, COLOR_FNAF_BLACK);

            eadk_point_t p_hint = {30, 212};
            eadk_display_draw_string("G/D: Ajuster (0-20) | [OK]: Lancer | [Back]: Menu", p_hint, false, COLOR_FNAF_MED_GREY, COLOR_FNAF_BLACK);

            /* Contrôles Custom Night */
            if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                if (g_fnaf.custom_selected_bot < 3) {
                    g_fnaf.custom_selected_bot++;
                } else if (g_fnaf.custom_selected_bot == 3) {
                    g_fnaf.custom_selected_bot = 4;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                if (g_fnaf.custom_selected_bot > 0) {
                    g_fnaf.custom_selected_bot--;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_up)) {
                if (g_fnaf.custom_selected_bot == 4) {
                    g_fnaf.custom_selected_bot = 0;
                } else {
                    if (g_fnaf.custom_selected_bot == 0 && g_fnaf.ai_freddy < 20) g_fnaf.ai_freddy++;
                    if (g_fnaf.custom_selected_bot == 1 && g_fnaf.ai_bonnie < 20) g_fnaf.ai_bonnie++;
                    if (g_fnaf.custom_selected_bot == 2 && g_fnaf.ai_chica < 20) g_fnaf.ai_chica++;
                    if (g_fnaf.custom_selected_bot == 3 && g_fnaf.ai_foxy < 20) g_fnaf.ai_foxy++;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_down)) {
                if (g_fnaf.custom_selected_bot < 4) {
                    if (g_fnaf.custom_selected_bot == 0 && g_fnaf.ai_freddy > 0) g_fnaf.ai_freddy--;
                    if (g_fnaf.custom_selected_bot == 1 && g_fnaf.ai_bonnie > 0) g_fnaf.ai_bonnie--;
                    if (g_fnaf.custom_selected_bot == 2 && g_fnaf.ai_chica > 0) g_fnaf.ai_chica--;
                    if (g_fnaf.custom_selected_bot == 3 && g_fnaf.ai_foxy > 0) g_fnaf.ai_foxy--;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                fnaf_init_night(7); // Nuit 7 personnalisée avec les IA choisies
            } else if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
                g_fnaf.state = FNAF_STATE_TITLE;
            }
        }
        /* 3. EN JEU DANS LE BUREAU (Office ou Caméras) */
        else if (g_fnaf.state == FNAF_STATE_OFFICE) {
            uint32_t dt = 30; // ~30ms par itération

            /* Mise à jour de l'animation du ventilateur */
            g_fnaf.fan_timer_ms += dt;
            if (g_fnaf.fan_timer_ms >= 60) {
                g_fnaf.fan_timer_ms = 0;
                g_fnaf.fan_frame = (g_fnaf.fan_frame + 1) % 3;
            }

            /* Logique de jeu & IA Scott Cawthon */
            fnaf_ai_update(dt);

            /* Interactions Joueur */
            if (g_fnaf.monitor_up) {
                /* ÉCRAN DE CAMÉRAS OUVERT */
                fnaf_render_camera_view(g_fnaf.active_cam);

                /* Changer de caméra avec les flèches ou touches numériques directes */
                if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
                    g_fnaf.active_cam = (fnaf_cam_id_t)((g_fnaf.active_cam + 1) % CAM_COUNT);
                } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
                    g_fnaf.active_cam = (fnaf_cam_id_t)((g_fnaf.active_cam + CAM_COUNT - 1) % CAM_COUNT);
                } else if (eadk_keyboard_key_down(pressed, eadk_key_one)) {
                    g_fnaf.active_cam = CAM_1A;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_two)) {
                    g_fnaf.active_cam = CAM_1B;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_three)) {
                    g_fnaf.active_cam = CAM_1C;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_four)) {
                    g_fnaf.active_cam = CAM_2A;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_five)) {
                    g_fnaf.active_cam = CAM_2B;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_six)) {
                    g_fnaf.active_cam = CAM_3;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_seven)) {
                    g_fnaf.active_cam = CAM_4A;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_eight)) {
                    g_fnaf.active_cam = CAM_4B;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_nine)) {
                    g_fnaf.active_cam = CAM_5;
                } else if (eadk_keyboard_key_down(pressed, eadk_key_zero)) {
                    g_fnaf.active_cam = CAM_6;
                }

                /* Fermer le moniteur : Flèche Bas, Touche Haut, Ans ou OK */
                if (eadk_keyboard_key_down(pressed, eadk_key_down) ||
                    eadk_keyboard_key_down(pressed, eadk_key_up) ||
                    eadk_keyboard_key_down(pressed, eadk_key_ans) ||
                    eadk_keyboard_key_down(pressed, eadk_key_back)) {
                    g_fnaf.monitor_up = false;
                }
            } else {
                /* VUE DU BUREAU */
                fnaf_render_office();

                /* Navigation panoramique : Flèches Gauche / Droite */
                if (eadk_keyboard_key_down(kbd, eadk_key_left)) {
                    g_fnaf.view_pan = 0; // Regard vers la porte gauche
                } else if (eadk_keyboard_key_down(kbd, eadk_key_right)) {
                    g_fnaf.view_pan = 2; // Regard vers la porte droite
                } else if (eadk_keyboard_key_down(kbd, eadk_key_down)) {
                    g_fnaf.view_pan = 1; // Retour au centre
                }

                /* Contrôles Porte Gauche et Lumière Gauche : Touche 1 & 4 (ou OK si tourné à gauche) */
                if (eadk_keyboard_key_down(pressed, eadk_key_one) ||
                    (g_fnaf.view_pan == 0 && (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)))) {
                    g_fnaf.door_left_closed = !g_fnaf.door_left_closed;
                }
                if (eadk_keyboard_key_down(pressed, eadk_key_four)) {
                    g_fnaf.light_left_on = !g_fnaf.light_left_on;
                    if (g_fnaf.light_left_on) g_fnaf.light_right_on = false;
                }

                /* Contrôles Porte Droite et Lumière Droite : Touche 3 & 6 (ou OK si tourné à droite) */
                if (eadk_keyboard_key_down(pressed, eadk_key_three) ||
                    (g_fnaf.view_pan == 2 && (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)))) {
                    g_fnaf.door_right_closed = !g_fnaf.door_right_closed;
                }
                if (eadk_keyboard_key_down(pressed, eadk_key_six)) {
                    g_fnaf.light_right_on = !g_fnaf.light_right_on;
                    if (g_fnaf.light_right_on) g_fnaf.light_left_on = false;
                }

                /* Ouvrir le Moniteur : Flèche Haut ou Ans */
                if (eadk_keyboard_key_down(pressed, eadk_key_up) || eadk_keyboard_key_down(pressed, eadk_key_ans)) {
                    g_fnaf.monitor_up = true;
                    g_fnaf.light_left_on = false;
                    g_fnaf.light_right_on = false;
                }

                /* Easter Egg : Clic sur le nez de Freddy sur le poster (Touche 5) -> "HONK!" */
                if (g_fnaf.view_pan == 1 && eadk_keyboard_key_down(pressed, eadk_key_five)) {
                    eadk_point_t p_hnk = {145, 18};
                    eadk_display_draw_string("* HONK! *", p_hnk, false, COLOR_FNAF_YELLOW, COLOR_FNAF_BLACK);
                }

                /* Quitter la partie : Touche Back */
                if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
                    g_fnaf.state = FNAF_STATE_TITLE;
                }
            }
        }
        /* 4. PANNE D'ÉNERGIE (BLACKOUT) */
        else if (g_fnaf.state == FNAF_STATE_POWER_OUT) {
            g_fnaf.blackout_timer += 40;
            fnaf_render_power_out();

            /* Fin de la boîte à musique après 6-12 secondes */
            if (g_fnaf.blackout_timer >= 7500) {
                g_fnaf.state = FNAF_STATE_JUMPSCARE;
                g_fnaf.scare_type = SCARE_FREDDY_POWER_OUT;
                g_fnaf.scare_timer_ms = 0;
            }
        }
        /* 5. JUMPSCARE */
        else if (g_fnaf.state == FNAF_STATE_JUMPSCARE) {
            g_fnaf.scare_timer_ms += 40;
            fnaf_render_jumpscare(g_fnaf.scare_timer_ms);

            if (g_fnaf.scare_timer_ms >= 1800) {
                g_fnaf.state = FNAF_STATE_GAME_OVER;
            }
        }
        /* 6. GAME OVER */
        else if (g_fnaf.state == FNAF_STATE_GAME_OVER) {
            fnaf_render_game_over();

            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                fnaf_init_night(g_fnaf.night); // Recommencer la nuit
            } else if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
                g_fnaf.state = FNAF_STATE_TITLE;
            }
        }
        /* 7. VICTOIRE 6 AM */
        else if (g_fnaf.state == FNAF_STATE_6AM_WIN) {
            g_fnaf.win_timer_ms += 40;
            fnaf_render_6am_win(g_fnaf.win_timer_ms);

            if (eadk_keyboard_key_down(pressed, eadk_key_ok) || eadk_keyboard_key_down(pressed, eadk_key_exe)) {
                if (g_fnaf.night < 5) {
                    fnaf_init_night(g_fnaf.night + 1);
                } else {
                    g_fnaf.state = FNAF_STATE_TITLE;
                }
            } else if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
                g_fnaf.state = FNAF_STATE_TITLE;
            }
        }

        prev_kbd = kbd;
        eadk_timing_msleep(25);
    }

    while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
}
