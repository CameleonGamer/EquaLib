#include <eadk.h>
#include <stdbool.h>
#include <stdint.h>
#include "apps.h"

int snprintf(char* buf, unsigned int max, const char* fmt, ...);
int strcmp(const char* s1, const char* s2);
size_t strlen(const char* s);
char* strcpy(char* dest, const char* src);

/* ========================================================================= */
/*                          ENVIRONNEMENT PYTHON                             */
/* ========================================================================= */

#define MAX_VARS       128
#define MAX_FUNCS      32
#define MAX_LINES      512
#define MAX_CALL_STACK 16
#define MAX_LIST_ITEMS 64
#define CONSOLE_ROWS   14
#define CONSOLE_COLS   45

typedef enum {
    PY_NONE,
    PY_BOOL,
    PY_INT,
    PY_FLOAT,
    PY_STR,
    PY_LIST
} py_type_t;

typedef struct py_val {
    py_type_t type;
    union {
        bool b;
        int32_t i;
        float f;
        char str[48];
        struct {
            int32_t items[MAX_LIST_ITEMS];
            int count;
        } list;
    } u;
} py_val_t;

typedef struct {
    char name[24];
    py_val_t val;
} py_var_t;

typedef struct {
    char name[24];
    char args[6][16];
    int arg_count;
    int start_line;
    int end_line;
} py_func_t;

typedef struct {
    py_var_t vars[MAX_VARS];
    int var_count;
    py_func_t funcs[MAX_FUNCS];
    int func_count;
    bool should_break;
    bool should_continue;
    bool should_return;
    py_val_t return_val;
    bool panic_triggered;
    bool exit_requested;
} py_vm_t;

static py_vm_t s_vm;

/* Console virtuelle */
static char s_console[CONSOLE_ROWS][CONSOLE_COLS + 1];
static int s_console_lines = 0;
static bool s_has_graphics = false;

static void console_init(void) {
    for (int r = 0; r < CONSOLE_ROWS; r++) {
        s_console[r][0] = '\0';
    }
    s_console_lines = 0;
    s_has_graphics = false;
}

static void console_draw(void) {
    if (s_has_graphics) return;

    eadk_rect_t bg = {0, 22, EADK_SCREEN_WIDTH, EADK_SCREEN_HEIGHT - 22 - 16};
    eadk_display_push_rect_uniform(bg, 0x18C3);

    int start_r = 0;
    if (s_console_lines > CONSOLE_ROWS) {
        start_r = s_console_lines - CONSOLE_ROWS;
    }

    for (int i = 0; i < CONSOLE_ROWS; i++) {
        int r = (start_r + i) % CONSOLE_ROWS;
        if (s_console[r][0] != '\0') {
            eadk_point_t pt = {8, (uint16_t)(26 + i * 14)};
            eq_display_draw_string(s_console[r], pt, false, 0xFFFF, 0x18C3);
        }
    }
}

static void console_print(const char* msg) {
    int idx = s_console_lines % CONSOLE_ROWS;
    int col = 0;
    while (*msg && col < CONSOLE_COLS) {
        s_console[idx][col++] = *msg++;
    }
    s_console[idx][col] = '\0';
    s_console_lines++;
    console_draw();
}

/* ========================================================================= */
/*                          GESTION DES VARIABLES                            */
/* ========================================================================= */

static void vm_init(void) {
    s_vm.var_count = 0;
    s_vm.func_count = 0;
    s_vm.should_break = false;
    s_vm.should_continue = false;
    s_vm.should_return = false;
    s_vm.panic_triggered = false;
    s_vm.exit_requested = false;
    s_vm.return_val.type = PY_NONE;
}

static py_val_t* vm_get_var(const char* name) {
    for (int i = 0; i < s_vm.var_count; i++) {
        if (strcmp(s_vm.vars[i].name, name) == 0) {
            return &s_vm.vars[i].val;
        }
    }
    return NULL;
}

