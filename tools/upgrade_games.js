const fs = require('fs');
const path = require('path');

console.log('=== UPGRADING ALL NUMWORKS PYTHON GAMES (.NWS) ===\n');

const appsDir = path.join(__dirname, '../web/apps');

const games = [
  {
    filename: '2048.nws',
    name: '2048 Ultimate',
    description: 'Le casse-tete 2048 authentique avec fusion fluide, records et animations',
    author: 'Gabriele Cirulli / EquaLib NW',
    version: '2.1',
    scriptName: 'g2048.py',
    scriptContent: `# 2048 Ultimate - NumWorks Edition
import kandinsky as kd
import ion
import time
import random

C_BG = kd.color(250, 248, 239)
C_GRID = kd.color(187, 173, 160)
C_EMPTY = kd.color(205, 193, 180)
C_DARK = kd.color(119, 110, 101)
C_LIGHT = kd.color(255, 255, 255)

TILES = {
    0: (C_EMPTY, C_EMPTY),
    2: (kd.color(238, 228, 218), C_DARK),
    4: (kd.color(237, 224, 200), C_DARK),
    8: (kd.color(242, 177, 121), C_LIGHT),
    16: (kd.color(245, 149, 99), C_LIGHT),
    32: (kd.color(246, 124, 95), C_LIGHT),
    64: (kd.color(233, 89, 55), C_LIGHT),
    128: (kd.color(237, 207, 114), C_LIGHT),
    256: (kd.color(237, 204, 97), C_LIGHT),
    512: (kd.color(237, 200, 80), C_LIGHT),
    1024: (kd.color(237, 197, 63), C_LIGHT),
    2048: (kd.color(237, 194, 46), C_LIGHT)
}

GX, GY = 59, 38
CW, CH, GAP = 44, 43, 5

def draw_hud(score, best):
    kd.fill_rect(0, 0, 320, 36, C_BG)
    kd.draw_string("2048", 14, 8, C_DARK, C_BG)
    kd.fill_rect(130, 6, 88, 24, C_GRID)
    kd.draw_string("SC:" + str(score), 134, 10, C_LIGHT, C_GRID)
    kd.fill_rect(224, 6, 88, 24, C_GRID)
    kd.draw_string("HI:" + str(best), 228, 10, C_LIGHT, C_GRID)

def draw_cell(r, c, v):
    x = GX + GAP + c * (CW + GAP)
    y = GY + GAP + r * (CH + GAP)
    bg, fg = TILES.get(v, (kd.color(60, 58, 50), C_LIGHT))
    kd.fill_rect(x, y, CW, CH, bg)
    if v > 0:
        s = str(v)
        tx = x + (CW - len(s) * 10) // 2
        ty = y + (CH - 18) // 2
        kd.draw_string(s, tx, ty, fg, bg)

def draw_full_board(g):
    kd.fill_rect(GX, GY, 4 * CW + 5 * GAP, 4 * CH + 5 * GAP, C_GRID)
    for r in range(4):
        for c in range(4):
            draw_cell(r, c, g[r][c])

def spawn(g):
    empty = [(r, c) for r in range(4) for c in range(4) if g[r][c] == 0]
    if empty:
        r, c = random.choice(empty)
        g[r][c] = 4 if random.random() < 0.1 else 2
        draw_cell(r, c, g[r][c])
        return True
    return False

def slide_line(line):
    non_zero = [x for x in line if x != 0]
    res = []
    sc = 0
    i = 0
    while i < len(non_zero):
        if i + 1 < len(non_zero) and non_zero[i] == non_zero[i + 1]:
            val = non_zero[i] * 2
            res.append(val)
            sc += val
            i += 2
        else:
            res.append(non_zero[i])
            i += 1
    res += [0] * (4 - len(res))
    return res, sc

def move_left(g):
    ng, sc = [], 0
    for r in range(4):
        row, pts = slide_line(g[r])
        ng.append(row)
        sc += pts
    return ng, sc

def move_right(g):
    ng, sc = [], 0
    for r in range(4):
        row, pts = slide_line(g[r][::-1])
        ng.append(row[::-1])
        sc += pts
    return ng, sc

def move_up(g):
    trans = [[g[r][c] for r in range(4)] for c in range(4)]
    ng, sc = move_left(trans)
    return [[ng[r][c] for r in range(4)] for c in range(4)], sc

def move_down(g):
    trans = [[g[r][c] for r in range(4)] for c in range(4)]
    ng, sc = move_right(trans)
    return [[ng[r][c] for r in range(4)] for c in range(4)], sc

def can_move(g):
    for r in range(4):
        for c in range(4):
            if g[r][c] == 0:
                return True
            if c < 3 and g[r][c] == g[r][c + 1]:
                return True
            if r < 3 and g[r][c] == g[r + 1][c]:
                return True
    return False

def main():
    best = 0
    while True:
        kd.fill_rect(0, 0, 320, 240, C_BG)
        grid = [[0] * 4 for _ in range(4)]
        score = 0
        draw_hud(score, best)
        draw_full_board(grid)
        spawn(grid)
        spawn(grid)

        over = False
        while not over:
            if ion.keydown(ion.KEY_BACK):
                return
            new_g, pts = None, 0
            if ion.keydown(ion.KEY_LEFT):
                new_g, pts = move_left(grid)
            elif ion.keydown(ion.KEY_RIGHT):
                new_g, pts = move_right(grid)
            elif ion.keydown(ion.KEY_UP):
                new_g, pts = move_up(grid)
            elif ion.keydown(ion.KEY_DOWN):
                new_g, pts = move_down(grid)

            if new_g is not None and new_g != grid:
                grid = new_g
                score += pts
                if score > best:
                    best = score
                draw_hud(score, best)
                for r in range(4):
                    for c in range(4):
                        draw_cell(r, c, grid[r][c])
                time.sleep(0.04)
                spawn(grid)
                if not can_move(grid):
                    over = True

                while (ion.keydown(ion.KEY_LEFT) or ion.keydown(ion.KEY_RIGHT) or
                       ion.keydown(ion.KEY_UP) or ion.keydown(ion.KEY_DOWN)):
                    time.sleep(0.02)

            time.sleep(0.02)

        kd.fill_rect(35, 90, 250, 58, kd.color(238, 228, 218))
        kd.draw_string("GAME OVER ! SCORE: " + str(score), 45, 98, C_DARK, kd.color(238, 228, 218))
        kd.draw_string("OK: Rejouer | Back: Quitter", 42, 122, kd.color(245, 149, 99), kd.color(238, 228, 218))

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  },
  {
    filename: 'pong.nws',
    name: 'Pong Retro Arcade',
    description: 'Le classique Pong arcade 60 FPS contre IA intelligente',
    author: 'NW Arcade / EquaLib',
    version: '2.0',
    scriptName: 'pong.py',
    scriptContent: `# Pong Retro Arcade - NumWorks Edition
import kandinsky as kd
import ion
import time
import random

C_BG = kd.color(10, 12, 18)
C_WHITE = kd.color(255, 255, 255)
C_GRAY = kd.color(80, 85, 100)
C_P1 = kd.color(50, 200, 255)
C_CPU = kd.color(255, 90, 90)

PW = 6
PH = 38
Y_MIN = 26
Y_MAX = 234

def draw_court():
    kd.fill_rect(0, 0, 320, 240, C_BG)
    kd.fill_rect(0, Y_MIN - 2, 320, 2, C_WHITE)
    kd.fill_rect(0, Y_MAX, 320, 2, C_WHITE)
    for y in range(Y_MIN + 4, Y_MAX - 4, 16):
        kd.fill_rect(159, y, 2, 8, C_GRAY)

def draw_scores(s1, sc):
    kd.fill_rect(70, 4, 180, 18, C_BG)
    kd.draw_string("P1: " + str(s1), 75, 4, C_P1, C_BG)
    kd.draw_string("CPU: " + str(sc), 195, 4, C_CPU, C_BG)

def main():
    while True:
        draw_court()
        s1, sc = 0, 0
        draw_scores(s1, sc)

        p1_y = 110
        cpu_y = 110
        old_p1_y = p1_y
        old_cpu_y = cpu_y

        kd.fill_rect(14, p1_y, PW, PH, C_P1)
        kd.fill_rect(300, cpu_y, PW, PH, C_CPU)

        bx, by = 160.0, 120.0
        old_bx, old_by = int(bx), int(by)
        bvx = 3.6 if random.random() < 0.5 else -3.6
        bvy = (random.random() - 0.5) * 3.0

        target_score = 7
        match_over = False

        while not match_over:
            if ion.keydown(ion.KEY_BACK):
                return

            if ion.keydown(ion.KEY_UP) and p1_y > Y_MIN + 2:
                p1_y -= 4
            elif ion.keydown(ion.KEY_DOWN) and p1_y + PH < Y_MAX - 2:
                p1_y += 4

            if bvx > 0 and bx > 90:
                cpu_center = cpu_y + PH / 2
                target = by + 3
                if cpu_center < target - 4 and cpu_y + PH < Y_MAX - 2:
                    cpu_y += 3
                elif cpu_center > target + 4 and cpu_y > Y_MIN + 2:
                    cpu_y -= 3

            if p1_y != old_p1_y:
                kd.fill_rect(14, old_p1_y, PW, PH, C_BG)
                kd.fill_rect(14, p1_y, PW, PH, C_P1)
                old_p1_y = p1_y
            if cpu_y != old_cpu_y:
                kd.fill_rect(300, old_cpu_y, PW, PH, C_BG)
                kd.fill_rect(300, cpu_y, PW, PH, C_CPU)
                old_cpu_y = cpu_y

            kd.fill_rect(old_bx, old_by, 6, 6, C_BG)
            if 157 <= old_bx <= 162:
                for y in range(Y_MIN + 4, Y_MAX - 4, 16):
                    if old_by <= y + 8 and old_by + 6 >= y:
                        kd.fill_rect(159, y, 2, 8, C_GRAY)

            bx += bvx
            by += bvy

            if by <= Y_MIN + 1:
                by = Y_MIN + 1
                bvy = abs(bvy)
            elif by + 6 >= Y_MAX - 1:
                by = Y_MAX - 7
                bvy = -abs(bvy)

            if bx <= 20 and bx >= 12 and by + 6 >= p1_y and by <= p1_y + PH:
                bx = 20
                offset = ((by + 3) - (p1_y + PH / 2)) / (PH / 2)
                bvy = offset * 4.2
                bvx = min(6.0, abs(bvx) * 1.05)

            if bx + 6 >= 300 and bx <= 308 and by + 6 >= cpu_y and by <= cpu_y + PH:
                bx = 294
                offset = ((by + 3) - (cpu_y + PH / 2)) / (PH / 2)
                bvy = offset * 4.2
                bvx = -min(6.0, abs(bvx) * 1.05)

            if bx < 2:
                sc += 1
                draw_scores(s1, sc)
                if sc >= target_score:
                    match_over = True
                    break
                bx, by = 160.0, 120.0
                bvx = 3.6
                bvy = (random.random() - 0.5) * 3.0
                time.sleep(0.5)
            elif bx > 312:
                s1 += 1
                draw_scores(s1, sc)
                if s1 >= target_score:
                    match_over = True
                    break
                bx, by = 160.0, 120.0
                bvx = -3.6
                bvy = (random.random() - 0.5) * 3.0
                time.sleep(0.5)

            old_bx, old_by = int(bx), int(by)
            kd.fill_rect(old_bx, old_by, 6, 6, C_WHITE)

            time.sleep(0.02)

        won = s1 >= target_score
        box_bg = kd.color(20, 35, 60) if won else kd.color(60, 20, 25)
        text_col = kd.color(100, 240, 120) if won else kd.color(255, 100, 100)
        kd.fill_rect(40, 90, 240, 60, box_bg)
        msg = "VICTOIRE !" if won else "DEFAITE !"
        kd.draw_string(msg, 115, 98, text_col, box_bg)
        kd.draw_string("OK: Rejouer | Back: Quitter", 46, 124, C_WHITE, box_bg)

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  },
  {
    filename: 'dino.nws',
    name: 'Chrome Dino Runner',
    description: 'Le jeu mythique du T-Rex avec animation de course et obstacles',
    author: 'Google / EquaLib NW',
    version: '2.0',
    scriptName: 'dino.py',
    scriptContent: `# Chrome Dino Runner - NumWorks Edition
import kandinsky as kd
import ion
import time
import random

C_BG = kd.color(247, 247, 247)
C_DARK = kd.color(83, 83, 83)
C_LIGHT = kd.color(180, 180, 180)

GROUND_Y = 190
DINO_X = 40
DINO_W = 20
DINO_H = 24
GROUND_DINO_Y = GROUND_Y - DINO_H

def draw_dino(y, leg_frame):
    kd.fill_rect(DINO_X + 6, y, 14, 10, C_DARK)
    kd.fill_rect(DINO_X + 8, y + 2, 2, 2, C_BG)
    kd.fill_rect(DINO_X + 2, y + 8, 14, 10, C_DARK)
    kd.fill_rect(DINO_X + 16, y + 10, 3, 2, C_DARK)
    if y < GROUND_DINO_Y:
        kd.fill_rect(DINO_X + 4, y + 18, 4, 6, C_DARK)
        kd.fill_rect(DINO_X + 12, y + 18, 4, 6, C_DARK)
    elif leg_frame == 0:
        kd.fill_rect(DINO_X + 4, y + 18, 3, 6, C_DARK)
        kd.fill_rect(DINO_X + 12, y + 18, 3, 3, C_DARK)
    else:
        kd.fill_rect(DINO_X + 4, y + 18, 3, 3, C_DARK)
        kd.fill_rect(DINO_X + 12, y + 18, 3, 6, C_DARK)

def erase_dino(y):
    kd.fill_rect(DINO_X, y, DINO_W, DINO_H, C_BG)

def draw_cactus(cx, ctype):
    if ctype == 0:
        kd.fill_rect(cx + 2, GROUND_Y - 18, 6, 18, C_DARK)
        kd.fill_rect(cx, GROUND_Y - 12, 3, 6, C_DARK)
        kd.fill_rect(cx + 7, GROUND_Y - 14, 3, 6, C_DARK)
    elif ctype == 1:
        kd.fill_rect(cx + 4, GROUND_Y - 26, 8, 26, C_DARK)
        kd.fill_rect(cx, GROUND_Y - 18, 4, 10, C_DARK)
        kd.fill_rect(cx + 12, GROUND_Y - 20, 4, 10, C_DARK)
    else:
        kd.fill_rect(cx + 2, GROUND_Y - 18, 5, 18, C_DARK)
        kd.fill_rect(cx + 11, GROUND_Y - 22, 6, 22, C_DARK)

def erase_cactus(cx, ctype):
    w = 12 if ctype == 0 else (18 if ctype == 1 else 20)
    kd.fill_rect(cx, GROUND_Y - 28, w + 4, 28, C_BG)

def main():
    hi_score = 0
    while True:
        kd.fill_rect(0, 0, 320, 240, C_BG)
        kd.fill_rect(0, GROUND_Y, 320, 2, C_DARK)
        kd.draw_string("DINO RUNNER", 12, 10, C_DARK, C_BG)

        dino_y = float(GROUND_DINO_Y)
        vel_y = 0.0
        on_ground = True
        cacti = []
        cacti.append([320, 0])
        score = 0
        speed = 4.5
        leg_frame = 0
        frame_cnt = 0

        game_over = False
        while not game_over:
            if ion.keydown(ion.KEY_BACK):
                return

            if (ion.keydown(ion.KEY_OK) or ion.keydown(ion.KEY_UP)) and on_ground:
                vel_y = -8.5
                on_ground = False

            old_dy = int(dino_y)
            if not on_ground:
                vel_y += 0.65
                dino_y += vel_y
                if dino_y >= GROUND_DINO_Y:
                    dino_y = float(GROUND_DINO_Y)
                    vel_y = 0.0
                    on_ground = True

            frame_cnt += 1
            if frame_cnt % 6 == 0:
                leg_frame = 1 - leg_frame

            erase_dino(old_dy)
            draw_dino(int(dino_y), leg_frame)

            new_cacti = []
            for c in cacti:
                old_cx = int(c[0])
                c[0] -= speed
                new_cx = int(c[0])
                erase_cactus(old_cx, c[1])

                cw = 12 if c[1] == 0 else (18 if c[1] == 1 else 20)
                ch = 18 if c[1] == 0 else (26 if c[1] == 1 else 22)

                d_rect_x = DINO_X + 3
                d_rect_y = int(dino_y) + 2
                d_rect_w = DINO_W - 5
                d_rect_h = DINO_H - 2

                c_rect_x = new_cx
                c_rect_y = GROUND_Y - ch
                c_rect_w = cw
                c_rect_h = ch

                if (d_rect_x < c_rect_x + c_rect_w and
                    d_rect_x + d_rect_w > c_rect_x and
                    d_rect_y < c_rect_y + c_rect_h and
                    d_rect_y + d_rect_h > c_rect_y):
                    game_over = True

                if c[0] > -25:
                    draw_cactus(new_cx, c[1])
                    new_cacti.append(c)
                else:
                    score += 10
                    if score > hi_score:
                        hi_score = score
                    if speed < 8.0:
                        speed += 0.08

            cacti = new_cacti
            if len(cacti) == 0 or cacti[-1][0] < 320 - random.randint(110, 180):
                cacti.append([320, random.randint(0, 2)])

            sc_str = "HI " + str(hi_score).zfill(5) + "  " + str(score).zfill(5)
            kd.draw_string(sc_str, 155, 10, C_DARK, C_BG)

            time.sleep(0.02)

        kd.fill_rect(45, 90, 230, 56, kd.color(230, 230, 230))
        kd.draw_string("G A M E   O V E R", 80, 98, C_DARK, kd.color(230, 230, 230))
        kd.draw_string("OK: Rejouer | Back: Quitter", 52, 120, kd.color(120, 120, 120), kd.color(230, 230, 230))

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  },
  {
    filename: 'space_invaders.nws',
    name: 'Space Invaders Retro',
    description: 'Armada complete denvahisseurs, tirs et vagues sans glitch',
    author: 'Tomohiro Nishikado / EquaLib',
    version: '2.0',
    scriptName: 'space_invaders.py',
    scriptContent: `# Space Invaders - NumWorks Edition
import kandinsky as kd
import ion
import time
import random

C_BG = kd.color(5, 5, 18)
C_GREEN = kd.color(50, 230, 100)
C_YELLOW = kd.color(255, 220, 30)
C_CYAN = kd.color(40, 210, 255)
C_RED = kd.color(255, 60, 60)
C_WHITE = kd.color(255, 255, 255)

CAN_Y = 210
CAN_W = 20
CAN_H = 14

def draw_cannon(x):
    kd.fill_rect(x + 8, CAN_Y, 4, 5, C_GREEN)
    kd.fill_rect(x + 2, CAN_Y + 5, 16, 7, C_GREEN)
    kd.fill_rect(x, CAN_Y + 12, 20, 2, C_GREEN)

def erase_cannon(x):
    kd.fill_rect(x, CAN_Y, CAN_W + 1, CAN_H + 1, C_BG)

def draw_invader(x, y, r, f):
    col = C_YELLOW if r == 0 else (C_CYAN if r == 1 else C_RED)
    if f == 0:
        kd.fill_rect(x + 2, y, 10, 8, col)
        kd.fill_rect(x, y + 2, 14, 4, col)
        kd.fill_rect(x + 1, y + 8, 3, 2, col)
        kd.fill_rect(x + 10, y + 8, 3, 2, col)
    else:
        kd.fill_rect(x + 2, y, 10, 8, col)
        kd.fill_rect(x, y + 4, 14, 4, col)
        kd.fill_rect(x + 4, y + 8, 2, 2, col)
        kd.fill_rect(x + 8, y + 8, 2, 2, col)

def erase_invader(x, y):
    kd.fill_rect(x, y, 16, 11, C_BG)

def main():
    while True:
        kd.fill_rect(0, 0, 320, 240, C_BG)
        kd.draw_string("SPACE INVADERS", 10, 6, C_GREEN, C_BG)
        score = 0
        lives = 3

        can_x = 150
        old_can_x = can_x
        draw_cannon(can_x)

        aliens = []
        for r in range(3):
            for c in range(6):
                aliens.append({'r': r, 'c': c, 'alive': True})

        form_x = 35.0
        form_y = 35.0
        form_dx = 3.0
        anim_frame = 0
        step_timer = 0
        step_delay = 14

        laser_x = -1
        laser_y = -1

        bomb_x = -1
        bomb_y = -1

        def draw_hud():
            kd.fill_rect(170, 6, 145, 18, C_BG)
            kd.draw_string("SC:" + str(score) + " V:" + str(lives), 175, 6, C_WHITE, C_BG)

        draw_hud()

        game_over = False
        won = False

        while not game_over and not won:
            if ion.keydown(ion.KEY_BACK):
                return

            if ion.keydown(ion.KEY_LEFT) and can_x > 10:
                can_x -= 4
            elif ion.keydown(ion.KEY_RIGHT) and can_x < 290:
                can_x += 4

            if can_x != old_can_x:
                erase_cannon(old_can_x)
                draw_cannon(can_x)
                old_can_x = can_x

            if ion.keydown(ion.KEY_OK) and laser_y < 0:
                laser_x = can_x + 9
                laser_y = CAN_Y - 4

            if laser_y >= 0:
                kd.fill_rect(laser_x, laser_y, 2, 6, C_BG)
                laser_y -= 8
                if laser_y < 24:
                    laser_y = -1
                else:
                    kd.fill_rect(laser_x, laser_y, 2, 6, C_YELLOW)

            step_timer += 1
            if step_timer >= step_delay:
                step_timer = 0
                anim_frame = 1 - anim_frame

                for a in aliens:
                    if a['alive']:
                        ax = int(form_x + a['c'] * 34)
                        ay = int(form_y + a['r'] * 18)
                        erase_invader(ax, ay)

                edge_hit = False
                for a in aliens:
                    if a['alive']:
                        ax = form_x + a['c'] * 34
                        if (form_dx > 0 and ax >= 285) or (form_dx < 0 and ax <= 15):
                            edge_hit = True
                            break

                if edge_hit:
                    form_dx = -form_dx
                    form_y += 8
                else:
                    form_x += form_dx

                alive_count = 0
                for a in aliens:
                    if a['alive']:
                        alive_count += 1
                        ax = int(form_x + a['c'] * 34)
                        ay = int(form_y + a['r'] * 18)
                        draw_invader(ax, ay, a['r'], anim_frame)
                        if ay + 10 >= CAN_Y:
                            game_over = True

                if alive_count == 0:
                    won = True
                    break

                step_delay = max(4, int(alive_count * 0.7) + 2)

                if bomb_y < 0 and random.random() < 0.4:
                    alive_aliens = [a for a in aliens if a['alive']]
                    if alive_aliens:
                        shooter = random.choice(alive_aliens)
                        bomb_x = int(form_x + shooter['c'] * 34 + 6)
                        bomb_y = int(form_y + shooter['r'] * 18 + 10)

            if bomb_y >= 0:
                kd.fill_rect(bomb_x, bomb_y, 3, 6, C_BG)
                bomb_y += 5
                if bomb_y >= CAN_Y and bomb_y <= CAN_Y + CAN_H and bomb_x >= can_x and bomb_x <= can_x + CAN_W:
                    bomb_y = -1
                    lives -= 1
                    draw_hud()
                    if lives <= 0:
                        game_over = True
                elif bomb_y > 230:
                    bomb_y = -1
                else:
                    kd.fill_rect(bomb_x, bomb_y, 3, 6, C_RED)

            if laser_y >= 0:
                for a in aliens:
                    if a['alive']:
                        ax = int(form_x + a['c'] * 34)
                        ay = int(form_y + a['r'] * 18)
                        if ax <= laser_x <= ax + 14 and ay <= laser_y <= ay + 10:
                            a['alive'] = False
                            kd.fill_rect(laser_x, laser_y, 2, 6, C_BG)
                            laser_y = -1
                            erase_invader(ax, ay)
                            score += (30 if a['r'] == 0 else (20 if a['r'] == 1 else 10))
                            draw_hud()
                            break

            time.sleep(0.02)

        box_bg = kd.color(20, 60, 30) if won else kd.color(60, 20, 25)
        text_col = C_GREEN if won else C_RED
        kd.fill_rect(45, 90, 230, 56, box_bg)
        msg = "VAGUE NETTOYEE !" if won else "GAME OVER !"
        kd.draw_string(msg, 78, 98, text_col, box_bg)
        kd.draw_string("OK: Rejouer | Back: Quitter", 48, 122, C_WHITE, box_bg)

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  },
  {
    filename: 'breakout.nws',
    name: 'Casse-Briques (Breakout)',
    description: '35 briques colorees, rebonds physiques, scores et 3 vies',
    author: 'Atari / EquaLib NW',
    version: '2.0',
    scriptName: 'breakout.py',
    scriptContent: `# Casse-Briques (Breakout) - NumWorks Edition
import kandinsky as kd
import ion
import time

C_BG = kd.color(12, 14, 24)
C_WHITE = kd.color(255, 255, 255)
C_PADDLE = kd.color(240, 240, 255)

COLORS = [
    kd.color(240, 50, 60),
    kd.color(250, 130, 20),
    kd.color(250, 210, 30),
    kd.color(40, 200, 100),
    kd.color(30, 180, 240)
]
POINTS = [50, 40, 30, 20, 10]

BW = 38
BH = 10
GAP_X = 4
GAP_Y = 4
GRID_X = 15
GRID_Y = 38
PW = 48
PH = 7
PY = 222

def draw_brick(r, c):
    x = GRID_X + c * (BW + GAP_X)
    y = GRID_Y + r * (BH + GAP_Y)
    kd.fill_rect(x, y, BW, BH, COLORS[r])

def erase_brick(r, c):
    x = GRID_X + c * (BW + GAP_X)
    y = GRID_Y + r * (BH + GAP_Y)
    kd.fill_rect(x, y, BW, BH, C_BG)

def draw_hud(score, lives):
    kd.fill_rect(0, 0, 320, 28, C_BG)
    kd.draw_string("CASSE-BRIQUES", 10, 6, kd.color(255, 200, 0), C_BG)
    kd.draw_string("SC:" + str(score) + " VIES:" + str(lives), 170, 6, C_WHITE, C_BG)

def main():
    while True:
        kd.fill_rect(0, 0, 320, 240, C_BG)
        bricks = [[1] * 7 for _ in range(5)]
        remaining = 35
        for r in range(5):
            for c in range(7):
                draw_brick(r, c)

        score = 0
        lives = 3
        draw_hud(score, lives)

        paddle_x = 136
        old_px = paddle_x
        kd.fill_rect(paddle_x, PY, PW, PH, C_PADDLE)

        ball_x = 157.0
        ball_y = float(PY - 8)
        old_bx, old_by = int(ball_x), int(ball_y)
        bvx = 2.8
        bvy = -3.2
        attached = True

        won = False
        while lives > 0 and remaining > 0:
            if ion.keydown(ion.KEY_BACK):
                return

            if ion.keydown(ion.KEY_LEFT) and paddle_x > 8:
                paddle_x -= 5
            elif ion.keydown(ion.KEY_RIGHT) and paddle_x + PW < 312:
                paddle_x += 5

            if paddle_x != old_px:
                kd.fill_rect(old_px, PY, PW, PH, C_BG)
                kd.fill_rect(paddle_x, PY, PW, PH, C_PADDLE)
                old_px = paddle_x

            if attached:
                ball_x = paddle_x + PW / 2 - 3
                ball_y = float(PY - 7)
                if ion.keydown(ion.KEY_OK):
                    attached = False
                    bvx = 2.8
                    bvy = -3.4
            else:
                ball_x += bvx
                ball_y += bvy

                if ball_x <= 4:
                    ball_x = 4
                    bvx = abs(bvx)
                elif ball_x + 6 >= 316:
                    ball_x = 310
                    bvx = -abs(bvx)

                if ball_y <= 30:
                    ball_y = 30
                    bvy = abs(bvy)

                if ball_y + 6 >= PY and ball_y <= PY + PH and ball_x + 6 >= paddle_x and ball_x <= paddle_x + PW:
                    ball_y = float(PY - 6)
                    rel = (ball_x + 3) - (paddle_x + PW / 2)
                    bvx = rel * 0.16
                    bvy = -max(2.8, abs(bvy))

                bx_int = int(ball_x)
                by_int = int(ball_y)
                hit_col = (bx_int + 3 - GRID_X) // (BW + GAP_X)
                hit_row = (by_int + 3 - GRID_Y) // (BH + GAP_Y)

                if 0 <= hit_row < 5 and 0 <= hit_col < 7:
                    if bricks[hit_row][hit_col] == 1:
                        bricks[hit_row][hit_col] = 0
                        erase_brick(hit_row, hit_col)
                        remaining -= 1
                        score += POINTS[hit_row]
                        draw_hud(score, lives)
                        bvy = -bvy

                if ball_y > 236:
                    lives -= 1
                    draw_hud(score, lives)
                    kd.fill_rect(old_bx, old_by, 6, 6, C_BG)
                    attached = True
                    ball_x = paddle_x + PW / 2 - 3
                    ball_y = float(PY - 7)

            kd.fill_rect(old_bx, old_by, 6, 6, C_BG)
            old_bx, old_by = int(ball_x), int(ball_y)
            kd.fill_rect(old_bx, old_by, 6, 6, C_WHITE)

            time.sleep(0.02)

        won = remaining == 0
        box_bg = kd.color(20, 60, 30) if won else kd.color(60, 20, 25)
        text_col = kd.color(50, 230, 100) if won else kd.color(255, 70, 70)
        kd.fill_rect(45, 95, 230, 56, box_bg)
        msg = "VICTOIRE !" if won else "GAME OVER !"
        kd.draw_string(msg, 110, 102, text_col, box_bg)
        kd.draw_string("OK: Rejouer | Back: Quitter", 48, 126, C_WHITE, box_bg)

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  },
  {
    filename: 'puissance4.nws',
    name: 'Puissance 4',
    description: 'Plateau 7x6 avec gravite reelle, 1P vs IA tactique et detection de victoire',
    author: 'Milton Bradley / EquaLib',
    version: '2.0',
    scriptName: 'puissance4.py',
    scriptContent: `# Puissance 4 - NumWorks Edition (1P vs Smart AI)
import kandinsky as kd
import ion
import time
import random

C_BG = kd.color(20, 35, 75)
C_BOARD = kd.color(30, 75, 175)
C_SLOT = kd.color(15, 25, 55)
C_YELLOW = kd.color(255, 215, 0)
C_RED = kd.color(235, 45, 55)
C_WHITE = kd.color(255, 255, 255)

START_X = 28
START_Y = 56
SLOT_W = 32
SLOT_H = 26
PITCH_X = 38
PITCH_Y = 29

def draw_cabinet():
    kd.fill_rect(0, 0, 320, 240, C_BG)
    kd.draw_string("PUISSANCE 4", 105, 8, C_WHITE, C_BG)
    kd.fill_rect(START_X - 6, START_Y - 4, 7 * PITCH_X + 8, 6 * PITCH_Y + 8, C_BOARD)
    for r in range(6):
        for c in range(7):
            draw_chip(r, c, 0)

def draw_chip(r, c, val):
    x = START_X + c * PITCH_X
    y = START_Y + r * PITCH_Y
    col = C_SLOT if val == 0 else (C_YELLOW if val == 1 else C_RED)
    kd.fill_rect(x, y, SLOT_W, SLOT_H, col)
    if val != 0:
        kd.fill_rect(x + 4, y + 3, 6, 4, C_WHITE)

def draw_cursor(sel_c, p):
    kd.fill_rect(START_X - 6, 32, 7 * PITCH_X + 8, 18, C_BG)
    x = START_X + sel_c * PITCH_X
    col = C_YELLOW if p == 1 else C_RED
    kd.fill_rect(x + 8, 34, 16, 12, col)
    kd.fill_rect(x + 12, 46, 8, 4, col)

def check_win(board, p):
    for r in range(6):
        for c in range(4):
            if board[r][c] == p and board[r][c+1] == p and board[r][c+2] == p and board[r][c+3] == p:
                return [(r, c+i) for i in range(4)]
    for r in range(3):
        for c in range(7):
            if board[r][c] == p and board[r+1][c] == p and board[r+2][c] == p and board[r+3][c] == p:
                return [(r+i, c) for i in range(4)]
    for r in range(3):
        for c in range(4):
            if board[r][c] == p and board[r+1][c+1] == p and board[r+2][c+2] == p and board[r+3][c+3] == p:
                return [(r+i, c+i) for i in range(4)]
    for r in range(3, 6):
        for c in range(4):
            if board[r][c] == p and board[r-1][c+1] == p and board[r-2][c+2] == p and board[r-3][c+3] == p:
                return [(r-i, c+i) for i in range(4)]
    return None

def get_lowest_row(board, c):
    for r in range(5, -1, -1):
        if board[r][c] == 0:
            return r
    return -1

def ai_choose_col(board):
    for c in range(7):
        r = get_lowest_row(board, c)
        if r != -1:
            board[r][c] = 2
            if check_win(board, 2):
                board[r][c] = 0
                return c
            board[r][c] = 0
    for c in range(7):
        r = get_lowest_row(board, c)
        if r != -1:
            board[r][c] = 1
            if check_win(board, 1):
                board[r][c] = 0
                return c
            board[r][c] = 0
    preferred = [3, 2, 4, 1, 5, 0, 6]
    for c in preferred:
        if get_lowest_row(board, c) != -1:
            return c
    return 0

def drop_anim(board, c, target_r, p):
    for r in range(target_r + 1):
        draw_chip(r, c, p)
        time.sleep(0.02)
        if r < target_r:
            draw_chip(r, c, 0)
    board[target_r][c] = p

def main():
    while True:
        draw_cabinet()
        board = [[0] * 7 for _ in range(6)]
        current_p = 1
        sel_c = 3
        draw_cursor(sel_c, current_p)

        game_over = False
        winner = 0

        while not game_over:
            if ion.keydown(ion.KEY_BACK):
                return

            if current_p == 1:
                if ion.keydown(ion.KEY_LEFT) and sel_c > 0:
                    sel_c -= 1
                    draw_cursor(sel_c, current_p)
                    time.sleep(0.12)
                elif ion.keydown(ion.KEY_RIGHT) and sel_c < 6:
                    sel_c += 1
                    draw_cursor(sel_c, current_p)
                    time.sleep(0.12)
                elif ion.keydown(ion.KEY_OK):
                    target_r = get_lowest_row(board, sel_c)
                    if target_r != -1:
                        drop_anim(board, sel_c, target_r, current_p)
                        winning_cells = check_win(board, current_p)
                        if winning_cells:
                            winner = current_p
                            game_over = True
                            break
                        if all(board[0][c] != 0 for c in range(7)):
                            game_over = True
                            break
                        current_p = 2
                        draw_cursor(sel_c, current_p)
                        time.sleep(0.1)
            else:
                time.sleep(0.3)
                ai_c = ai_choose_col(board)
                sel_c = ai_c
                draw_cursor(sel_c, current_p)
                time.sleep(0.2)
                target_r = get_lowest_row(board, ai_c)
                if target_r != -1:
                    drop_anim(board, ai_c, target_r, current_p)
                    winning_cells = check_win(board, current_p)
                    if winning_cells:
                        winner = current_p
                        game_over = True
                        break
                    if all(board[0][c] != 0 for c in range(7)):
                        game_over = True
                        break
                    current_p = 1
                    draw_cursor(sel_c, current_p)

            time.sleep(0.02)

        if winner != 0 and winning_cells:
            for _ in range(3):
                for (r, c) in winning_cells:
                    kd.fill_rect(START_X + c * PITCH_X, START_Y + r * PITCH_Y, SLOT_W, SLOT_H, C_WHITE)
                time.sleep(0.15)
                for (r, c) in winning_cells:
                    draw_chip(r, c, winner)
                time.sleep(0.15)

        box_bg = kd.color(20, 60, 30) if winner == 1 else (kd.color(60, 20, 25) if winner == 2 else kd.color(40, 40, 50))
        kd.fill_rect(45, 95, 230, 56, box_bg)
        msg = "JOUEUR 1 A GAGNE !" if winner == 1 else ("L'IA A GAGNE !" if winner == 2 else "MATCH NUL !")
        kd.draw_string(msg, 65, 102, C_WHITE, box_bg)
        kd.draw_string("OK: Rejouer | Back: Quitter", 48, 126, kd.color(200, 220, 240), box_bg)

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  },
  {
    filename: 'flappy.nws',
    name: 'Flappy Bird NW',
    description: 'Le celebre jeu Flappy Bird avec physique, tuyaux et score a 60 FPS',
    author: 'EquaLib Arcade',
    version: '2.0',
    scriptName: 'flappy.py',
    scriptContent: `# Flappy Bird - NumWorks Edition
import kandinsky as kd
import ion
import time
import random

C_SKY = kd.color(110, 195, 230)
C_PIPE = kd.color(60, 180, 50)
C_PIPE_DARK = kd.color(40, 130, 35)
C_BIRD = kd.color(255, 215, 0)
C_ORANGE = kd.color(255, 120, 0)
C_GROUND = kd.color(220, 205, 140)
C_GRASS = kd.color(100, 200, 60)
C_WHITE = kd.color(255, 255, 255)

GROUND_Y = 215
BIRD_X = 60
BIRD_W = 16
BIRD_H = 12

def draw_hud(score, best):
    kd.fill_rect(10, 6, 150, 20, C_SKY)
    kd.draw_string("SC:" + str(score) + " HI:" + str(best), 10, 6, kd.color(30, 40, 60), C_SKY)

def draw_bird(y):
    kd.fill_rect(BIRD_X, int(y), BIRD_W, BIRD_H, C_BIRD)
    kd.fill_rect(BIRD_X + 11, int(y) + 2, 3, 3, C_WHITE)
    kd.fill_rect(BIRD_X + 12, int(y) + 3, 2, 2, kd.color(0, 0, 0))
    kd.fill_rect(BIRD_X + 13, int(y) + 6, 4, 3, C_ORANGE)
    kd.fill_rect(BIRD_X + 3, int(y) + 4, 5, 4, C_ORANGE)

def erase_bird(y):
    kd.fill_rect(BIRD_X, int(y), BIRD_W + 2, BIRD_H, C_SKY)

def draw_pipe(x, gap_y, gap_h):
    # Top pipe
    if gap_y > 0:
        kd.fill_rect(x, 0, 30, gap_y, C_PIPE)
        kd.fill_rect(x - 2, gap_y - 8, 34, 8, C_PIPE_DARK)
    # Bottom pipe
    bot_y = gap_y + gap_h
    if bot_y < GROUND_Y:
        kd.fill_rect(x - 2, bot_y, 34, 8, C_PIPE_DARK)
        kd.fill_rect(x, bot_y + 8, 30, GROUND_Y - (bot_y + 8), C_PIPE)

def erase_pipe(x, gap_y, gap_h):
    kd.fill_rect(x - 2, 0, 35, GROUND_Y, C_SKY)

def main():
    best_score = 0
    while True:
        kd.fill_rect(0, 0, 320, GROUND_Y, C_SKY)
        kd.fill_rect(0, GROUND_Y, 320, 6, C_GRASS)
        kd.fill_rect(0, GROUND_Y + 6, 320, 240 - GROUND_Y - 6, C_GROUND)

        bird_y = 90.0
        vel = 0.0
        score = 0
        draw_hud(score, best_score)
        draw_bird(bird_y)

        # Pipe setup
        pipes = [[320, random.randint(35, 120), 65, False]]

        game_over = False
        while not game_over:
            if ion.keydown(ion.KEY_BACK):
                return

            if ion.keydown(ion.KEY_OK) or ion.keydown(ion.KEY_UP):
                vel = -4.8

            old_by = bird_y
            vel += 0.42
            bird_y += vel

            if bird_y <= 2:
                bird_y = 2
                vel = 0
            if bird_y + BIRD_H >= GROUND_Y:
                game_over = True

            erase_bird(old_by)
            draw_bird(bird_y)

            # Move pipes
            new_pipes = []
            for p in pipes:
                old_px = p[0]
                p[0] -= 3
                new_px = p[0]

                erase_pipe(old_px, p[1], p[2])

                # Check pass
                if not p[3] and p[0] + 30 < BIRD_X:
                    p[3] = True
                    score += 1
                    if score > best_score:
                        best_score = score
                    draw_hud(score, best_score)

                # Collision check
                if (BIRD_X + BIRD_W > new_px and BIRD_X < new_px + 30):
                    if bird_y < p[1] or bird_y + BIRD_H > p[1] + p[2]:
                        game_over = True

                if p[0] > -35:
                    draw_pipe(new_px, p[1], p[2])
                    new_pipes.append(p)

            pipes = new_pipes
            if len(pipes) == 0 or pipes[-1][0] < 320 - 150:
                pipes.append([320, random.randint(35, 120), 65, False])

            time.sleep(0.02)

        kd.fill_rect(45, 90, 230, 56, kd.color(240, 240, 240))
        kd.draw_string("GAME OVER ! SCORE: " + str(score), 55, 98, kd.color(50, 50, 50), kd.color(240, 240, 240))
        kd.draw_string("OK: Rejouer | Back: Quitter", 48, 122, C_ORANGE, kd.color(240, 240, 240))

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  },
  {
    filename: 'snake.nws',
    name: 'Snake Classic',
    description: 'Le jeu du serpent retro avec corps articulé, records et vitesse progressive',
    author: 'EquaLib Arcade',
    version: '2.0',
    scriptName: 'snake.py',
    scriptContent: `# Snake Classic - NumWorks Edition
import kandinsky as kd
import ion
import random
import time

C_BG = kd.color(15, 25, 20)
C_GRID_BG = kd.color(20, 35, 28)
C_BORDER = kd.color(45, 90, 65)
C_SNAKE_HEAD = kd.color(50, 255, 120)
C_SNAKE_BODY = kd.color(30, 190, 90)
C_FOOD = kd.color(255, 60, 60)
C_WHITE = kd.color(255, 255, 255)

CELL = 10
GRID_W = 28
GRID_H = 19
OX = 20
OY = 35

def draw_hud(score, hi):
    kd.fill_rect(0, 0, 320, 32, C_BG)
    kd.draw_string("SNAKE", 20, 8, C_SNAKE_HEAD, C_BG)
    kd.draw_string("SCORE: " + str(score), 120, 8, C_WHITE, C_BG)
    kd.draw_string("HI: " + str(hi), 240, 8, kd.color(255, 215, 0), C_BG)

def draw_cell(cx, cy, col):
    kd.fill_rect(OX + cx * CELL, OY + cy * CELL, CELL - 1, CELL - 1, col)

def main():
    hi_score = 0
    while True:
        kd.fill_rect(0, 0, 320, 240, C_BG)
        kd.fill_rect(OX - 2, OY - 2, GRID_W * CELL + 4, GRID_H * CELL + 4, C_BORDER)
        kd.fill_rect(OX, OY, GRID_W * CELL, GRID_H * CELL, C_GRID_BG)

        score = 0
        draw_hud(score, hi_score)

        snake = [(14, 9), (13, 9), (12, 9)]
        dx, dy = 1, 0
        for seg in snake[1:]:
            draw_cell(seg[0], seg[1], C_SNAKE_BODY)
        draw_cell(snake[0][0], snake[0][1], C_SNAKE_HEAD)

        food = (random.randint(0, GRID_W - 1), random.randint(0, GRID_H - 1))
        while food in snake:
            food = (random.randint(0, GRID_W - 1), random.randint(0, GRID_H - 1))
        draw_cell(food[0], food[1], C_FOOD)

        step_delay = 0.12
        game_over = False

        while not game_over:
            if ion.keydown(ion.KEY_BACK):
                return

            if ion.keydown(ion.KEY_UP) and dy == 0:
                dx, dy = 0, -1
            elif ion.keydown(ion.KEY_DOWN) and dy == 0:
                dx, dy = 0, 1
            elif ion.keydown(ion.KEY_LEFT) and dx == 0:
                dx, dy = -1, 0
            elif ion.keydown(ion.KEY_RIGHT) and dx == 0:
                dx, dy = 1, 0

            head_x = snake[0][0] + dx
            head_y = snake[0][1] + dy

            # Wall collision
            if head_x < 0 or head_x >= GRID_W or head_y < 0 or head_y >= GRID_H:
                game_over = True
                break

            # Self collision
            if (head_x, head_y) in snake[:-1]:
                game_over = True
                break

            new_head = (head_x, head_y)
            snake.insert(0, new_head)

            # Redraw old head as body
            draw_cell(snake[1][0], snake[1][1], C_SNAKE_BODY)
            # Draw new head
            draw_cell(new_head[0], new_head[1], C_SNAKE_HEAD)

            if new_head == food:
                score += 1
                if score > hi_score:
                    hi_score = score
                draw_hud(score, hi_score)
                step_delay = max(0.06, 0.12 - (score * 0.003))
                food = (random.randint(0, GRID_W - 1), random.randint(0, GRID_H - 1))
                while food in snake:
                    food = (random.randint(0, GRID_W - 1), random.randint(0, GRID_H - 1))
                draw_cell(food[0], food[1], C_FOOD)
            else:
                tail = snake.pop()
                draw_cell(tail[0], tail[1], C_GRID_BG)

            time.sleep(step_delay)

        kd.fill_rect(45, 95, 230, 56, kd.color(30, 20, 25))
        kd.draw_string("GAME OVER ! SCORE: " + str(score), 55, 102, kd.color(255, 100, 100), kd.color(30, 20, 25))
        kd.draw_string("OK: Rejouer | Back: Quitter", 48, 126, C_WHITE, kd.color(30, 20, 25))

        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)
        while not ion.keydown(ion.KEY_OK):
            if ion.keydown(ion.KEY_BACK):
                return
            time.sleep(0.03)
        while ion.keydown(ion.KEY_OK):
            time.sleep(0.02)

main()
`
  }
];

for (const g of games) {
  const filePath = path.join(appsDir, g.filename);
  const jsonContent = {
    name: g.name,
    description: g.description,
    author: g.author,
    version: g.version,
    created_at: "2026-10-09T18:00:00.000Z",
    scripts: [
      {
        name: g.scriptName,
        text: g.scriptContent
      }
    ]
  };
  fs.writeFileSync(filePath, JSON.stringify(jsonContent, null, 2), 'utf-8');
  console.log(`✓ Updated ${g.filename} (${jsonContent.scripts[0].text.length} chars of Python script)`);
}

console.log('\n=== ALL GAMES UPGRADED SUCCESSFULLY! ===');
