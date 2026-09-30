#ifndef EQUALIB_EXAM_SIM_H
#define EQUALIB_EXAM_SIM_H

#include "eadk.h"
#include <stdbool.h>

/**
 * @brief Initialise le sous-système de simulation du mode examen
 */
void exam_sim_init(void);

/**
 * @brief Met à jour l'état de la LED matérielle et du timing
 * @param now_ms Timestamp courant en millisecondes
 */
void exam_sim_tick(uint32_t now_ms);

/**
 * @brief Active ou désactive la simulation du mode examen
 */
void exam_sim_set_active(bool active);

/**
 * @brief Vérifie si la simulation est actuellement en cours
 */
bool exam_sim_is_active(void);

/**
 * @brief Lance l'écran de calcul factice avec mode examen actif et LED clignotante
 *        Permet de simuler une calculatrice en plein examen officiel.
 *        Retourne au launcher via une combinaison secrète.
 */
void exam_sim_run_stealth_calculator(void);

/**
 * @brief Contrôle bas-niveau direct de la LED RVB
 * @param r Composante rouge (0 ou 1)
 * @param g Composante verte (0 ou 1)
 * @param b Composante bleue (0 ou 1)
 */
void exam_sim_set_hardware_led(bool r, bool g, bool b);

#endif // EQUALIB_EXAM_SIM_H
