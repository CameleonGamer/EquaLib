/* =========================================================================
 * Five Nights at Freddy's (FNAF) 1 - Moteur Haute Fidélité pour NumWorks
 * Conforme aux algorithmes de Scott Cawthon & au port TI-84 Plus CE
 * ========================================================================= */

#ifndef APP_FNAF_H
#define APP_FNAF_H

#include <stdint.h>
#include <stdbool.h>
#include "fnaf_assets.h"

#define APP_TYPE_FNAF 21

#define FNAF_SCREEN_WIDTH   320
#define FNAF_SCREEN_HEIGHT  240

/* Modes de rythme (Pacing) */
typedef enum {
    FNAF_PACING_NORMAL = 0, // 89.16s par heure (Scott Cawthon authentique, ~8:55 la nuit)
    FNAF_PACING_FAST   = 1  // 40.0s par heure (Rythme rapide calculatrice, 4:00 la nuit)
} fnaf_pacing_mode_t;

/* Caméras de surveillance (11 caméras) */
typedef enum {
    CAM_1A = 0, // Show Stage (Scène)
    CAM_1B,     // Dining Area (Salle à manger)
    CAM_1C,     // Pirate Cove (Crique Pirate de Foxy)
    CAM_2A,     // West Hall (Couloir Ouest)
    CAM_2B,     // West Hall Corner (Coin Couloir Ouest)
    CAM_3,      // Supply Closet (Placard à balais)
    CAM_4A,     // East Hall (Couloir Est)
    CAM_4B,     // East Hall Corner (Coin Couloir Est)
    CAM_5,      // Backstage (Coulisses)
    CAM_6,      // Kitchen (Cuisine - Audio Only)
    CAM_7,      // Restrooms (Toilettes)
    CAM_COUNT
} fnaf_cam_id_t;

/* Emplacements & Salles des Animatroniques */
typedef enum {
    LOC_STAGE = 0,
    LOC_DINING,
    LOC_BACKSTAGE,
    LOC_RESTROOMS,
    LOC_KITCHEN,
    LOC_WEST_HALL,
    LOC_WEST_CORNER,
    LOC_EAST_HALL,
    LOC_EAST_CORNER,
    LOC_SUPPLY_CLOSET,
    LOC_DOOR_LEFT,
    LOC_DOOR_RIGHT,
    LOC_IN_OFFICE
} fnaf_location_t;

/* États généraux du jeu */
typedef enum {
    FNAF_STATE_TITLE = 0,
    FNAF_STATE_NIGHT_INTRO,
    FNAF_STATE_OFFICE,
    FNAF_STATE_POWER_OUT,
    FNAF_STATE_JUMPSCARE,
    FNAF_STATE_GAME_OVER,
    FNAF_STATE_6AM_WIN,
    FNAF_STATE_CUSTOM_NIGHT
} fnaf_game_state_t;

/* Types de Jumpscare */
typedef enum {
    SCARE_NONE = 0,
    SCARE_BONNIE,
    SCARE_CHICA,
    SCARE_FOXY,
    SCARE_FREDDY_OFFICE,
    SCARE_FREDDY_POWER_OUT
} fnaf_scare_type_t;

/* Structure complète de l'état de jeu FNAF */
typedef struct {
    fnaf_game_state_t state;
    fnaf_pacing_mode_t pacing_mode;
    uint8_t night;              // 1 à 7 (Nuits 1-5, Nuit 6, Nuit 7 Custom)
    uint8_t hour;               // 0 = 12 AM, 1 = 1 AM, ... 5 = 5 AM, 6 = 6 AM (Victoire)
    uint32_t hour_timer_ms;     // Horloge interne de progression de l'heure
    uint32_t hour_duration_ms;  // 89166 ms (NORMAL) ou 40000 ms (FAST)

    /* Batterie & Énergie */
    float power_percent;        // 100.0% à 0.0%
    uint8_t power_usage_bars;   // 1 à 5 barres
    uint32_t power_drain_accum_ms;

    /* Bureau */
    int8_t view_pan;            // 0: Regard Gauche (Porte G), 1: Centre (Bureau/Ventilo), 2: Droite (Porte D)
    bool door_left_closed;
    bool door_right_closed;
    bool light_left_on;
    bool light_right_on;
    bool door_left_jammed;
    bool door_right_jammed;
    bool light_left_jammed;
    bool light_right_jammed;

    /* Moniteur de Surveillance */
    bool monitor_up;
    fnaf_cam_id_t active_cam;
    uint32_t cam_static_timer_ms;

    /* Niveaux d'IA (0 à 20) */
    uint8_t ai_freddy;
    uint8_t ai_bonnie;
    uint8_t ai_chica;
    uint8_t ai_foxy;

    /* Positions & Minuteurs des Animatroniques */
    fnaf_location_t bonnie_loc;
    uint32_t bonnie_timer_ms;   // Fréquence officielle: 4.97s (4970 ms)
    bool bonnie_in_office;

    fnaf_location_t chica_loc;
    uint32_t chica_timer_ms;    // Fréquence officielle: 4.98s (4980 ms)
    bool chica_in_office;

    uint8_t foxy_stage;         // 0: Rideau fermé, 1: Regarde, 2: Sorti, 3: En sprint
    uint32_t foxy_timer_ms;     // Fréquence officielle: 5.01s (5010 ms)
    uint32_t foxy_sprint_timer; // Temps imparti pour fermer la porte gauche
    uint8_t foxy_bang_count;    // Compteur de frappes (pénalité 1% + 5%*(N-1))

    fnaf_location_t freddy_loc;
    uint32_t freddy_timer_ms;   // Fréquence officielle: 3.02s (3020 ms)

    /* Panne d'énergie (Blackout) */
    uint32_t blackout_timer_ms;
    bool toreador_flashing;
    uint32_t toreador_timer_ms;
    uint32_t toreador_duration_ms;
    bool toreador_ended;

    /* Jumpscare & Game Over */
    fnaf_scare_type_t scare_type;
    uint8_t scare_frame;
    uint32_t scare_timer_ms;

    /* Victoire 6 AM */
    uint32_t win_timer_ms;

    /* Ventilateur */
    uint8_t fan_frame;
    uint32_t fan_timer_ms;

    /* Générateur pseudo-aléatoire XorShift32 */
    uint32_t rng_state;

    /* Bannières de sous-titres sonores */
    char subtitle_text[48];
    uint16_t subtitle_color;
    uint32_t subtitle_timer_ms;

    /* Menu Custom Night */
    uint8_t custom_selected_bot; // 0: Freddy, 1: Bonnie, 2: Chica, 3: Foxy, 4: READY

    /* Écran d'intro de nuit */
    uint32_t night_intro_timer_ms;

} fnaf_game_t;

extern fnaf_game_t g_fnaf;

/* Contrat Display Subsystem */
void fnaf_display_init(void);
void fnaf_draw_image(fnaf_asset_id_t asset_id, int16_t dst_x, int16_t dst_y);
void fnaf_draw_tv_snow(uint16_t intensity);
void fnaf_draw_subtitle(const char *text, uint16_t color_rgb565);
void fnaf_display_flip(void);

/* Contrat Application Entry */
void run_fnaf_app(void);
void app_fnaf_entry(void);

/* Moteur de jeu */
void fnaf_init_game(fnaf_pacing_mode_t pacing);
void fnaf_start_night(uint8_t night);
void fnaf_update(uint32_t dt_ms);
void fnaf_render(void);
void fnaf_handle_input(uint64_t pressed_keys, uint64_t down_keys);

#endif /* APP_FNAF_H */
