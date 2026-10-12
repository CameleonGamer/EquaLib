#include "equalib_manifest.h"

const equalib_manifest_t g_equalib_manifest __attribute__((used, aligned(4), section(".rodata.equalib_manifest"))) = {
    .magic = EQUALIB_MANIFEST_MAGIC,
    .version = 1,
    .app_count = 16,
    .flags = MANIFEST_FLAG_GLASS_MODE | MANIFEST_FLAG_SMOOTH_CORNERS,
    .wallpaper_offset = 0,
    .wallpaper_size = 0,
    .apps = {
        {"mariokart", "1. Mario Kart", "Jeu / Arcade", "Course Mode 7 3D complete pour N0120", APP_TYPE_MARIOKART, {0,0,0}, 0, 0},
        {"periodique", "2. Tableau Periodique", "Chimie", "118 elements, masses et configurations", APP_TYPE_PERIODIC, {0,0,0}, 0, 0},
        {"fiches", "3. Fiches de Cours", "Revision", "Formulaires Maths, Physique et Chimie", APP_TYPE_COURSES, {0,0,0}, 0, 0},
        {"math_solver", "4. Solveur de Maths", "Algebre", "Polynomes 2nd degre, racines et outils", APP_TYPE_MATH_TOOLS, {0,0,0}, 0, 0},
        {"flappy", "5. Flappy Bird", "Jeu / Arcade", "Flappy Bird en C natif fluide a 60 FPS", APP_TYPE_FLAPPY, {0,0,0}, 0, 0},
        {"2048", "6. 2048 Ultimate", "Jeu / Arcade", "Casse-tete 2048 en C natif 60 FPS", APP_TYPE_2048, {0,0,0}, 0, 0},
        {"snake", "7. Snake Classic", "Jeu / Retro", "Serpent retro en C natif 60 FPS", APP_TYPE_SNAKE, {0,0,0}, 0, 0},
        {"tetris", "8. Tetris Master", "Jeu / Puzzle", "Tetris complet 7 pieces en C 60 FPS", APP_TYPE_TETRIS, {0,0,0}, 0, 0},
        {"demineur", "9. Demineur", "Jeu / Logique", "Demineur grille 9x9 avec drapeaux", APP_TYPE_MINESWEEPER, {0,0,0}, 0, 0},
        {"pong", "10. Pong Arcade", "Jeu / Retro", "Pong 60 FPS raquette vs IA fluide", APP_TYPE_PONG, {0,0,0}, 0, 0},
        {"dino", "11. Chrome Dino", "Jeu / Runner", "Dino runner T-Rex 60 FPS saut et obstacles", APP_TYPE_DINO, {0,0,0}, 0, 0},
        {"invaders", "12. Space Invaders", "Jeu / Arcade", "Space Invaders retro tirs et boucliers", APP_TYPE_SPACE_INVADERS, {0,0,0}, 0, 0},
        {"breakout", "13. Casse-Briques", "Jeu / Arcade", "Casse-briques retro paddle et rebonds", APP_TYPE_BREAKOUT, {0,0,0}, 0, 0},
        {"puissance4", "14. Puissance 4", "Jeu / Tactique", "Puissance 4 en C natif grille 7x6 et IA Minimax", APP_TYPE_PUISSANCE4, {0,0,0}, 0, 0},
        {"morpion", "15. Morpion (Tic-Tac-Toe)", "Jeu / Tactique", "Morpion en C natif grille 3x3 et IA Minimax", APP_TYPE_MORPION, {0,0,0}, 0, 0},
        {"settings", "16. Options & Themes", "Systeme", "Themes, mode galerie/liste et aide", APP_TYPE_SETTINGS, {0,0,0}, 0, 0}
    }
};
