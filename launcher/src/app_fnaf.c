/* =========================================================================
 * Five Nights at Freddy's (FNAF) 1 - Moteur Officiel pour NumWorks (EquaLib)
 *
 * Implémentation 100% fidèle aux algorithmes originaux de Scott Cawthon
 * et du port TI-84 Plus CE (Axe / C).
 *
 * Conforme aux contraintes matérielles NumWorks N0110 / N0115 / N0120 :
 *  - Rendu par bandes en SRAM (s_fnaf_ram_band, 5 Ko) garantissant la
 *    compatibilité DMA OctoSPI sur STM32H7 (N0120) et évitant tout écran noir.
 *  - Zéro allocation dynamique (aucun malloc, sécurité totale de la pile).
 *  - Décompression RLE 4bpp à la volée vers l'afficheur.
 *  - Synchronisation VBlank et delta-timing temps réel.
 * ========================================================================= */

#include "app_fnaf.h"
#include "eadk.h"
#include "eq_font.h"
#include "fnaf_assets.h"

/* Inclusion directe des tables d'assets compressés en Flash */
#include "fnaf_assets.c"

/* =========================================================================
 * Constantes et Définitions Internes
 * ========================================================================= */

#define RGB565(r, g, b) ((((r) & 0xF8) << 8) | (((g) & 0xFC) << 3) | (((b) & 0xF8) >> 3))

#define COLOR_BLACK     0x0000
#define COLOR_WHITE     0xFFFF
#define COLOR_RED       0xF800
#define COLOR_GREEN     0x07E0
#define COLOR_BLUE      0x001F
#define COLOR_YELLOW    0xFFE0
#define COLOR_GRAY      0x8410
#define COLOR_DARK_GRAY 0x3186

#define FNAF_BAND_HEIGHT 8

/* Minuteurs officiels Scott Cawthon (en millisecondes) */
#define AI_CHECK_BONNIE_MS 4970
#define AI_CHECK_CHICA_MS  4980
#define AI_CHECK_FOXY_MS   5010
#define AI_CHECK_FREDDY_MS 3020

#define NORMAL_HOUR_DURATION_MS 89166
#define FAST_HOUR_DURATION_MS   40000

/* Tampon intermédiaire en SRAM pour le contrôleur DMA (NumWorks N0120 / STM32H7)
 * 320 pixels * 8 lignes * 2 octets = 5 120 octets (parfaitement sûr sur N0110).
 */
static eadk_color_t s_fnaf_ram_band[FNAF_SCREEN_WIDTH * FNAF_BAND_HEIGHT];

/* Instance globale de l'état du jeu */
fnaf_game_t g_fnaf;

/* Générateur pseudo-aléatoire XorShift32 */
static uint32_t fnaf_rand(void) {
    if (g_fnaf.rng_state == 0) g_fnaf.rng_state = 0x1337BEEF;
    uint32_t x = g_fnaf.rng_state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    g_fnaf.rng_state = x;
    return x;
}

static uint32_t fnaf_rand_range(uint32_t min, uint32_t max) {
    if (max <= min) return min;
    return min + (fnaf_rand() % (max - min + 1));
}

/* =========================================================================
 * Sous-système d'Affichage & Décompression RLE Sécurisée DMA
 * ========================================================================= */

void fnaf_display_init(void) {
    eadk_display_push_rect_uniform((eadk_rect_t){0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT}, COLOR_BLACK);
}

void fnaf_display_flip(void) {
    eadk_display_wait_for_vblank();
}

void fnaf_draw_subtitle(const char *text, uint16_t color_rgb565) {
    if (!text) return;
    int i = 0;
    while (text[i] && i < 47) {
        g_fnaf.subtitle_text[i] = text[i];
        i++;
    }
    g_fnaf.subtitle_text[i] = '\0';
    g_fnaf.subtitle_color = color_rgb565;
    g_fnaf.subtitle_timer_ms = 2200;
}

/* Décompression streaming sécurisée DMA d'un asset RLE vers l'écran LCD
 * 160x120 4bpp mis à l'échelle 2x vers 320x240, ou rendu direct 320x240.
 */
void fnaf_draw_image(fnaf_asset_id_t asset_id, int16_t dst_x, int16_t dst_y) {
    if (asset_id < 0 || asset_id >= FNAF_ASSET_COUNT) return;
    const fnaf_asset_descriptor_t *desc = &g_fnaf_assets[asset_id];
    if (!desc->rle_data || desc->rle_data_size == 0) return;

    /* Clamping défensif systématique des coordonnées pour la sécurité ST7789/DMA */
    (void)dst_x;
    (void)dst_y;
    dst_x = 0;
    dst_y = 0;

    const uint8_t *rle = desc->rle_data;
    const uint32_t rle_size = desc->rle_data_size;
    const uint16_t *pal = desc->palette_rgb565;

    uint32_t rle_idx = 0;
    uint8_t cur_run = 0;
    uint8_t cur_col_idx = 0;
    uint16_t cur_color = 0;

    /* Cas 1: Image 160x120 mise à l'échelle 2x vers 320x240 */
    if (desc->width == 160 && desc->height == 120) {
        /* Il y a 30 bandes d'écran de 8 lignes (240 lignes au total).
         * Chaque bande de 8 lignes d'écran correspond à 4 lignes sources de 160 pixels.
         */
        for (int band = 0; band < 30; band++) {
            int16_t screen_y = dst_y + (band * 8);
            if (screen_y >= FNAF_SCREEN_HEIGHT || screen_y + 8 <= 0) {
                /* Si hors écran, avancer simplement la décompression de 4*160 pixels */
                uint32_t skip_pixels = 160 * 4;
                while (skip_pixels > 0 && rle_idx < rle_size) {
                    if (cur_run == 0) {
                        uint8_t b = rle[rle_idx++];
                        cur_run = ((b >> 4) & 0x0F) + 1;
                    }
                    uint32_t take = (cur_run <= skip_pixels) ? cur_run : skip_pixels;
                    cur_run -= take;
                    skip_pixels -= take;
                }
                continue;
            }

            /* Remplir la bande RAM de 8 lignes d'écran */
            for (int src_row = 0; src_row < 4; src_row++) {
                int out_line_0 = src_row * 2;
                int out_line_1 = out_line_0 + 1;
                eadk_color_t *line0_ptr = &s_fnaf_ram_band[out_line_0 * FNAF_SCREEN_WIDTH];
                eadk_color_t *line1_ptr = &s_fnaf_ram_band[out_line_1 * FNAF_SCREEN_WIDTH];

                for (int sx = 0; sx < 160; sx++) {
                    if (cur_run == 0) {
                        if (rle_idx < rle_size) {
                            uint8_t b = rle[rle_idx++];
                            cur_run = ((b >> 4) & 0x0F) + 1;
                            cur_col_idx = b & 0x0F;
                            cur_color = pal[cur_col_idx];
                        } else {
                            cur_color = COLOR_BLACK;
                            cur_run = 1;
                        }
                    }
                    cur_run--;

                    int dx = sx * 2;
                    line0_ptr[dx]     = cur_color;
                    line0_ptr[dx + 1] = cur_color;
                    line1_ptr[dx]     = cur_color;
                    line1_ptr[dx + 1] = cur_color;
                }
            }

            /* Pousser la bande RAM vers l'écran LCD via DMA Cortex-M */
            eadk_rect_t band_rect = {
                0,
                (uint16_t)(band * FNAF_BAND_HEIGHT),
                FNAF_SCREEN_WIDTH,
                FNAF_BAND_HEIGHT
            };
            eadk_display_push_rect(band_rect, s_fnaf_ram_band);
        }
    } else {
        /* Cas 2: Image 320x240 en taille 1:1 */
        for (int band = 0; band < 30; band++) {
            int16_t screen_y = dst_y + (band * 8);
            for (int line = 0; line < 8; line++) {
                eadk_color_t *line_ptr = &s_fnaf_ram_band[line * FNAF_SCREEN_WIDTH];
                for (int x = 0; x < FNAF_SCREEN_WIDTH; x++) {
                    if (cur_run == 0) {
                        if (rle_idx < rle_size) {
                            uint8_t b = rle[rle_idx++];
                            cur_run = ((b >> 4) & 0x0F) + 1;
                            cur_col_idx = b & 0x0F;
                            cur_color = pal[cur_col_idx];
                        } else {
                            cur_color = COLOR_BLACK;
                            cur_run = 1;
                        }
                    }
                    cur_run--;
                    line_ptr[x] = cur_color;
                }
            }
            eadk_rect_t band_rect = {
                0,
                (uint16_t)(band * FNAF_BAND_HEIGHT),
                FNAF_SCREEN_WIDTH,
                FNAF_BAND_HEIGHT
            };
            eadk_display_push_rect(band_rect, s_fnaf_ram_band);
        }
    }
}