static void vm_set_var(const char* name, py_val_t val) {
    for (int i = 0; i < s_vm.var_count; i++) {
        if (strcmp(s_vm.vars[i].name, name) == 0) {
            s_vm.vars[i].val = val;
            return;
        }
    }
    if (s_vm.var_count < MAX_VARS) {
        int idx = s_vm.var_count++;
        int c = 0;
        while (name[c] && c < 23) {
            s_vm.vars[idx].name[c] = name[c];
            c++;
        }
        s_vm.vars[idx].name[c] = '\0';
        s_vm.vars[idx].val = val;
    }
}

/* Conversion de valeur en entier */
static int32_t val_to_int(py_val_t v) {
    if (v.type == PY_INT) return v.u.i;
    if (v.type == PY_FLOAT) return (int32_t)v.u.f;
    if (v.type == PY_BOOL) return v.u.b ? 1 : 0;
    return 0;
}

/* Conversion de valeur en chaîne */
static void val_to_str(py_val_t v, char* buf, int max) {
    if (v.type == PY_INT) {
        snprintf(buf, max, "%d", (int)v.u.i);
    } else if (v.type == PY_FLOAT) {
        int ent = (int)v.u.f;
        int dec = (int)((v.u.f - ent) * 100);
        if (dec < 0) dec = -dec;
        snprintf(buf, max, "%d.%02d", ent, dec);
    } else if (v.type == PY_BOOL) {
        snprintf(buf, max, "%s", v.u.b ? "True" : "False");
    } else if (v.type == PY_STR) {
        snprintf(buf, max, "%s", v.u.str);
    } else {
        snprintf(buf, max, "None");
    }
}

/* ========================================================================= */
/*                          FONCTIONS BUILT-IN                               */
/* ========================================================================= */

static uint16_t py_color(int r, int g, int b) {
    if (r < 0) r = 0; if (r > 255) r = 255;
    if (g < 0) g = 0; if (g > 255) g = 255;
    if (b < 0) b = 0; if (b > 255) b = 255;
    return (uint16_t)((((r >> 3) & 0x1F) << 11) | (((g >> 2) & 0x3F) << 5) | ((b >> 3) & 0x1F));
}

static py_val_t eval_expr(const char** expr);

/* Analyse d'une liste d'arguments séparés par des virgules */
static int parse_args(const char* str, py_val_t* args, int max_args) {
    int count = 0;
    const char* p = str;
    while (*p && count < max_args) {
        while (*p == ' ' || *p == '\t') p++;
        if (*p == '\0') break;
        args[count++] = eval_expr(&p);
        while (*p == ' ' || *p == '\t') p++;
        if (*p == ',') p++;
        else break;
    }
    return count;
}

