# EquaLib 📚⚡

> **Bibliothèque Multi-Applications et Hub Lanceur pour calculatrices NumWorks (Spécialement optimisé pour la N0120 et N0110)**

![NumWorks N0120 Ready](https://img.shields.io/badge/NumWorks-N0120%20(STM32H725)-FFBB00?style=for-the-badge&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![GitHub Pages](https://img.shields.io/badge/Web_Studio-GitHub_Pages-brightgreen?style=for-the-badge)

---

## 🚀 Le Problème Résolu

Sur le système officiel **Epsilon** (particulièrement sur la **NumWorks N0120** dont le bootloader est verrouillé contre les systèmes personnalisés comme Omega ou Upsilon) :
* NumWorks restreint l'installation à **une seule application externe à la fois** (`.nwa`). Chaque nouvelle installation écrase la précédente.
* Le passage en mode examen officiel purge immédiatement les applications tierces.

**EquaLib** résout définitivement ce problème :
1. **Un hub multi-applications** qui occupe l'unique slot externe et permet de lancer jusqu'à 12 sous-applications (KhiCAS, tableau périodique, fiches de révision, émulateurs rétro).
2. **Une interface Web moderne (GitHub Pages)** avec catalogue d'applications, téléversement direct via **WebUSB** et export de fichiers `.nwa` / `.nws`.
3. **Écosystème NumWorks N0120** : architecture modulaire native ARM Cortex-M7 @ 550 MHz avec support EADK, jeux 60 FPS, formulaires scientifiques et calcul matriciel.

---

## 🛠️ Structure du Projet

```text
EquaLib/
├── web/                  # 🌐 Interface Web (Prête pour GitHub Pages)
│   ├── index.html        # Interface Studio (Catalogue, Import, Flasher)
│   ├── app.js            # Contrôleur d'interface & gestion du pack
│   ├── bundler.js        # Moteur d'assemblage binaire client-side (.nwa / .nws)
│   ├── webusb.js         # Pilote de transfert direct WebUSB (N0120 / N0110)
│   └── catalog.json      # Catalogue des applications populaires
│
├── launcher/             # 📟 Application embarquée pour la calculatrice (C/C++)
│   ├── src/
│   │   ├── main.c        # Boucle principale et détection des touches
│   │   ├── app_mariokart.c # Super Mario Kart 3D Mode 7
│   │   ├── app_courses.c # Fiches de cours et formulaires
│   │   ├── app_periodic.c# Tableau périodique des éléments
│   │   ├── app_math_tools.c # Résolution d'équations 2nd degré
│   │   ├── app_flappy.c  # Jeu Flappy Bird 60 FPS
│   │   ├── app_2048.c    # Jeu 2048 Ultimate 60 FPS
│   │   ├── app_snake.c   # Jeu Snake Classic 60 FPS
│   │   ├── app_tetris.c  # Jeu Tetris 60 FPS
│   │   └── app_minesweeper.c # Démineur 60 FPS
│   ├── include/
│   │   ├── equalib_bundle.h # Spécification du format binaire du bundle
│   │   ├── eadk.h        # En-têtes EADK NumWorks
│   │   └── apps.h        # Prototypes des applications
│   └── Makefile          # Compilation Cortex-M7 (STM32H725)
│
└── README.md
```

---

## 🌐 Déploiement sur GitHub Pages

L'interface web dans le dossier `web/` est **100% statique** (aucun serveur requis). Toutes les opérations de fusion binaire et de communication WebUSB s'exécutent directement dans votre navigateur.

### Étapes pour publier sur GitHub Pages :
1. Créez un dépôt GitHub et poussez le code :
   ```bash
   git init
   git add .
   git commit -m "Initial commit of EquaLib"
   git remote add origin https://github.com/<votre-pseudo>/EquaLib.git
   git branch -M main
   git push -u origin main
   ```
2. Rendez-vous dans les paramètres de votre dépôt sur GitHub :
   * **Settings** > **Pages**
   * Sous **Build and deployment** :
     * Source : `Deploy from a branch`
     * Branch : `main` / dossier `/web` (ou déployez la racine si vous configurez une GitHub Action).
3. Votre site sera disponible en ligne à l'adresse : `https://<votre-pseudo>.github.io/EquaLib/` !

---

## 🎮 Utilisation sur la Calculatrice (N0120)

| Action | Raccourci Clavier |
| :--- | :--- |
| **Naviguer dans les applications** | Touches directionnelles `←` `↑` `↓` `→` |
| **Lancer l'application sélectionnée** | Touche `OK` ou `EXE` |
| **Quitter l'application et revenir au hub** | Touche `Back` |
| **Retour à Epsilon (Calculatrice native)** | Touche `Home` ou double appui sur `Back` depuis le Hub |

---

## 🔨 Compilation du Runner (Optionnel / Développeurs)

Pour recompiler le binaire de base du lanceur depuis les sources C :
```bash
cd launcher
make
```
*Le Makefile cible spécifiquement l'architecture ARM Cortex-M7 de la NumWorks N0120 (`-mcpu=cortex-m7 -mfpu=fpv5-d16 -mfloat-abi=hard`).*

---

## 👥 Contributeurs & Auteurs

* **[CameleonGamer](https://github.com/CameleonGamer)** — Créateur, Lead Developer & Conception du Projet
* **Gemini (Google DeepMind)** — Pair Programming, architecture système bas-niveau Cortex-M7 (N0120), compilation EADK / freestanding libc, et interface EquaLib Studio

---

## ⚖️ Avertissement Légal & Éthique
Ce projet est conçu à des fins éducatives et de recherche sur le matériel embarqué. L'utilisation de fonctionnalités de contournement ou de simulation lors d'épreuves officielles est soumise aux règlements des examens nationaux.
