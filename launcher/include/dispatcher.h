#ifndef EQUALIB_DISPATCHER_H
#define EQUALIB_DISPATCHER_H

#include "equalib_bundle.h"
#include <stdbool.h>

/**
 * @brief Initialise le gestionnaire de dispatch en scannant la mémoire flash
 * @param out_header Pointeur de réception de l'en-tête du bundle
 * @param out_apps Tableau de réception des métadonnées des applications
 * @return true si un bundle EquaLib valide a été détecté
 */
bool dispatcher_init(equalib_header_t * out_header, equalib_app_entry_t * out_apps);

/**
 * @brief Exécute une sous-application à partir de son index
 * @param app_index Index de l'application dans la table
 * @return Code de retour de l'application
 */
int dispatcher_launch_app(int app_index);

#endif // EQUALIB_DISPATCHER_H