static py_val_t call_builtin(const char* name, const char* arg_str) {
    py_val_t ret;
    ret.type = PY_NONE;

    py_val_t args[6];
    for (int i = 0; i < 6; i++) args[i].type = PY_NONE;
    int argc = parse_args(arg_str, args, 6);

    /* --- Module kandinsky --- */
    if (strcmp(name, "fill_rect") == 0 || strcmp(name, "kd.fill_rect") == 0 || strcmp(name, "kandinsky.fill_rect") == 0) {
        s_has_graphics = true;
        int x = val_to_int(args[0]);
        int y = val_to_int(args[1]);
        int w = val_to_int(args[2]);
        int h = val_to_int(args[3]);
        uint16_t c = (argc >= 5) ? (uint16_t)val_to_int(args[4]) : 0x0000;
        if (x < 0) x = 0; if (y < 0) y = 0;
        if (x + w > EADK_SCREEN_WIDTH) w = EADK_SCREEN_WIDTH - x;
        if (y + h > EADK_SCREEN_HEIGHT) h = EADK_SCREEN_HEIGHT - y;
        if (w > 0 && h > 0) {
            eadk_rect_t rect = {(uint16_t)x, (uint16_t)y, (uint16_t)w, (uint16_t)h};
            eadk_display_push_rect_uniform(rect, c);
        }
        return ret;
    }

    if (strcmp(name, "draw_string") == 0 || strcmp(name, "kd.draw_string") == 0 || strcmp(name, "kandinsky.draw_string") == 0) {
        s_has_graphics = true;
        char s[48] = "";
        val_to_str(args[0], s, sizeof(s));
        int x = val_to_int(args[1]);
        int y = val_to_int(args[2]);
        uint16_t fg = (argc >= 4) ? (uint16_t)val_to_int(args[3]) : 0x0000;
        uint16_t bg = (argc >= 5) ? (uint16_t)val_to_int(args[4]) : 0xFFFF;
        eadk_point_t pt = {(uint16_t)x, (uint16_t)y};
        eq_display_draw_string(s, pt, false, fg, bg);
        return ret;
    }

    if (strcmp(name, "color") == 0 || strcmp(name, "kd.color") == 0 || strcmp(name, "kandinsky.color") == 0) {
        int r = val_to_int(args[0]);
        int g = val_to_int(args[1]);
        int b = val_to_int(args[2]);
        ret.type = PY_INT;
        ret.u.i = py_color(r, g, b);
        return ret;
    }

    /* --- Module ion --- */
    if (strcmp(name, "keydown") == 0 || strcmp(name, "ion.keydown") == 0) {
        int k = val_to_int(args[0]);
        eadk_keyboard_state_t state = eadk_keyboard_scan();

        /* Raccourci panique Var ou Home */
        if (eadk_keyboard_key_down(state, eadk_key_var)) {
            s_vm.panic_triggered = true;
        }
        if (eadk_keyboard_key_down(state, eadk_key_home) || eadk_keyboard_key_down(state, eadk_key_on_off)) {
            s_vm.exit_requested = true;
        }

        ret.type = PY_BOOL;
        ret.u.b = eadk_keyboard_key_down(state, (eadk_key_t)k);
        return ret;
    }

    /* --- Module time --- */
    if (strcmp(name, "sleep") == 0 || strcmp(name, "time.sleep") == 0) {
        float sec = (args[0].type == PY_FLOAT) ? args[0].u.f : (float)val_to_int(args[0]);
        uint32_t ms = (uint32_t)(sec * 1000.0f);
        if (ms == 0) ms = 10;
        eadk_timing_msleep(ms);
        return ret;
    }

    if (strcmp(name, "monotonic") == 0 || strcmp(name, "time.monotonic") == 0) {
        ret.type = PY_FLOAT;
        ret.u.f = (float)(uint32_t)eadk_timing_millis() / 1000.0f;
        return ret;
    }

    /* --- Module random --- */
    if (strcmp(name, "randint") == 0 || strcmp(name, "random.randint") == 0) {
        int a = val_to_int(args[0]);
        int b = val_to_int(args[1]);
        ret.type = PY_INT;
        if (b >= a) {
            ret.u.i = a + (int)(eadk_random() % (uint32_t)(b - a + 1));
        } else {
            ret.u.i = a;
        }
        return ret;
    }

    /* --- print(...) --- */
    if (strcmp(name, "print") == 0) {
        char buf[64] = "";
        char tmp[48];
        int pos = 0;
        for (int i = 0; i < argc; i++) {
            val_to_str(args[i], tmp, sizeof(tmp));
            int l = 0;
            while (tmp[l] && pos < 62) {
                buf[pos++] = tmp[l++];
            }
            if (i < argc - 1 && pos < 62) buf[pos++] = ' ';
        }
        buf[pos] = '\0';
        console_print(buf);
        return ret;
    }

    /* --- len(...) --- */
    if (strcmp(name, "len") == 0) {
        ret.type = PY_INT;
        if (args[0].type == PY_LIST) ret.u.i = args[0].u.list.count;
        else if (args[0].type == PY_STR) ret.u.i = (int)strlen(args[0].u.str);
        else ret.u.i = 0;
        return ret;
    }

    return ret;
}

/* ========================================================================= */
/*                          ÉVALUATION D'EXPRESSIONS                         */
/* ========================================================================= */

static const char* skip_ws(const char* p) {
    while (*p == ' ' || *p == '\t') p++;
    return p;
}