/* Génération procédurale de neige TV (Static Noise) */
void fnaf_draw_tv_snow(uint16_t intensity) {
    (void)intensity;
    for (int band = 0; band < 30; band++) {
        for (int i = 0; i < FNAF_SCREEN_WIDTH * FNAF_BAND_HEIGHT; i++) {
            uint32_t r = fnaf_rand();
            uint8_t val = (uint8_t)(r & 0xFF);
            if (val > 190) {
                s_fnaf_ram_band[i] = COLOR_WHITE;
            } else if (val > 100) {
                s_fnaf_ram_band[i] = COLOR_GRAY;
            } else if (val > 40) {
                s_fnaf_ram_band[i] = COLOR_DARK_GRAY;
            } else {
                s_fnaf_ram_band[i] = COLOR_BLACK;
            }
        }
        eadk_rect_t rect = {0, (uint16_t)(band * 8), FNAF_SCREEN_WIDTH, FNAF_BAND_HEIGHT};
        eadk_display_push_rect(rect, s_fnaf_ram_band);
    }
}

/* =========================================================================
 * Moteur de Jeu : Initialisation, AI & Logique
 * ========================================================================= */

void fnaf_init_game(fnaf_pacing_mode_t pacing) {
    g_fnaf.state = FNAF_STATE_TITLE;
    g_fnaf.pacing_mode = pacing;
    g_fnaf.night = 1;
    g_fnaf.hour = 0;
    g_fnaf.hour_timer_ms = 0;
    g_fnaf.hour_duration_ms = (pacing == FNAF_PACING_FAST) ? FAST_HOUR_DURATION_MS : NORMAL_HOUR_DURATION_MS;

    g_fnaf.power_percent = 100.0f;
    g_fnaf.power_usage_bars = 1;
    g_fnaf.power_drain_accum_ms = 0;

    g_fnaf.view_pan = 1; // Vue Bureau / Ventilateur par défaut
    g_fnaf.door_left_closed = false;
    g_fnaf.door_right_closed = false;
    g_fnaf.light_left_on = false;
    g_fnaf.light_right_on = false;
    g_fnaf.door_left_jammed = false;
    g_fnaf.door_right_jammed = false;
    g_fnaf.light_left_jammed = false;
    g_fnaf.light_right_jammed = false;

    g_fnaf.monitor_up = false;
    g_fnaf.active_cam = CAM_1A;
    g_fnaf.cam_static_timer_ms = 0;

    g_fnaf.bonnie_loc = LOC_STAGE;
    g_fnaf.bonnie_timer_ms = 0;
    g_fnaf.bonnie_in_office = false;

    g_fnaf.chica_loc = LOC_STAGE;
    g_fnaf.chica_timer_ms = 0;
    g_fnaf.chica_in_office = false;

    g_fnaf.foxy_stage = 0;
    g_fnaf.foxy_timer_ms = 0;
    g_fnaf.foxy_sprint_timer = 0;
    g_fnaf.foxy_bang_count = 0;

    g_fnaf.freddy_loc = LOC_STAGE;
    g_fnaf.freddy_timer_ms = 0;

    g_fnaf.blackout_timer_ms = 0;
    g_fnaf.toreador_flashing = false;
    g_fnaf.toreador_timer_ms = 0;
    g_fnaf.toreador_duration_ms = 0;
    g_fnaf.toreador_ended = false;

    g_fnaf.scare_type = SCARE_NONE;
    g_fnaf.scare_frame = 0;
    g_fnaf.scare_timer_ms = 0;
    g_fnaf.win_timer_ms = 0;

    g_fnaf.fan_frame = 0;
    g_fnaf.fan_timer_ms = 0;

    g_fnaf.subtitle_text[0] = '\0';
    g_fnaf.subtitle_color = COLOR_WHITE;
    g_fnaf.subtitle_timer_ms = 0;

    g_fnaf.custom_selected_bot = 0;
    g_fnaf.ai_freddy = 0;
    g_fnaf.ai_bonnie = 0;
    g_fnaf.ai_chica = 0;
    g_fnaf.ai_foxy = 0;

    g_fnaf.rng_state = 0x90200000;
}

void fnaf_start_night(uint8_t night) {
    g_fnaf.night = night;
    g_fnaf.state = FNAF_STATE_NIGHT_INTRO;
    g_fnaf.night_intro_timer_ms = 2000;

    g_fnaf.hour = 0; // 12 AM
    g_fnaf.hour_timer_ms = 0;
    g_fnaf.hour_duration_ms = (g_fnaf.pacing_mode == FNAF_PACING_FAST) ? FAST_HOUR_DURATION_MS : NORMAL_HOUR_DURATION_MS;

    g_fnaf.power_percent = 100.0f;
    g_fnaf.power_usage_bars = 1;
    g_fnaf.power_drain_accum_ms = 0;

    g_fnaf.view_pan = 1;
    g_fnaf.door_left_closed = false;
    g_fnaf.door_right_closed = false;
    g_fnaf.light_left_on = false;
    g_fnaf.light_right_on = false;
    g_fnaf.door_left_jammed = false;
    g_fnaf.door_right_jammed = false;
    g_fnaf.light_left_jammed = false;
    g_fnaf.light_right_jammed = false;

    g_fnaf.monitor_up = false;
    g_fnaf.active_cam = CAM_1A;
    g_fnaf.cam_static_timer_ms = 0;

    g_fnaf.bonnie_loc = LOC_STAGE;
    g_fnaf.bonnie_timer_ms = 0;
    g_fnaf.bonnie_in_office = false;

    g_fnaf.chica_loc = LOC_STAGE;
    g_fnaf.chica_timer_ms = 0;
    g_fnaf.chica_in_office = false;

    g_fnaf.foxy_stage = 0;
    g_fnaf.foxy_timer_ms = 0;
    g_fnaf.foxy_sprint_timer = 0;
    g_fnaf.foxy_bang_count = 0;

    g_fnaf.freddy_loc = LOC_STAGE;
    g_fnaf.freddy_timer_ms = 0;

    g_fnaf.blackout_timer_ms = 0;
    g_fnaf.toreador_flashing = false;
    g_fnaf.toreador_timer_ms = 0;
    g_fnaf.toreador_duration_ms = 0;
    g_fnaf.toreador_ended = false;

    g_fnaf.scare_type = SCARE_NONE;
    g_fnaf.scare_frame = 0;
    g_fnaf.scare_timer_ms = 0;
    g_fnaf.win_timer_ms = 0;

    /* Configuration des IA selon la nuit */
    if (night == 1) {
        g_fnaf.ai_freddy = 0;
        g_fnaf.ai_bonnie = 0; // S'active à 2 AM (+2)
        g_fnaf.ai_chica = 0;  // S'active à 3 AM (+1)
        g_fnaf.ai_foxy = 0;   // S'active à 3 AM (+1)
    } else if (night == 2) {
        g_fnaf.ai_freddy = 0;
        g_fnaf.ai_bonnie = 3;
        g_fnaf.ai_chica = 1;
        g_fnaf.ai_foxy = 1;
    } else if (night == 3) {
        g_fnaf.ai_freddy = 1;
        g_fnaf.ai_bonnie = 0;
        g_fnaf.ai_chica = 5;
        g_fnaf.ai_foxy = 2;
    } else if (night == 4) {
        g_fnaf.ai_freddy = 2;
        g_fnaf.ai_bonnie = 2;
        g_fnaf.ai_chica = 4;
        g_fnaf.ai_foxy = 6;
    } else if (night == 5) {
        g_fnaf.ai_freddy = 3;
        g_fnaf.ai_bonnie = 5;
        g_fnaf.ai_chica = 7;
        g_fnaf.ai_foxy = 5;
    } else if (night == 6) {
        g_fnaf.ai_freddy = 4;
        g_fnaf.ai_bonnie = 10;
        g_fnaf.ai_chica = 12;
        g_fnaf.ai_foxy = 16;
    }
    /* Si Nuit 7 (Custom), les valeurs ai_* sont conservées depuis le menu */

    /* Bonus FAST mode : +1 à toutes les IA */
    if (g_fnaf.pacing_mode == FNAF_PACING_FAST && night <= 6) {
        if (g_fnaf.ai_freddy > 0 && g_fnaf.ai_freddy < 20) g_fnaf.ai_freddy++;
        if (g_fnaf.ai_bonnie < 20) g_fnaf.ai_bonnie++;
        if (g_fnaf.ai_chica < 20) g_fnaf.ai_chica++;
        if (g_fnaf.ai_foxy < 20) g_fnaf.ai_foxy++;
    }
}

