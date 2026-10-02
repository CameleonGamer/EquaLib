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
3. **Simulation du Mode Examen** : fait clignoter la LED rouge à 1 Hz et affiche l'indicateur d'examen officiel avec une **touche de panique furtive** pour basculer instantanément sur un écran de calcul standard en cas de vérification.

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
│   │   ├── dispatcher.c  # Moteur de saut d'exécution vers les sous-applications
│   │   ├── exam_sim.c    # Simulation du mode examen (LED 1Hz & écran furtif)
│   │   └── ui.c          # Rendu graphique haute fidélité style NumWorks
│   ├── include/
│   │   ├── equalib_bundle.h # Spécification du format binaire du bundle
│   │   ├── eadk.h        # En-têtes EADK NumWorks
│   │   ├── exam_sim.h
│   │   ├── dispatcher.h
│   │   └── ui.h
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
| **Activer / Désactiver la simulation LED Examen (1 Hz)** | Touche `Toolbox` |
| **Mode Panique Furtif (Calculatrice de secours)** | **Touche `Var`** (accessible instantanément depuis n'importe quelle app ou jeu) ou **Double appui rapide sur `Back`** |
| **Sortir du Mode Panique Furtif** | **Touche `Var`** (bascule immédiate) ou `Shift` + `Home` / `Toolbox` + `Back` |

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