static py_val_t eval_primary(const char** expr) {
    const char* p = skip_ws(*expr);
    py_val_t res;
    res.type = PY_NONE;

    /* Nombres */
    if ((*p >= '0' && *p <= '9') || (*p == '-' && p[1] >= '0' && p[1] <= '9')) {
        int sign = 1;
        if (*p == '-') { sign = -1; p++; }
        int val = 0;
        while (*p >= '0' && *p <= '9') {
            val = val * 10 + (*p - '0');
            p++;
        }
        if (*p == '.') {
            p++;
            float frac = 0.0f;
            float div = 10.0f;
            while (*p >= '0' && *p <= '9') {
                frac += (float)(*p - '0') / div;
                div *= 10.0f;
                p++;
            }
            res.type = PY_FLOAT;
            res.u.f = (float)sign * ((float)val + frac);
        } else {
            res.type = PY_INT;
            res.u.i = sign * val;
        }
        *expr = p;
        return res;
    }

    /* Chaînes de caractères */
    if (*p == '"' || *p == '\'') {
        char quote = *p++;
        int i = 0;
        while (*p && *p != quote && i < 47) {
            res.u.str[i++] = *p++;
        }
        if (*p == quote) p++;
        res.u.str[i] = '\0';
        res.type = PY_STR;
        *expr = p;
        return res;
    }

    /* Parenthèses */
    if (*p == '(') {
        p++;
        res = eval_expr(&p);
        p = skip_ws(p);
        if (*p == ')') p++;
        *expr = p;
        return res;
    }

    /* Identifiants, mots-clés ou appels */
    if ((*p >= 'a' && *p <= 'z') || (*p >= 'A' && *p <= 'Z') || *p == '_') {
        char id[32];
        int l = 0;
        while (((*p >= 'a' && *p <= 'z') || (*p >= 'A' && *p <= 'Z') ||
                (*p >= '0' && *p <= '9') || *p == '_' || *p == '.') && l < 31) {
            id[l++] = *p++;
        }
        id[l] = '\0';
        p = skip_ws(p);

        /* Appel de fonction */
        if (*p == '(') {
            p++;
            const char* arg_start = p;
            int paren_depth = 1;
            while (*p && paren_depth > 0) {
                if (*p == '(') paren_depth++;
                else if (*p == ')') paren_depth--;
                p++;
            }
            char arg_buf[64] = "";
            int arg_len = (int)(p - 1 - arg_start);
            if (arg_len > 0 && arg_len < 63) {
                for (int k = 0; k < arg_len; k++) arg_buf[k] = arg_start[k];
                arg_buf[arg_len] = '\0';
            }
            res = call_builtin(id, arg_buf);
            *expr = p;
            return res;
        }

        /* Constantes booléennes */
        if (strcmp(id, "True") == 0) { res.type = PY_BOOL; res.u.b = true; *expr = p; return res; }
        if (strcmp(id, "False") == 0) { res.type = PY_BOOL; res.u.b = false; *expr = p; return res; }
        if (strcmp(id, "None") == 0) { res.type = PY_NONE; *expr = p; return res; }

        /* Constantes ion */
        if (strcmp(id, "KEY_LEFT") == 0 || strcmp(id, "ion.KEY_LEFT") == 0) { res.type = PY_INT; res.u.i = eadk_key_left; *expr = p; return res; }
        if (strcmp(id, "KEY_UP") == 0 || strcmp(id, "ion.KEY_UP") == 0) { res.type = PY_INT; res.u.i = eadk_key_up; *expr = p; return res; }
        if (strcmp(id, "KEY_DOWN") == 0 || strcmp(id, "ion.KEY_DOWN") == 0) { res.type = PY_INT; res.u.i = eadk_key_down; *expr = p; return res; }
        if (strcmp(id, "KEY_RIGHT") == 0 || strcmp(id, "ion.KEY_RIGHT") == 0) { res.type = PY_INT; res.u.i = eadk_key_right; *expr = p; return res; }
        if (strcmp(id, "KEY_OK") == 0 || strcmp(id, "ion.KEY_OK") == 0) { res.type = PY_INT; res.u.i = eadk_key_ok; *expr = p; return res; }
        if (strcmp(id, "KEY_BACK") == 0 || strcmp(id, "ion.KEY_BACK") == 0) { res.type = PY_INT; res.u.i = eadk_key_back; *expr = p; return res; }
        if (strcmp(id, "KEY_EXE") == 0 || strcmp(id, "ion.KEY_EXE") == 0) { res.type = PY_INT; res.u.i = eadk_key_exe; *expr = p; return res; }

        /* Variable */
        py_val_t* v = vm_get_var(id);
        if (v) res = *v;
        *expr = p;
        return res;
    }

    *expr = p;
    return res;
}

