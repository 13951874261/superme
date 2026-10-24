"""
坦克大战 (Battle City / Tank Battle)
Classic tank battle game implemented with pygame.

Controls:
  Arrow Keys / WASD  - Move player tank
  Space              - Fire bullet
  R                  - Restart after game over
  ESC                - Quit

Run:
  pip install pygame
  python tank_battle.py
"""

import pygame
import sys
import random
import math
import time

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TILE = 40                       # tile size in pixels
COLS, ROWS = 16, 14             # map grid dimensions
WIDTH  = TILE * COLS            # 640
HEIGHT = TILE * ROWS + 48       # 608  (48 px bottom bar for HUD)
FPS = 60

# Directions
UP, DOWN, LEFT, RIGHT = 0, 1, 2, 3
DIR_VEC = {UP: (0, -1), DOWN: (0, 1), LEFT: (-1, 0), RIGHT: (1, 0)}

# Tile types
EMPTY  = 0
BRICK  = 1
STEEL  = 2
WATER  = 3
TREE   = 4
BASE   = 5

# Colors
C_BLACK   = (0, 0, 0)
C_WHITE   = (255, 255, 255)
C_GRAY    = (128, 128, 128)
C_DKGRAY  = (64, 64, 64)
C_RED     = (200, 40, 40)
C_GREEN   = (34, 139, 34)
C_DKGREEN = (0, 100, 0)
C_BLUE    = (40, 80, 200)
C_YELLOW  = (240, 220, 60)
C_ORANGE  = (240, 140, 20)
C_BROWN   = (160, 82, 45)
C_LTBROWN = (205, 133, 63)
C_SILVER  = (192, 192, 192)
C_HUD_BG  = (40, 40, 40)

# Map layout (14 rows x 16 cols)
# 0=empty 1=brick 2=steel 3=water 4=tree 5=base
LEVEL_MAP = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0],
    [0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0],
    [0,1,1,0,0,1,1,2,2,1,1,0,0,1,1,0],
    [0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,0,0,4,4,0,0,1,1,0,0,0],
    [2,0,0,1,1,0,0,4,4,0,0,1,1,0,0,2],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,1,0,0,2,0,0,0,0,2,0,0,1,1,0],
    [0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0],
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,5,5,1,0,0,0,0,0,0],
]