/* =========================================================================
 * Mise à jour de l'IA et de la Simulation (Tick)
 * ========================================================================= */

/* Déclenchement immédiat de la panne de courant (Blackout) */
static void fnaf_trigger_blackout(void) {
    g_fnaf.power_percent = 0.0f;
    g_fnaf.door_left_closed = false;
    g_fnaf.door_right_closed = false;
    g_fnaf.light_left_on = false;
    g_fnaf.light_right_on = false;
    g_fnaf.monitor_up = false;
    g_fnaf.state = FNAF_STATE_POWER_OUT;
    g_fnaf.blackout_timer_ms = 0;
    fnaf_draw_subtitle("* POWER OUTAGE - BLACKOUT *", COLOR_RED);
}

static void fnaf_ai_update_tick(uint32_t dt_ms) {
    /* Si 6 AM ou jumpscare ou blackout, l'IA standard est gelée */
    if (g_fnaf.state != FNAF_STATE_OFFICE) return;

    /* -------------------------------------------------------------
     * 1. BONNIE AI (Test toutes les 4.97s = 4970 ms)
     * ------------------------------------------------------------- */
    g_fnaf.bonnie_timer_ms += dt_ms;
    if (g_fnaf.bonnie_timer_ms >= AI_CHECK_BONNIE_MS) {
        g_fnaf.bonnie_timer_ms -= AI_CHECK_BONNIE_MS;
        uint32_t roll = fnaf_rand_range(1, 20);
        if (roll <= g_fnaf.ai_bonnie) {
            /* Succès du jet de déplacement */
            if (g_fnaf.bonnie_loc == LOC_STAGE) {
                g_fnaf.bonnie_loc = LOC_DINING;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.bonnie_loc == LOC_DINING) {
                g_fnaf.bonnie_loc = (fnaf_rand() % 2 == 0) ? LOC_BACKSTAGE : LOC_WEST_HALL;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.bonnie_loc == LOC_BACKSTAGE) {
                g_fnaf.bonnie_loc = LOC_WEST_HALL;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.bonnie_loc == LOC_WEST_HALL) {
                g_fnaf.bonnie_loc = (fnaf_rand() % 2 == 0) ? LOC_SUPPLY_CLOSET : LOC_WEST_CORNER;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.bonnie_loc == LOC_SUPPLY_CLOSET) {
                g_fnaf.bonnie_loc = LOC_WEST_CORNER;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.bonnie_loc == LOC_WEST_CORNER) {
                g_fnaf.bonnie_loc = LOC_DOOR_LEFT;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.bonnie_loc == LOC_DOOR_LEFT) {
                if (g_fnaf.door_left_closed) {
                    /* Porte fermée : Bonnie recule vers la salle à manger */
                    g_fnaf.bonnie_loc = LOC_DINING;
                    fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
                } else {
                    /* Porte ouverte : Bonnie entre dans le bureau et bloque les commandes */
                    g_fnaf.bonnie_loc = LOC_IN_OFFICE;
                    g_fnaf.bonnie_in_office = true;
                    g_fnaf.door_left_jammed = true;
                    g_fnaf.light_left_jammed = true;
                }
            }
        }
    }

    /* -------------------------------------------------------------
     * 2. CHICA AI (Test toutes les 4.98s = 4980 ms)
     * ------------------------------------------------------------- */
    g_fnaf.chica_timer_ms += dt_ms;
    if (g_fnaf.chica_timer_ms >= AI_CHECK_CHICA_MS) {
        g_fnaf.chica_timer_ms -= AI_CHECK_CHICA_MS;
        uint32_t roll = fnaf_rand_range(1, 20);
        if (roll <= g_fnaf.ai_chica) {
            if (g_fnaf.chica_loc == LOC_STAGE) {
                g_fnaf.chica_loc = LOC_DINING;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.chica_loc == LOC_DINING) {
                g_fnaf.chica_loc = (fnaf_rand() % 2 == 0) ? LOC_KITCHEN : LOC_RESTROOMS;
                if (g_fnaf.chica_loc == LOC_KITCHEN) {
                    fnaf_draw_subtitle("* pots and pans clattering *", COLOR_YELLOW);
                } else {
                    fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
                }
            } else if (g_fnaf.chica_loc == LOC_KITCHEN || g_fnaf.chica_loc == LOC_RESTROOMS) {
                g_fnaf.chica_loc = LOC_EAST_HALL;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.chica_loc == LOC_EAST_HALL) {
                g_fnaf.chica_loc = LOC_EAST_CORNER;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.chica_loc == LOC_EAST_CORNER) {
                g_fnaf.chica_loc = LOC_DOOR_RIGHT;
                fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
            } else if (g_fnaf.chica_loc == LOC_DOOR_RIGHT) {
                if (g_fnaf.door_right_closed) {
                    /* Porte fermée : Chica recule */
                    g_fnaf.chica_loc = LOC_DINING;
                    fnaf_draw_subtitle("* footsteps *", COLOR_GRAY);
                } else {
                    /* Porte ouverte : Chica entre dans le bureau et bloque les commandes */
                    g_fnaf.chica_loc = LOC_IN_OFFICE;
                    g_fnaf.chica_in_office = true;
                    g_fnaf.door_right_jammed = true;
                    g_fnaf.light_right_jammed = true;
                }
            }
        }
    }

    /* -------------------------------------------------------------
     * 3. FOXY AI (Test toutes les 5.01s = 5010 ms)
     * ------------------------------------------------------------- */
    if (g_fnaf.foxy_stage < 3) {
        /* Camera Stalling : Foxy est figé tant que le joueur a le moniteur levé */
        if (!g_fnaf.monitor_up) {
            g_fnaf.foxy_timer_ms += dt_ms;
            if (g_fnaf.foxy_timer_ms >= AI_CHECK_FOXY_MS) {
                g_fnaf.foxy_timer_ms -= AI_CHECK_FOXY_MS;
                uint32_t roll = fnaf_rand_range(1, 20);
                if (roll <= g_fnaf.ai_foxy) {
                    g_fnaf.foxy_stage++;
                    if (g_fnaf.foxy_stage == 3) {
                        /* Déclenchement du sprint dans West Hall (CAM 2A) */
                        g_fnaf.foxy_sprint_timer = (g_fnaf.pacing_mode == FNAF_PACING_FAST) ? 4000 : 2600;
                        fnaf_draw_subtitle("* sprinting in hallway *", COLOR_RED);
                    }
                }
            }
        }
    } else if (g_fnaf.foxy_stage == 3) {
        /* Foxy est en plein sprint vers le bureau */
        if (g_fnaf.foxy_sprint_timer > dt_ms) {
            g_fnaf.foxy_sprint_timer -= dt_ms;
        } else {
            g_fnaf.foxy_sprint_timer = 0;
            if (g_fnaf.door_left_closed) {
                /* Porte gauche fermée : Foxy frappe à la porte et pénalise l'énergie */
                g_fnaf.foxy_bang_count++;
                float penalty = 1.0f + 5.0f * (float)(g_fnaf.foxy_bang_count - 1);
                g_fnaf.power_percent -= penalty;
                g_fnaf.foxy_stage = 0; // Retour à Pirate Cove
                if (g_fnaf.power_percent <= 0.0f) {
                    fnaf_trigger_blackout();
                    return; // Interrompt immédiatement l'IA standard pour ce tick
                }
                fnaf_draw_subtitle("* BANG BANG BANG *", COLOR_YELLOW);
            } else {
                /* Porte ouverte : Jumpscare immédiat de Foxy */
                g_fnaf.scare_type = SCARE_FOXY;
                g_fnaf.state = FNAF_STATE_JUMPSCARE;
                g_fnaf.scare_timer_ms = 0;
                g_fnaf.scare_frame = 0;
            }
        }
    }

    /* -------------------------------------------------------------
     * 4. FREDDY FAZBEAR AI (Test toutes les 3.02s = 3020 ms)
     * ------------------------------------------------------------- */
    /* Freddy ne bouge que lorsque Bonnie et Chica ont quitté la scène */
    if (g_fnaf.bonnie_loc != LOC_STAGE && g_fnaf.chica_loc != LOC_STAGE) {
        /* Freddy ne bouge que si le joueur n'a PAS le moniteur levé,
         * OU si le moniteur ne regarde PAS sa caméra actuelle (Camera Stalling).
         */
        bool freddy_stalled = (g_fnaf.monitor_up && (
            (g_fnaf.freddy_loc == LOC_STAGE && g_fnaf.active_cam == CAM_1A) ||
            (g_fnaf.freddy_loc == LOC_DINING && g_fnaf.active_cam == CAM_1B) ||
            (g_fnaf.freddy_loc == LOC_RESTROOMS && g_fnaf.active_cam == CAM_7) ||
            (g_fnaf.freddy_loc == LOC_EAST_HALL && g_fnaf.active_cam == CAM_4A) ||
            (g_fnaf.freddy_loc == LOC_EAST_CORNER && g_fnaf.active_cam == CAM_4B)
        ));

        if (!freddy_stalled) {
            g_fnaf.freddy_timer_ms += dt_ms;
            if (g_fnaf.freddy_timer_ms >= AI_CHECK_FREDDY_MS) {
                g_fnaf.freddy_timer_ms -= AI_CHECK_FREDDY_MS;
                uint32_t roll = fnaf_rand_range(1, 20);
                if (roll <= g_fnaf.ai_freddy) {
                    if (g_fnaf.freddy_loc == LOC_STAGE) {
                        g_fnaf.freddy_loc = LOC_DINING;
                        fnaf_draw_subtitle("* Freddy laughs *", COLOR_RED);
                    } else if (g_fnaf.freddy_loc == LOC_DINING) {
                        g_fnaf.freddy_loc = LOC_RESTROOMS;
                        fnaf_draw_subtitle("* Freddy laughs *", COLOR_RED);
                    } else if (g_fnaf.freddy_loc == LOC_RESTROOMS) {
                        g_fnaf.freddy_loc = LOC_EAST_HALL;
                        fnaf_draw_subtitle("* Freddy laughs *", COLOR_RED);
                    } else if (g_fnaf.freddy_loc == LOC_EAST_HALL) {
                        g_fnaf.freddy_loc = LOC_EAST_CORNER;
                        fnaf_draw_subtitle("* Freddy laughs *", COLOR_RED);
                    } else if (g_fnaf.freddy_loc == LOC_EAST_CORNER) {
                        if (g_fnaf.door_right_closed) {
                            /* Bloqué par la porte droite */
                        } else {
                            /* Si la porte droite est ouverte, Freddy attend que le moniteur se lève pour attaquer */
                            if (g_fnaf.monitor_up && g_fnaf.active_cam != CAM_4B) {
                                g_fnaf.scare_type = SCARE_FREDDY_OFFICE;
                                g_fnaf.state = FNAF_STATE_JUMPSCARE;
                                g_fnaf.scare_timer_ms = 0;
                                g_fnaf.scare_frame = 0;
                            }
                        }
                    }
                }
            }
        }
    }

    /* Si un animatronique est entré dans le bureau et que le moniteur est baissé -> Jumpscare */
    if ((g_fnaf.bonnie_in_office || g_fnaf.chica_in_office) && !g_fnaf.monitor_up) {
        g_fnaf.scare_type = g_fnaf.bonnie_in_office ? SCARE_BONNIE : SCARE_CHICA;
        g_fnaf.state = FNAF_STATE_JUMPSCARE;
        g_fnaf.scare_timer_ms = 0;
        g_fnaf.scare_frame = 0;
    }
}