static py_val_t eval_expr(const char** expr) {
    py_val_t left = eval_primary(expr);
    const char* p = skip_ws(*expr);

    while (*p) {
        char op = *p;
        if (op == '+' || op == '-' || op == '*' || op == '/' || op == '<' || op == '>' || op == '=' || op == '!') {
            p++;
            bool double_op = false;
            if (*p == '=' || (op == '=' && *p == '=') || (op == '/' && *p == '/')) {
                double_op = true;
                p++;
            }
            *expr = p;
            py_val_t right = eval_primary(expr);
            p = skip_ws(*expr);

            int32_t li = val_to_int(left);
            int32_t ri = val_to_int(right);

            if (op == '+') { left.type = PY_INT; left.u.i = li + ri; }
            else if (op == '-') { left.type = PY_INT; left.u.i = li - ri; }
            else if (op == '*') { left.type = PY_INT; left.u.i = li * ri; }
            else if (op == '/') { left.type = PY_INT; left.u.i = (ri != 0) ? (li / ri) : 0; }
            else if (op == '<' && !double_op) { left.type = PY_BOOL; left.u.b = (li < ri); }
            else if (op == '<' && double_op) { left.type = PY_BOOL; left.u.b = (li <= ri); }
            else if (op == '>' && !double_op) { left.type = PY_BOOL; left.u.b = (li > ri); }
            else if (op == '>' && double_op) { left.type = PY_BOOL; left.u.b = (li >= ri); }
            else if (op == '=' && double_op) { left.type = PY_BOOL; left.u.b = (li == ri); }
            else if (op == '!' && double_op) { left.type = PY_BOOL; left.u.b = (li != ri); }
        } else {
            break;
        }
    }

    *expr = p;
    return left;
}

/* ========================================================================= */
/*                          EXÉCUTION DES LIGNES                             */
/* ========================================================================= */

static int get_indent(const char* line) {
    int indent = 0;
    while (*line) {
        if (*line == ' ') indent++;
        else if (*line == '\t') indent += 4;
        else break;
        line++;
    }
    return indent;
}

static void execute_line(const char* line_text) {
    const char* p = skip_ws(line_text);
    if (*p == '\0' || *p == '#') return;

    /* Ignorer les imports */
    if (p[0] == 'i' && p[1] == 'm' && p[2] == 'p' && p[3] == 'o' && p[4] == 'r' && p[5] == 't') return;
    if (p[0] == 'f' && p[1] == 'r' && p[2] == 'o' && p[3] == 'm') return;

    /* break / continue / return */
    if (p[0] == 'b' && p[1] == 'r' && p[2] == 'e' && p[3] == 'a' && p[4] == 'k') {
        s_vm.should_break = true;
        return;
    }
    if (p[0] == 'c' && p[1] == 'o' && p[2] == 'n' && p[3] == 't' && p[4] == 'i' && p[5] == 'n' && p[6] == 'u' && p[7] == 'e') {
        s_vm.should_continue = true;
        return;
    }
    if (p[0] == 'r' && p[1] == 'e' && p[2] == 't' && p[3] == 'u' && p[4] == 'r' && p[5] == 'n') {
        p += 6;
        s_vm.return_val = eval_expr(&p);
        s_vm.should_return = true;
        return;
    }

    /* Assignation : var = expr ou var += expr */
    const char* eq = p;
    while (*eq && *eq != '=' && *eq != '(') eq++;
    if (*eq == '=') {
        char var_name[24];
        int nl = 0;
        const char* v = p;
        while (v < eq && *v != ' ' && *v != '\t' && *v != '+' && *v != '-' && nl < 23) {
            var_name[nl++] = *v++;
        }
        var_name[nl] = '\0';

        bool plus_eq = (eq > p && *(eq - 1) == '+');
        bool minus_eq = (eq > p && *(eq - 1) == '-');

        const char* val_p = eq + 1;
        py_val_t val = eval_expr(&val_p);

        if (plus_eq) {
            py_val_t* cur = vm_get_var(var_name);
            if (cur) val.u.i = val_to_int(*cur) + val_to_int(val);
        } else if (minus_eq) {
            py_val_t* cur = vm_get_var(var_name);
            if (cur) val.u.i = val_to_int(*cur) - val_to_int(val);
        }

        vm_set_var(var_name, val);
        return;
    }

    /* Appel ou instruction directe */
    eval_expr(&p);
}

