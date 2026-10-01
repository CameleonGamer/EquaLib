#include <eadk.h>
#include <stdio.h>
#include <string.h>

#define COLOR_NUMWORKS 0xFE60
#define COLOR_CARD_BG  0xFFFF
#define COLOR_GRAY_BG  0xF7BE

typedef struct {
    const char* chapter_title;
    const char* section;
    const char* lines[6];
} course_page_t;

static const course_page_t s_pages[] = {
    {
        "Derivees Usuelles",
        "Mathematiques",
        {
            "(k)' = 0   |   (x^n)' = n * x^(n-1)",
            "(1/x)' = -1/x^2   |   (sqrt(x))' = 1/(2*sqrt(x))",
            "(e^x)' = e^x      |   (e^(ax))' = a * e^(ax)",
            "(ln(x))' = 1/x    (x > 0)",
            "(sin(x))' = cos(x) | (cos(x))' = -sin(x)",
            "(u*v)' = u'v + uv'  |  (u/v)' = (u'v - uv')/v^2"
        }
    },
    {
        "Primitives Usuelles",
        "Mathematiques",
        {
            "x^n -> x^(n+1)/(n+1)  (n != -1)",
            "1/x -> ln|x|",
            "1/sqrt(x) -> 2*sqrt(x)",
            "e^(ax) -> (1/a)*e^(ax)",
            "u'*e^u -> e^u",
            "u'/u -> ln|u|   |   u'*u^n -> u^(n+1)/(n+1)"
        }
    },
    {
        "Trigonometrie",
        "Mathematiques",
        {
            "cos^2(x) + sin^2(x) = 1",
            "cos(a + b) = cos(a)cos(b) - sin(a)sin(b)",
            "sin(a + b) = sin(a)cos(b) + cos(a)sin(b)",
            "cos(2a) = cos^2(a) - sin^2(a) = 2*cos^2(a) - 1",
            "sin(2a) = 2*sin(a)*cos(a)",
            "tan(x) = sin(x) / cos(x)"
        }
    },
    {
        "Suites & Limites",
        "Mathematiques",
        {
            "Arithmetique : u_n = u_0 + n*r",
            "Somme arith : S = (n+1)*(u_0 + u_n) / 2",
            "Geometrique : u_n = u_0 * q^n",
            "Somme geom : S = u_0 * (1 - q^(n+1)) / (1 - q)",
            "Si |q| < 1 : lim q^n = 0 (suite convergente)",
            "Croissance comparee : lim e^x / x^n = +inf"
        }
    },
    {
        "Mecanique Newtonienne",
        "Physique",
        {
            "2e Loi de Newton : Somme(F) = m * a",
            "Vitesse : v = dr/dt  |  Acceleration : a = dv/dt",
            "Energie cinetique : Ec = 1/2 * m * v^2",
            "Energie potentielle pesanteur : Epp = m * g * z",
            "Energie mecanique : Em = Ec + Epp = cste",
            "Travail force constante : W_AB(F) = F . AB"
        }
    },
    {
        "Ondes & Optique",
        "Physique",
        {
            "Loi de Descartes : n1 * sin(i1) = n2 * sin(i2)",
            "Relation de conjugaison : 1/OA' - 1/OA = 1/f'",
            "Grandissement : gamma = A'B'/AB = OA'/OA",
            "Vitesse onde : v = lambda / T = lambda * f",
            "Effet Doppler : f_rec = f_em * (c / (c - v_s))",
            "Interferences constructives : delta = k * lambda"
        }
    },
    {
        "Chimie & Solutions",
        "Chimie",
        {
            "Quantite matiere : n = m / M = C * V",
            "Loi des gaz parfaits : P * V = n * R * T",
            "pH = -log[H3O+]  <=>  [H3O+] = 10^(-pH)",
            "Constante acidite : Ka = [A-][H3O+] / [AH]",
            "Formule d'Henderson : pH = pKa + log([A-]/[AH])",
            "Oxydoreduction : Oxydant + n e- <=> Reducteur"
        }
    }
};

#define PAGE_COUNT (sizeof(s_pages) / sizeof(s_pages[0]))

void run_courses_app(void) {
    int cur_page = 0;
    bool redraw = true;
    eadk_keyboard_state_t prev_kbd = eadk_keyboard_scan();

    while (true) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;

        if (eadk_keyboard_key_down(pressed, eadk_key_back)) {
            break;
        }

        if (eadk_keyboard_key_down(pressed, eadk_key_right)) {
            if (cur_page < (int)PAGE_COUNT - 1) {
                cur_page++;
                redraw = true;
            }
        } else if (eadk_keyboard_key_down(pressed, eadk_key_left)) {
            if (cur_page > 0) {
                cur_page--;
                redraw = true;
            }
        }

        prev_kbd = kbd;

        if (redraw) {
            redraw = false;
            const course_page_t* p = &s_pages[cur_page];

            eadk_display_push_rect_uniform(eadk_screen_rect, COLOR_GRAY_BG);

            /* Entete */
            eadk_rect_t top = {0, 0, EADK_SCREEN_WIDTH, 22};
            eadk_display_push_rect_uniform(top, COLOR_NUMWORKS);
            eadk_point_t pt_title = {10, 5};
            eadk_display_draw_string("Fiches de Cours & Formulaires", pt_title, false, eadk_color_black, COLOR_NUMWORKS);

            /* Boite principale */
            eadk_rect_t main_box = {12, 30, EADK_SCREEN_WIDTH - 24, 182};
            eadk_display_push_rect_uniform(main_box, COLOR_CARD_BG);

            /* En-tete du chapitre */
            eadk_point_t pt_sec = {24, 40};
            eadk_display_draw_string(p->section, pt_sec, false, 0x028A, COLOR_CARD_BG);

            eadk_point_t pt_ch = {24, 56};
            eadk_display_draw_string(p->chapter_title, pt_ch, true, eadk_color_black, COLOR_CARD_BG);

            eadk_rect_t div = {24, 80, EADK_SCREEN_WIDTH - 48, 1};
            eadk_display_push_rect_uniform(div, 0xDEFB);

            /* Lignes de formules */
            for (int i = 0; i < 6; i++) {
                if (p->lines[i] && p->lines[i][0]) {
                    eadk_point_t pt_line = {24, (uint16_t)(90 + i * 18)};
                    eadk_display_draw_string(p->lines[i], pt_line, false, 0x18C3, COLOR_CARD_BG);
                }
            }

            /* Pagination */
            char page_str[32];
            snprintf(page_str, sizeof(page_str), "Fiche %d / %d (Gauche / Droite)", cur_page + 1, (int)PAGE_COUNT);
            eadk_point_t pt_page = {55, 196};
            eadk_display_draw_string(page_str, pt_page, false, 0x7BEF, COLOR_CARD_BG);

            /* Pied de page */
            eadk_rect_t bottom = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
            eadk_display_push_rect_uniform(bottom, eadk_color_white);
            eadk_point_t pt_help = {10, EADK_SCREEN_HEIGHT - 13};
            eadk_display_draw_string("< > : Changer fiche  |  BACK : Menu", pt_help, false, 0x4208, eadk_color_white);
        }

        eadk_timing_msleep(20);
    }
}