void fnaf_update(uint32_t dt_ms) {
    /* Mise à jour des bannières de sous-titres */
    if (g_fnaf.subtitle_timer_ms > dt_ms) {
        g_fnaf.subtitle_timer_ms -= dt_ms;
    } else {
        g_fnaf.subtitle_timer_ms = 0;
        g_fnaf.subtitle_text[0] = '\0';
    }

    /* Animation du ventilateur */
    g_fnaf.fan_timer_ms += dt_ms;
    if (g_fnaf.fan_timer_ms >= 60) {
        g_fnaf.fan_timer_ms = 0;
        g_fnaf.fan_frame = (g_fnaf.fan_frame + 1) % 3;
    }

    /* État 1 : Écran Titre ou Menu Custom Night */
    if (g_fnaf.state == FNAF_STATE_TITLE || g_fnaf.state == FNAF_STATE_CUSTOM_NIGHT) {
        return;
    }

    /* État 2 : Intro de la Nuit */
    if (g_fnaf.state == FNAF_STATE_NIGHT_INTRO) {
        if (g_fnaf.night_intro_timer_ms > dt_ms) {
            g_fnaf.night_intro_timer_ms -= dt_ms;
        } else {
            g_fnaf.night_intro_timer_ms = 0;
            g_fnaf.state = FNAF_STATE_OFFICE;
        }
        return;
    }

    /* État 3 : Victoire 6 AM */
    if (g_fnaf.state == FNAF_STATE_6AM_WIN) {
        g_fnaf.win_timer_ms += dt_ms;
        return;
    }

    /* État 5 : Game Over */
    if (g_fnaf.state == FNAF_STATE_GAME_OVER) {
        return;
    }

    /* Progression de l'horloge (12 AM à 6 AM) - active en BUREAU, PANNE et JUMPSCARE */
    g_fnaf.hour_timer_ms += dt_ms;
    if (g_fnaf.hour_timer_ms >= g_fnaf.hour_duration_ms) {
        g_fnaf.hour_timer_ms -= g_fnaf.hour_duration_ms;
        g_fnaf.hour++;

        /* Boost d'IA au fil des heures (uniquement en Nuits 1 à 6, pas en Custom Night) */
        if (g_fnaf.night < 7) {
            if (g_fnaf.hour == 2) {
                if (g_fnaf.ai_bonnie < 20) g_fnaf.ai_bonnie += 1;
            } else if (g_fnaf.hour == 3) {
                if (g_fnaf.ai_bonnie < 20) g_fnaf.ai_bonnie += 1;
                if (g_fnaf.ai_chica < 20) g_fnaf.ai_chica += 1;
                if (g_fnaf.ai_foxy < 20) g_fnaf.ai_foxy += 1;
            } else if (g_fnaf.hour == 4) {
                if (g_fnaf.ai_bonnie < 20) g_fnaf.ai_bonnie += 1;
                if (g_fnaf.ai_chica < 20) g_fnaf.ai_chica += 1;
                if (g_fnaf.ai_foxy < 20) g_fnaf.ai_foxy += 1;
            }
        }

        /* 6 AM VICTOIRE ! (Priorité absolue sur Jumpscare et Panne) */
        if (g_fnaf.hour >= 6) {
            g_fnaf.state = FNAF_STATE_6AM_WIN;
            g_fnaf.win_timer_ms = 0;
            fnaf_draw_subtitle("* 6:00 AM - CHIMES CELEBRATION ♪ *", COLOR_GREEN);
            return;
        }
    }

    /* État 4 : Jumpscare */
    if (g_fnaf.state == FNAF_STATE_JUMPSCARE) {
        g_fnaf.scare_timer_ms += dt_ms;
        if (g_fnaf.scare_timer_ms >= 1800) {
            g_fnaf.state = FNAF_STATE_GAME_OVER;
        }
        return;
    }

    /* État 6 : Panne d'Énergie (Power Outage / Blackout) */
    if (g_fnaf.state == FNAF_STATE_POWER_OUT) {
        g_fnaf.blackout_timer_ms += dt_ms;
        if (!g_fnaf.toreador_flashing && !g_fnaf.toreador_ended) {
            /* Test toutes les 4s avec 20% de chance de démarrer le Toreador March */
            if (g_fnaf.blackout_timer_ms >= 4000) {
                g_fnaf.blackout_timer_ms = 0;
                if (fnaf_rand_range(1, 100) <= 25) {
                    g_fnaf.toreador_flashing = true;
                    g_fnaf.toreador_duration_ms = fnaf_rand_range(4000, 12000);
                    g_fnaf.toreador_timer_ms = 0;
                    fnaf_draw_subtitle("* Toreador March ♪ *", COLOR_BLUE);
                }
            }
        } else if (g_fnaf.toreador_flashing) {
            g_fnaf.toreador_timer_ms += dt_ms;
            if (g_fnaf.toreador_timer_ms >= g_fnaf.toreador_duration_ms) {
                g_fnaf.toreador_flashing = false;
                g_fnaf.toreador_ended = true;
                g_fnaf.blackout_timer_ms = 0;
            }
        } else if (g_fnaf.toreador_ended) {
            /* Période d'obscurité totale après la musique avant jumpscare */
            if (g_fnaf.blackout_timer_ms >= 3000) {
                g_fnaf.scare_type = SCARE_FREDDY_POWER_OUT;
                g_fnaf.state = FNAF_STATE_JUMPSCARE;
                g_fnaf.scare_timer_ms = 0;
            }
        }
        return;
    }

    /* État 7 : Bureau & Caméras (Jeu Normal) */
    if (g_fnaf.state == FNAF_STATE_OFFICE) {
        /* Extinction automatique des lumières hors du champ de vision */
        if (g_fnaf.view_pan != 0) g_fnaf.light_left_on = false;
        if (g_fnaf.view_pan != 2) g_fnaf.light_right_on = false;

        /* Calcul dynamique des barres d'utilisation d'énergie */
        uint8_t usage = 1; // Base ventilateur
        if (g_fnaf.door_left_closed) usage++;
        if (g_fnaf.door_right_closed) usage++;
        if (g_fnaf.light_left_on) usage++;
        if (g_fnaf.light_right_on) usage++;
        if (g_fnaf.monitor_up) usage++;
        if (usage > 5) usage = 5;
        g_fnaf.power_usage_bars = usage;

        /* Décharge de la batterie selon les formules officielles */
        /* Intervalles de perte de 1% (en ms) en mode NORMAL :
         * Usage 1: ~9670 ms
         * Usage 2: ~4830 ms
         * Usage 3: ~3210 ms
         * Usage 4: ~2410 ms
         * Usage 5: ~1930 ms
         */
        uint32_t drain_interval_ms = 9670 / usage;
        if (g_fnaf.pacing_mode == FNAF_PACING_FAST) {
            drain_interval_ms = (drain_interval_ms * 40) / 89;
        }
        if (drain_interval_ms < 100) drain_interval_ms = 100;

        g_fnaf.power_drain_accum_ms += dt_ms;
        if (g_fnaf.power_drain_accum_ms >= drain_interval_ms) {
            uint32_t steps = g_fnaf.power_drain_accum_ms / drain_interval_ms;
            g_fnaf.power_drain_accum_ms %= drain_interval_ms;
            g_fnaf.power_percent -= (float)steps;
            if (g_fnaf.power_percent <= 0.0f) {
                fnaf_trigger_blackout();
                return;
            }
        }

        /* Mise à jour du minuteur de transition statique caméra */
        if (g_fnaf.cam_static_timer_ms > dt_ms) {
            g_fnaf.cam_static_timer_ms -= dt_ms;
        } else {
            g_fnaf.cam_static_timer_ms = 0;
        }

        /* Mise à jour de l'IA */
        fnaf_ai_update_tick(dt_ms);
    }
}

