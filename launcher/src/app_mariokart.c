#include <eadk.h>
#include "apps.h"
#include "smk_game.h"
#include "smk_renderer.h"

static smk_game_t s_game;

void run_mariokart_app(void) {
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    smk_renderer_init();
    smk_game_init(&s_game);

    /* Enregistre l'etat initial du clavier */
    eadk_keyboard_state_t init_kbd = eadk_keyboard_scan();
    s_game.prev_input.ok_pressed = eadk_keyboard_key_down(init_kbd, eadk_key_ok) || eadk_keyboard_key_down(init_kbd, eadk_key_exe);
    s_game.prev_input.up = eadk_keyboard_key_down(init_kbd, eadk_key_up);
    s_game.prev_input.down = eadk_keyboard_key_down(init_kbd, eadk_key_down);
    s_game.prev_input.left = eadk_keyboard_key_down(init_kbd, eadk_key_left);
    s_game.prev_input.right = eadk_keyboard_key_down(init_kbd, eadk_key_right);
    s_game.prev_input.back_pressed = eadk_keyboard_key_down(init_kbd, eadk_key_back);

    bool prev_tb_key = false;

    while (true) {
        uint64_t now = eadk_timing_millis();
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();

        /* Mode Panique Furtif universel direct depuis Mario Kart via [Var] */
        if (eadk_keyboard_key_down(kbd, eadk_key_var)) {
            run_panic_calculator();
            while (eadk_keyboard_scan() != 0) {
                eadk_timing_msleep(20);
            }
            break; // Sortie sécurisée vers le Hub
        }

        /* Quitter Mario Kart et revenir au menu EquaLib avec Back depuis le menu titre */
        if (eadk_keyboard_key_down(kbd, eadk_key_home) ||
            eadk_keyboard_key_down(kbd, eadk_key_on_off) ||
            (s_game.state == GAME_STATE_TITLE && eadk_keyboard_key_down(kbd, eadk_key_back) && !s_game.prev_input.back_pressed && s_game.title_debounce == 0)) {
            break;
        }

        /* Mapping des entrees pour le clavier NumWorks */
        smk_input_t input = {0};

        bool raw_up = eadk_keyboard_key_down(kbd, eadk_key_up);
        bool raw_down = eadk_keyboard_key_down(kbd, eadk_key_down);
        bool raw_left = eadk_keyboard_key_down(kbd, eadk_key_left);
        bool raw_right = eadk_keyboard_key_down(kbd, eadk_key_right);
        bool raw_ok = eadk_keyboard_key_down(kbd, eadk_key_ok) || eadk_keyboard_key_down(kbd, eadk_key_exe);
        bool raw_back = eadk_keyboard_key_down(kbd, eadk_key_back);

        input.up = raw_up;
        input.down = raw_down;
        input.left = raw_left;
        input.right = raw_right;
        input.steer_left = raw_left;
        input.steer_right = raw_right;

        /* En course : Haut ou OK/EXE accelere ; Bas ou Back freine */
        input.accelerate = raw_up || raw_ok;
        input.brake = raw_down || raw_back;

        input.ok_pressed = raw_ok;
        input.back_pressed = raw_back;

        input.hop_drift = eadk_keyboard_key_down(kbd, eadk_key_shift) ||
                          eadk_keyboard_key_down(kbd, eadk_key_right_parenthesis) ||
                          eadk_keyboard_key_down(kbd, eadk_key_nine);

        input.use_item = eadk_keyboard_key_down(kbd, eadk_key_multiplication) ||
                         eadk_keyboard_key_down(kbd, eadk_key_backspace) ||
                         eadk_keyboard_key_down(kbd, eadk_key_plus) ||
                         eadk_keyboard_key_down(kbd, eadk_key_division);

        /* Basculer la minimap avec [Toolbox] */
        bool cur_tb_key = eadk_keyboard_key_down(kbd, eadk_key_toolbox);
        if (cur_tb_key && !prev_tb_key) {
            s_game.show_minimap = !s_game.show_minimap;
        }
        prev_tb_key = cur_tb_key;

        /* Mise a jour physique et IA */
        smk_game_update(&s_game, &input, (uint32_t)now);

        /* Rendu par bandes pour economiser la RAM de la calculatrice */
        for (int b = 0; b < NUM_BANDS; b++) {
            int band_y = b * RENDER_BAND_HEIGHT;
            smk_game_render_band(&s_game, band_y);
            eadk_display_push_rect((eadk_rect_t){0, (uint16_t)band_y, SCREEN_WIDTH, RENDER_BAND_HEIGHT}, smk_framebuffer);
        }

        /* 60 FPS (16.6 ms par frame) */
        uint64_t elapsed = eadk_timing_millis() - now;
        if (elapsed < 16) {
            eadk_timing_usleep((uint32_t)((16 - elapsed) * 1000));
        }
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