/* ========================================================================= */
/*                          MOTEUR D'EXÉCUTION PRINCIPAL                     */
/* ========================================================================= */

static void run_script_engine(const char* script_code, uint32_t script_len) {
    if (!script_code || script_len == 0) return;

    /* Découpage en lignes */
    static const char* lines[MAX_LINES];
    static int line_indents[MAX_LINES];
    static char line_buffers[MAX_LINES][96];

    int line_count = 0;
    uint32_t pos = 0;

    while (pos < script_len && line_count < MAX_LINES) {
        int c = 0;
        while (pos < script_len && script_code[pos] != '\n' && script_code[pos] != '\r' && c < 95) {
            line_buffers[line_count][c++] = script_code[pos++];
        }
        line_buffers[line_count][c] = '\0';
        if (pos < script_len && (script_code[pos] == '\n' || script_code[pos] == '\r')) pos++;

        lines[line_count] = line_buffers[line_count];
        line_indents[line_count] = get_indent(lines[line_count]);
        line_count++;
    }

    vm_init();
    console_init();

    /* Exécution séquentielle avec boucles et conditions */
    int cur_line = 0;
    uint64_t last_check_ms = eadk_timing_millis();

    while (cur_line < line_count && !s_vm.exit_requested && !s_vm.panic_triggered) {
        /* Vérification clavier périodique (toutes les 30ms) pour sécurité et réactivité */
        uint64_t now = eadk_timing_millis();
        if (now - last_check_ms >= 30) {
            last_check_ms = now;
            eadk_keyboard_state_t kbd = eadk_keyboard_scan();
            if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
                break;
            }
            if (eadk_keyboard_key_down(kbd, eadk_key_var)) {
                run_panic_calculator();
                while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
                continue;
            }
            if (eadk_keyboard_key_down(kbd, eadk_key_back) && !s_has_graphics) {
                break;
            }
        }

        const char* p = skip_ws(lines[cur_line]);
        int indent = line_indents[cur_line];

        /* if condition: */
        if (p[0] == 'i' && p[1] == 'f' && p[2] == ' ') {
            p += 3;
            py_val_t cond = eval_expr(&p);
            bool is_true = (cond.type == PY_BOOL) ? cond.u.b : (val_to_int(cond) != 0);

            if (!is_true) {
                /* Sauter le bloc if */
                cur_line++;
                while (cur_line < line_count && line_indents[cur_line] > indent) {
                    cur_line++;
                }
                continue;
            }
            cur_line++;
            continue;
        }

        /* while condition: */
        if (p[0] == 'w' && p[1] == 'h' && p[2] == 'i' && p[3] == 'l' && p[4] == 'e' && p[5] == ' ') {
            const char* cond_p = p + 6;
            py_val_t cond = eval_expr(&cond_p);
            bool is_true = (cond.type == PY_BOOL) ? cond.u.b : (val_to_int(cond) != 0);

            if (!is_true) {
                cur_line++;
                while (cur_line < line_count && line_indents[cur_line] > indent) {
                    cur_line++;
                }
                continue;
            }

            /* Trouver la fin du bloc while */
            int block_start = cur_line + 1;
            int block_end = block_start;
            while (block_end < line_count && line_indents[block_end] > indent) {
                block_end++;
            }

            /* Boucle while */
            while (true) {
                cond_p = p + 6;
                cond = eval_expr(&cond_p);
                is_true = (cond.type == PY_BOOL) ? cond.u.b : (val_to_int(cond) != 0);
                if (!is_true || s_vm.exit_requested || s_vm.panic_triggered) break;

                s_vm.should_break = false;
                s_vm.should_continue = false;

                for (int l = block_start; l < block_end; l++) {
                    const char* lp = skip_ws(lines[l]);
                    if (lp[0] == 'i' && lp[1] == 'f' && lp[2] == ' ') {
                        lp += 3;
                        py_val_t if_c = eval_expr(&lp);
                        bool it = (if_c.type == PY_BOOL) ? if_c.u.b : (val_to_int(if_c) != 0);
                        if (!it) {
                            int if_indent = line_indents[l];
                            l++;
                            while (l < block_end && line_indents[l] > if_indent) l++;
                            l--;
                            continue;
                        }
                        continue;
                    }
                    execute_line(lines[l]);
                    if (s_vm.should_break || s_vm.should_return || s_vm.exit_requested) break;
                }

                if (s_vm.should_break) break;
                eadk_timing_msleep(2);
            }

            cur_line = block_end;
            continue;
        }

        /* Ligne standard */
        execute_line(lines[cur_line]);
        cur_line++;
    }
}