ENEMY_SPAWN_POS = [(0, 0), (COLS // 2 - 1, 0), (COLS - 2, 0)]

# Powerup types
PW_STAR   = 'star'
PW_SHIELD = 'shield'
PW_LIFE   = 'life'
PW_BOMB   = 'bomb'

# ---------------------------------------------------------------------------
# Helper drawing functions  (no external assets needed)
# ---------------------------------------------------------------------------

def draw_tank_body(surface, x, y, size, direction, body_color, turret_color):
    """Draw a simple tank sprite at (x,y) facing *direction*."""
    cx, cy = x + size // 2, y + size // 2
    half = size // 2
    # body
    body_rect = pygame.Rect(x + 4, y + 4, size - 8, size - 8)
    pygame.draw.rect(surface, body_color, body_rect)
    # tracks
    track_c = tuple(max(0, c - 50) for c in body_color)
    if direction in (UP, DOWN):
        pygame.draw.rect(surface, track_c, (x + 1, y + 2, 6, size - 4))
        pygame.draw.rect(surface, track_c, (x + size - 7, y + 2, 6, size - 4))
    else:
        pygame.draw.rect(surface, track_c, (x + 2, y + 1, size - 4, 6))
        pygame.draw.rect(surface, track_c, (x + 2, y + size - 7, size - 4, 6))
    # turret circle
    pygame.draw.circle(surface, turret_color, (cx, cy), size // 5)
    # barrel
    dx, dy = DIR_VEC[direction]
    bx, by = cx + dx * (half - 2), cy + dy * (half - 2)
    pygame.draw.line(surface, turret_color, (cx, cy), (bx, by), 4)


def draw_explosion(surface, x, y, radius, phase):
    """Draw expanding explosion rings."""
    colors = [C_YELLOW, C_ORANGE, C_RED]
    for i, c in enumerate(colors):
        r = max(1, int(radius * (1 - i * 0.25) * phase))
        a_surf = pygame.Surface((r * 2, r * 2), pygame.SRCALPHA)
        alpha = max(0, int(200 * (1 - phase)))
        pygame.draw.circle(a_surf, (*c, alpha), (r, r), r)
        surface.blit(a_surf, (x - r, y - r))


# ---------------------------------------------------------------------------
# Game objects
# ---------------------------------------------------------------------------

class Bullet:
    SPEED = 6

    def __init__(self, x, y, direction, owner):
        self.x = float(x)
        self.y = float(y)
        self.direction = direction
        self.owner = owner  # 'player' or 'enemy'
        self.alive = True
        self.radius = 4
        dx, dy = DIR_VEC[direction]
        self.vx = dx * self.SPEED
        self.vy = dy * self.SPEED

    def update(self):
        self.x += self.vx
        self.y += self.vy
        if self.x < 0 or self.x > WIDTH or self.y < 0 or self.y > TILE * ROWS:
            self.alive = False

    def draw(self, surface):
        pygame.draw.circle(surface, C_YELLOW, (int(self.x), int(self.y)), self.radius)

    def get_rect(self):
        return pygame.Rect(int(self.x) - self.radius, int(self.y) - self.radius,
                           self.radius * 2, self.radius * 2)


class Explosion:
    DURATION = 0.4

    def __init__(self, x, y, big=False):
        self.x = x
        self.y = y
        self.timer = 0
        self.big = big
        self.max_r = 30 if big else 18

    @property
    def alive(self):
        return self.timer < self.DURATION

    def update(self, dt):
        self.timer += dt

    def draw(self, surface):
        phase = min(self.timer / self.DURATION, 1.0)
        draw_explosion(surface, self.x, self.y, self.max_r, phase)


class Powerup:
    BLINK_RATE = 0.3

    def __init__(self, kind, x, y):
        self.kind = kind
        self.x = x
        self.y = y
        self.timer = 0
        self.alive = True
        self.lifetime = 10.0  # seconds

    def update(self, dt):
        self.timer += dt
        if self.timer > self.lifetime:
            self.alive = False

    def draw(self, surface):
        if int(self.timer / self.BLINK_RATE) % 2 == 0:
            rect = pygame.Rect(self.x, self.y, TILE, TILE)
            pygame.draw.rect(surface, C_WHITE, rect)
            pygame.draw.rect(surface, C_RED, rect, 2)
            font = pygame.font.SysFont(None, 20)
            label = {'star': 'S', 'shield': 'A', 'life': '+', 'bomb': 'B'}[self.kind]
            txt = font.render(label, True, C_BLACK)
            surface.blit(txt, (self.x + TILE // 2 - txt.get_width() // 2,
                               self.y + TILE // 2 - txt.get_height() // 2))

    def get_rect(self):
        return pygame.Rect(self.x, self.y, TILE, TILE)


class Tank:
    def __init__(self, gx, gy, direction, body_color, turret_color,
                 speed=2, is_player=False, tier=0):
        self.gx = gx
        self.gy = gy
        self.x = float(gx * TILE)
        self.y = float(gy * TILE)
        self.w = TILE * 2   # tank occupies 2x2 tiles conceptually but drawn in TILE
        self.h = TILE * 2
        # Actually keep tank size = TILE for simplicity
        self.w = TILE
        self.h = TILE
        self.direction = direction
        self.body_color = body_color
        self.turret_color = turret_color
        self.speed = speed
        self.is_player = is_player
        self.tier = tier  # 0-3 for enemy strength
        self.alive = True
        self.hp = 1 + tier
        self.shoot_cd = 0
        self.shoot_interval = 0.6 if is_player else (1.2 - tier * 0.15)
        self.shield_timer = 0
        self.frozen_timer = 0
        # enemy AI
        self.ai_move_timer = 0
        self.ai_move_interval = random.uniform(1.0, 3.0)

    def get_rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.w, self.h)

    def try_move(self, direction, dt, tile_map, tanks):
        """Attempt to move in *direction*. Returns True if moved."""
        self.direction = direction
        dx, dy = DIR_VEC[direction]
        speed = self.speed * 60 * dt  # pixels this frame
        nx = self.x + dx * speed
        ny = self.y + dy * speed
        # clamp to map bounds
        nx = max(0, min(nx, TILE * COLS - self.w))
        ny = max(0, min(ny, TILE * ROWS - self.h))
        new_rect = pygame.Rect(int(nx), int(ny), self.w, self.h)
        # tile collision
        for r in range(ROWS):
            for c in range(COLS):
                t = tile_map[r][c]
                if t in (BRICK, STEEL, WATER, BASE):
                    tr = pygame.Rect(c * TILE, r * TILE, TILE, TILE)
                    if new_rect.colliderect(tr):
                        return False
        # tank-tank collision
        for other in tanks:
            if other is self or not other.alive:
                continue
            if new_rect.colliderect(other.get_rect()):
                return False
        self.x = nx
        self.y = ny
        return True

    def shoot(self):
        if self.shoot_cd > 0:
            return None
        self.shoot_cd = self.shoot_interval
        cx = self.x + self.w // 2
        cy = self.y + self.h // 2
        dx, dy = DIR_VEC[self.direction]
        bx = cx + dx * (self.w // 2)
        by = cy + dy * (self.h // 2)
        return Bullet(bx, by, self.direction, 'player' if self.is_player else 'enemy')

    def update(self, dt):
        if self.shoot_cd > 0:
            self.shoot_cd = max(0, self.shoot_cd - dt)
        if self.shield_timer > 0:
            self.shield_timer = max(0, self.shield_timer - dt)
        if self.frozen_timer > 0:
            self.frozen_timer = max(0, self.frozen_timer - dt)

    def draw(self, surface):
        draw_tank_body(surface, int(self.x), int(self.y), self.w,
                       self.direction, self.body_color, self.turret_color)
        # shield effect
        if self.shield_timer > 0:
            if int(self.shield_timer * 8) % 2:
                r = self.w // 2 + 4
                cx = int(self.x) + self.w // 2
                cy = int(self.y) + self.h // 2
                pygame.draw.circle(surface, C_WHITE, (cx, cy), r, 2)
        # HP bar for strong enemies
        if not self.is_player and self.hp > 1:
            bar_w = self.w
            bar_h = 4
            bx = int(self.x)
            by = int(self.y) - 6
            pygame.draw.rect(surface, C_RED, (bx, by, bar_w, bar_h))
            pygame.draw.rect(surface, C_GREEN, (bx, by, int(bar_w * self.hp / (1 + self.tier)), bar_h))


# ---------------------------------------------------------------------------
# Game class
# ---------------------------------------------------------------------------

class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("坦克大战  Tank Battle")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont(None, 28)
        self.big_font = pygame.font.SysFont(None, 56)
        self.reset()

    # ---- init / reset ----
    def reset(self):
        self.tile_map = [row[:] for row in LEVEL_MAP]
        self.player = Tank(7, 12, UP, C_YELLOW, C_DKGREEN, speed=2.5, is_player=True)
        self.player.shield_timer = 3.0
        self.bullets = []
        self.explosions = []
        self.powerups = []
        self.enemies = []
        self.score = 0
        self.lives = 3
        self.level = 1
        self.enemies_to_spawn = 20
        self.spawn_timer = 0
        self.spawn_interval = 3.0
        self.game_over = False
        self.game_won = False
        self.base_alive = True
        self.kill_count = 0
        # spawn first enemies
        for i in range(min(3, self.enemies_to_spawn)):
            self._spawn_enemy(i % len(ENEMY_SPAWN_POS))
            self.enemies_to_spawn -= 1

    def _spawn_enemy(self, slot=None):
        if slot is None:
            slot = random.randint(0, len(ENEMY_SPAWN_POS) - 1)
        gx, gy = ENEMY_SPAWN_POS[slot]
        tier = random.choices([0, 1, 2, 3], weights=[40, 30, 20, 10])[0]
        colors = [
            (C_SILVER, C_GRAY),
            (C_BROWN, C_DKGRAY),
            (C_GREEN, C_DKGRAY),
            (C_RED, C_DKGRAY),
        ]
        bc, tc = colors[tier]
        speed = 1.5 + tier * 0.3
        e = Tank(gx, gy, DOWN, bc, tc, speed=speed, tier=tier)
        # check overlap with existing tanks
        er = e.get_rect()
        for t in self.enemies + [self.player]:
            if t.alive and er.colliderect(t.get_rect()):
                return  # skip
        self.enemies.append(e)

    # ---- main loop ----
    def run(self):
        running = True
        while running:
            dt = self.clock.tick(FPS) / 1000.0
            dt = min(dt, 0.05)  # cap

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    if event.key == pygame.K_r and (self.game_over or self.game_won):
                        self.reset()

            if not self.game_over and not self.game_won:
                self._handle_input(dt)
                self._update(dt)

            self._draw()

        pygame.quit()
        sys.exit()

    # ---- input ----
    def _handle_input(self, dt):
        keys = pygame.key.get_pressed()
        moved = False
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            moved = self.player.try_move(UP, dt, self.tile_map,
                                         self.enemies + [self.player])
        elif keys[pygame.K_DOWN] or keys[pygame.K_s]:
            moved = self.player.try_move(DOWN, dt, self.tile_map,
                                          self.enemies + [self.player])
        elif keys[pygame.K_LEFT] or keys[pygame.K_a]:
            moved = self.player.try_move(LEFT, dt, self.tile_map,
                                          self.enemies + [self.player])
        elif keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            moved = self.player.try_move(RIGHT, dt, self.tile_map,
                                          self.enemies + [self.player])

        if keys[pygame.K_SPACE]:
            b = self.player.shoot()
            if b:
                self.bullets.append(b)

    # ---- update ----
    def _update(self, dt):
        # Player update
        self.player.update(dt)

        # Enemy AI + update
        all_tanks = [self.player] + self.enemies
        for e in self.enemies:
            if not e.alive:
                continue
            e.update(dt)
            if e.frozen_timer > 0:
                continue
            # simple AI
            e.ai_move_timer -= dt
            if e.ai_move_timer <= 0:
                e.direction = random.choice([UP, DOWN, LEFT, RIGHT])
                e.ai_move_interval = random.uniform(1.0, 3.0)
                e.ai_move_timer = e.ai_move_interval
            e.try_move(e.direction, dt, self.tile_map, all_tanks)
            # shoot
            b = e.shoot()
            if b:
                self.bullets.append(b)

        # Bullets
        for b in self.bullets:
            b.update()

        # Bullet - tile collision
        for b in self.bullets[:]:
            if not b.alive:
                continue
            br = b.get_rect()
            for r in range(ROWS):
                for c in range(COLS):
                    t = self.tile_map[r][c]
                    if t == EMPTY or t == TREE:
                        continue
                    tr = pygame.Rect(c * TILE, r * TILE, TILE, TILE)
                    if br.colliderect(tr):
                        if t == BRICK:
                            self.tile_map[r][c] = EMPTY
                            b.alive = False
                            self.explosions.append(Explosion(c * TILE + TILE // 2,
                                                             r * TILE + TILE // 2))
                        elif t == STEEL:
                            b.alive = False
                            self.explosions.append(Explosion(c * TILE + TILE // 2,
                                                             r * TILE + TILE // 2))
                        elif t == WATER:
                            pass  # bullets fly over water
                        elif t == BASE:
                            self.tile_map[r][c] = EMPTY
                            b.alive = False
                            self.base_alive = False
                            self.explosions.append(Explosion(c * TILE + TILE // 2,
                                                             r * TILE + TILE // 2, big=True))
                            self.game_over = True

        # Bullet - tank collision
        for b in self.bullets[:]:
            if not b.alive:
                continue
            br = b.get_rect()
            if b.owner == 'player':
                for e in self.enemies:
                    if e.alive and br.colliderect(e.get_rect()):
                        b.alive = False
                        e.hp -= 1
                        if e.hp <= 0:
                            e.alive = False
                            self.score += (e.tier + 1) * 100
                            self.kill_count += 1
                            self.explosions.append(
                                Explosion(int(e.x) + e.w // 2,
                                          int(e.y) + e.h // 2, big=True))
                            # chance to drop powerup
                            if random.random() < 0.2:
                                kind = random.choice([PW_STAR, PW_SHIELD, PW_LIFE, PW_BOMB])
                                px = random.randint(1, COLS - 2) * TILE
                                py = random.randint(1, ROWS - 2) * TILE
                                self.powerups.append(Powerup(kind, px, py))
                        else:
                            self.explosions.append(
                                Explosion(int(b.x), int(b.y)))
                        break
            else:  # enemy bullet
                if self.player.alive and br.colliderect(self.player.get_rect()):
                    b.alive = False
                    if self.player.shield_timer <= 0:
                        self.lives -= 1
                        self.explosions.append(
                            Explosion(int(self.player.x) + self.player.w // 2,
                                      int(self.player.y) + self.player.h // 2, big=True))
                        if self.lives <= 0:
                            self.player.alive = False
                            self.game_over = True
                        else:
                            # respawn player
                            self.player.x = 7 * TILE
                            self.player.y = 12 * TILE
                            self.player.direction = UP
                            self.player.shield_timer = 3.0

        # Bullet - bullet collision
        alive_bullets = [b for b in self.bullets if b.alive]
        for i in range(len(alive_bullets)):
            for j in range(i + 1, len(alive_bullets)):
                bi, bj = alive_bullets[i], alive_bullets[j]
                if bi.alive and bj.alive and bi.owner != bj.owner:
                    if bi.get_rect().colliderect(bj.get_rect()):
                        bi.alive = False
                        bj.alive = False

        # Clean dead bullets
        self.bullets = [b for b in self.bullets if b.alive]

        # Powerup collision with player
        pr = self.player.get_rect()
        for pw in self.powerups[:]:
            if pw.alive and pr.colliderect(pw.get_rect()):
                pw.alive = False
                self._apply_powerup(pw.kind)

        # Update powerups
        for pw in self.powerups:
            pw.update(dt)
        self.powerups = [pw for pw in self.powerups if pw.alive]

        # Update explosions
        for ex in self.explosions:
            ex.update(dt)
        self.explosions = [ex for ex in self.explosions if ex.alive]

        # Clean dead enemies
        self.enemies = [e for e in self.enemies if e.alive]

        # Spawn new enemies
        max_on_screen = 4
        if len(self.enemies) < max_on_screen and self.enemies_to_spawn > 0:
            self.spawn_timer -= dt
            if self.spawn_timer <= 0:
                self._spawn_enemy()
                self.enemies_to_spawn -= 1
                self.spawn_timer = self.spawn_interval

        # Win condition
        if self.enemies_to_spawn <= 0 and len(self.enemies) == 0:
            self.game_won = True

    def _apply_powerup(self, kind):
        if kind == PW_STAR:
            self.player.speed = min(self.player.speed + 0.5, 4.0)
            self.player.shoot_interval = max(self.player.shoot_interval - 0.1, 0.2)
        elif kind == PW_SHIELD:
            self.player.shield_timer = 10.0
        elif kind == PW_LIFE:
            self.lives += 1
        elif kind == PW_BOMB:
            for e in self.enemies:
                e.alive = False
                self.score += (e.tier + 1) * 100
                self.kill_count += 1
                self.explosions.append(
                    Explosion(int(e.x) + e.w // 2,
                              int(e.y) + e.h // 2, big=True))

    # ---- draw ----
    def _draw(self):
        self.screen.fill(C_BLACK)
        self._draw_map()

        # draw powerups
        for pw in self.powerups:
            pw.draw(self.screen)

        # draw player
        if self.player.alive:
            self.player.draw(self.screen)

        # draw enemies
        for e in self.enemies:
            if e.alive:
                e.draw(self.screen)

        # draw bullets
        for b in self.bullets:
            b.draw(self.screen)

        # draw tree overlay (trees render on top of tanks)
        for r in range(ROWS):
            for c in range(COLS):
                if self.tile_map[r][c] == TREE:
                    self._draw_tile(c, r, TREE, overlay=True)

        # draw explosions
        for ex in self.explosions:
            ex.draw(self.screen)

        # HUD
        self._draw_hud()

        # Game over / win overlay
        if self.game_over:
            self._draw_overlay("GAME OVER", C_RED)
        elif self.game_won:
            self._draw_overlay("YOU WIN!", C_GREEN)

        pygame.display.flip()

    def _draw_map(self):
        for r in range(ROWS):
            for c in range(COLS):
                t = self.tile_map[r][c]
                if t != EMPTY:
                    self._draw_tile(c, r, t)

    def _draw_tile(self, c, r, t, overlay=False):
        x, y = c * TILE, r * TILE
        rect = pygame.Rect(x, y, TILE, TILE)
        if t == BRICK:
            pygame.draw.rect(self.screen, C_BROWN, rect)
            # brick pattern
            for i in range(0, TILE, TILE // 4):
                pygame.draw.line(self.screen, C_LTBROWN, (x, y + i), (x + TILE, y + i), 1)
            for i in range(0, TILE, TILE // 2):
                pygame.draw.line(self.screen, C_LTBROWN, (x + i, y), (x + i, y + TILE), 1)
        elif t == STEEL:
            pygame.draw.rect(self.screen, C_SILVER, rect)
            pygame.draw.rect(self.screen, C_WHITE, rect, 2)
            # cross pattern
            pygame.draw.line(self.screen, C_GRAY, (x, y), (x + TILE, y + TILE), 1)
            pygame.draw.line(self.screen, C_GRAY, (x + TILE, y), (x, y + TILE), 1)
        elif t == WATER:
            pygame.draw.rect(self.screen, C_BLUE, rect)
            # wave pattern
            for i in range(0, TILE, 8):
                for j in range(0, TILE, 8):
                    if (i + j) % 16 == 0:
                        pygame.draw.rect(self.screen, (60, 100, 220),
                                         (x + i, y + j, 6, 6))
        elif t == TREE:
            if not overlay:
                return  # draw trees on overlay pass
            pygame.draw.rect(self.screen, C_DKGREEN, rect)
            # leaf clusters
            for _ in range(5):
                lx = x + random.Random(c * 100 + r * 10 + _).randint(4, TILE - 4)
                ly = y + random.Random(c * 100 + r * 10 + _ + 50).randint(4, TILE - 4)
                lr = random.Random(c * 100 + r * 10 + _ + 99).randint(4, 8)
                pygame.draw.circle(self.screen, C_GREEN, (lx, ly), lr)
        elif t == BASE:
            # eagle / base
            pygame.draw.rect(self.screen, C_BLACK, rect)
            pygame.draw.rect(self.screen, C_WHITE, rect, 2)
            # draw a simplified eagle
            cx, cy = x + TILE // 2, y + TILE // 2
            pygame.draw.polygon(self.screen, C_YELLOW, [
                (cx, y + 6), (x + 6, y + TILE - 6), (x + TILE - 6, y + TILE - 6)
            ])
            pygame.draw.polygon(self.screen, C_ORANGE, [
                (cx, y + 12), (x + 12, y + TILE - 8), (x + TILE - 12, y + TILE - 8)
            ])

    def _draw_hud(self):
        hud_y = TILE * ROWS
        pygame.draw.rect(self.screen, C_HUD_BG, (0, hud_y, WIDTH, 48))
        # lives
        txt = self.font.render(f"Lives: {self.lives}", True, C_WHITE)
        self.screen.blit(txt, (10, hud_y + 12))
        # score
        txt = self.font.render(f"Score: {self.score}", True, C_YELLOW)
        self.screen.blit(txt, (160, hud_y + 12))
        # enemies remaining
        remaining = self.enemies_to_spawn + len(self.enemies)
        txt = self.font.render(f"Enemies: {remaining}", True, C_RED)
        self.screen.blit(txt, (380, hud_y + 12))

    def _draw_overlay(self, text, color):
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 150))
        self.screen.blit(overlay, (0, 0))
        txt = self.big_font.render(text, True, color)
        self.screen.blit(txt, (WIDTH // 2 - txt.get_width() // 2,
                               HEIGHT // 3))
        hint = self.font.render("Press R to restart  |  ESC to quit", True, C_WHITE)
        self.screen.blit(hint, (WIDTH // 2 - hint.get_width() // 2,
                                HEIGHT // 3 + 70))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    game = Game()
    game.run()
