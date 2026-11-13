#ifndef APP_FNAF_H
#define APP_FNAF_H

#include <stdint.h>
#include <stdbool.h>

/* =========================================================================
 * Five Nights at Freddy's 1 - Moteur Officiel Haute Fidélité pour NumWorks
 * 100% conforme aux formules algorithmiques et timings de Scott Cawthon
 * ========================================================================= */

#define FNAF_SCREEN_WIDTH   320
#define FNAF_SCREEN_HEIGHT  240

/* Caméras de surveillance */
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

/* Emplacements & États d'animatroniques */
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

/* État du jeu */
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

/* Types de jumpscare */
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
    uint8_t night;              // 1 à 7 (Nuit 1-5, Nuit 6, Nuit 7 Custom)
    uint8_t hour;               // 0 = 12 AM, 1 = 1 AM, ... 5 = 5 AM, 6 = 6 AM (Victoire)
    uint32_t hour_timer_ms;     // Horloge interne de progression de l'heure

    /* Batterie & Énergie */
    float power_percent;        // 100.0% à 0.0%
    uint8_t power_usage_bars;   // 1 à 5 barres (ventilateur + portes + lumières + écran)
    uint32_t power_drain_tick;  // Compteur ms pour le calcul de décharge

    /* Bureau */
    int8_t view_pan;            // 0: Regard Gauche (Porte G), 1: Centre (Bureau/Ventilo), 2: Droite (Porte D)
    float pan_smooth_x;         // Position X continue pour défilement fluide
    bool door_left_closed;
    bool door_right_closed;
    bool light_left_on;
    bool light_right_on;
    bool monitor_up;
    float monitor_anim_progress;// 0.0 (fermé) à 1.0 (ouvert)
    fnaf_cam_id_t active_cam;

    /* Niveaux d'IA (0 à 20) */
    uint8_t ai_freddy;
    uint8_t ai_bonnie;
    uint8_t ai_chica;
    uint8_t ai_foxy;

    /* Positions & Minuteurs des Animatroniques */
    fnaf_location_t bonnie_loc;
    uint32_t bonnie_timer_ms;   // Fréquence officielle Scott Cawthon: 4.97s

    fnaf_location_t chica_loc;
    uint32_t chica_timer_ms;    // Fréquence officielle Scott Cawthon: 4.98s

    uint8_t foxy_stage;         // 0: Caché, 1: Regarde, 2: Sorti, 3: En sprint vers le bureau
    uint32_t foxy_timer_ms;     // Fréquence officielle Scott Cawthon: 5.01s
    uint32_t foxy_sprint_timer; // ~2.5s pour fermer la porte gauche
    uint8_t foxy_bang_count;    // Compte des coups sur la porte (draine de plus en plus)

    fnaf_location_t freddy_loc;
    uint32_t freddy_timer_ms;   // Fréquence officielle Scott Cawthon: 3.02s

    /* Panne d'énergie */
    uint32_t blackout_timer;
    bool toreador_flashing;
    uint32_t toreador_flicker_timer;

    /* Jumpscare & Game Over */
    fnaf_scare_type_t scare_type;
    uint8_t scare_frame;
    uint32_t scare_timer_ms;

    /* Victoire 6 AM */
    uint32_t win_timer_ms;

    /* Ventilateur */
    uint8_t fan_frame;
    uint32_t fan_timer_ms;

    /* Générateur pseudo-aléatoire XorShift pour neige TV en temps réel */
    uint32_t rng_state;

    /* Menu Custom Night */
    uint8_t custom_selected_bot; // 0: Freddy, 1: Bonnie, 2: Chica, 3: Foxy, 4: READY

} fnaf_game_t;

/* Lancement de l'application Five Nights at Freddy's */
void run_fnaf_app(void);

#endif // APP_FNAF_H