/* ========================================================================= */
/*                          POINT D'ENTRÉE APPLICATION                       */
/* ========================================================================= */

void run_python_app(const char* title, const char* script_code, uint32_t script_len) {
    /* Debounce */
    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }

    /* Barre supérieure officielle EquaLib */
    eadk_rect_t top = {0, 0, EADK_SCREEN_WIDTH, 22};
    eadk_display_push_rect_uniform(top, 0xFE60);
    eadk_point_t pt_title = {10, 5};
    eq_display_draw_string(title ? title : "Application NumWorks", pt_title, false, eadk_color_black, 0xFE60);

    /* Barre inférieure */
    eadk_rect_t bottom = {0, EADK_SCREEN_HEIGHT - 16, EADK_SCREEN_WIDTH, 16};
    eadk_display_push_rect_uniform(bottom, eadk_color_white);
    eadk_point_t pt_help = {8, EADK_SCREEN_HEIGHT - 13};
    eq_display_draw_string("BACK: Quitter vers Hub  |  Var: Furtif Panique", pt_help, false, 0x4208, eadk_color_white);

    /* Exécution du script Python */
    run_script_engine(script_code, script_len);

    /* Attente de sortie si le script s'est terminé mais affiche encore son résultat */
    eadk_keyboard_state_t prev_kbd = 0;
    while (!s_vm.exit_requested) {
        eadk_keyboard_state_t kbd = eadk_keyboard_scan();
        if (eadk_keyboard_key_down(kbd, eadk_key_home) || eadk_keyboard_key_down(kbd, eadk_key_on_off)) {
            break;
        }
        if (eadk_keyboard_key_down(kbd, eadk_key_var)) {
            run_panic_calculator();
            while (eadk_keyboard_scan() != 0) eadk_timing_msleep(20);
            break;
        }

        eadk_keyboard_state_t pressed = kbd & ~prev_kbd;
        if (eadk_keyboard_key_down(pressed, eadk_key_back) ||
            eadk_keyboard_key_down(pressed, eadk_key_ok) ||
            eadk_keyboard_key_down(pressed, eadk_key_exe)) {
            break;
        }
        prev_kbd = kbd;
        eadk_timing_msleep(20);
    }

    while (eadk_keyboard_scan() != 0) {
        eadk_timing_msleep(20);
    }
}