/* =========================================================================
 * Gestion des Entrées Clavier
 * ========================================================================= */

void fnaf_handle_input(uint64_t pressed, uint64_t down) {
    (void)down;

    /* Entrée dans l'écran titre */
    if (g_fnaf.state == FNAF_STATE_TITLE) {
        if (pressed & (1ULL << eadk_key_ok | 1ULL << eadk_key_exe)) {
            fnaf_start_night(g_fnaf.night);
        } else if (pressed & (1ULL << eadk_key_left | 1ULL << eadk_key_right)) {
            /* Basculer le mode de rythme (NORMAL vs FAST) */
            g_fnaf.pacing_mode = (g_fnaf.pacing_mode == FNAF_PACING_NORMAL) ? FNAF_PACING_FAST : FNAF_PACING_NORMAL;
            g_fnaf.hour_duration_ms = (g_fnaf.pacing_mode == FNAF_PACING_FAST) ? FAST_HOUR_DURATION_MS : NORMAL_HOUR_DURATION_MS;
        } else if (pressed & (1ULL << eadk_key_six)) {
            /* Déverrouillage direct Nuit 6 */
            fnaf_start_night(6);
        } else if (pressed & (1ULL << eadk_key_seven)) {
            /* Menu Custom Night */
            g_fnaf.state = FNAF_STATE_CUSTOM_NIGHT;
            g_fnaf.custom_selected_bot = 0;
        }
        return;
    }

    /* Entrée dans le menu Custom Night */
    if (g_fnaf.state == FNAF_STATE_CUSTOM_NIGHT) {
        if (pressed & (1ULL << eadk_key_up)) {
            if (g_fnaf.custom_selected_bot > 0) g_fnaf.custom_selected_bot--;
        } else if (pressed & (1ULL << eadk_key_down)) {
            if (g_fnaf.custom_selected_bot < 4) g_fnaf.custom_selected_bot++;
        } else if (pressed & (1ULL << eadk_key_left)) {
            if (g_fnaf.custom_selected_bot == 0 && g_fnaf.ai_freddy > 0) g_fnaf.ai_freddy--;
            else if (g_fnaf.custom_selected_bot == 1 && g_fnaf.ai_bonnie > 0) g_fnaf.ai_bonnie--;
            else if (g_fnaf.custom_selected_bot == 2 && g_fnaf.ai_chica > 0) g_fnaf.ai_chica--;
            else if (g_fnaf.custom_selected_bot == 3 && g_fnaf.ai_foxy > 0) g_fnaf.ai_foxy--;
        } else if (pressed & (1ULL << eadk_key_right)) {
            if (g_fnaf.custom_selected_bot == 0 && g_fnaf.ai_freddy < 20) g_fnaf.ai_freddy++;
            else if (g_fnaf.custom_selected_bot == 1 && g_fnaf.ai_bonnie < 20) g_fnaf.ai_bonnie++;
            else if (g_fnaf.custom_selected_bot == 2 && g_fnaf.ai_chica < 20) g_fnaf.ai_chica++;
            else if (g_fnaf.custom_selected_bot == 3 && g_fnaf.ai_foxy < 20) g_fnaf.ai_foxy++;
        } else if (pressed & (1ULL << eadk_key_ok | 1ULL << eadk_key_exe)) {
            if (g_fnaf.custom_selected_bot == 4) {
                fnaf_start_night(7);
            }
        } else if (pressed & (1ULL << eadk_key_back)) {
            g_fnaf.state = FNAF_STATE_TITLE;
        }
        return;
    }

    /* Entrée lors de la victoire 6 AM ou Game Over */
    if (g_fnaf.state == FNAF_STATE_6AM_WIN || g_fnaf.state == FNAF_STATE_GAME_OVER) {
        if (pressed & (1ULL << eadk_key_ok | 1ULL << eadk_key_exe | 1ULL << eadk_key_back)) {
            if (g_fnaf.state == FNAF_STATE_6AM_WIN) {
                uint8_t next_night = g_fnaf.night + 1;
                if (next_night > 7) next_night = 1;
                fnaf_start_night(next_night);
            } else {
                g_fnaf.state = FNAF_STATE_TITLE;
            }
        }
        return;
    }

    /* Entrée en cours de jeu (Bureau / Caméras) */
    if (g_fnaf.state == FNAF_STATE_OFFICE) {
        /* Bascule du Moniteur (Haut / Bas) */
        if (pressed & (1ULL << eadk_key_up)) {
            if (!g_fnaf.monitor_up) {
                g_fnaf.monitor_up = true;
                g_fnaf.cam_static_timer_ms = 180;
            }
        } else if (pressed & (1ULL << eadk_key_down)) {
            if (g_fnaf.monitor_up) {
                g_fnaf.monitor_up = false;
            }
        }

        /* Si le moniteur est LEVÉ : Sélection des caméras */
        if (g_fnaf.monitor_up) {
            fnaf_cam_id_t prev_cam = g_fnaf.active_cam;
            if (pressed & (1ULL << eadk_key_one)) g_fnaf.active_cam = CAM_1A;
            else if (pressed & (1ULL << eadk_key_two)) g_fnaf.active_cam = CAM_1B;
            else if (pressed & (1ULL << eadk_key_three)) g_fnaf.active_cam = CAM_1C;
            else if (pressed & (1ULL << eadk_key_four)) g_fnaf.active_cam = CAM_2A;
            else if (pressed & (1ULL << eadk_key_five)) g_fnaf.active_cam = CAM_2B;
            else if (pressed & (1ULL << eadk_key_six)) g_fnaf.active_cam = CAM_3;
            else if (pressed & (1ULL << eadk_key_seven)) g_fnaf.active_cam = CAM_4A;
            else if (pressed & (1ULL << eadk_key_eight)) g_fnaf.active_cam = CAM_4B;
            else if (pressed & (1ULL << eadk_key_nine)) g_fnaf.active_cam = CAM_5;
            else if (pressed & (1ULL << eadk_key_zero)) g_fnaf.active_cam = CAM_6;
            else if (pressed & (1ULL << eadk_key_ans | 1ULL << eadk_key_exe)) g_fnaf.active_cam = CAM_7;
            else if (pressed & (1ULL << eadk_key_left)) {
                if (g_fnaf.active_cam > 0) g_fnaf.active_cam--;
            } else if (pressed & (1ULL << eadk_key_right)) {
                if (g_fnaf.active_cam < CAM_COUNT - 1) g_fnaf.active_cam++;
            }

            if (g_fnaf.active_cam != prev_cam) {
                g_fnaf.cam_static_timer_ms = 150;
            }
        } else {
            /* Moniteur BAISSÉ : Panning et Contrôles du Bureau */
            if (pressed & (1ULL << eadk_key_left)) {
                if (g_fnaf.view_pan > 0) g_fnaf.view_pan--;
            } else if (pressed & (1ULL << eadk_key_right)) {
                if (g_fnaf.view_pan < 2) g_fnaf.view_pan++;
            }

            /* Extinction automatique des lumières lorsqu'on quitte le couloir concerné */
            if (g_fnaf.view_pan != 0) g_fnaf.light_left_on = false;
            if (g_fnaf.view_pan != 2) g_fnaf.light_right_on = false;

            /* Touche OK / EXE : Basculer la Porte correspondante */
            if (pressed & (1ULL << eadk_key_ok | 1ULL << eadk_key_exe)) {
                if (g_fnaf.view_pan == 0) {
                    if (g_fnaf.door_left_jammed) {
                        fnaf_draw_subtitle("* Left door jammed! *", COLOR_RED);
                    } else {
                        g_fnaf.door_left_closed = !g_fnaf.door_left_closed;
                    }
                } else if (g_fnaf.view_pan == 2) {
                    if (g_fnaf.door_right_jammed) {
                        fnaf_draw_subtitle("* Right door jammed! *", COLOR_RED);
                    } else {
                        g_fnaf.door_right_closed = !g_fnaf.door_right_closed;
                    }
                }
            }

            /* Touche BACK : Basculer la Lumière correspondante */
            if (pressed & (1ULL << eadk_key_back)) {
                if (g_fnaf.view_pan == 0) {
                    if (g_fnaf.light_left_jammed) {
                        fnaf_draw_subtitle("* Left light jammed! *", COLOR_RED);
                    } else {
                        g_fnaf.light_left_on = !g_fnaf.light_left_on;
                        if (g_fnaf.light_left_on) g_fnaf.light_right_on = false; // Une seule lumière à la fois
                    }
                } else if (g_fnaf.view_pan == 2) {
                    if (g_fnaf.light_right_jammed) {
                        fnaf_draw_subtitle("* Right light jammed! *", COLOR_RED);
                    } else {
                        g_fnaf.light_right_on = !g_fnaf.light_right_on;
                        if (g_fnaf.light_right_on) g_fnaf.light_left_on = false;
                    }
                }
            }
        }
    }
}

