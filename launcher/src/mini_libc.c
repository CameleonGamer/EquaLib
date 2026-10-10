#include <stddef.h>
#include <stdint.h>
#include <stdarg.h>

__attribute__((optimize("no-tree-loop-distribute-patterns")))
size_t strlen(const char* s) {
    if (!s) return 0;
    const char* p = s;
    while (*p) {
        __asm__ volatile("" : "+r"(p));
        p++;
    }
    return (size_t)(p - s);
}

char* strcpy(char* dest, const char* src) {
    char* d = dest;
    while ((*d++ = *src++));
    return dest;
}

char* strcat(char* dest, const char* src) {
    char* d = dest;
    while (*d) d++;
    while ((*d++ = *src++));
    return dest;
}

int strcmp(const char* s1, const char* s2) {
    while (*s1 && (*s1 == *s2)) {
        s1++;
        s2++;
    }
    return *(const unsigned char*)s1 - *(const unsigned char*)s2;
}

void* memmove(void* dest, const void* src, size_t n) {
    char* d = (char*)dest;
    const char* s = (const char*)src;
    if (d < s) {
        while (n--) *d++ = *s++;
    } else {
        d += n;
        s += n;
        while (n--) *--d = *--s;
    }
    return dest;
}

static int append_int(char* buf, size_t max, size_t* pos, int val) {
    char tmp[16];
    int i = 0;
    int sign = 0;
    if (val < 0) {
        sign = 1;
        val = -val;
    }
    if (val == 0) {
        tmp[i++] = '0';
    } else {
        while (val > 0 && i < 15) {
            tmp[i++] = '0' + (val % 10);
            val /= 10;
        }
    }
    if (sign && *pos + 1 < max) {
        buf[(*pos)++] = '-';
    }
    while (i > 0 && *pos + 1 < max) {
        buf[(*pos)++] = tmp[--i];
    }
    return 0;
}

static int append_str(char* buf, size_t max, size_t* pos, const char* s) {
    if (!s) s = "(null)";
    while (*s && *pos + 1 < max) {
        buf[(*pos)++] = *s++;
    }
    return 0;
}

int vsnprintf(char* buf, size_t max, const char* fmt, va_list args) {
    if (!buf || max == 0) return 0;
    size_t pos = 0;

    for (const char* p = fmt; *p && pos + 1 < max; p++) {
        if (*p != '%') {
            buf[pos++] = *p;
            continue;
        }
        p++;
        if (*p == '\0') break;

        if (*p == 'd' || *p == 'i') {
            int v = va_arg(args, int);
            append_int(buf, max, &pos, v);
        } else if (*p == 's') {
            const char* s = va_arg(args, const char*);
            append_str(buf, max, &pos, s);
        } else if (*p == 'c') {
            char c = (char)va_arg(args, int);
            if (pos + 1 < max) buf[pos++] = c;
        } else if (*p == '%') {
            if (pos + 1 < max) buf[pos++] = '%';
        }
    }

    buf[pos] = '\0';
    return (int)pos;
}

int snprintf(char* buf, size_t max, const char* fmt, ...) {
    va_list args;
    va_start(args, fmt);
    int ret = vsnprintf(buf, max, fmt, args);
    va_end(args);
    return ret;
}

float __aeabi_ul2f(unsigned long long val) {
    float f = (float)(uint32_t)(val & 0xFFFFFFFFULL);
    uint32_t hi = (uint32_t)(val >> 32);
    if (hi > 0) {
        f += (float)hi * 4294967296.0f;
    }
    return f;
}

static uint32_t s_random_state = 0x853c49e7;

uint32_t eadk_random(void) {
    if (s_random_state == 0) s_random_state = 0x12345678;
    s_random_state ^= s_random_state << 13;
    s_random_state ^= s_random_state >> 17;
    s_random_state ^= s_random_state << 5;
    return s_random_state;
}

void eadk_random_seed(uint32_t seed) {
    if (seed != 0) s_random_state = seed;
}
