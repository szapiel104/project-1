"""Zamek gracza (11×11 pól) według wspólnego planu src/data/keep-layout.json.

Mury kurtynowe z blankami i basztami, brama z przejazdem, kratą i mostem, donżon nad tylnym murem,
a w środku dziedziniec ze studnią i pomieszczenia: sala tronowa, kuchnia, komnata pana, koszary, lochy z celami.
Ściany pomieszczeń stoją dokładnie na krawędziach pól z planu — tam, gdzie zatrzymuje się symulacja i spacer.
Dachy (grupa 'shell') znikają przy podglądzie wnętrza; sufity ('ceiling') widać tylko z wnętrza podczas spaceru.
Sprzęty, o które się potyka spacerowicz, trafiają do listy 'solid' (prostokąty x0, x1, z0, z1).

Uruchomienie (z katalogu repo):  python tools/models/keep.py
Układ: środek działki = (0, 0), 1 = jedno pole, przód (brama) = +z, pole (dx, dy) ma środek w (dx - 5, dy - 5).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
L = json.load(open(os.path.join(ROOT, 'src', 'data', 'keep-layout.json')))
N = L['size']
H = N / 2
TILES = L['tiles']
tile = lambda dx, dy: TILES[dy][dx] if 0 <= dx < N and 0 <= dy < N else '#'
room = lambda dx, dy: '.' if tile(dx, dy) == 'G' else tile(dx, dy)
walk = lambda dx, dy: tile(dx, dy) not in '#o'
edge_key = lambda a: tuple(sorted([(a[0], a[1]), (a[2], a[3])]))
DOORS = {edge_key(d) for d in L['doors']}
BARS = {edge_key(d) for d in L['bars']}
cx = lambda dx: dx - H + 0.5   # środek pola w układzie modelu
cz = lambda dy: dy - H + 0.5

b = Building()
solid = []          # przeszkody spacerowicza: x0, x1, z0, z1, od wysokości y0 do y1
def block(x0, x1, z0, z1, y0=0.0, y1=9.0):
    solid.append([round(min(x0, x1), 3), round(max(x0, x1), 3), round(min(z0, z1), 3), round(max(z0, z1), 3), round(y0, 3), round(y1, 3)])
def boxs(group, mat, w, h, d, x, y, z, rot=0.0, **kw):
    """Pudło, które jest też przeszkodą dla spacerowicza (na swojej wysokości)"""
    b.box(group, mat, w, h, d, x, y, z, rot, **kw)
    c, s = abs(math.cos(rot)), abs(math.sin(rot))
    ww, dd = w * c + d * s, w * s + d * c
    block(x - ww / 2, x + ww / 2, z - dd / 2, z + dd / 2, y - 0.05, y + h)

G = 0.15             # posadzka dziedzińca i sal
WH = 1.5             # wysokość murów nad posadzką
TOP = G + WH
WALK = TOP + 0.06     # chodnik na koronie muru (wierzch płyt)

# ---------------- podmurówka, posadzki ----------------
b.box('base', 'stoneDark', N + 0.3, 0.06, N + 0.3, 0, 0, 0)
b.box('base', 'stoneDark', N, G - 0.06, N, 0, 0.06, 0)
FLOOR = {'.': 'pathCobble', 'T': 'plank', 'K': 'stone', 'C': 'plank', 'L': 'stoneDark', 'B': 'plank'}
for dy in range(N):
    for dx in range(N):
        r = room(dx, dy)
        if not walk(dx, dy) and r != 'o':
            continue
        if r in '1234':
            b.box('interior', 'stoneDark', 1.0, 0.012, 1.0, cx(dx), G, cz(dy))
            continue
        grp = 'floor' if r == 'B' else 'base' if r in '.o' else 'interior'
        b.box(grp, FLOOR.get(r, 'pathCobble'), 1.0, 0.012, 1.0, cx(dx), G, cz(dy))

# ---------------- mury kurtynowe ----------------
def curtain(x0, x1, z0, z1, y0=G, y1=TOP):
    b.box('base', 'castle', x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2)
curtain(-H, H, -H, -H + 1)                     # tył
curtain(-H, -H + 1, -H + 1, H - 1)             # lewy
curtain(H - 1, H, -H + 1, H - 1)               # prawy
gx = L['tiles'][N - 1].index('G')
gl, gr = cx(gx) - 0.5, cx(gx) + 0.5
curtain(-H, gl, H - 1, H)                      # przód po bokach bramy
curtain(gr, H, H - 1, H)
curtain(gl, gr, H - 1, H, G + 0.95, TOP)       # nad przejazdem
# skarpa u stóp murów, gzyms; przed bramą skarpy nie ma: most kładzie się prosto na ziemi
gx0 = L['tiles'][N - 1].index('G') - H + 0.5
b.box('base', 'stoneDark', N + 0.24, 0.35, 0.12, 0, 0, -(H + 0.06))
b.box('base', 'stoneDark', (gx0 - 0.5) + H + 0.12, 0.35, 0.12, (-H - 0.12 + gx0 - 0.5) / 2, 0, H + 0.06)
b.box('base', 'stoneDark', H + 0.12 - (gx0 + 0.5), 0.35, 0.12, (H + 0.12 + gx0 + 0.5) / 2, 0, H + 0.06)
for s in (-1, 1):
    b.box('base', 'stoneDark', 0.12, 0.35, N + 0.24, s * (H + 0.06), 0, 0)
    b.box('base', 'castleDark', N + 0.08, 0.06, 0.04, 0, G + 0.75, s * (H + 0.02))
    b.box('base', 'castleDark', 0.04, 0.06, N + 0.08, s * (H + 0.02), G + 0.75, 0)
for k in (-3.2, -1.6, 1.6, 3.2):
    b.box('base', 'dark', 0.05, 0.24, 0.015, k, G + 0.95, -H - 0.006)
    for s in (-1, 1):
        b.box('base', 'dark', 0.015, 0.24, 0.05, s * (H + 0.006), G + 0.95, k)

# ---------------- chodnik na murach: płyty, blanki od pola, przedpiersie od dziedzińca ----------------
# Po murze chodzi się pola, które w planie mają „=”; od pola zamyka je mur z blankami, od dziedzińca niskie przedpiersie
# z przerwą tam, gdzie wychodzą schody.
def is_tower(dx, dy):
    return dx in (0, N - 1) and dy in (0, N // 2, N - 1)
stair_tops = {(dx, dy + 1) for dy in range(N) for dx in range(N) if tile(dx, dy) == 'S' and tile(dx, dy + 1) == '='}
for dy in range(N):
    for dx in range(N):
        if tile(dx, dy) != '=' or is_tower(dx, dy):
            continue  # w basztach własna izba
        x, z = cx(dx), cz(dy)
        b.box('base', 'castleDark', 1.0, 0.06, 1.0, x, TOP, z)
        for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = dx + ox, dy + oy
            outside = not (0 <= nx < N and 0 <= ny < N)
            if not outside and tile(nx, ny) in '=#':
                continue  # dalej mur albo wieża
            if outside:   # od pola: przedpiersie i blanki
                ex, ez = x + ox * 0.44, z + oy * 0.44
                w, d = (0.12, 1.0) if ox else (1.0, 0.12)
                boxs('base', 'castle', w, 0.16, d, ex, WALK, ez)
                for t in (-0.3, 0.06, 0.4):
                    if ox:
                        b.box('base', 'castle', 0.12, 0.2, 0.18, ex, WALK + 0.16, z + t - 0.05)
                    else:
                        b.box('base', 'castle', 0.18, 0.2, 0.12, x + t - 0.05, WALK + 0.16, ez)
            elif (dx, dy) in stair_tops and (ox, oy) == (0, -1):
                continue  # wyjście schodów na mur
            elif tile(nx, ny) != 'S' or (ox, oy) != (0, -1):
                ex, ez = x + ox * 0.47, z + oy * 0.47
                w, d = (0.06, 1.0) if ox else (1.0, 0.06)
                boxs('base', 'castle', w, 0.24, d, ex, WALK, ez)
                b.box('base', 'castleDark', w + 0.02, 0.03, d + 0.02, ex, WALK + 0.24, ez)

# ---------------- baszty: w narożnikach okrągłe, w połowie boków kwadratowe; w środku izba na wysokości chodnika ----------------
TR = 0.82
RW = 0.13   # grubość ściany izby w baszcie
DOORW = 0.5
def tower_doors(dx, dy):
    """Kierunki (ox, oy), w których z izby w baszcie wychodzi się na chodnik muru"""
    out = []
    for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        if tile(dx + ox, dy + oy) == '=' and 0 <= dx + ox < N and 0 <= dy + oy < N:
            out.append((ox, oy))
    return out
for sx in (-1, 1):
    for sz in (-1, 1):
        dx, dy = (0 if sx < 0 else N - 1), (0 if sz < 0 else N - 1)
        tx, tz = cx(dx), cz(dy)
        doors = tower_doors(dx, dy)
        b.prism('base', 'castleDark', TR + 0.12, TR, 0.5, tx, 0.0, tz, seg=18, top=False)
        b.prism('base', 'castle', TR, TR, TOP - 0.5, tx, 0.5, tz, seg=18, top=False)
        block(tx - TR - 0.12, tx + TR + 0.12, tz - TR - 0.12, tz + TR + 0.12, 0, TOP)
        b.prism('base', 'castleDark', TR - RW, TR - RW, 0.06, tx, TOP, tz, seg=18)   # podłoga izby
        # ściana izby z odcinków; tam, gdzie chodnik, drzwi z nadprożem
        seg = 18
        for k in range(seg):
            a = 2 * math.pi * (k + 0.5) / seg
            ox, oz = math.sin(a), math.cos(a)
            door = any(ox * ddx + oz * ddy > 0.93 for ddx, ddy in doors)
            ln = 2 * math.pi * TR / seg + 0.02
            px, pz = tx + ox * (TR - RW / 2), tz + oz * (TR - RW / 2)
            if door:
                b.box('base', 'castle', ln, 2.55 - (WALK + 0.62), RW, px, WALK + 0.62, pz, a)
                b.box('base', 'woodDark', ln, 0.04, RW + 0.02, px, WALK + 0.6, pz, a)
            else:
                b.box('base', 'castle', ln, 2.55 - WALK + 0.06, RW, px, WALK - 0.06, pz, a)
                block(px - 0.09, px + 0.09, pz - 0.09, pz + 0.09, WALK - 0.1, 9)
        for ddx, ddy in doors:  # ościeża drzwi
            for side in (-1, 1):
                px = tx + ddx * (TR - 0.05) + (ddy * side * DOORW / 2 if ddy else 0)
                pz = tz + ddy * (TR - 0.05) + (ddx * side * DOORW / 2 if ddx else 0)
                boxs('base', 'castleDark', 0.12, 0.62, 0.12, px, WALK, pz)
        b.prism('base', 'woodDark', TR - RW, TR - RW, 0.03, tx, 2.52, tz, seg=18, top=False)
        b.poly('base', 'wood', [(tx + math.sin(2 * math.pi * k / 18) * (TR - RW), 2.52, tz + math.cos(2 * math.pi * k / 18) * (TR - RW)) for k in range(18)], away=(tx, 3.5, tz))
        b.prism('base', 'castleDark', TR + 0.05, TR + 0.05, 0.08, tx, 2.55, tz, seg=18)
        b.merlons_ring('base', 'castle', tx, tz, TR - 0.02, 2.63, n=12, w=0.17, h=0.18, t=0.1)
        b.prism('base', 'castleDark', TR + 0.1, TR + 0.1, 0.04, tx, 2.81, tz, seg=18)
        b.prism('base', 'slate', TR + 0.1, 0.0, 1.25, tx, 2.85, tz, seg=18)
        b.box('base', 'gold', 0.06, 0.12, 0.06, tx, 4.08, tz)
        b.box('base', 'woodDark', 0.03, 0.45, 0.03, tx, 4.15, tz)
        b.box('base', 'flag', 0.3, 0.17, 0.015, tx + 0.15, 4.4, tz)
        for a0 in (math.atan2(sx, sz) - 0.7, math.atan2(sx, sz) + 0.7):
            for y in (1.0, 2.1):
                b.box('base', 'dark', 0.05, 0.22, 0.015, tx + math.sin(a0) * (TR + 0.002), y, tz + math.cos(a0) * (TR + 0.002), a0)
        b.box('interior', 'ember', 0.04, 0.07, 0.03, tx - sx * 0.45, WALK + 0.45, tz - sz * 0.45)
for sx in (-1, 1):
    dx = 0 if sx < 0 else N - 1
    dy = N // 2
    tx, tz = cx(dx), cz(dy)
    S2 = 0.65
    b.box('base', 'castle', 2 * S2, TOP - G, 2 * S2, tx, G, tz)
    block(tx - S2, tx + S2, tz - S2, tz + S2, 0, TOP)
    b.box('base', 'castleDark', 2 * S2 - 0.1, 0.06, 2 * S2 - 0.1, tx, TOP, tz)
    # ściany izby: od pola i od dziedzińca pełne, w kierunku muru drzwi
    for ox in (-1, 1):
        b.box('base', 'castle', RW, 2.2 - WALK, 2 * S2, tx + ox * (S2 - RW / 2), WALK, tz)
        block(tx + ox * (S2 - RW / 2) - RW / 2, tx + ox * (S2 - RW / 2) + RW / 2, tz - S2, tz + S2, WALK - 0.1, 9)
    for oz in (-1, 1):
        zz = tz + oz * (S2 - RW / 2)
        for side in (-1, 1):
            w = S2 - DOORW / 2
            b.box('base', 'castle', w, 2.2 - WALK, RW, tx + side * (DOORW / 2 + w / 2), WALK, zz)
            block(tx + side * DOORW / 2, tx + side * S2, zz - RW / 2, zz + RW / 2, WALK - 0.1, 9)
        b.box('base', 'castle', DOORW, 2.2 - (WALK + 0.62), RW, tx, WALK + 0.62, zz)
        b.box('base', 'woodDark', DOORW + 0.04, 0.04, RW + 0.02, tx, WALK + 0.6, zz)
    b.box('base', 'wood', 2 * S2 - 2 * RW, 0.02, 2 * S2 - 2 * RW, tx, 2.17, tz, bottom=True)
    b.box('base', 'castleDark', 1.4, 0.07, 1.4, tx, 2.2, tz)
    for s2 in (-1, 1):
        b.merlons_line('base', 'castle', tx - 0.6, tz + s2 * 0.62, tx + 0.6, tz + s2 * 0.62, 2.27, step=0.3, w=0.14, h=0.16, t=0.08)
        b.merlons_line('base', 'castle', tx + s2 * 0.62, tz - 0.6, tx + s2 * 0.62, tz + 0.6, 2.27, step=0.3, w=0.14, h=0.16, t=0.08)
    b.box('base', 'dark', 0.015, 0.26, 0.06, tx + sx * 0.656, 1.0, tz)
    b.box('interior', 'ember', 0.03, 0.07, 0.04, tx + sx * 0.5, WALK + 0.45, tz)

# ---------------- schody na mury: kamienne stopnie od dziedzińca w górę ku koronie ----------------
for dx in range(N):
    col = [dy for dy in range(N) if tile(dx, dy) == 'S']
    if not col:
        continue
    z0, z1 = cz(min(col)) - 0.5, cz(max(col)) + 0.5
    n = 12
    for i in range(n):
        za, zb = z0 + (z1 - z0) * i / n, z0 + (z1 - z0) * (i + 1) / n
        hgt = G + (WALK - G) * (i + 1) / n
        b.box('base', 'stone', 0.86, hgt - G, zb - za, cx(dx), G, (za + zb) / 2)
        b.box('base', 'castleDark', 0.88, 0.02, 0.03, cx(dx), hgt - 0.02, zb - 0.015)
    for side in (-1, 1):   # balustrada z belek
        x = cx(dx) + side * 0.45
        for i in range(4):
            zz = z0 + 0.15 + i * (z1 - z0 - 0.3) / 3
            hh = G + (WALK - G) * (zz - z0) / (z1 - z0)
            b.box('base', 'woodDark', 0.04, 0.32, 0.04, x, hh, zz)
        b.box('base', 'woodDark', 0.04, 0.04, math.hypot(z1 - z0, WALK - G), x, G + 0.32 + (WALK - G) / 2, (z0 + z1) / 2, tilt=-math.atan2(WALK - G, z1 - z0))
        block(x - 0.03, x + 0.03, z0, z1)

# ---------------- donżon nad tylnym murem: wysoka wieża z chorągwią ----------------
DZ = -H + 0.55
b.box('base', 'castle', 1.9, 3.6 - G, 1.4, 0, G, DZ)
b.box('base', 'castleDark', 2.0, 0.08, 1.5, 0, 1.6, DZ)
b.box('base', 'castleDark', 2.04, 0.08, 1.54, 0, 3.6, DZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('base', 'castle', 0.26, 0.2, 0.26, sx * 0.88, 3.68, DZ + sz * 0.63)
for x in (-0.45, 0.45):
    for y in (2.0, 2.85):
        b.box('base', 'dark', 0.16, 0.34, 0.015, x, y, DZ - 0.708)
b.pyramid('base', 'slate', 2.1, 1.6, 1.5, 0, 3.68, DZ)
b.box('base', 'gold', 0.07, 0.12, 0.07, 0, 5.17, DZ)
b.box('base', 'woodDark', 0.04, 0.9, 0.04, 0, 5.2, DZ)
b.box('base', 'flag', 0.7, 0.4, 0.02, 0.37, 5.65, DZ)

# ---------------- brama: dwie wieże, przejazd, krata, wrota, most zwodzony ----------------
GZ = H - 0.5
for s in (-1, 1):
    x = cx(gx) + s * 0.95
    b.box('base', 'castle', 0.9, 2.35 - G, 1.4, x, G, GZ + 0.2)
    b.box('base', 'castleDark', 1.0, 0.07, 1.5, x, 2.35, GZ + 0.2)
    b.merlons_line('base', 'castle', x - 0.4, GZ + 0.86, x + 0.4, GZ + 0.86, 2.42, step=0.2, w=0.12, h=0.16, t=0.08)
    b.box('base', 'dark', 0.06, 0.26, 0.015, x, 1.4, GZ + 0.906)
    b.box('base', 'flag', 0.32, 0.6, 0.02, x, 0.85, GZ + 0.915)
b.box('base', 'castle', 1.0, 2.2 - (G + 0.95), 1.36, cx(gx), G + 0.95, GZ + 0.2)
b.box('base', 'castleDark', 1.0, 0.06, 1.44, cx(gx), 2.2, GZ + 0.2)
b.merlons_line('base', 'castle', cx(gx) - 0.45, GZ + 0.84, cx(gx) + 0.45, GZ + 0.84, 2.26, step=0.22, w=0.12, h=0.16, t=0.08)
b.box('base', 'dark', 1.0, 0.004, 1.4, cx(gx), G + 0.946, GZ + 0.2)
for k in range(9):  # łuk z ciosów od frontu
    a = math.pi * (k + 0.5) / 9
    b.box('base', 'castleDark', 0.13, 0.09, 0.05, cx(gx) - math.cos(a) * 0.44, G + 0.78 + math.sin(a) * 0.16, GZ + 0.925, -a + math.pi / 2)
for k in range(8):  # krata podniesiona: widać tylko zęby pod sklepieniem
    b.box('base', 'iron', 0.02, 0.07, 0.02, cx(gx) - 0.42 + k * 0.12, G + 0.88, GZ + 0.75)
b.box('base', 'iron', 0.96, 0.02, 0.02, cx(gx), G + 0.93, GZ + 0.75)
for s in (-1, 1):  # wrota otwarte na boki przejazdu
    b.box('base', 'woodDark', 0.46, 0.85, 0.05, cx(gx) + s * 0.44, G, GZ - 0.2, s * math.pi / 2)
ramp = math.atan2(G, 0.9)
b.box('base', 'roadWood', 0.92, 0.05, math.hypot(0.9, G), cx(gx), G - 0.05, GZ + 0.9, tilt=ramp, bottom=True)
for k in range(5):
    f = (k + 0.5) / 5
    b.box('base', 'woodDark', 0.96, 0.02, 0.035, cx(gx), G - G * f, GZ + 0.9 + 0.9 * f)
for s in (-1, 1):
    b.box('base', 'iron', 0.016, math.hypot(0.9, 1.1), 0.016, cx(gx) + s * 0.43, 0.04, GZ + 1.8, tilt=-math.atan2(0.9, 1.1))

# ---------------- pomieszczenia: ściany na krawędziach pól ----------------
ROOM_H = {'T': 1.3, 'K': 1.0, 'C': 1.05, 'B': 0.95, 'L': 0.9, '1': 0.9, '2': 0.9, '3': 0.9, '4': 0.9}
WALL_MAT = {'T': 'castle', 'K': 'plaster', 'C': 'plaster', 'B': 'woodDark', 'L': 'castleDark'}
WT = 0.14
DW, DH = 0.46, 0.62   # drzwi: szerokość i wysokość przejścia
def height_of(r1, r2):
    return max(ROOM_H.get(r1, 0), ROOM_H.get(r2, 0))
def mat_of(r1, r2):
    for r in (r1, r2):
        if r in WALL_MAT:
            return WALL_MAT[r]
        if r in '1234':
            return 'castleDark'
    return 'castle'
def wall_piece(grp, mat, x0, x1, z0, z1, y0, y1):
    b.box(grp, mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2)
for dy in range(N):
    for dx in range(N):
        for ex, ey in ((1, 0), (0, 1)):
            ax, ay, bx2, by2 = dx, dy, dx + ex, dy + ey
            if not (walk(ax, ay) and walk(bx2, by2)):
                continue
            ra, rb = room(ax, ay), room(bx2, by2)
            k = edge_key((ax, ay, bx2, by2))
            if ra == rb and k not in BARS:
                continue
            h = height_of(ra, rb)
            mat = mat_of(ra, rb)
            if ex:   # ściana pionowa x = granica, wzdłuż z
                x = cx(ax) + 0.5
                z0, z1 = cz(ay) - 0.5, cz(ay) + 0.5
                if k in BARS:
                    for i in range(9):
                        b.box('interior', 'iron', 0.018, h - 0.04, 0.018, x, G, z0 + WT / 2 + 0.06 + i * 0.11)
                    b.box('interior', 'iron', 0.03, 0.03, 1.0, x, G + h - 0.04, cz(ay))
                    b.box('interior', 'iron', 0.03, 0.03, 1.0, x, G + 0.05, cz(ay))
                    block(x - 0.05, x + 0.05, cz(ay) - 0.5, cz(ay) + 0.5)
                elif k in DOORS:
                    zc = cz(ay)
                    wall_piece('base', mat, x - WT / 2, x + WT / 2, z0, zc - DW / 2, G, G + h)
                    wall_piece('base', mat, x - WT / 2, x + WT / 2, zc + DW / 2, z1, G, G + h)
                    wall_piece('base', mat, x - WT / 2, x + WT / 2, zc - DW / 2, zc + DW / 2, G + DH, G + h)
                    b.box('base', 'woodDark', DW + 0.06, 0.04, WT + 0.03, x, G + DH, zc, math.pi / 2)
                    side = 1 if rb != '.' else -1   # skrzydło otwiera się do pomieszczenia, nie na dziedziniec
                    b.box('interior', 'woodDark', DW - 0.04, DH - 0.02, 0.035, x + side * 0.2, G, zc - DW / 2 + 0.02, math.pi / 2 + side * 1.35)
                    block(x - WT / 2, x + WT / 2, z0, zc - DW / 2); block(x - WT / 2, x + WT / 2, zc + DW / 2, z1)
                else:
                    wall_piece('base', mat, x - WT / 2, x + WT / 2, z0, z1, G, G + h)
                    block(x - WT / 2, x + WT / 2, z0, z1)
            else:    # ściana pozioma z = granica, wzdłuż x
                z = cz(ay) + 0.5
                x0, x1 = cx(ax) - 0.5, cx(ax) + 0.5
                if k in DOORS:
                    xc = cx(ax)
                    wall_piece('base', mat, x0, xc - DW / 2, z - WT / 2, z + WT / 2, G, G + h)
                    wall_piece('base', mat, xc + DW / 2, x1, z - WT / 2, z + WT / 2, G, G + h)
                    wall_piece('base', mat, xc - DW / 2, xc + DW / 2, z - WT / 2, z + WT / 2, G + DH, G + h)
                    b.box('base', 'woodDark', DW + 0.06, 0.04, WT + 0.03, xc, G + DH, z)
                    side = 1 if rb != '.' else -1
                    b.box('interior', 'woodDark', DW - 0.04, DH - 0.02, 0.035, xc - DW / 2 + 0.05, G, z + side * 0.22, math.pi / 2 - side * 0.2)
                    block(x0, xc - DW / 2, z - WT / 2, z + WT / 2); block(xc + DW / 2, x1, z - WT / 2, z + WT / 2)
                else:
                    wall_piece('base', mat, x0, x1, z - WT / 2, z + WT / 2, G, G + h)
                    block(x0, x1, z - WT / 2, z + WT / 2)

# słupy w narożnikach ścian (zamykają styki odcinków)
posts = {}
for dy in range(N):
    for dx in range(N):
        for ex, ey in ((1, 0), (0, 1)):
            ax, ay, bx2, by2 = dx, dy, dx + ex, dy + ey
            if not (walk(ax, ay) and walk(bx2, by2)):
                continue
            k = edge_key((ax, ay, bx2, by2))
            if room(ax, ay) == room(bx2, by2) and k not in BARS:
                continue
            h = height_of(room(ax, ay), room(bx2, by2))
            ends = ((cx(ax) + 0.5, cz(ay) - 0.5), (cx(ax) + 0.5, cz(ay) + 0.5)) if ex else ((cx(ax) - 0.5, cz(ay) + 0.5), (cx(ax) + 0.5, cz(ay) + 0.5))
            for e in ends:
                key2 = (round(e[0], 3), round(e[1], 3))
                old = posts.get(key2, (0, '', set()))
                posts[key2] = (max(old[0], h), mat_of(room(ax, ay), room(bx2, by2)), old[2] | {'v' if ex else 'h'})
                posts[key2][2].add(('v' if ex else 'h') + ('+' if e == ends[1] else '-'))
for (x, z), (h, mat, dirs) in posts.items():
    if abs(x) > H - 1.001 or abs(z) > H - 1.001:
        continue  # przy murze kurtynowym słup niepotrzebny
    ends_here = {d for d in dirs if len(d) == 2}
    # środek prostej ściany (dwa odcinki w jednej linii): bez słupa, ściana idzie gładko
    if ends_here in ({'v+', 'v-'}, {'h+', 'h-'}):
        continue
    pm = 'woodDark' if mat in ('plaster', 'woodDark') else 'castleDark'
    b.box('base', pm, WT + 0.04, h + 0.02, WT + 0.04, x, G, z)
    block(x - WT / 2 - 0.02, x + WT / 2 + 0.02, z - WT / 2 - 0.02, z + WT / 2 + 0.02)

# ---------------- dachy pomieszczeń (shell) i sufity (ceiling) ----------------
def bbox(chars):
    xs = [dx for dy in range(N) for dx in range(N) if room(dx, dy) in chars]
    zs = [dy for dy in range(N) for dx in range(N) if room(dx, dy) in chars]
    return cx(min(xs)) - 0.5, cx(max(xs)) + 0.5, cz(min(zs)) - 0.5, cz(max(zs)) + 0.5
ROOFS = [('T', 'slate', 0.95), ('K', 'thatch', 0.6), ('C', 'slate', 0.7), ('B', 'roadWood', 0.65), ('L1234', 'castleDark', 0.0)]
for chars, mat, rise in ROOFS:
    x0, x1, z0, z1 = bbox(chars)
    h = ROOM_H.get(chars[0], 0.9)
    if rise:
        b.gable('shell', mat, x0, x1, z0, z1, G + h, rise, along_x=(x1 - x0) >= (z1 - z0), over=0.1, end_mat=WALL_MAT.get(chars[0], 'castle'))
    else:   # lochy: płaski kamienny strop z otworem świetlnym
        b.box('shell', mat, x1 - x0 + 0.1, 0.08, z1 - z0 + 0.1, (x0 + x1) / 2, G + h, (z0 + z1) / 2, bottom=True)
    b.box('ceiling', 'wood' if chars[0] != 'L' else 'castleDark', x1 - x0, 0.03, z1 - z0, (x0 + x1) / 2, G + h - 0.03, (z0 + z1) / 2, bottom=True)
    if chars[0] in 'TCB':
        n = int((x1 - x0) / 0.5)
        for i in range(1, n):
            b.box('ceiling', 'woodDark', 0.06, 0.06, z1 - z0, x0 + i * (x1 - x0) / n, G + h - 0.09, (z0 + z1) / 2, bottom=True)
    if chars[0] == 'K':  # komin kuchni
        b.box('shell', 'stone', 0.3, 0.9, 0.3, x0 + 0.35, G + h, z0 + 0.25)
        b.box('shell', 'dark', 0.22, 0.01, 0.22, x0 + 0.35, G + h + 0.9, z0 + 0.25)

# ---------------- sala tronowa ----------------
tx0, tx1, tz0, tz1 = bbox('T')
tmx = (tx0 + tx1) / 2
b.box('interior', 'stoneDark', 1.7, 0.08, 0.8, tmx, G, tz0 + 0.45)
boxs('interior', 'woodDark', 0.42, 0.24, 0.34, tmx, G + 0.08, tz0 + 0.38)
b.box('interior', 'woodDark', 0.46, 0.68, 0.06, tmx, G + 0.08, tz0 + 0.2)
b.box('interior', 'flag', 0.32, 0.03, 0.28, tmx, G + 0.32, tz0 + 0.4)
for s in (-1, 1):
    b.box('interior', 'gold', 0.05, 0.08, 0.05, tmx + s * 0.2, G + 0.76, tz0 + 0.2)
    b.box('interior', 'woodDark', 0.05, 0.2, 0.3, tmx + s * 0.23, G + 0.32, tz0 + 0.38)
    b.box('interior', 'flag', 0.26, 0.75, 0.015, tmx + s * 1.1, G + 0.3, tz0 + 0.01)
    b.box('interior', 'gold', 0.3, 0.03, 0.03, tmx + s * 1.1, G + 1.05, tz0 + 0.02)
b.box('interior', 'flag', 0.6, 0.008, tz1 - tz0 - 0.95, tmx, G + 0.013, (tz0 + 0.85 + tz1) / 2)
for s in (-1, 1):
    # długie stoły z ławami po bokach sali, na nich chleb i jabłka
    x = tmx + s * 1.55
    boxs('interior', 'wood', 0.42, 0.05, 1.5, x, G + 0.25, (tz0 + tz1) / 2 + 0.25)
    for zz in (-0.6, 0.6):
        b.box('interior', 'woodDark', 0.36, 0.25, 0.05, x, G, (tz0 + tz1) / 2 + 0.25 + zz)
    for s2 in (-1, 1):
        boxs('interior', 'woodDark', 0.12, 0.14, 1.4, x + s2 * 0.33, G, (tz0 + tz1) / 2 + 0.25)
    for i in range(4):
        b.box('interior', 'bread' if i % 2 else 'apple', 0.07, 0.05, 0.07, x, G + 0.3, (tz0 + tz1) / 2 - 0.3 + i * 0.36)
    # kolumny i kosze z ogniem
    for zz in (tz0 + 1.2, tz1 - 0.5):
        b.prism('interior', 'castleDark', 0.1, 0.1, 1.27, tmx + s * 0.85, G, zz, seg=8)
        block(tmx + s * 0.85 - 0.1, tmx + s * 0.85 + 0.1, zz - 0.1, zz + 0.1)
    b.prism('interior', 'iron', 0.13, 0.09, 0.08, tmx + s * 0.62, G + 0.4, tz0 + 0.35, seg=8)
    b.prism('interior', 'iron', 0.02, 0.02, 0.4, tmx + s * 0.62, G, tz0 + 0.35, seg=5)
    b.box('interior', 'ember', 0.16, 0.04, 0.16, tmx + s * 0.62, G + 0.46, tz0 + 0.35)
    block(tmx + s * 0.62 - 0.13, tmx + s * 0.62 + 0.13, tz0 + 0.22, tz0 + 0.48)

# ---------------- kuchnia ----------------
kx0, kx1, kz0, kz1 = bbox('K')
boxs('interior', 'stone', 1.1, 0.75, 0.42, (kx0 + kx1) / 2, G, kz0 + 0.21)
b.box('interior', 'dark', 0.6, 0.38, 0.02, (kx0 + kx1) / 2, G + 0.05, kz0 + 0.425)
b.box('interior', 'ember', 0.5, 0.06, 0.2, (kx0 + kx1) / 2, G + 0.05, kz0 + 0.3)
b.prism('interior', 'iron', 0.13, 0.15, 0.16, (kx0 + kx1) / 2, G + 0.1, kz0 + 0.3, seg=10)
boxs('interior', 'wood', 0.85, 0.05, 0.45, (kx0 + kx1) / 2, G + 0.28, (kz0 + kz1) / 2 + 0.15)
for s in (-1, 1):
    b.box('interior', 'woodDark', 0.05, 0.28, 0.4, (kx0 + kx1) / 2 + s * 0.38, G, (kz0 + kz1) / 2 + 0.15)
for i, m in enumerate(('bread', 'apple', 'fish', 'bread', 'apple')):
    b.box('interior', m, 0.07, 0.05, 0.07, (kx0 + kx1) / 2 - 0.3 + i * 0.15, G + 0.33, (kz0 + kz1) / 2 + 0.15)
for i, (x, z) in enumerate(((kx0 + 0.22, kz1 - 0.25), (kx0 + 0.22, kz1 - 0.6), (kx1 - 0.25, kz0 + 0.65))):
    b.prism('interior', 'wood', 0.15, 0.13, 0.36, x, G, z, seg=10)
    block(x - 0.15, x + 0.15, z - 0.15, z + 0.15)
boxs('interior', 'woodDark', 0.12, 0.7, 0.6, kx1 - 0.09, G, (kz0 + kz1) / 2 + 0.35)
for i in range(3):
    b.box('interior', 'apple' if i % 2 else 'bread', 0.06, 0.05, 0.08, kx1 - 0.09, G + 0.42 + i * 0.12, (kz0 + kz1) / 2 + 0.2 + i * 0.1)

# ---------------- komnata pana ----------------
qx0, qx1, qz0, qz1 = bbox('C')
boxs('interior', 'woodDark', 0.75, 0.2, 1.05, qx1 - 0.45, G, qz0 + 0.6)
b.box('interior', 'flag', 0.7, 0.06, 0.82, qx1 - 0.45, G + 0.2, qz0 + 0.72)
b.box('interior', 'white', 0.55, 0.08, 0.2, qx1 - 0.45, G + 0.2, qz0 + 0.22)
b.box('interior', 'woodDark', 0.75, 0.55, 0.06, qx1 - 0.45, G, qz0 + 0.09)
for s in (-1, 1):
    b.box('interior', 'woodDark', 0.05, 1.0, 0.05, qx1 - 0.45 + s * 0.35, G, qz0 + 0.09)
    b.box('interior', 'woodDark', 0.05, 1.0, 0.05, qx1 - 0.45 + s * 0.35, G, qz0 + 1.1)
b.box('interior', 'flag', 0.75, 0.04, 1.05, qx1 - 0.45, G + 0.98, qz0 + 0.6)
boxs('interior', 'woodDark', 0.42, 0.24, 0.26, qx0 + 0.45, G, qz0 + 0.2)
b.box('interior', 'gold', 0.36, 0.04, 0.2, qx0 + 0.45, G + 0.24, qz0 + 0.2)
boxs('interior', 'wood', 0.5, 0.04, 0.32, qx0 + 0.5, G + 0.3, qz1 - 0.35)
b.box('interior', 'white', 0.2, 0.01, 0.15, qx0 + 0.5, G + 0.34, qz1 - 0.35)
b.box('interior', 'ember', 0.025, 0.06, 0.025, qx0 + 0.66, G + 0.34, qz1 - 0.35)
for s in (-1, 1):
    b.box('interior', 'woodDark', 0.04, 0.3, 0.28, qx0 + 0.5 + s * 0.22, G, qz1 - 0.35)
boxs('interior', 'woodDark', 0.4, 0.85, 0.3, qx1 - 0.25, G, qz1 - 0.2)

# ---------------- koszary straży (na podłodze śpią mieszkańcy zamku) ----------------
bx0, bx1, bz0, bz1 = bbox('B')
for i in range(5):
    b.box('interior', 'wood', 0.02, 0.62, 0.02, bx1 - 0.08, G, bz0 + 0.25 + i * 0.07)
b.box('interior', 'woodDark', 0.05, 0.04, 0.4, bx1 - 0.09, G + 0.4, bz0 + 0.39)
for i in range(4):
    b.box('interior', 'iron', 0.03, 0.08, 0.04, bx1 - 0.08, G + 0.62, bz0 + 0.25 + i * 0.09)
block(bx1 - 0.14, bx1, bz0 + 0.15, bz0 + 0.62)
boxs('interior', 'woodDark', 0.4, 0.2, 0.22, bx1 - 0.28, G, bz1 - 0.16)
boxs('interior', 'woodDark', 0.12, 0.5, 0.6, bx0 + 0.09, G, bz1 - 0.45)
for i in range(3):
    b.box('interior', 'iron', 0.08, 0.1, 0.08, bx0 + 0.09, G + 0.5, bz1 - 0.65 + i * 0.2)

# ---------------- lochy: korytarz i cztery cele za kratą ----------------
lx0, lx1, lz0, lz1 = bbox('L1234')
for dy in range(N):
    if room(1, dy) in '1234':
        z = cz(dy)
        b.box('interior', 'hay', 0.4, 0.04, 0.55, cx(1) - 0.2, G + 0.012, z + 0.1)
        for y in (0.35, 0.5):
            b.box('interior', 'iron', 0.02, 0.02, 0.18, cx(1) - 0.47, G + y, z - 0.15)
        b.prism('interior', 'wood', 0.06, 0.05, 0.1, cx(1) + 0.25, G, z - 0.3, seg=8)
b.box('interior', 'ember', 0.05, 0.08, 0.03, cx(2) + 0.42, G + 0.55, cz(7))
b.box('interior', 'iron', 0.06, 0.05, 0.1, cx(2) + 0.44, G + 0.5, cz(7))
boxs('interior', 'wood', 0.22, 0.2, 0.22, cx(2) + 0.32, G, lz1 - 0.2)

# ---------------- dziedziniec: studnia, wóz, siano, kukły do ćwiczeń, beczki, drewno ----------------
wx, wz = None, None
for dy in range(N):
    for dx in range(N):
        if tile(dx, dy) == 'o':
            wx, wz = cx(dx), cz(dy)
b.prism('base', 'stone', 0.36, 0.36, 0.32, wx, G, wz, seg=14)
b.prism('base', 'dark', 0.28, 0.28, 0.006, wx, G + 0.322, wz, seg=14)
for s in (-1, 1):
    b.box('base', 'woodDark', 0.05, 0.75, 0.05, wx + s * 0.3, G + 0.2, wz)
b.box('base', 'woodDark', 0.66, 0.05, 0.05, wx, G + 0.92, wz)
b.gable('base', 'roadWood', wx - 0.4, wx + 0.4, wz - 0.32, wz + 0.32, G + 0.95, 0.25, along_x=True, over=0.05)
b.prism('base', 'wood', 0.08, 0.08, 0.12, wx + 0.12, G + 0.45, wz, seg=8)
# wóz z sianem
cxw, czw = cx(4) - 0.05, cz(6) + 0.1
boxs('base', 'wood', 0.5, 0.06, 0.9, cxw, G + 0.2, czw)
b.box('base', 'hay', 0.44, 0.22, 0.8, cxw, G + 0.26, czw)
for s in (-1, 1):
    for zz in (-0.3, 0.3):
        b.box('base', 'woodDark', 0.04, 0.26, 0.26, cxw + s * 0.28, G, czw + zz)  # koła
b.box('base', 'woodDark', 0.04, 0.04, 0.7, cxw, G + 0.15, czw + 0.75)
# siano i beczki pod murem, stos drewna, kukły
for i, (x, z) in enumerate(((cx(4) - 0.25, cz(9) + 0.3), (cx(4) + 0.1, cz(9) + 0.35), (cx(6) + 0.3, cz(4) - 0.25))):
    b.prism('base', 'wood', 0.16, 0.14, 0.38, x, G, z, seg=10)
    block(x - 0.16, x + 0.16, z - 0.16, z + 0.16)
boxs('base', 'hay', 0.4, 0.3, 0.5, cx(6) + 0.2, G, cz(9) + 0.15)
for i in range(4):
    b.box('base', 'wood', 0.6, 0.08, 0.08, cx(1) + 0.05, G + i * 0.08, cz(4) - 0.3 + (i % 2) * 0.02, 0.0)
block(cx(1) - 0.25, cx(1) + 0.35, cz(4) - 0.38, cz(4) - 0.22)
for x, z in ((cx(6) + 0.1, cz(6) + 0.1), (cx(6) + 0.1, cz(5) + 0.2)):
    b.box('base', 'woodDark', 0.05, 0.55, 0.05, x, G, z)
    b.box('base', 'woodDark', 0.4, 0.05, 0.05, x, G + 0.42, z)
    b.box('base', 'sack', 0.16, 0.22, 0.12, x, G + 0.3, z)
    b.box('base', 'sack', 0.11, 0.1, 0.11, x, G + 0.55, z)
    block(x - 0.12, x + 0.12, z - 0.08, z + 0.08)
# kosze z ogniem przy wewnętrznej stronie bramy
for s in (-1, 1):
    x, z = cx(gx) + s * 0.75, cz(N - 2) + 0.2
    b.prism('base', 'iron', 0.02, 0.02, 0.45, x, G, z, seg=5)
    b.prism('base', 'iron', 0.12, 0.08, 0.08, x, G + 0.45, z, seg=8)
    b.box('base', 'ember', 0.14, 0.04, 0.14, x, G + 0.5, z)
    block(x - 0.12, x + 0.12, z - 0.12, z + 0.12)

b.save('keep', maxe=0.45, rays=16, reach=0.5, extra={'solid': solid, 'floorY': G, 'wallY': WALK})