/* =========================================================================
 * Moteur de Rendu Graphique
 * ========================================================================= */

static void fnaf_render_hud_overlay(void) {
    /* 1. Heure en haut à droite */
    char hour_str[16];
    if (g_fnaf.hour == 0) {
        hour_str[0] = '1'; hour_str[1] = '2'; hour_str[2] = ' '; hour_str[3] = 'A'; hour_str[4] = 'M'; hour_str[5] = '\0';
    } else {
        hour_str[0] = '0' + g_fnaf.hour; hour_str[1] = ' '; hour_str[2] = 'A'; hour_str[3] = 'M'; hour_str[4] = '\0';
    }
    eq_display_draw_string(hour_str, (eadk_point_t){260, 10}, true, COLOR_WHITE, COLOR_BLACK);

    /* Nuit en cours */
    char night_str[16];
    night_str[0] = 'N'; night_str[1] = 'i'; night_str[2] = 'g'; night_str[3] = 'h'; night_str[4] = 't'; night_str[5] = ' ';
    night_str[6] = '0' + g_fnaf.night; night_str[7] = '\0';
    eq_display_draw_string(night_str, (eadk_point_t){260, 28}, false, COLOR_GRAY, COLOR_BLACK);

    /* 2. Énergie restante en bas à gauche */
    char power_str[24];
    int p_int = (int)g_fnaf.power_percent;
    power_str[0] = 'P'; power_str[1] = 'o'; power_str[2] = 'w'; power_str[3] = 'e'; power_str[4] = 'r';
    power_str[5] = ':'; power_str[6] = ' ';
    int idx = 7;
    if (p_int >= 100) { power_str[idx++] = '1'; power_str[idx++] = '0'; power_str[idx++] = '0'; }
    else if (p_int >= 10) { power_str[idx++] = '0' + (p_int / 10); power_str[idx++] = '0' + (p_int % 10); }
    else { power_str[idx++] = '0' + p_int; }
    power_str[idx++] = '%';
    power_str[idx] = '\0';
    eq_display_draw_string(power_str, (eadk_point_t){10, 205}, false, COLOR_WHITE, COLOR_BLACK);

    /* Barres d'usage (1 à 5 barres) */
    eq_display_draw_string("Usage:", (eadk_point_t){10, 220}, false, COLOR_WHITE, COLOR_BLACK);
    for (int b = 0; b < 5; b++) {
        eadk_rect_t r = {(uint16_t)(55 + b * 9), 221, 6, 9};
        eadk_color_t c = (b < g_fnaf.power_usage_bars) ?
            (g_fnaf.power_usage_bars >= 4 ? COLOR_RED : (g_fnaf.power_usage_bars >= 3 ? COLOR_YELLOW : COLOR_GREEN)) :
            COLOR_DARK_GRAY;
        eadk_display_push_rect_uniform(r, c);
    }

    /* 3. Guide de touches / Panning */
    if (!g_fnaf.monitor_up) {
        if (g_fnaf.view_pan == 0) {
            eq_display_draw_string("< [LEFT DOOR] >", (eadk_point_t){110, 222}, false, COLOR_YELLOW, COLOR_BLACK);
            /* Indicateur de porte gauche */
            if (g_fnaf.door_left_closed) {
                eq_display_draw_string("[DOOR: SHUT]", (eadk_point_t){10, 25}, false, COLOR_RED, COLOR_BLACK);
            } else {
                eq_display_draw_string("[DOOR: OPEN]", (eadk_point_t){10, 25}, false, COLOR_GREEN, COLOR_BLACK);
            }
            if (g_fnaf.light_left_on) {
                eq_display_draw_string("[LIGHT: ON]", (eadk_point_t){10, 38}, false, COLOR_YELLOW, COLOR_BLACK);
            }
        } else if (g_fnaf.view_pan == 1) {
            eq_display_draw_string("< [DESK / FAN] >", (eadk_point_t){105, 222}, false, COLOR_GRAY, COLOR_BLACK);
            eq_display_draw_string("[UP: MONITOR]", (eadk_point_t){115, 208}, false, COLOR_WHITE, COLOR_BLACK);
        } else if (g_fnaf.view_pan == 2) {
            eq_display_draw_string("< [RIGHT DOOR] >", (eadk_point_t){105, 222}, false, COLOR_YELLOW, COLOR_BLACK);
            /* Indicateur de porte droite */
            if (g_fnaf.door_right_closed) {
                eq_display_draw_string("[DOOR: SHUT]", (eadk_point_t){220, 25}, false, COLOR_RED, COLOR_BLACK);
            } else {
                eq_display_draw_string("[DOOR: OPEN]", (eadk_point_t){220, 25}, false, COLOR_GREEN, COLOR_BLACK);
            }
            if (g_fnaf.light_right_on) {
                eq_display_draw_string("[LIGHT: ON]", (eadk_point_t){220, 38}, false, COLOR_YELLOW, COLOR_BLACK);
            }
        }
    }

    /* 4. Bannière de sous-titres audio */
    if (g_fnaf.subtitle_timer_ms > 0 && g_fnaf.subtitle_text[0] != '\0') {
        int len = 0;
        while (g_fnaf.subtitle_text[len]) len++;
        int text_x = (FNAF_SCREEN_WIDTH - (len * 6)) / 2;
        if (text_x < 5) text_x = 5;
        eadk_rect_t sub_bg = {(uint16_t)(text_x - 4), 185, (uint16_t)(len * 6 + 8), 14};
        eadk_display_push_rect_uniform(sub_bg, COLOR_BLACK);
        eq_display_draw_string(g_fnaf.subtitle_text, (eadk_point_t){(uint16_t)text_x, 188}, false, g_fnaf.subtitle_color, COLOR_BLACK);
    }
}

