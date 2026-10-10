# Makefile pour le Lanceur EquaLib - Ciblant NumWorks N0120 (STM32H725)

CC ?= arm-none-eabi-gcc
OBJCOPY ?= arm-none-eabi-objcopy
NWLINK ?= nwlink

# Architecture Cortex-M7 pour N0120 (STM32H725 @ 550MHz)
TARGET_ARCH ?= -mcpu=cortex-m7 -mfpu=fpv5-d16 -mfloat-abi=hard -mthumb

CFLAGS ?= $(TARGET_ARCH) \
          -std=c11 \
          -Os \
          -Wall \
          -Wextra \
          -ffreestanding \
          -fno-common \
          -fdata-sections \
          -ffunction-sections \
          -Iinclude

LDFLAGS ?= $(TARGET_ARCH) \
           -Wl,--gc-sections \
           -nostdlib

SRCS = src/main.c src/app_mariokart.c src/app_courses.c src/app_periodic.c src/app_math_tools.c src/app_text_viewer.c src/app_flappy.c src/app_2048.c src/app_snake.c src/app_tetris.c src/app_minesweeper.c src/app_python.c src/eq_font.c src/mini_libc.c
OBJS = $(SRCS:.c=.o)
TARGET = build/equalib.nwa
TARGET_ELF = build/equalib.elf

all: $(TARGET)

build:
	mkdir -p build

%.o: %.c | build
	$(CC) $(CFLAGS) -c $< -o $@

$(TARGET_ELF): $(OBJS) | build
	$(CC) $(LDFLAGS) $(OBJS) -o $@

$(TARGET): $(TARGET_ELF)
	@if command -v $(NWLINK) >/dev/null 2>&1; then \
		echo "Packaging via nwlink..."; \
		$(NWLINK) nwa-elf $< $@; \
	else \
		echo "nwlink non detecte, extraction brute..."; \
		$(OBJCOPY) -O binary $< $@; \
	fi
	@echo "Build termine : $@"

clean:
	rm -rf build src/*.o

.PHONY: all clean
