#ifndef EQUALIB_APPS_H
#define EQUALIB_APPS_H

#include <stdint.h>
#include <stddef.h>

void run_panic_calculator(void);
void run_mariokart_app(void);
void run_periodic_table_app(void);
void run_courses_app(void);
void run_math_tools_app(void);
void run_text_viewer_app(const char* title, const char* text_data, uint32_t text_size);

#endif // EQUALIB_APPS_H