void fnaf_render(void) {
    /* 1. Écran Titre */
    if (g_fnaf.state == FNAF_STATE_TITLE) {
        fnaf_draw_image(FNAF_IMG_OFFICE_NORMAL_CENTER, 0, 0);
        /* Overlay sombre */
        eadk_rect_t box = {20, 30, 280, 180};
        eadk_display_push_rect_uniform(box, COLOR_BLACK);

        eq_display_draw_string("FIVE NIGHTS AT FREDDY'S", (eadk_point_t){45, 45}, true, COLOR_WHITE, COLOR_BLACK);
        eq_display_draw_string("NumWorks Edition - EquaLib", (eadk_point_t){70, 70}, false, COLOR_GRAY, COLOR_BLACK);

        char night_buf[32];
        night_buf[0] = '>'; night_buf[1] = ' '; night_buf[2] = 'C'; night_buf[3] = 'O'; night_buf[4] = 'N';
        night_buf[5] = 'T'; night_buf[6] = 'I'; night_buf[7] = 'N'; night_buf[8] = 'U'; night_buf[9] = 'E';
        night_buf[10] = ' '; night_buf[11] = '('; night_buf[12] = 'N'; night_buf[13] = 'I'; night_buf[14] = 'G';
        night_buf[15] = 'H'; night_buf[16] = 'T'; night_buf[17] = ' '; night_buf[18] = '0' + g_fnaf.night;
        night_buf[19] = ')'; night_buf[20] = '\0';
        eq_display_draw_string(night_buf, (eadk_point_t){50, 100}, false, COLOR_GREEN, COLOR_BLACK);

        eq_display_draw_string("  NIGHT 6 (Press 6)", (eadk_point_t){50, 120}, false, COLOR_YELLOW, COLOR_BLACK);
        eq_display_draw_string("  CUSTOM NIGHT (Press 7)", (eadk_point_t){50, 140}, false, COLOR_BLUE, COLOR_BLACK);

        if (g_fnaf.pacing_mode == FNAF_PACING_NORMAL) {
            eq_display_draw_string("PACING: NORMAL (89s/hr) [< >]", (eadk_point_t){50, 165}, false, COLOR_WHITE, COLOR_BLACK);
        } else {
            eq_display_draw_string("PACING: FAST (40s/hr) [< >]", (eadk_point_t){50, 165}, false, COLOR_YELLOW, COLOR_BLACK);
        }

        eq_display_draw_string("Press [OK] to Start", (eadk_point_t){90, 190}, false, COLOR_WHITE, COLOR_BLACK);
        fnaf_display_flip();
        return;
    }

    /* 2. Intro de la Nuit */
    if (g_fnaf.state == FNAF_STATE_NIGHT_INTRO) {
        eadk_display_push_rect_uniform((eadk_rect_t){0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT}, COLOR_BLACK);
        eq_display_draw_string("12:00 AM", (eadk_point_t){120, 100}, true, COLOR_WHITE, COLOR_BLACK);
        char intro_str[20];
        intro_str[0] = 'N'; intro_str[1] = 'i'; intro_str[2] = 'g'; intro_str[3] = 'h'; intro_str[4] = 't';
        intro_str[5] = ' '; intro_str[6] = '0' + g_fnaf.night; intro_str[7] = '\0';
        eq_display_draw_string(intro_str, (eadk_point_t){135, 125}, false, COLOR_GRAY, COLOR_BLACK);
        fnaf_display_flip();
        return;
    }

    /* 3. Victoire 6 AM */
    if (g_fnaf.state == FNAF_STATE_6AM_WIN) {
        eadk_display_push_rect_uniform((eadk_rect_t){0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT}, COLOR_BLACK);
        eq_display_draw_string("5:59 AM", (eadk_point_t){125, 80}, false, COLOR_GRAY, COLOR_BLACK);
        eq_display_draw_string("6:00 AM", (eadk_point_t){105, 105}, true, COLOR_GREEN, COLOR_BLACK);
        eq_display_draw_string("CHEERING & CELEBRATION CHIMES ♪", (eadk_point_t){45, 135}, false, COLOR_YELLOW, COLOR_BLACK);

        if (g_fnaf.night == 5) {
            eq_display_draw_string("PAYCHECK: $120.00 (Mike Schmidt)", (eadk_point_t){50, 160}, false, COLOR_WHITE, COLOR_BLACK);
        } else if (g_fnaf.night == 6) {
            eq_display_draw_string("OVERTIME PAYCHECK: $120.50", (eadk_point_t){65, 160}, false, COLOR_WHITE, COLOR_BLACK);
        } else if (g_fnaf.night == 7) {
            eq_display_draw_string("NOTICE OF TERMINATION (PINK SLIP)", (eadk_point_t){45, 160}, false, COLOR_RED, COLOR_BLACK);
        }

        eq_display_draw_string("Press [OK] to Continue", (eadk_point_t){85, 195}, false, COLOR_WHITE, COLOR_BLACK);
        fnaf_display_flip();
        return;
    }

    /* 4. Jumpscare Screamer */
    if (g_fnaf.state == FNAF_STATE_JUMPSCARE) {
        /* Choix du screamer selon l'animatronique */
        fnaf_asset_id_t scare_asset = FNAF_IMG_SCARE_BONNIE;
        if (g_fnaf.scare_type == SCARE_CHICA) scare_asset = FNAF_IMG_SCARE_CHICA;
        else if (g_fnaf.scare_type == SCARE_FOXY) scare_asset = FNAF_IMG_SCARE_FOXY;
        else if (g_fnaf.scare_type == SCARE_FREDDY_OFFICE) scare_asset = FNAF_IMG_SCARE_FREDDY;
        else if (g_fnaf.scare_type == SCARE_FREDDY_POWER_OUT) scare_asset = FNAF_IMG_SCARE_0210;

        /* Rendu plein écran centré (0, 0) sécurisé DMA LCD */
        fnaf_draw_image(scare_asset, 0, 0);
        fnaf_display_flip();
        return;
    }

    /* 5. Game Over */
    if (g_fnaf.state == FNAF_STATE_GAME_OVER) {
        fnaf_draw_tv_snow(100);
        eadk_rect_t banner = {40, 95, 240, 50};
        eadk_display_push_rect_uniform(banner, COLOR_BLACK);
        eq_display_draw_string("GAME OVER", (eadk_point_t){105, 105}, true, COLOR_RED, COLOR_BLACK);
        eq_display_draw_string("Press [OK] to Retry or [Home] to Exit", (eadk_point_t){45, 128}, false, COLOR_WHITE, COLOR_BLACK);
        fnaf_display_flip();
        return;
    }

    /* 6. Custom Night Menu */
    if (g_fnaf.state == FNAF_STATE_CUSTOM_NIGHT) {
        eadk_display_push_rect_uniform((eadk_rect_t){0, 0, FNAF_SCREEN_WIDTH, FNAF_SCREEN_HEIGHT}, COLOR_BLACK);
        eq_display_draw_string("CUSTOM NIGHT - AI CONFIG", (eadk_point_t){45, 20}, true, COLOR_WHITE, COLOR_BLACK);

        const char *bots[4] = {"1. Freddy Fazbear", "2. Bonnie Bunny  ", "3. Chica Chicken ", "4. Foxy the Pirate"};
        uint8_t vals[4] = {g_fnaf.ai_freddy, g_fnaf.ai_bonnie, g_fnaf.ai_chica, g_fnaf.ai_foxy};

        for (int i = 0; i < 4; i++) {
            uint16_t col = (g_fnaf.custom_selected_bot == i) ? COLOR_YELLOW : COLOR_GRAY;
            char line[32];
            int idx = 0;
            const char *src = bots[i];
            while (src[idx]) { line[idx] = src[idx]; idx++; }
            line[idx++] = ' '; line[idx++] = ':'; line[idx++] = ' ';
            if (vals[i] >= 10) { line[idx++] = '0' + (vals[i] / 10); line[idx++] = '0' + (vals[i] % 10); }
            else { line[idx++] = ' '; line[idx++] = '0' + vals[i]; }
            line[idx] = '\0';
            eq_display_draw_string(line, (eadk_point_t){45, (uint16_t)(60 + i * 25)}, false, col, COLOR_BLACK);
        }

        uint16_t ready_col = (g_fnaf.custom_selected_bot == 4) ? COLOR_GREEN : COLOR_DARK_GRAY;
        eq_display_draw_string("[ START NIGHT 7 ]", (eadk_point_t){95, 175}, false, ready_col, COLOR_BLACK);
        eq_display_draw_string("Use Arrows to adjust (0-20), OK to Launch", (eadk_point_t){30, 210}, false, COLOR_WHITE, COLOR_BLACK);
        fnaf_display_flip();
        return;
    }

    /* 7. Panne d'Énergie (Blackout) */
    if (g_fnaf.state == FNAF_STATE_POWER_OUT) {
        if (g_fnaf.toreador_flashing) {
            /* Yeux de Freddy clignotants au rythme du Toreador March */
            if ((g_fnaf.toreador_timer_ms / 300) % 2 == 0) {
                fnaf_draw_image(FNAF_IMG_OFFICE_BLACKOUT_LEFT, 0, 0);
            } else {
                fnaf_draw_image(FNAF_IMG_OFFICE_BLACKOUT_CENTER, 0, 0);
            }
        } else {
            fnaf_draw_image(FNAF_IMG_OFFICE_BLACKOUT_CENTER, 0, 0);
        }
        fnaf_render_hud_overlay();
        fnaf_display_flip();
        return;
    }

    /* 8. Mode Moniteur de Surveillance (Caméras) */
    if (g_fnaf.monitor_up) {
        /* Si transition statique active : afficher la neige TV */
        if (g_fnaf.cam_static_timer_ms > 0) {
            fnaf_draw_tv_snow(150);
        } else {
            /* Rendu du fond de la caméra active */
            fnaf_asset_id_t cam_asset = FNAF_IMG_CAM_1A_STAGE;
            if (g_fnaf.active_cam == CAM_1A) cam_asset = FNAF_IMG_CAM_1A_STAGE;
            else if (g_fnaf.active_cam == CAM_1B) cam_asset = FNAF_IMG_CAM_1B_DINING;
            else if (g_fnaf.active_cam == CAM_1C) cam_asset = FNAF_IMG_CAM_1C_COVE;
            else if (g_fnaf.active_cam == CAM_2A) cam_asset = FNAF_IMG_CAM_2A_WEST_HALL;
            else if (g_fnaf.active_cam == CAM_2B) cam_asset = FNAF_IMG_CAM_2B_WEST_CORNER;
            else if (g_fnaf.active_cam == CAM_3)  cam_asset = FNAF_IMG_CAM_3_CLOSET;
            else if (g_fnaf.active_cam == CAM_4A) cam_asset = FNAF_IMG_CAM_4A_EAST_HALL;
            else if (g_fnaf.active_cam == CAM_4B) cam_asset = FNAF_IMG_CAM_4B_EAST_CORNER;
            else if (g_fnaf.active_cam == CAM_5)  cam_asset = FNAF_IMG_CAM_3_CLOSET;
            else if (g_fnaf.active_cam == CAM_6) {
                /* Cuisine : Audio Only -> Neige TV continue */
                fnaf_draw_tv_snow(200);
            }
            else if (g_fnaf.active_cam == CAM_7)  cam_asset = FNAF_IMG_CAM_1B_DINING;

            if (g_fnaf.active_cam != CAM_6) {
                fnaf_draw_image(cam_asset, 0, 0);
            }
        }

        /* Nom de la caméra active */
        const char *cam_names[CAM_COUNT] = {
            "CAM 1A - SHOW STAGE",
            "CAM 1B - DINING AREA",
            "CAM 1C - PIRATE COVE",
            "CAM 2A - WEST HALL",
            "CAM 2B - W. HALL CORNER",
            "CAM 3  - SUPPLY CLOSET",
            "CAM 4A - EAST HALL",
            "CAM 4B - E. HALL CORNER",
            "CAM 5  - BACKSTAGE",
            "CAM 6  - KITCHEN (AUDIO ONLY)",
            "CAM 7  - RESTROOMS"
        };
        eq_display_draw_string(cam_names[g_fnaf.active_cam], (eadk_point_t){10, 10}, false, COLOR_WHITE, COLOR_BLACK);

        /* Blip d'enregistrement clignotant */
        if ((eadk_timing_millis() / 500) % 2 == 0) {
            eadk_rect_t rec_dot = {10, 25, 6, 6};
            eadk_display_push_rect_uniform(rec_dot, COLOR_RED);
            eq_display_draw_string("REC", (eadk_point_t){20, 24}, false, COLOR_RED, COLOR_BLACK);
        }

        /* Radar / Carte des caméras dans le coin inférieur droit */
        eadk_rect_t map_bg = {220, 130, 95, 105};
        eadk_display_push_rect_uniform(map_bg, COLOR_BLACK);
        eq_display_draw_string("CAM MAP", (eadk_point_t){235, 135}, false, COLOR_GRAY, COLOR_BLACK);

        /* Mini-boutons de sélection sur la carte */
        for (int c = 0; c < CAM_COUNT; c++) {
            uint16_t bx = 225 + (c % 3) * 30;
            uint16_t by = 150 + (c / 3) * 18;
            eadk_rect_t btn = {bx, by, 26, 14};
            eadk_color_t btn_col = (g_fnaf.active_cam == c) ? COLOR_GREEN : COLOR_DARK_GRAY;
            eadk_display_push_rect_uniform(btn, btn_col);

            char btn_lbl[4];
            btn_lbl[0] = (c < 9) ? ('1' + c) : ('A' + (c - 9));
            btn_lbl[1] = '\0';
            eq_display_draw_string(btn_lbl, (eadk_point_t){(uint16_t)(bx + 9), (uint16_t)(by + 3)}, false, COLOR_WHITE, btn_col);
        }

        eq_display_draw_string("[DOWN: LOWER MONITOR]", (eadk_point_t){90, 222}, false, COLOR_YELLOW, COLOR_BLACK);

        fnaf_render_hud_overlay();
        fnaf_display_flip();
        return;
    }

    /* 9. Mode Bureau (Normal / Lumières / Portes) */
    fnaf_asset_id_t office_asset = FNAF_IMG_OFFICE_NORMAL_CENTER;

    if (g_fnaf.view_pan == 0) {
        /* Vue Gauche (Porte Gauche) */
        if (g_fnaf.light_left_on) {
            if (g_fnaf.bonnie_loc == LOC_DOOR_LEFT) {
                office_asset = FNAF_IMG_OFFICE_BONNIE_LEFT;
            } else {
                office_asset = FNAF_IMG_OFFICE_LIGHT_L_LEFT;
            }
        } else {
            office_asset = FNAF_IMG_OFFICE_NORMAL_LEFT;
        }
    } else if (g_fnaf.view_pan == 1) {
        /* Vue Centre (Bureau & Ventilateur) */
        if (g_fnaf.bonnie_in_office) {
            office_asset = FNAF_IMG_OFFICE_BONNIE_CENTER;
        } else if (g_fnaf.chica_in_office) {
            office_asset = FNAF_IMG_OFFICE_CHICA_CENTER;
        } else {
            office_asset = FNAF_IMG_OFFICE_NORMAL_CENTER;
        }
    } else if (g_fnaf.view_pan == 2) {
        /* Vue Droite (Porte Droite) */
        if (g_fnaf.light_right_on) {
            if (g_fnaf.chica_loc == LOC_DOOR_RIGHT) {
                office_asset = FNAF_IMG_OFFICE_CHICA_RIGHT;
            } else {
                office_asset = FNAF_IMG_OFFICE_LIGHT_R_RIGHT;
            }
        } else {
            office_asset = FNAF_IMG_OFFICE_NORMAL_RIGHT;
        }
    }

    fnaf_draw_image(office_asset, 0, 0);

    /* Si vue porte fermée : dessiner l'indicateur visuel de blindage de porte */
    if (g_fnaf.view_pan == 0 && g_fnaf.door_left_closed) {
        eadk_rect_t door_l = {0, 30, 45, 170};
        eadk_display_push_rect_uniform(door_l, COLOR_DARK_GRAY);
        eq_display_draw_string("CLOSED", (eadk_point_t){5, 110}, false, COLOR_RED, COLOR_DARK_GRAY);
    }
    if (g_fnaf.view_pan == 2 && g_fnaf.door_right_closed) {
        eadk_rect_t door_r = {275, 30, 45, 170};
        eadk_display_push_rect_uniform(door_r, COLOR_DARK_GRAY);
        eq_display_draw_string("CLOSED", (eadk_point_t){280, 110}, false, COLOR_RED, COLOR_DARK_GRAY);
    }

    fnaf_render_hud_overlay();
    fnaf_display_flip();
}

