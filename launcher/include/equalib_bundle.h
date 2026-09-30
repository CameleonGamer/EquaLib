#ifndef EQUALIB_BUNDLE_H
#define EQUALIB_BUNDLE_H

#include <stdint.h>
#include <stdbool.h>

#define EQUALIB_MAGIC_0 0x4C415145 // "EQAL" in little endian
#define EQUALIB_MAGIC_1 0x31304249 // "IB01" in little endian

#define EQUALIB_FLAG_SIMULATE_EXAM   (1 << 0)
#define EQUALIB_FLAG_PANIC_ENABLED   (1 << 1)
#define EQUALIB_FLAG_STEALTH_DEFAULT (1 << 2)

#define MAX_APP_NAME_LEN 32
#define MAX_BUNDLE_APPS  16

#pragma pack(push, 1)

/**
 * @brief En-tête principal du bundle EquaLib
 */
typedef struct {
  uint32_t magic_0;             // "EQAL"
  uint32_t magic_1;             // "IB01"
  uint32_t version;             // Version du format (1)
  uint32_t app_count;           // Nombre de sous-applications embarquées
  uint32_t flags;               // Drapeaux globaux (simulation examen, panic key, etc.)
  uint32_t exam_blink_period_ms;// Période de clignotement LED (ex: 1000 ms)
  uint32_t panic_key;           // Code touche d'urgence (ex: Back x2)
  uint32_t total_bundle_size;   // Taille totale du bundle en octets
  uint32_t reserved[8];         // Extension future
} equalib_header_t;

/**
 * @brief Métadonnées d'une sous-application
 */
typedef struct {
  char name[MAX_APP_NAME_LEN];  // Nom affiché (ex: "KhiCAS", "Tableau Périodique")
  uint32_t binary_offset;       // Offset absolu du binaire exécutable dans le bundle
  uint32_t binary_size;         // Taille du binaire exécutable en octets
  uint32_t icon_offset;         // Offset des données graphiques de l'icône (55x56)
  uint32_t icon_size;           // Taille des données icône
  uint32_t entrypoint_offset;   // Offset relatif de la fonction d'entrée (main)
  uint32_t flags;               // Drapeaux spécifiques à l'application
  uint32_t reserved[2];
} equalib_app_entry_t;

#pragma pack(pop)

#endif // EQUALIB_BUNDLE_H
