"""Zamek gracza (11×11 pól) według wspólnego planu src/data/keep-layout.json.

Mury kurtynowe z blankami i basztami, brama z przejazdem, kratą i kamiennym zjazdem, donżon nad tylnym murem,
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
def torch(group, x, y, z):
    """Pochodnia na ścianie: drewniany trzonek w żelaznym uchwycie, kubek ze smołą i wąski, wysoki płomień"""
    b.box(group, 'iron', 0.05, 0.02, 0.05, x, y + 0.02, z)                       # uchwyt
    b.prism(group, 'woodDark', 0.012, 0.016, 0.2, x, y - 0.06, z, seg=6)         # trzonek
    b.prism(group, 'iron', 0.022, 0.03, 0.04, x, y + 0.14, z, seg=6, top=False)  # kubek
    b.prism(group, 'dark', 0.026, 0.026, 0.004, x, y + 0.172, z, seg=6)          # smoła
    b.prism(group, 'ember', 0.0, 0.022, 0.03, x, y + 0.176, z, seg=6, top=False)  # płomień: rozszerza się…
    b.prism(group, 'ember', 0.022, 0.0, 0.09, x, y + 0.206, z, seg=6)            # …i zwęża ku górze
def brazier(group, x, y, z):
    """Kosz ogniowy na nodze: misa rozszerzona ku górze, z dnem, żar i trzy języki ognia"""
    b.prism(group, 'iron', 0.02, 0.02, y - G, x, G, z, seg=5)
    b.prism(group, 'iron', 0.06, 0.06, 0.012, x, y - 0.012, z, seg=10)
    b.poly(group, 'iron', [(x + math.sin(2 * math.pi * k / 10) * 0.06, y - 0.012, z + math.cos(2 * math.pi * k / 10) * 0.06) for k in range(10)], away=(x, y + 1, z))
    b.prism(group, 'iron', 0.06, 0.13, 0.09, x, y, z, seg=10, top=False)
    b.prism(group, 'woodDark', 0.11, 0.11, 0.06, x, y + 0.01, z, seg=10)
    for i, (ox, oz, hh) in enumerate(((0.0, 0.0, 0.16), (0.045, 0.02, 0.11), (-0.035, -0.03, 0.12))):
        b.prism(group, 'ember', 0.04, 0.0, hh, x + ox, y + 0.07, z + oz, seg=6)
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
    """Baszty (narożne i w połowie boków) i wieże bramy: tam zamiast chodnika jest izba"""
    return (dx in (0, N - 1) and dy in (0, N // 2, N - 1)) or (dy == N - 1 and tile(dx, dy) == '=' and 'G' in (tile(dx - 1, dy), tile(dx + 1, dy)))
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

# ---------------- baszty i wieże bramy: izba na wysokości chodnika, drzwi na mur, strzelnice ----------------
# Izby mają gładkie ściany (pierścień z prawdziwych wycinków, nie z klocków) i strzelnice: wąskie okna,
# przez które widać pole przed murem. Wysokość izby z zapasem, żeby nikt nie zawadzał głową.
TR = 0.82
RW = 0.13      # grubość ściany izby
DOORW = 0.5
ROOM_UP = 0.95  # wysokość izby nad chodnikiem
SLIT = (0.26, 0.56)  # strzelnica: od-do nad chodnikiem
def tower_doors(dx, dy):
    """Kierunki (ox, oy), w których z izby wychodzi się na chodnik muru"""
    return [(ox, oy) for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1))
            if 0 <= dx + ox < N and 0 <= dy + oy < N and tile(dx + ox, dy + oy) == '=']
def ring_piece(mat, x0, z0, ri, ro, a0, a1, y0, y1, jamb0=False, jamb1=False):
    """Wycinek okrągłej ściany: lico zewnętrzne i wewnętrzne, wierzch, ościeża przy otworach"""
    P = lambda r, a, y: (x0 + math.sin(a) * r, y, z0 + math.cos(a) * r)
    am = (a0 + a1) / 2
    inside = (x0, (y0 + y1) / 2, z0)
    outside = (x0 + math.sin(am) * 9, (y0 + y1) / 2, z0 + math.cos(am) * 9)
    b.poly('base', mat, [P(ro, a0, y0), P(ro, a1, y0), P(ro, a1, y1), P(ro, a0, y1)], away=inside)
    b.poly('base', mat, [P(ri, a0, y0), P(ri, a1, y0), P(ri, a1, y1), P(ri, a0, y1)], away=outside)
    b.poly('base', mat, [P(ro, a0, y1), P(ro, a1, y1), P(ri, a1, y1), P(ri, a0, y1)], away=(x0, y0 - 5, z0))
    b.poly('base', mat, [P(ro, a0, y0), P(ro, a1, y0), P(ri, a1, y0), P(ri, a0, y0)], away=(x0, y1 + 5, z0))
    for jamb, a in ((jamb0, a0), (jamb1, a1)):
        if jamb:
            b.poly('base', 'castleDark', [P(ri, a, y0), P(ro, a, y0), P(ro, a, y1), P(ri, a, y1)], away=P((ri + ro) / 2, am, (y0 + y1) / 2))
for sx in (-1, 1):
    for sz in (-1, 1):
        dx, dy = (0 if sx < 0 else N - 1), (0 if sz < 0 else N - 1)
        tx, tz = cx(dx), cz(dy)
        doors = tower_doors(dx, dy)
        out_a = math.atan2(sx, sz)
        y_top = WALK + ROOM_UP
        b.prism('base', 'castleDark', TR + 0.12, TR, 0.5, tx, 0.0, tz, seg=24, top=False)
        b.prism('base', 'castle', TR, TR, TOP - 0.5, tx, 0.5, tz, seg=24, top=False)
        # przeszkoda w kształcie koła (trzy prostokąty), żeby przy baszcie dało się przejść tuż obok
        R0 = TR + 0.12
        for ax, az in ((0.92, 0.38), (0.38, 0.92), (0.7, 0.7)):
            block(tx - R0 * ax, tx + R0 * ax, tz - R0 * az, tz + R0 * az, 0, TOP)
        b.prism('base', 'castleDark', TR - RW, TR - RW, 0.06, tx, TOP, tz, seg=24)   # podłoga izby
        seg = 24
        kinds = []
        for k in range(seg):
            am = 2 * math.pi * (k + 0.5) / seg
            ox, oz = math.sin(am), math.cos(am)
            door = any(ox * ddx + oz * ddy > 0.95 for ddx, ddy in doors)
            rel = abs((am - out_a + math.pi) % (2 * math.pi) - math.pi)
            window = not door and (rel < 0.14 or abs(rel - 0.75) < 0.14 or abs(rel - 1.75) < 0.14)
            kinds.append('door' if door else 'window' if window else 'wall')
        for k in range(seg):
            a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
            am = (a0 + a1) / 2
            ox, oz = math.sin(am), math.cos(am)
            kind = kinds[k]
            px, pz = tx + ox * (TR - RW / 2), tz + oz * (TR - RW / 2)
            if kind == 'door':
                ring_piece('castle', tx, tz, TR - RW, TR, a0, a1, WALK + 0.62, y_top)
                b.box('base', 'woodDark', 2 * math.pi * TR / seg + 0.02, 0.04, RW + 0.02, px, WALK + 0.6, pz, am)
            elif kind == 'window':
                ring_piece('castle', tx, tz, TR - RW, TR, a0, a1, TOP, WALK + SLIT[0])
                ring_piece('castle', tx, tz, TR - RW, TR, a0, a1, WALK + SLIT[1], y_top)
                block(px - 0.09, px + 0.09, pz - 0.09, pz + 0.09, WALK - 0.1, 9)
            else:
                # ościeża: boki ściany przy strzelnicy i drzwiach, żeby nie było widać pustki między licami
                ring_piece('castle', tx, tz, TR - RW, TR, a0, a1, TOP, y_top,
                           jamb0=kinds[k - 1] != 'wall', jamb1=kinds[(k + 1) % seg] != 'wall')
                block(px - 0.09, px + 0.09, pz - 0.09, pz + 0.09, WALK - 0.1, 9)
        for ddx, ddy in doors:  # ościeża drzwi
            for side in (-1, 1):
                px = tx + ddx * (TR - 0.06) + (ddy * side * DOORW / 2 if ddy else 0)
                pz = tz + ddy * (TR - 0.06) + (ddx * side * DOORW / 2 if ddx else 0)
                boxs('base', 'castleDark', 0.13, 0.62, 0.13, px, WALK, pz)
        # strop izby i dach
        b.poly('base', 'wood', [(tx + math.sin(2 * math.pi * k / 24) * (TR - RW), y_top - 0.01, tz + math.cos(2 * math.pi * k / 24) * (TR - RW)) for k in range(24)], away=(tx, y_top + 2, tz))
        b.prism('base', 'castleDark', TR + 0.05, TR + 0.05, 0.08, tx, y_top, tz, seg=24)
        b.merlons_ring('base', 'castle', tx, tz, TR - 0.02, y_top + 0.08, n=12, w=0.17, h=0.18, t=0.1)
        b.prism('base', 'castleDark', TR + 0.1, TR + 0.1, 0.04, tx, y_top + 0.26, tz, seg=24)
        b.poly('base', 'woodDark', [(tx + math.sin(2 * math.pi * k / 24) * (TR + 0.1), y_top + 0.26, tz + math.cos(2 * math.pi * k / 24) * (TR + 0.1)) for k in range(24)], away=(tx, y_top + 5, tz))
        b.prism('base', 'slate', TR + 0.1, 0.0, 1.25, tx, y_top + 0.3, tz, seg=24)
        b.box('base', 'gold', 0.06, 0.12, 0.06, tx, y_top + 1.53, tz)
        b.box('base', 'woodDark', 0.03, 0.45, 0.03, tx, y_top + 1.6, tz)
        b.box('base', 'flag', 0.3, 0.17, 0.015, tx + 0.15, y_top + 1.85, tz)
        for a0 in (out_a - 0.7, out_a + 0.7):
            b.box('base', 'dark', 0.05, 0.22, 0.015, tx + math.sin(a0) * (TR + 0.002), 1.0, tz + math.cos(a0) * (TR + 0.002), a0)
        torch('interior', tx - sx * 0.5, WALK + 0.36, tz - sz * 0.5)

def square_room(tx, tz, hx, hz, y_top, doors, windows, roof_merlons=True):
    """Izba kwadratowa na wysokości chodnika: ściany z drzwiami (ox, oz) i strzelnicami, strop, blanki na dachu"""
    def side_wall(axis_x, sgn, half_len, center, door, win):
        # ściana równoległa do osi x (axis_x=True) w z = tz + sgn*(hz - RW/2), albo równoległa do z
        segs = []
        if door:
            segs.append((-half_len, -DOORW / 2, WALK, y_top))
            segs.append((DOORW / 2, half_len, WALK, y_top))
            segs.append((-DOORW / 2, DOORW / 2, WALK + 0.62, y_top))
        elif win:
            w = 0.16
            segs.append((-half_len, -w / 2, WALK, y_top))
            segs.append((w / 2, half_len, WALK, y_top))
            segs.append((-w / 2, w / 2, WALK, WALK + SLIT[0]))
            segs.append((-w / 2, w / 2, WALK + SLIT[1], y_top))
        else:
            segs.append((-half_len, half_len, WALK, y_top))
        for u0, u1, y0, y1 in segs:
            if axis_x:
                z = tz + sgn * (hz - RW / 2)
                b.box('base', 'castle', u1 - u0, y1 - y0, RW, tx + (u0 + u1) / 2, y0, z)
                if y0 <= WALK + 0.01: block(tx + u0, tx + u1, z - RW / 2, z + RW / 2, WALK - 0.1, 9)
            else:
                x = tx + sgn * (hx - RW / 2)
                b.box('base', 'castle', RW, y1 - y0, u1 - u0, x, y0, tz + (u0 + u1) / 2)
                if y0 <= WALK + 0.01: block(x - RW / 2, x + RW / 2, tz + u0, tz + u1, WALK - 0.1, 9)
        if door:
            if axis_x:
                b.box('base', 'woodDark', DOORW + 0.04, 0.04, RW + 0.02, tx, WALK + 0.6, tz + sgn * (hz - RW / 2))
            else:
                b.box('base', 'woodDark', RW + 0.02, 0.04, DOORW + 0.04, tx + sgn * (hx - RW / 2), WALK + 0.6, tz)
    for sgn in (-1, 1):
        side_wall(True, sgn, hx, tz, (0, sgn) in doors, (0, sgn) in windows)
        side_wall(False, sgn, hz - RW, tx, (sgn, 0) in doors, (sgn, 0) in windows)
    b.box('base', 'castleDark', 2 * hx - 0.1, 0.06, 2 * hz - 0.1, tx, TOP, tz)
    b.box('base', 'wood', 2 * hx - 2 * RW, 0.02, 2 * hz - 2 * RW, tx, y_top - 0.02, tz, bottom=True)
    b.box('base', 'castleDark', 2 * hx + 0.1, 0.07, 2 * hz + 0.1, tx, y_top, tz)
    if roof_merlons:
        for s2 in (-1, 1):
            b.merlons_line('base', 'castle', tx - hx + 0.1, tz + s2 * (hz - 0.03), tx + hx - 0.1, tz + s2 * (hz - 0.03), y_top + 0.07, step=0.3, w=0.14, h=0.18, t=0.08)
            b.merlons_line('base', 'castle', tx + s2 * (hx - 0.03), tz - hz + 0.1, tx + s2 * (hx - 0.03), tz + hz - 0.1, y_top + 0.07, step=0.3, w=0.14, h=0.18, t=0.08)
# baszty w połowie boków: większe (1,6 pola), izba wysoka na człowieka z zapasem
for sx in (-1, 1):
    dx, dy = (0 if sx < 0 else N - 1), N // 2
    tx, tz = cx(dx), cz(dy)
    S2 = 0.8
    b.box('base', 'castle', 2 * S2, TOP - G, 2 * S2, tx, G, tz)
    block(tx - S2, tx + S2, tz - S2, tz + S2, 0, TOP)
    square_room(tx, tz, S2, S2, WALK + ROOM_UP, doors=[(0, -1), (0, 1)], windows=[(sx, 0), (-sx, 0)])
    b.box('base', 'dark', 0.015, 0.26, 0.06, tx + sx * (S2 + 0.006), 1.0, tz)
    torch('interior', tx + sx * (S2 - RW - 0.03), WALK + 0.36, tz + 0.35)

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
        b.box('base', 'stone', 0.76, hgt - G, zb - za, cx(dx), G, (za + zb) / 2)
        b.box('base', 'castleDark', 0.78, 0.02, 0.03, cx(dx), hgt - 0.02, zb - 0.015)
    for side in (-1, 1):   # balustrada z belek
        x = cx(dx) + side * 0.36
        for i in range(4):
            zz = z0 + 0.15 + i * (z1 - z0 - 0.3) / 3
            hh = G + (WALK - G) * (zz - z0) / (z1 - z0)
            b.box('base', 'woodDark', 0.04, 0.32, 0.04, x, hh, zz)
        b.box('base', 'woodDark', 0.04, 0.04, math.hypot(z1 - z0, WALK - G), x, G + 0.32 + (WALK - G) / 2, (z0 + z1) / 2, tilt=-math.atan2(WALK - G, z1 - z0))
        block(x - 0.03, x + 0.03, z0, z1)

# ---------------- donżon nad tylnym murem: wysoka wieża z chorągwią ----------------
# donżon stoi w tylnym murze i wystaje tylko na zewnątrz: przód kończy się tuż za tylną ścianą sali tronowej
DD = 1.13
DZ = -H - 0.15 + DD / 2
b.box('base', 'castle', 1.9, 3.6 - G, DD, 0, G, DZ)
b.box('base', 'castleDark', 2.0, 0.08, DD + 0.1, 0, 1.6, DZ - 0.05)
b.box('base', 'castleDark', 2.04, 0.08, DD + 0.14, 0, 3.6, DZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('base', 'castle', 0.26, 0.2, 0.26, sx * 0.88, 3.68, DZ + sz * (DD / 2 - 0.08))
for x in (-0.45, 0.45):
    for y in (2.0, 2.85):
        b.box('base', 'dark', 0.16, 0.34, 0.015, x, y, DZ - DD / 2 - 0.008)
b.pyramid('base', 'slate', 2.1, DD + 0.25, 1.5, 0, 3.68, DZ)
b.box('base', 'gold', 0.07, 0.12, 0.07, 0, 5.17, DZ)
b.box('base', 'woodDark', 0.04, 0.9, 0.04, 0, 5.2, DZ)
b.box('base', 'flag', 0.7, 0.4, 0.02, 0.37, 5.65, DZ)

# ---------------- brama: dwie wieże, przejazd ze sklepieniem, krata, wrota, kamienny zjazd ----------------
GZ = H - 0.5
# wieże bramy: w dole pełne, wyżej izby z wejściem z chodnika muru (od strony schodów) i strzelnicami na przedpole
for s in (-1, 1):
    x = cx(gx) + s * 0.95
    b.box('base', 'castle', 0.9, TOP - G, 1.4, x, G, GZ + 0.2)
    block(x - 0.45, x + 0.45, GZ - 0.5, GZ + 0.9, 0, TOP)
    square_room(x, GZ + 0.2, 0.45, 0.7, WALK + ROOM_UP, doors=[(s, 0)], windows=[(0, 1), (0, -1)])
    b.box('base', 'flag', 0.32, 0.6, 0.02, x, 0.85, GZ + 0.915)
    torch('interior', x - s * (0.45 - RW - 0.03), WALK + 0.36, GZ + 0.2)  # na ścianie naprzeciw drzwi
b.box('base', 'castle', 1.0, WALK + ROOM_UP - 0.15 - (G + 0.95), 1.36, cx(gx), G + 0.95, GZ + 0.2, bottom=True)   # sklepienie przejazdu: spód widać z dołu
b.box('base', 'castleDark', 1.0, 0.06, 1.44, cx(gx), WALK + ROOM_UP - 0.15, GZ + 0.2)
b.merlons_line('base', 'castle', cx(gx) - 0.45, GZ + 0.84, cx(gx) + 0.45, GZ + 0.84, WALK + ROOM_UP - 0.09, step=0.22, w=0.12, h=0.16, t=0.08)
for k in range(9):  # łuk z ciosów od frontu
    a = math.pi * (k + 0.5) / 9
    b.box('base', 'castleDark', 0.13, 0.09, 0.05, cx(gx) - math.cos(a) * 0.44, G + 0.78 + math.sin(a) * 0.16, GZ + 0.925, -a + math.pi / 2)
# krata (osobna grupa 'portcullis', zapisana opuszczona): gra podnosi ją o PORT_LIFT, gdy pod zamkiem spokojnie,
# i opuszcza, gdy podchodzi wróg — podniesiona chowa się w murze nad przejazdem, spod sklepienia widać tylko zęby
PORT_Z = GZ + 0.75
for k in range(8):
    x = cx(gx) - 0.42 + k * 0.12
    b.box('portcullis', 'iron', 0.022, 0.86, 0.022, x, G + 0.06, PORT_Z)
    b.prism('portcullis', 'iron', 0.0, 0.016, 0.07, x, G - 0.01, PORT_Z, seg=4)
for y in (0.2, 0.45, 0.7, 0.9):
    b.box('portcullis', 'iron', 0.96, 0.03, 0.028, cx(gx), G + y, PORT_Z)
b.box('base', 'iron', 0.96, 0.02, 0.02, cx(gx), G + 0.93, PORT_Z)
for s in (-1, 1):  # wrota otwarte na boki przejazdu
    b.box('base', 'woodDark', 0.46, 0.85, 0.05, cx(gx) + s * 0.44, G, GZ - 0.2, s * math.pi / 2)
# zjazd z przejazdu na przedpole: kamienna rampa (bez drewnianego mostu)
ramp = math.atan2(G, 0.9)
b.box('base', 'roadStone', 0.92, 0.05, math.hypot(0.9, G), cx(gx), G - 0.05, GZ + 0.9, tilt=ramp, bottom=True)

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
            if ra in 'S=' or rb in 'S=':
                continue  # schody i chodnik na murach mają własne bryły (stopnie, przedpiersia)
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
            if room(ax, ay) in 'S=' or room(bx2, by2) in 'S=':
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
        # koszary i lochy stoją przy schodach na mury: krótki okap, żeby dach nie wchodził w bieg schodów
        b.gable('shell', mat, x0, x1, z0, z1, G + h, rise, along_x=(x1 - x0) >= (z1 - z0), over=0.03 if chars[0] in 'BL' else 0.1, end_mat=WALL_MAT.get(chars[0], 'castle'))
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
# podest z dwoma stopniami: niższy szerszy, wyższy pod tronem, krawędzie stopni z ciemniejszego kamienia
b.box('interior', 'stoneDark', 2.1, 0.06, 1.05, tmx, G, tz0 + 0.55)
b.box('interior', 'castleDark', 2.12, 0.015, 0.04, tmx, G + 0.06, tz0 + 1.06)
b.box('interior', 'stoneDark', 1.4, 0.06, 0.72, tmx, G + 0.06, tz0 + 0.4)
b.box('interior', 'castleDark', 1.42, 0.015, 0.04, tmx, G + 0.12, tz0 + 0.75)
b.box('interior', 'flag', 0.5, 0.006, 1.0, tmx, G + 0.122, tz0 + 0.42)   # chodnik na podeście
TY = G + 0.12   # tu stoi tron
TZ = tz0 + 0.34
# tron: siedzisko z poduchą, wysokie oparcie zakończone szczytem, poręcze z złotymi gałkami, nogi-łapy
boxs('interior', 'woodDark', 0.52, 0.22, 0.4, tmx, TY, TZ)
b.box('interior', 'gold', 0.54, 0.025, 0.42, tmx, TY + 0.2, TZ)
b.box('interior', 'flag', 0.44, 0.05, 0.34, tmx, TY + 0.225, TZ + 0.01)
b.box('interior', 'woodDark', 0.56, 0.9, 0.07, tmx, TY, TZ - 0.21)
b.box('interior', 'flag', 0.4, 0.62, 0.012, tmx, TY + 0.25, TZ - 0.17)
b.gable('interior', 'gold', tmx - 0.28, tmx + 0.28, TZ - 0.25, TZ - 0.17, TY + 0.9, 0.2, along_x=False, over=0.01, end_mat='woodDark')
b.box('interior', 'gold', 0.07, 0.07, 0.07, tmx, TY + 1.1, TZ - 0.21)
for sx in (-1, 1):
    x = tmx + sx * 0.28
    b.box('interior', 'woodDark', 0.07, 1.0, 0.09, x, TY, TZ - 0.21)               # słupki oparcia
    b.prism('interior', 'gold', 0.045, 0.045, 0.06, x, TY + 1.0, TZ - 0.21, seg=8)  # gałki
    b.box('interior', 'woodDark', 0.07, 0.16, 0.38, x, TY + 0.22, TZ + 0.01)        # poręcz
    b.prism('interior', 'gold', 0.04, 0.03, 0.05, x, TY + 0.38, TZ + 0.18, seg=8)   # gałka poręczy
    for zz in (TZ - 0.15, TZ + 0.16):
        b.prism('interior', 'gold', 0.035, 0.025, 0.05, x - sx * 0.02, TY, zz, seg=6)  # złote stopki
# baldachim nad tronem: cztery kute słupki, sukno w barwach pana ze złotym obszyciem
for sx in (-1, 1):
    for zz in (TZ - 0.27, TZ + 0.3):
        b.prism('interior', 'woodDark', 0.022, 0.022, 1.2, tmx + sx * 0.42, TY, zz, seg=6)
        b.prism('interior', 'gold', 0.035, 0.035, 0.04, tmx + sx * 0.42, TY + 1.2, zz, seg=6)
b.box('interior', 'flag', 0.92, 0.03, 0.64, tmx, TY + 1.2, TZ + 0.015)
for zz, w, d in ((TZ - 0.29, 0.94, 0.02), (TZ + 0.32, 0.94, 0.02)):
    b.box('interior', 'flag', w, 0.16, d, tmx, TY + 1.06, zz)
    b.box('interior', 'gold', w, 0.025, d + 0.006, tmx, TY + 1.06, zz)
for sx in (-1, 1):
    b.box('interior', 'flag', 0.02, 0.16, 0.62, tmx + sx * 0.44, TY + 1.06, TZ + 0.015)
    b.box('interior', 'gold', 0.026, 0.025, 0.62, tmx + sx * 0.44, TY + 1.06, TZ + 0.015)
# arras z herbem za tronem: płótno na złotym drążku, tarcza herbowa
b.box('interior', 'gold', 1.3, 0.03, 0.03, tmx, G + 1.22, tz0 + 0.03)
b.box('interior', 'flag', 1.2, 1.0, 0.012, tmx, G + 0.22, tz0 + 0.025)
b.box('interior', 'gold', 1.2, 0.03, 0.016, tmx, G + 0.22, tz0 + 0.027)
b.box('interior', 'castleDark', 0.32, 0.3, 0.02, tmx, G + 0.86, tz0 + 0.04)
b.box('interior', 'gold', 0.05, 0.22, 0.022, tmx, G + 0.9, tz0 + 0.045)
b.box('interior', 'gold', 0.2, 0.05, 0.022, tmx, G + 1.02, tz0 + 0.045)
for sx in (-1, 1):
    # chorągwie po bokach i tarcze ze skrzyżowanymi mieczami
    b.box('interior', 'flag', 0.26, 0.75, 0.015, tmx + sx * 1.15, G + 0.3, tz0 + 0.01)
    b.box('interior', 'gold', 0.3, 0.03, 0.03, tmx + sx * 1.15, G + 1.05, tz0 + 0.02)
    sxw = tmx + sx * 1.15
# dywan od drzwi do podestu ze złotym obszyciem
cl = tz1 - (tz0 + 1.1)
b.box('interior', 'flag', 0.62, 0.008, cl, tmx, G + 0.013, tz0 + 1.1 + cl / 2)
for sx in (-1, 1):
    b.box('interior', 'gold', 0.035, 0.009, cl, tmx + sx * 0.3, G + 0.013, tz0 + 1.1 + cl / 2)
# żyrandol z kutego żelaza ze świecami (pod sufitem, widać go od środka sali)
for zz in (tz0 + 1.25, tz1 - 0.55):
    b.prism('ceiling', 'iron', 0.32, 0.32, 0.025, tmx, G + 1.0, zz, seg=12)
    b.prism('ceiling', 'iron', 0.008, 0.008, 0.28, tmx, G + 1.02, zz, seg=4)
    for k in range(6):
        a2 = k * math.pi / 3
        x, z = tmx + math.sin(a2) * 0.3, zz + math.cos(a2) * 0.3
        b.prism('ceiling', 'white', 0.016, 0.016, 0.06, x, G + 1.025, z, seg=5)
        b.prism('ceiling', 'ember', 0.012, 0.0, 0.035, x, G + 1.085, z, seg=5)
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
    brazier('interior', tmx + s * 0.85, G + 0.45, tz0 + 0.85)
    block(tmx + s * 0.85 - 0.13, tmx + s * 0.85 + 0.13, tz0 + 0.72, tz0 + 0.98)

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
for i, (x, z) in enumerate(((kx0 + 0.22, kz1 - 0.25), (kx0 + 0.22, kz1 - 0.6), (kx0 + 0.2, kz0 + 0.62))):
    b.prism('interior', 'wood', 0.15, 0.13, 0.36, x, G, z, seg=10)
    block(x - 0.15, x + 0.15, z - 0.15, z + 0.15)
boxs('interior', 'woodDark', 0.12, 0.7, 0.6, kx1 - 0.09, G, (kz0 + kz1) / 2 + 0.35)
for i in range(3):
    b.box('interior', 'apple' if i % 2 else 'bread', 0.06, 0.05, 0.08, kx1 - 0.09, G + 0.42 + i * 0.12, (kz0 + kz1) / 2 + 0.2 + i * 0.1)

# ---------------- komnata pana ----------------
# pochodnie w sali tronowej i kuchni
for xx in (tx0 + 0.09, tx1 - 0.09):
    for zz in (tz0 + 1.3, tz1 - 0.5):
        torch('interior', xx, G + 0.7, zz)
torch('interior', kx1 - 0.08, G + 0.55, kz0 + 0.5)
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
b.prism('interior', 'white', 0.015, 0.015, 0.05, qx0 + 0.66, G + 0.34, qz1 - 0.35, seg=6)
b.prism('interior', 'ember', 0.01, 0.0, 0.03, qx0 + 0.66, G + 0.39, qz1 - 0.35, seg=5)
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
# pochodnie na ścianach koszar (ściana od muru i obie szczytowe)
for zz in (bz0 + 1.2, bz0 + 2.8):
    torch('interior', bx1 - 0.05, G + 0.5, zz)
torch('interior', (bx0 + bx1) / 2, G + 0.5, bz0 + 0.09)
torch('interior', (bx0 + bx1) / 2, G + 0.5, bz1 - 0.09)
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
torch('interior', cx(2) + 0.42, G + 0.45, cz(7))
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
# wóz z sianem: skrzynia z deskami burt, kopa siana, dwie osie z kołami na szprychach, dyszel
cxw, czw = cx(4) - 0.05, cz(6) + 0.1
WHR, WHY = 0.13, G + 0.13
def wheel(x, y, z, r):
    """Koło wozu w płaszczyźnie YZ: obręcz z grubością, piasta i szprychy"""
    n = 16
    P = lambda rr, a, dx: (x + dx, y + math.cos(a) * rr, z + math.sin(a) * rr)
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        for rr, side in ((r, 1), (r - 0.03, -1)):          # zewnętrzny i wewnętrzny brzeg obręczy
            b.poly('base', 'woodDark', [P(rr, a0, -0.02), P(rr, a1, -0.02), P(rr, a1, 0.02), P(rr, a0, 0.02)],
                   away=(x, y, z) if side > 0 else P(r * 3, (a0 + a1) / 2, 0))
        for dx in (-0.02, 0.02):                            # boki obręczy
            b.poly('base', 'woodDark', [P(r, a0, dx), P(r, a1, dx), P(r - 0.03, a1, dx), P(r - 0.03, a0, dx)], away=(x - dx * 9, y, z))
        b.poly('base', 'iron', [P(r + 0.006, a0, -0.022), P(r + 0.006, a1, -0.022), P(r + 0.006, a1, 0.022), P(r + 0.006, a0, 0.022)], away=(x, y, z))
    for k in range(8):                                      # szprychy od piasty do obręczy
        b.box('base', 'wood', 0.016, r - 0.025, 0.016, x, y, z, tilt=2 * math.pi * k / 8 + 0.2, bottom=True)
    b.box('base', 'iron', 0.06, 0.05, 0.05, x, y - 0.025, z, bottom=True)   # piasta
boxs('base', 'wood', 0.5, 0.05, 0.9, cxw, WHY + 0.02, czw)
for s in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.12, 0.9, cxw + s * 0.235, WHY + 0.07, czw)       # burty
for zz in (-0.45, 0.45):
    b.box('base', 'woodDark', 0.5, 0.12, 0.03, cxw, WHY + 0.07, czw + zz * 0.97)
b.box('base', 'hay', 0.44, 0.18, 0.84, cxw, WHY + 0.07, czw)
b.box('base', 'hay', 0.36, 0.08, 0.7, cxw, WHY + 0.25, czw)
for zz in (-0.28, 0.28):
    b.box('base', 'iron', 0.62, 0.025, 0.025, cxw, WHY - 0.012, czw + zz)              # oś
    for s in (-1, 1):
        wheel(cxw + s * 0.29, WHY, czw + zz, WHR)
b.box('base', 'woodDark', 0.04, 0.04, 0.7, cxw, WHY - 0.02, czw + 0.75)
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
    brazier('base', x, G + 0.45, z)
    block(x - 0.12, x + 0.12, z - 0.12, z + 0.12)

# punkty do obchodu (tools/models/inspect_building.py): [podpis, oko, cel, grupy, ogniskowa]; oko i cel w układzie modelu
E, WY = G + 0.46, WALK + 0.46
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor', 'ceiling']
VIEWS = [
    ['brama z zewnątrz', [0, 0.46, 7.6], [0, 0.7, 3], OUT, 22],
    ['dziedziniec → sala', [0.9, E, 0.4], [0, 0.9, -3], OUT, 20],
    ['dziedziniec → brama', [0, E, -0.8], [0, 0.6, 5], OUT, 20],
    ['dziedziniec → lochy, schody', [1.2, E, 1.2], [-3, 0.6, 3.5], OUT, 20],
    ['dziedziniec → koszary', [-1.0, E, 1.0], [3.5, 0.6, 3], OUT, 20],
    ['sala tronowa', [0, E, -1.9], [0, 0.6, -4.5], ROOM, 18],
    ['tron z bliska', [0.5, E + 0.1, -2.9], [0, 0.7, -4.6], ROOM, 20],
    ['kuchnia', [-2.9, E, -2.8], [-4.3, 0.4, -4.4], ROOM, 16],
    ['komnata', [2.9, E, -2.7], [4.4, 0.4, -4.3], ROOM, 16],
    ['koszary', [3.0, E, 0.9], [4.0, 0.3, 4.3], ROOM, 16],
    ['lochy', [-3.0, E, 0.8], [-3.0, 0.4, 4.4], ROOM, 16],
    ['pod schodami', [-1.3, E, 2.2], [-2.0, 1.0, 4.5], OUT, 18],
    ['schody przy koszarach', [1.1, E + 0.3, 2.1], [2.2, 1.2, 4.2], OUT, 18],
    ['na murze', [-5.0, WY, 3.8], [-5.0, WY - 0.2, -2], OUT, 20],
    ['izba baszty', [-5.0, WY, 4.7], [-4.0, WY - 0.1, 5.2], OUT, 16],
    ['baszta: strzelnice', [-4.75, WY, 4.75], [-5.6, WY - 0.05, 5.6], OUT, 16],
    ['izba baszty bocznej', [-5.0, WY, -0.4], [-5.0, WY, 0.7], OUT, 16],
    ['wieża bramy: izba', [-0.8, WY, 5.2], [-0.95, WY - 0.05, 6.0], OUT, 16],
    ['z muru do wieży bramy', [-2.2, WY, 5.0], [-0.9, WY, 5.0], OUT, 20],
    ['wóz z sianem', [-0.1, E, 2.5], [-1.05, 0.25, 1.6], OUT, 18],
    ['strzelnica baszty z bliska', [-4.55, WY - 0.05, 4.55], [-5.35, WY - 0.1, 5.1], OUT, 14],
    ['z muru na dziedziniec', [4.8, WY, 1.0], [0, 0.3, 1.0], OUT, 22],
]
b.save('keep', maxe=0.45, rays=16, reach=0.5, extra={'solid': solid, 'floorY': G, 'wallY': WALK, 'portLift': 0.86, 'views': VIEWS})