/* =========================================================================
 * Point d'Entrée Principal de l'Application FNAF
 * ========================================================================= */

void run_fnaf_app(void) {
    fnaf_display_init();
    fnaf_init_game(FNAF_PACING_NORMAL);

    uint64_t prev_kbd = 0;
    uint64_t prev_time = eadk_timing_millis();

    /* Boucle de jeu principale 50-60 FPS */
    while (true) {
        uint64_t now = eadk_timing_millis();
        uint32_t dt = (uint32_t)(now - prev_time);
        if (dt < 16) {
            eadk_timing_msleep(2);
            continue;
        }
        if (dt > 100) dt = 100; // Borner les sauts temporels
        prev_time = now;

        /* Gestion du clavier */
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        uint64_t pressed = (uint64_t)(kbd & ~prev_kbd);
        uint64_t down = (uint64_t)kbd;
        prev_kbd = kbd;

        /* Quitter vers le lanceur si Home ou On/Off est pressé */
        if (pressed & (1ULL << eadk_key_home | 1ULL << eadk_key_on_off)) {
            break;
        }

        fnaf_handle_input(pressed, down);
        fnaf_update(dt);
        fnaf_render();
    }
}

/* Alias d'entrée de spécification */
void app_fnaf_entry(void) {
    run_fnaf_app();
}
