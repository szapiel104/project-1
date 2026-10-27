"""Zamek gracza (11×11 pól) według wspólnego planu src/data/keep-layout.json.

Mury kurtynowe z blankami i basztami, brama z przejazdem i kratą, donżon nad tylnym murem,
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
# chorągwie z herbem: tylko miejsce zawieszenia, płachtę rysuje gra (src/render/banners.ts)
# [x, y, z, obrót, szerokość, wysokość, rodzaj: 0 = na drzewcu (x,y,z = brzeg przy drzewcu, środek wysokości), 1 = wisząca (x,y,z = środek górnej krawędzi), grupa]
BANNERS = []
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
lights = []         # pochodnie na ścianach: tu gra nocą zapala światło
solid = []          # przeszkody spacerowicza: x0, x1, z0, z1, od wysokości y0 do y1
def torch(group, x, y, z):
    """Pochodnia na ścianie: drewniany trzonek w żelaznym uchwycie, kubek ze smołą i wąski, wysoki płomień"""
    lights.append([round(x, 3), round(y + 0.25, 3), round(z, 3)])   # gra stawia tu nocą lekkie światło
    b.box(group, 'iron', 0.05, 0.02, 0.05, x, y + 0.02, z)                       # uchwyt
    b.prism(group, 'woodDark', 0.012, 0.016, 0.2, x, y - 0.06, z, seg=6)         # trzonek
    b.prism(group, 'iron', 0.022, 0.03, 0.04, x, y + 0.14, z, seg=6, top=False)  # kubek
    b.prism(group, 'dark', 0.026, 0.026, 0.004, x, y + 0.172, z, seg=6)          # smoła
    # płomień rysuje gra (żywy ogień jak w pochodni chłopa) w znaczniku 'lights'
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
# wierzch podmurówki 8 cm pod posadzką, a płyty posadzki sięgają w dół do niego: przy 1,2 cm odstępu z daleka
# podmurówka (detal o włos bliżej kamery, withAo w buildings.ts) przebijała przez posadzkę i dziedziniec ciemniał
SUB = 0.08
b.box('base', 'stoneDark', N, G - 0.06 - SUB, N, 0, 0.06, 0)
FLOOR = {'.': 'pathCobble', 'T': 'plank', 'K': 'stone', 'C': 'plank', 'L': 'stoneDark', 'B': 'plank'}
for dy in range(N):
    for dx in range(N):
        r = room(dx, dy)
        if not walk(dx, dy) and r != 'o':
            continue
        if r == 'Q':
            continue  # komnata królowej ma posadzkę na wysokości chodnika (donżon)
        if r in '1234':
            b.box('interior', 'stoneDark', 1.0, 0.012 + SUB, 1.0, cx(dx), G - SUB, cz(dy))
            continue
        grp = 'floor' if r == 'B' else 'base' if r in '.o' else 'interior'
        b.box(grp, FLOOR.get(r, 'pathCobble'), 1.0, 0.012 + SUB, 1.0, cx(dx), G - SUB, cz(dy))

# ---------------- mury kurtynowe ----------------
def curtain(x0, x1, z0, z1, y0=G, y1=TOP):
    b.box('base', 'castle', x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, y0, (z0 + z1) / 2)
curtain(-H, H, -H, -H + 1)                     # tył
curtain(-H, -H + 1, -H + 1, H - 1)             # lewy
curtain(H - 1, H, -H + 1, H - 1)               # prawy
gx = L['tiles'][N - 1].index('G')
gl, gr = cx(gx) - 0.5, cx(gx) + 0.5
# przód po bokach bramy: mur kończy się przy wieżach bramy (x ±1,4), nie wchodzi w nie — inaczej lico muru od dziedzińca
# i lico wieży leżały w jednej płaszczyźnie i migały
curtain(-H, gl - 0.9, H - 1, H)
curtain(gr + 0.9, H, H - 1, H)
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
            if not outside and tile(nx, ny) in '=#Q':
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
        b.prism('base', 'castleDark', TR - RW, TR - RW, 0.066, tx, TOP, tz, seg=24)   # podłoga izby (6 mm nad płytami chodnika, które wchodzą pod baszty)
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
        BANNERS.append([round(tx + 0.017, 3), round(y_top + 1.935, 3), round(tz, 3), 0, 0.3, 0.17, 0, 'base'])
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
    b.box('base', 'castleDark', 2 * hx - 0.1, 0.066, 2 * hz - 0.1, tx, TOP, tz)   # posadzka 6 mm nad płytami chodnika
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

# ---------------- pochodnie na murach od zewnątrz: przy bramie, na bokach i z tyłu (nocą płoną, gra stawia przy nich światło) ----------------
def torch_out(x, z, nx, nz, y=0.8):
    """Pochodnia na zewnętrznym licu muru: żelazne ramię od muru (normalna nx, nz) i pochodnia 7 cm przed licem"""
    b.box('base', 'iron', 0.03 if nz else 0.09, 0.025, 0.09 if nz else 0.03, x - nx * 0.04, y + 0.005, z - nz * 0.04)
    torch('base', x, y, z)
for s in (-1, 1):
    torch_out(s * 0.6, H + 0.48, 0, 1)            # po bokach bramy, na licach wież bramnych (lico z = H + 0,4; obok chorągwi)
    torch_out(s * 2.4, -H - 0.08, 0, -1)          # tylny mur
    for k in (-2.6, 2.6):
        torch_out(s * (H + 0.08), k, s, 0)        # boczne mury

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

# ---------------- donżon nad tylnym murem: wieża mieszkalna z komnatą królowej ----------------
# Donżon zajmuje trzy pola tylnego muru (Q w planie) i wystaje 0,45 pola na zewnątrz. Na wysokości chodnika jest komnata
# królowej: wchodzi się do niej z lewego chodnika muru (po schodach z dziedzińca, wzdłuż tylnego muru), drzwiami w boku wieży.
# Pas komnaty za linią muru (z < -H + 0,05) to sprzęty pod tylną ścianą — tam się nie chodzi (pola mapy kończą się na murze).
DX0, DX1 = -1.5, 1.5
DZB, DZF = -H - 0.45, -H + 1 - 0.02     # tył (od pola) i przód (od sali tronowej)
DD = DZF - DZB
DZ = (DZB + DZF) / 2
DW = DX1 - DX0
QY2 = WALK + 1.0                          # strop komnaty
QDZ = cz(0)                               # oś drzwi i chodnika
def dwall(axis_x, fixed, a0, a1, y0, y1, holes, mat='castle', t=RW, grp='base'):
    """Ściana donżonu z otworami (u0, u1, v0, v1): axis_x = biegnie wzdłuż x w z = fixed (środek grubości)"""
    us = sorted({a0, a1, *[h[0] for h in holes], *[h[1] for h in holes]})
    for u0, u1 in zip(us, us[1:]):
        hs = [h for h in holes if h[0] <= u0 and h[1] >= u1]
        spans = [(y0, y1)] if not hs else [(y0, hs[0][2]), (hs[0][3], y1)]
        for v0, v1 in spans:
            if v1 - v0 < 1e-4:
                continue
            if axis_x:
                b.box(grp, mat, u1 - u0, v1 - v0, t, (u0 + u1) / 2, v0, fixed)
            else:
                b.box(grp, mat, t, v1 - v0, u1 - u0, fixed, v0, (u0 + u1) / 2)
# cokół (przykrywa skarpę muru), trzon do wysokości chodnika, posadzka komnaty
b.box('base', 'castleDark', DW + 0.1, 0.36, DD + 0.1, 0, 0, DZ - 0.05 + 0.025, bottom=False)
b.box('base', 'castle', DW, TOP - 0.36, DD, 0, 0.36, DZ)
b.box('base', 'castleDark', DW, WALK - TOP, DD, 0, TOP, DZ)
block(DX0, DX1, DZB, DZF, 0, WALK - 0.05)
# ściany komnaty: drzwi w lewym boku, dwa okna od pola, jedno nad salą tronową
QW1 = (0.3 - 0.11, 0.3 + 0.11)
BACKW = [(-0.75, -0.53, WALK + 0.3, WALK + 0.72), (0.53, 0.75, WALK + 0.3, WALK + 0.72)]
FRONTW = [(-0.16, 0.16, WALK + 0.32, WALK + 0.72)]
dwall(True, DZB + RW / 2, DX0, DX1, WALK, QY2, BACKW)
dwall(True, DZF - RW / 2, DX0, DX1, WALK, QY2, FRONTW)
dwall(False, DX0 + RW / 2, DZB + RW, DZF - RW, WALK, QY2, [(QDZ - DOORW / 2, QDZ + DOORW / 2, WALK, WALK + 0.62)])
dwall(False, DX1 - RW / 2, DZB + RW, DZF - RW, WALK, QY2, [])
block(DX0, DX0 + RW, DZB, QDZ - DOORW / 2, WALK - 0.1, 9); block(DX0, DX0 + RW, QDZ + DOORW / 2, DZF, WALK - 0.1, 9)
block(DX1 - RW, DX1, DZB, DZF, WALK - 0.1, 9); block(DX0, DX1, DZF - RW, DZF, WALK - 0.1, 9)
block(DX0, DX1, DZB, -H + 0.05, WALK - 0.1, 9)          # pas pod tylną ścianą: łoże, kominek, toaletka
# ościeża, nadproże i próg drzwi, skrzydło otwarte do środka
for side in (-1, 1):
    b.box('base', 'castleDark', 0.15, 0.64, 0.06, DX0 + RW / 2, WALK, QDZ + side * (DOORW / 2 + 0.02))
b.box('base', 'woodDark', RW + 0.03, 0.05, DOORW + 0.1, DX0 + RW / 2, WALK + 0.6, QDZ)
b.box('interior', 'woodDark', 0.035, 0.6, DOORW - 0.04, DX0 + RW + 0.2, WALK + 0.01, QDZ - DOORW / 2 + 0.22, math.pi / 2 - 1.2)
# parapety i obramienia okien (wystają 3 cm przed lico), okiennice przy oknach od pola
for u0, u1, v0, v1 in BACKW:
    b.box('base', 'castleDark', u1 - u0 + 0.08, 0.04, RW + 0.06, (u0 + u1) / 2, v0 - 0.04, DZB + RW / 2)
    b.box('base', 'castleDark', u1 - u0 + 0.1, 0.05, 0.05, (u0 + u1) / 2, v1, DZB - 0.015)
    for sgn in (-1, 1):
        b.box('base', 'woodDark', 0.13, v1 - v0, 0.025, (u0 + u1) / 2 + sgn * ((u1 - u0) / 2 + 0.075), v0, DZB - 0.03, sgn * 0.5)
for u0, u1, v0, v1 in FRONTW:
    b.box('base', 'castleDark', u1 - u0 + 0.08, 0.04, RW + 0.06, (u0 + u1) / 2, v0 - 0.04, DZF - RW / 2)
    b.box('base', 'castleDark', u1 - u0 + 0.1, 0.05, 0.05, (u0 + u1) / 2, v1, DZF + 0.015)
# nad komnatą: pełne piętro (strych i izba straży), gzymsy na styku pięter
b.box('base', 'castle', DW, 3.6 - QY2, DD, 0, QY2, DZ, bottom=False)
for y in (TOP - 0.06, QY2 - 0.03):
    b.box('base', 'castleDark', DW + 0.1, 0.07, DD + 0.05, 0, y, DZ - 0.025)
for x in (-0.95, 0.95):   # okna górnej izby od pola i strzelnice w trzonie
    b.box('base', 'dark', 0.14, 0.3, 0.015, x, 2.95, DZB - 0.008)
    b.box('base', 'castleDark', 0.22, 0.04, 0.05, x, 2.91, DZB - 0.015)
    b.box('base', 'dark', 0.05, 0.26, 0.015, x * 0.6, 0.85, DZB - 0.008)
for sx in (-1, 1):
    b.box('base', 'dark', 0.015, 0.3, 0.14, sx * (DX1 + 0.008), 2.95, DZ)
# korona: gzyms, wsporniki machikuł z tyłu i z boków, blanki, narożne wieżyczki na kroksztynach
b.box('base', 'castleDark', DW + 0.14, 0.08, DD + 0.14, 0, 3.6, DZ)
n = 14
for i in range(n):
    x = DX0 + 0.12 + i * (DW - 0.24) / (n - 1)
    b.box('base', 'castleDark', 0.07, 0.14, 0.085, x, 3.46, DZB + 0.0225)
    b.box('base', 'castleDark', 0.07, 0.06, 0.05, x, 3.4, DZB + 0.005)
for sx in (-1, 1):
    for i in range(6):
        z = DZB + 0.12 + i * (DD - 0.24) / 5
        b.box('base', 'castleDark', 0.085, 0.14, 0.07, sx * (DX1 - 0.0225), 3.46, z)
        b.box('base', 'castleDark', 0.05, 0.06, 0.07, sx * (DX1 - 0.005), 3.4, z)
b.merlons_line('base', 'castle', DX0 + 0.35, DZB + 0.04, DX1 - 0.35, DZB + 0.04, 3.68, step=0.3, w=0.16, h=0.2, t=0.08)
b.merlons_line('base', 'castle', DX0 + 0.35, DZF - 0.04, DX1 - 0.35, DZF - 0.04, 3.68, step=0.3, w=0.16, h=0.2, t=0.08)
for sx in (-1, 1):
    b.merlons_line('base', 'castle', sx * (DX1 - 0.04), DZB + 0.3, sx * (DX1 - 0.04), DZF - 0.3, 3.68, step=0.3, w=0.16, h=0.2, t=0.08)
    for zc in (DZB, DZF):
        tx, tz = sx * (DX1 - 0.02), zc + (0.02 if zc == DZB else -0.02)
        b.prism('base', 'castleDark', 0.05, 0.2, 0.32, tx, 3.3, tz, seg=12, top=False)      # kroksztyn
        b.prism('base', 'castle', 0.2, 0.2, 0.52, tx, 3.62, tz, seg=12, top=False)
        b.prism('base', 'castleDark', 0.215, 0.215, 0.05, tx, 4.14, tz, seg=12)
        b.prism('base', 'slate', 0.24, 0.0, 0.5, tx, 4.19, tz, seg=12)
        b.prism('base', 'iron', 0.012, 0.0, 0.14, tx, 4.68, tz, seg=6)
        out_a = math.atan2(sx, -1 if zc == DZB else 1)
        b.box('base', 'dark', 0.05, 0.2, 0.012, tx + math.sin(out_a) * 0.202, 3.8, tz + math.cos(out_a) * 0.202, out_a)
# dach dwuspadowy z łupka za blankami, gąsior, komin kominka komnaty, maszt z chorągwią na kalenicy
RZ0, RZ1, RYB, RRISE = DZB + 0.14, DZF - 0.14, 3.68, 0.85
b.gable('base', 'slate', DX0 + 0.2, DX1 - 0.2, RZ0, RZ1, RYB, RRISE, along_x=True, over=0.04, end_mat='castle')
sh = 0.035 * math.sin(math.pi / 4)
b.box('base', 'castleDark', DW - 0.3, 0.07, 0.07, 0, RYB + RRISE - 0.035, DZ - sh, tilt=math.pi / 4)
CHX = 1.0
b.box('base', 'castle', 0.24, 1.05, 0.24, CHX, RYB, DZB + 0.35)
b.box('base', 'castleDark', 0.3, 0.05, 0.3, CHX, RYB + 1.05, DZB + 0.35)
b.box('base', 'dark', 0.16, 0.005, 0.16, CHX, RYB + 1.1, DZB + 0.35)
b.box('base', 'gold', 0.07, 0.12, 0.07, 0, RYB + RRISE - 0.02, DZ)
b.box('base', 'woodDark', 0.04, 0.9, 0.04, 0, RYB + RRISE, DZ)
BANNERS.append([0.022, round(RYB + RRISE + 0.68, 3), round(DZ, 3), 0, 0.7, 0.4, 0, 'base'])

# ---------------- komnata królowej (wnętrze donżonu) ----------------
QX0, QX1, QZ0, QZ1 = DX0 + RW, DX1 - RW, DZB + RW, DZF - RW
QF = WALK + 0.006
b.box('interior', 'plank', QX1 - QX0, 0.006, QZ1 - QZ0, 0, WALK, DZ)
b.box('ceiling', 'wood', QX1 - QX0, 0.03, QZ1 - QZ0, 0, QY2 - 0.03, DZ, bottom=True)
for x in (-0.9, -0.3, 0.3, 0.9):
    b.box('ceiling', 'woodDark', 0.06, 0.06, QZ1 - QZ0, x, QY2 - 0.09, DZ, bottom=True)
# łoże królowej wezgłowiem do prawej ściany, pod tylną ścianą: rama, siennik, poduszki, pierzyna, baldachim ze ściany
LB0, LB1, LZ0, LZ1 = 0.35, QX1, QZ0 + 0.02, QZ0 + 0.58
LM = (LZ0 + LZ1) / 2
for x in (LB0 + 0.03, LB1 - 0.03):
    for z in (LZ0 + 0.03, LZ1 - 0.03):
        b.box('interior', 'woodDark', 0.05, 0.13, 0.05, x, QF, z)
for z in (LZ0 + 0.03, LZ1 - 0.03):
    b.box('interior', 'woodDark', LB1 - LB0 - 0.04, 0.08, 0.035, (LB0 + LB1) / 2, QF + 0.09, z)
b.box('interior', 'woodDark', 0.045, 0.52, LZ1 - LZ0, LB1 - 0.03, QF, LM)                    # wezgłowie przy ścianie
b.box('interior', 'wood', 0.012, 0.3, LZ1 - LZ0 - 0.12, LB1 - 0.058, QF + 0.16, LM)            # płycina
b.box('interior', 'woodDark', 0.05, 0.25, LZ1 - LZ0, LB0 + 0.025, QF, LM)                      # deska w nogach
b.box('interior', 'canvas', LB1 - LB0 - 0.1, 0.08, LZ1 - LZ0 - 0.07, (LB0 + LB1) / 2 + 0.01, QF + 0.14, LM)
for oz in (-0.12, 0.12):
    b.box('interior', 'canvas', 0.14, 0.045, 0.22, LB1 - 0.15, QF + 0.22, LM + oz, roll=0.25)
    b.box('interior', 'canvas', 0.1, 0.03, 0.17, LB1 - 0.15, QF + 0.25, LM + oz, roll=0.25)
b.box('interior', 'flag', 0.6, 0.03, LZ1 - LZ0 - 0.03, (LB0 + LB1) / 2 - 0.06, QF + 0.215, LM)
b.box('interior', 'flag', 0.012, 0.13, LZ1 - LZ0 - 0.03, LB0 + 0.052, QF + 0.105, LM)
b.box('interior', 'flag', 0.6, 0.12, 0.012, (LB0 + LB1) / 2 - 0.06, QF + 0.11, LZ1 - 0.006)
# półbaldachim: korona na ścianie nad wezgłowiem i spływające zasłony
b.box('interior', 'woodDark', 0.22, 0.05, LZ1 - LZ0 + 0.1, LB1 - 0.11, QF + 0.88, LM)
b.box('interior', 'gold', 0.24, 0.02, LZ1 - LZ0 + 0.12, LB1 - 0.11, QF + 0.93, LM)
for oz in (-1, 1):
    b.box('interior', 'flag', 0.2, 0.62, 0.014, LB1 - 0.12, QF + 0.26, LM + oz * (LZ1 - LZ0 + 0.06) / 2)
b.box('interior', 'flag', 0.012, 0.66, LZ1 - LZ0 + 0.08, LB1 - 0.06, QF + 0.22, LM)
block(LB0, LB1, LZ0, LZ1 + 0.02, WALK - 0.1, WALK + 0.9)
# kominek pod tylną ścianą (w lewej części): obudowa, gzyms, palenisko z żarem, komin w murze
FX = -0.95
b.box('interior', 'castleDark', 0.5, 0.42, 0.16, FX, QF, QZ0 + 0.08)
b.box('interior', 'dark', 0.3, 0.26, 0.01, FX, QF, QZ0 + 0.162)
b.box('interior', 'ember', 0.22, 0.04, 0.08, FX, QF + 0.01, QZ0 + 0.11)
b.box('interior', 'woodDark', 0.58, 0.04, 0.2, FX, QF + 0.42, QZ0 + 0.1)
b.box('interior', 'castle', 0.36, QY2 - QF - 0.46, 0.12, FX, QF + 0.46, QZ0 + 0.06)
for k, ox in enumerate((-0.2, 0.18)):
    b.prism('interior', 'white', 0.012, 0.012, 0.05, FX + ox, QF + 0.46, QZ0 + 0.1, seg=6)
    b.prism('interior', 'ember', 0.008, 0.0, 0.025, FX + ox, QF + 0.51, QZ0 + 0.1, seg=5)
block(FX - 0.27, FX + 0.27, QZ0, QZ0 + 0.2, WALK - 0.1, 9)
# toaletka z lustrem i stołkiem między kominkiem a łożem
TX = -0.25
b.box('interior', 'wood', 0.42, 0.03, 0.2, TX, QF + 0.26, QZ0 + 0.11)
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.04, 0.26, 0.18, TX + sx * 0.19, QF, QZ0 + 0.11)
b.box('interior', 'woodDark', 0.24, 0.3, 0.02, TX, QF + 0.29, QZ0 + 0.015)
b.box('interior', 'steel', 0.18, 0.24, 0.006, TX, QF + 0.32, QZ0 + 0.028)                   # lustro z polerowanej stali
for k, ox in enumerate((-0.12, 0.12)):
    b.prism('interior', 'gold', 0.02, 0.016, 0.04, TX + ox, QF + 0.29, QZ0 + 0.13, seg=8)   # flakonik i szkatułka
b.box('interior', 'woodDark', 0.08, 0.05, 0.06, TX + 0.03, QF + 0.29, QZ0 + 0.14)
b.box('interior', 'gold', 0.084, 0.01, 0.064, TX + 0.03, QF + 0.34, QZ0 + 0.14)
b.prism('interior', 'flag', 0.07, 0.07, 0.03, TX, QF + 0.15, QZ0 + 0.34, seg=10)              # stołek z poduszką
for k in range(3):
    a = k * 2.1
    b.box('interior', 'woodDark', 0.022, 0.15, 0.022, TX + math.sin(a) * 0.05, QF, QZ0 + 0.34 + math.cos(a) * 0.05)
block(TX - 0.23, TX + 0.23, QZ0, QZ0 + 0.22, WALK - 0.1, WALK + 0.65)
# kołowrotek i ława pod oknem od sali tronowej, skrzynia z wianem, gobelin i dywan
WX = -0.7
b.box('interior', 'woodDark', 0.36, 0.04, 0.1, WX, QF + 0.16, QZ1 - 0.12)                    # ława kołowrotka
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.03, 0.16, 0.03, WX + sx * 0.15, QF, QZ1 - 0.12)
# koło kołowrotka: cienka obręcz na szprychach (nie pełna tarcza), oś wzdłuż x
WR, WY0, WZ0 = 0.15, QF + 0.38, QZ1 - 0.12
for k in range(18):
    a0, a1 = 2 * math.pi * k / 18, 2 * math.pi * (k + 1) / 18
    pts = lambda rr, dx: [(WX + 0.08 + dx, WY0 + math.cos(a) * rr, WZ0 + math.sin(a) * rr) for a in (a0, a1)]
    for rr, inner in ((WR, False), (WR - 0.018, True)):
        q = pts(rr, -0.012) + pts(rr, 0.012)[::-1]
        b.poly('interior', 'wood', q, away=(WX + 0.08, WY0, WZ0) if not inner else (WX + 0.08, WY0 + math.cos((a0 + a1) / 2) * 3, WZ0 + math.sin((a0 + a1) / 2) * 3))
    for dx in (-0.012, 0.012):
        o, i = pts(WR, dx), pts(WR - 0.018, dx)
        b.poly('interior', 'wood', [o[0], o[1], i[1], i[0]], away=(WX + 0.08 - dx * 50, WY0, WZ0))
for k in range(8):
    b.box('interior', 'woodDark', 0.012, WR - 0.012, 0.012, WX + 0.08, WY0, WZ0, tilt=2 * math.pi * k / 8 + 0.2, bottom=True)
b.box('interior', 'woodDark', 0.05, 0.03, 0.03, WX + 0.08, WY0 - 0.015, WZ0, bottom=True)
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.025, 0.24, 0.025, WX + 0.08, QF + 0.2, QZ1 - 0.12 + sx * 0.03)
b.prism('interior', 'canvas', 0.025, 0.018, 0.12, WX - 0.12, QF + 0.2, QZ1 - 0.12, seg=8)       # kądziel z lnem
b.box('interior', 'woodDark', 0.012, 0.22, 0.012, WX - 0.12, QF + 0.2, QZ1 - 0.12)
block(WX - 0.22, WX + 0.28, QZ1 - 0.24, QZ1, WALK - 0.1, WALK + 0.6)
SBX = 0.15
b.box('interior', 'woodDark', 0.42, 0.04, 0.16, SBX, QF + 0.18, QZ1 - 0.08)                 # ława pod oknem
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.04, 0.18, 0.14, SBX + sx * 0.18, QF, QZ1 - 0.08)
b.box('interior', 'flag', 0.38, 0.025, 0.13, SBX, QF + 0.22, QZ1 - 0.085)
block(SBX - 0.22, SBX + 0.22, QZ1 - 0.17, QZ1, WALK - 0.1, WALK + 0.45)
KX = 0.95
boxs('interior', 'wood', 0.38, 0.2, 0.22, KX, QF, QZ1 - 0.13)
b.box('interior', 'plank', 0.4, 0.05, 0.24, KX, QF + 0.2, QZ1 - 0.13)
for ox in (-0.12, 0.12):
    b.box('interior', 'iron', 0.025, 0.26, 0.25, KX + ox, QF - 0.001, QZ1 - 0.13, bottom=False)
b.box('interior', 'iron', 0.05, 0.06, 0.014, KX, QF + 0.15, QZ1 - 0.252)
b.box('interior', 'canvas', 0.22, 0.03, 0.15, KX - 0.03, QF + 0.25, QZ1 - 0.13, 0.2)          # złożone płótno na wieku
b.box('interior', 'gold', 0.72, 0.02, 0.02, -0.95, QF + 0.83, QZ1 - 0.02)               # drążek gobelinu
b.box('interior', 'flag', 0.66, 0.44, 0.01, -0.95, QF + 0.38, QZ1 - 0.012)                    # gobelin nad kołowrotkiem
b.box('interior', 'gold', 0.66, 0.02, 0.012, -0.95, QF + 0.38, QZ1 - 0.016)
b.box('interior', 'flag', 1.0, 0.008, 0.36, -0.2, QF, QDZ + 0.06, bottom=False)                # dywan w barwach pana
for sz in (-1, 1):
    b.box('interior', 'gold', 1.0, 0.012, 0.025, -0.2, QF, QDZ + 0.06 + sz * 0.17, bottom=False)
torch('interior', 0.62, WALK + 0.42, QZ1 - 0.02)
torch('interior', QX0 + 0.04, WALK + 0.42, QZ0 + 0.35)

# ---------------- brama: dwie wieże, przejazd ze sklepieniem, krata, wrota ----------------
GZ = H - 0.5
# wieże bramy: w dole pełne, wyżej izby z wejściem z chodnika muru (od strony schodów) i strzelnicami na przedpole
for s in (-1, 1):
    x = cx(gx) + s * 0.95
    b.box('base', 'castle', 0.9, TOP - G, 1.4, x, G, GZ + 0.2)
    block(x - 0.45, x + 0.45, GZ - 0.5, GZ + 0.9, 0, TOP)
    square_room(x, GZ + 0.2, 0.45, 0.7, WALK + ROOM_UP, doors=[(s, 0)], windows=[(0, 1), (0, -1)])
    b.box('base', 'iron', 0.36, 0.022, 0.03, x, 1.45, GZ + 0.92)   # drążek, na którym wisi chorągiew
    BANNERS.append([round(x, 3), 1.45, round(GZ + 0.92, 3), 0, 0.32, 0.6, 1, 'base'])
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
            if ra in 'S=Q' or rb in 'S=Q':
                continue  # schody, chodnik na murach i komnata w donżonie mają własne bryły
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
        # szczyty 6 mm od muru kurtynowego: lico szczytu i lico muru nie leżą w jednej płaszczyźnie (miganie)
        e = 0.006
        b.gable('shell', mat, x0 + e, x1 - e, z0 + e, z1 - e, G + h, rise, along_x=(x1 - x0) >= (z1 - z0), over=0.03 if chars[0] in 'BL' else 0.1, end_mat=WALL_MAT.get(chars[0], 'castle'))
        ax = (x1 - x0) >= (z1 - z0)
        ov = 0.03 if chars[0] in 'BL' else 0.1
        ry = G + h + rise
        ln = (x1 - x0 if ax else z1 - z0) + 2 * ov + 0.02
        ridge = {'T': 'castleDark', 'C': 'castleDark', 'K': 'thatchDark', 'B': 'woodDark'}[chars[0]]
        # gąsior na kalenicy: belka postawiona na kant, okrakiem na grzbiecie dachu
        sh = 0.035 * math.sin(math.pi / 4)   # pudło obraca się wokół krawędzi spodu: przesunięcie, żeby kant leżał na grzbiecie
        b.box('shell', ridge, ln, 0.07, 0.07, (x0 + x1) / 2 - (0 if ax else sh), ry - 0.035, (z0 + z1) / 2 - (sh if ax else 0), 0.0 if ax else math.pi / 2, tilt=math.pi / 4)
        if chars[0] in 'TC':   # kute iglice na końcach kalenicy
            for e in (-1, 1):
                ex = (x0 + x1) / 2 + (e * (ln / 2 - 0.04) if ax else 0)
                ez = (z0 + z1) / 2 + (0 if ax else e * (ln / 2 - 0.04))
                b.prism('shell', 'iron', 0.018, 0.0, 0.28, ex, ry + 0.03, ez, seg=6)
                b.prism('shell', 'iron', 0.035, 0.035, 0.03, ex, ry + 0.1, ez, seg=8)
        if chars[0] == 'T':    # sygnaturka: mała wieżyczka z dzwonkiem na środku kalenicy sali tronowej
            mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
            b.box('shell', 'woodDark', 0.26, 0.42, 0.26, mx, ry - 0.12, mz)
            for ox in (-1, 1):
                for oz in (-1, 1):
                    b.box('shell', 'woodDark', 0.04, 0.2, 0.04, mx + ox * 0.11, ry + 0.3, mz + oz * 0.11)
            b.prism('shell', 'iron', 0.045, 0.06, 0.09, mx, ry + 0.405, mz, seg=10)          # dzwonek
            b.box('shell', 'woodDark', 0.3, 0.03, 0.3, mx, ry + 0.5, mz)
            b.pyramid('shell', 'slate', 0.34, 0.34, 0.38, mx, ry + 0.53, mz)
            b.prism('shell', 'iron', 0.014, 0.0, 0.24, mx, ry + 0.88, mz, seg=6)
            b.box('shell', 'gold', 0.04, 0.04, 0.04, mx, ry + 0.95, mz)
        if chars[0] == 'B':    # wywietrznik dymu z daszkiem nad koszarami
            vx, vz = (x0 + x1) / 2, z0 + (z1 - z0) * 0.3
            b.box('shell', 'woodDark', 0.2, 0.2, 0.2, vx, ry - 0.08, vz)
            b.box('shell', 'dark', 0.14, 0.07, 0.205, vx, ry + 0.02, vz, bottom=False)
            b.gable('shell', 'roadWood', vx - 0.12, vx + 0.12, vz - 0.12, vz + 0.12, ry + 0.12, 0.1, along_x=False, over=0.03)
    else:   # lochy: płaski kamienny strop z krawężnikiem, kratą świetlika i rzygaczami
        b.box('shell', mat, x1 - x0 + 0.1, 0.08, z1 - z0 + 0.1, (x0 + x1) / 2, G + h, (z0 + z1) / 2, bottom=True)
        ty, mx, mz = G + h + 0.08, (x0 + x1) / 2, (z0 + z1) / 2
        W, D = x1 - x0 + 0.1, z1 - z0 + 0.1
        for sz in (-1, 1):
            b.box('shell', 'castle', W, 0.09, 0.1, mx, ty - 0.01, mz + sz * (D / 2 - 0.05), bottom=False)
        for sx in (-1, 1):
            b.box('shell', 'castle', 0.1, 0.09, D - 0.2, mx + sx * (W / 2 - 0.05), ty - 0.01, mz, bottom=False)
        for i, gz in enumerate((mz - D / 4, mz + D / 4)):   # dwa świetliki z kratą nad korytarzem i celami
            b.box('shell', 'castleDark', 0.42, 0.05, 0.42, mx, ty - 0.01, gz, bottom=False)
            b.box('shell', 'dark', 0.3, 0.002, 0.3, mx, ty + 0.042, gz, bottom=False)
            for k in (-1, 0, 1):
                b.box('shell', 'iron', 0.018, 0.02, 0.32, mx + k * 0.08, ty + 0.04, gz, bottom=False)
                b.box('shell', 'iron', 0.32, 0.02, 0.018, mx, ty + 0.045, gz + k * 0.08, bottom=False)
        for zz in (z0 + 0.5, z0 + 1.5):   # rzygacze: woda z dachu leci na dziedziniec, nie na schody
            b.box('shell', 'castleDark', 0.22, 0.06, 0.07, x1 + 0.12, G + h + 0.02, zz)
            b.box('shell', 'dark', 0.06, 0.006, 0.03, x1 + 0.2, G + h + 0.08, zz, bottom=False)
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
    b.box('interior', 'gold', 0.035, 0.014, cl, tmx + sx * 0.3, G + 0.013, tz0 + 1.1 + cl / 2)
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
        zz = (tz0 + tz1) / 2 - 0.3 + i * 0.36   # chleb i jabłka ze skanów na stole
        (b.bun('interior', x, G + 0.3, zz, w=0.09, rot=i) if i % 2 else b.apple('interior', x, G + 0.3, zz, w=0.06, rot=i))
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
# palenisko: belka nad otworem, półka z garnkami, okap zwężający się ku kominowi, kamienny przypiecek
HX = (kx0 + kx1) / 2
b.box('interior', 'woodDark', 1.16, 0.07, 0.08, HX, G + 0.44, kz0 + 0.44)
b.box('interior', 'wood', 1.2, 0.03, 0.16, HX, G + 0.75, kz0 + 0.4)
for k, ox in enumerate((-0.4, -0.22, 0.3)):
    b.prism('interior', 'iron', 0.05 - k * 0.008, 0.045 - k * 0.008, 0.07, HX + ox, G + 0.78, kz0 + 0.4, seg=10)
b.prism('interior', 'soil', 0.03, 0.022, 0.1, HX + 0.45, G + 0.78, kz0 + 0.4, seg=10)
b.box('interior', 'stone', 0.9, 0.12, 0.3, HX, G + 0.75, kz0 + 0.15)
b.box('interior', 'stone', 0.6, 0.1, 0.22, HX, G + 0.87, kz0 + 0.11)
b.box('interior', 'stoneDark', 1.2, 0.05, 0.2, HX, G + 0.006, kz0 + 0.52, bottom=False)
for ox in (-0.42, 0.42):   # haki z chochlą i patelnią na bokach
    b.box('interior', 'iron', 0.012, 0.05, 0.012, HX + ox, G + 0.38, kz0 + 0.43)
b.box('interior', 'woodDark', 0.012, 0.18, 0.012, HX - 0.42, G + 0.2, kz0 + 0.44)
b.prism('interior', 'iron', 0.03, 0.025, 0.012, HX - 0.42, G + 0.19, kz0 + 0.44, seg=8)
b.prism('interior', 'iron', 0.07, 0.07, 0.015, HX + 0.42, G + 0.22, kz0 + 0.45, seg=12)
# stół kuchenny na czterech nogach, na nim deska z nożem, bochenki i jabłka ze skanów, ryba z paczki
KTX, KTZ = (kx0 + kx1) / 2, (kz0 + kz1) / 2 + 0.15
boxs('interior', 'wood', 0.85, 0.05, 0.45, KTX, G + 0.28, KTZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('interior', 'woodDark', 0.05, 0.28, 0.05, KTX + sx * 0.37, G, KTZ + sz * 0.17)
    b.box('interior', 'woodDark', 0.03, 0.05, 0.3, KTX + sx * 0.37, G + 0.06, KTZ)       # spinacze nóg
b.box('interior', 'plank', 0.24, 0.02, 0.16, KTX + 0.25, G + 0.33, KTZ - 0.08)             # deska do krojenia
# nóż: cienkie stalowe ostrze zwężające się ku czubkowi i drewniana rękojeść z mosiężnym nitem
for k, (ln, wd) in enumerate(((0.06, 0.016), (0.035, 0.011), (0.015, 0.006))):
    b.box('interior', 'steel', ln, 0.003, wd, KTX + 0.235 + (0.0 if k == 0 else 0.03 + k * 0.012), G + 0.35, KTZ - 0.08 + (0.0 if k == 0 else 0.004), 0.4)
b.box('interior', 'wood', 0.055, 0.011, 0.016, KTX + 0.185, G + 0.35, KTZ - 0.059, 0.4)
b.box('interior', 'gold', 0.008, 0.013, 0.018, KTX + 0.205, G + 0.349, KTZ - 0.068, 0.4)
FISH_SPOTS = []   # ryba na stole: gotowy model z paczki stawiany przez grę (x, y, z pyska, yaw, wisi?, długość — jak w fisher.py)
FISH_SPOTS.append([round(KTX - 0.07, 4), round(G + 0.33, 4), round(KTZ + 0.05, 4), 0.25, 0, 0.14])
b.bun('interior', KTX - 0.28, G + 0.33, KTZ + 0.06, w=0.1, rot=0.4)
b.bun('interior', KTX + 0.2, G + 0.33, KTZ + 0.12, w=0.09, rot=2.1)
for i, (ox, oz) in enumerate(((-0.27, -0.1), (-0.2, -0.13), (0.08, -0.12), (0.31, 0.1))):
    b.apple('interior', KTX + ox, G + 0.33, KTZ + oz, w=0.055, rot=i * 1.3)
b.sack('interior', KTX + 0.47, G + 0.012, KTZ + 0.25, w=0.15, rot=0.6)                    # worek mąki pod stołem
for i, (x, z) in enumerate(((kx0 + 0.22, kz1 - 0.25), (kx0 + 0.22, kz1 - 0.6), (kx0 + 0.2, kz0 + 0.62))):
    b.prism('interior', 'wood', 0.15, 0.13, 0.36, x, G, z, seg=10)
    for yy in (G + 0.05, G + 0.29):
        b.prism('interior', 'iron', 0.152, 0.152, 0.02, x, yy, z, seg=10, top=False)
    block(x - 0.15, x + 0.15, z - 0.15, z + 0.15)
# regał na ścianie: boki, trzy półki i plecy z desek, a na półkach chleb, jabłka, dzbany i kosz
SX, SZ = kx1 - 0.09, (kz0 + kz1) / 2 + 0.35
for sz in (-1, 1):
    b.box('interior', 'woodDark', 0.14, 0.72, 0.025, SX, G, SZ + sz * 0.29)
b.box('interior', 'plank', 0.015, 0.72, 0.56, kx1 - 0.024, G, SZ)
block(SX - 0.08, SX + 0.08, SZ - 0.31, SZ + 0.31)
for k, yy in enumerate((G + 0.04, G + 0.29, G + 0.52)):
    b.box('interior', 'wood', 0.13, 0.022, 0.555, SX, yy, SZ)
    top = yy + 0.022
    if k == 0:
        b.prism('interior', 'basket', 0.065, 0.065, 0.09, SX, top, SZ - 0.12)   # kosz z wikliny z paczki
        b.sack('interior', SX, top, SZ + 0.13, w=0.11, rot=1.0)
    elif k == 1:
        b.bun('interior', SX, top, SZ - 0.16, w=0.09, rot=1.57)
        b.bun('interior', SX, top, SZ - 0.04, w=0.085, rot=1.2)
        for j in range(3):
            b.apple('interior', SX - 0.02 + (j % 2) * 0.03, top, SZ + 0.1 + j * 0.055, w=0.05, rot=j)
    else:
        for j, zz in enumerate((SZ - 0.17, SZ - 0.05, SZ + 0.09)):   # gliniane dzbany i kubek
            b.prism('interior', 'soil', 0.032, 0.022, 0.1 - j * 0.02, SX, top, zz, seg=10)
            b.prism('interior', 'soil', 0.022, 0.028, 0.02, SX, top + 0.1 - j * 0.02, zz, seg=10)
        b.apple('interior', SX, top, SZ + 0.2, w=0.055, rot=0.7)

# ---------------- komnata pana ----------------
# pochodnie w sali tronowej i kuchni
for xx in (tx0 + 0.09, tx1 - 0.09):
    for zz in (tz0 + 1.3, tz1 - 0.5):
        torch('interior', xx, G + 0.7, zz)
torch('interior', kx1 - 0.08, G + 0.55, kz0 + 0.5)
qx0, qx1, qz0, qz1 = bbox('C')
# łoże z baldachimem: nogi, rama, siennik, poduszki, pierzyna zwisająca po bokach, zasłony przy wezgłowiu
BX, BZ0, BZ1 = qx1 - 0.45, qz0 + 0.09, qz0 + 1.1
block(BX - 0.38, BX + 0.38, BZ0, BZ1)
for s2 in (-1, 1):
    for zz in (BZ0, BZ1):
        b.box('interior', 'woodDark', 0.05, 1.0, 0.05, BX + s2 * 0.35, G, zz)                         # słupki baldachimu
        b.box('interior', 'gold', 0.065, 0.04, 0.065, BX + s2 * 0.35, G + 1.0, zz)
    b.box('interior', 'woodDark', 0.04, 0.09, BZ1 - BZ0 - 0.05, BX + s2 * 0.35, G + 0.1, (BZ0 + BZ1) / 2)  # boki ramy
b.box('interior', 'woodDark', 0.66, 0.5, 0.045, BX, G + 0.05, BZ0 + 0.02)                               # wezgłowie
b.box('interior', 'woodDark', 0.72, 0.045, 0.06, BX, G + 0.55, BZ0 + 0.02)
b.box('interior', 'wood', 0.5, 0.3, 0.012, BX, G + 0.17, BZ0 + 0.048)                                    # płycina
b.box('interior', 'woodDark', 0.66, 0.24, 0.045, BX, G + 0.05, BZ1 - 0.02)                              # deska w nogach
b.box('interior', 'canvas', 0.64, 0.08, 0.9, BX, G + 0.16, (BZ0 + BZ1) / 2)                              # siennik
for ox in (-0.15, 0.15):
    # poduszki z lnu: wypchane (niższe brzegi, wyższy środek), oparte o wezgłowie
    b.box('interior', 'canvas', 0.26, 0.045, 0.15, BX + ox, G + 0.24, BZ0 + 0.16, tilt=-0.25)
    b.box('interior', 'canvas', 0.22, 0.03, 0.11, BX + ox, G + 0.27, BZ0 + 0.165, tilt=-0.25)
    b.box('interior', 'canvas', 0.16, 0.015, 0.07, BX + ox, G + 0.293, BZ0 + 0.171, tilt=-0.25)
b.box('interior', 'flag', 0.7, 0.03, 0.62, BX, G + 0.235, BZ1 - 0.36)                                    # pierzyna
b.box('interior', 'flag', 0.72, 0.05, 0.09, BX, G + 0.24, BZ1 - 0.66)                                    # wywinięty brzeg
for s2 in (-1, 1):
    b.box('interior', 'flag', 0.014, 0.13, 0.62, BX + s2 * 0.357, G + 0.135, BZ1 - 0.36)                 # zwisa po bokach
b.box('interior', 'flag', 0.75, 0.04, 1.05, BX, G + 0.98, (BZ0 + BZ1) / 2)                               # nieba baldachimu
for s2 in (-1, 1):   # lambrekin dookoła i zasłony zebrane przy słupkach wezgłowia
    b.box('interior', 'flag', 0.012, 0.12, 1.05, BX + s2 * 0.381, G + 0.87, (BZ0 + BZ1) / 2)
    b.box('interior', 'flag', 0.07, 0.72, 0.09, BX + s2 * 0.3, G + 0.26, BZ0 + 0.08)
    b.box('interior', 'gold', 0.075, 0.025, 0.095, BX + s2 * 0.3, G + 0.55, BZ0 + 0.08)
b.box('interior', 'flag', 0.78, 0.12, 0.012, BX, G + 0.87, BZ1 + 0.031)
b.box('interior', 'hide', 0.55, 0.012, 0.36, BX - 0.05, G + 0.014, BZ1 + 0.3, 0.15, bottom=False)       # skóra przy łożu
# skrzynia na skarby: korpus, wieko, okucia, zamek i puchar na wieku
CX, CZ = qx0 + 0.45, qz0 + 0.2
boxs('interior', 'wood', 0.42, 0.22, 0.26, CX, G, CZ)
b.box('interior', 'plank', 0.44, 0.06, 0.28, CX, G + 0.22, CZ)
for ox in (-0.13, 0.13):
    b.box('interior', 'iron', 0.03, 0.29, 0.29, CX + ox, G - 0.001, CZ, bottom=False)
b.box('interior', 'iron', 0.06, 0.07, 0.016, CX, G + 0.17, CZ + 0.145)
b.box('interior', 'dark', 0.012, 0.025, 0.006, CX, G + 0.19, CZ + 0.154)
b.prism('interior', 'gold', 0.035, 0.022, 0.012, CX - 0.1, G + 0.28, CZ, seg=10)                         # puchar
b.prism('interior', 'gold', 0.008, 0.008, 0.05, CX - 0.1, G + 0.292, CZ, seg=6)
b.prism('interior', 'gold', 0.022, 0.04, 0.06, CX - 0.1, G + 0.342, CZ, seg=10)
for k in range(5):
    b.prism('interior', 'gold', 0.02, 0.02, 0.008, CX + 0.07 + (k % 2) * 0.03, G + 0.28 + (k // 2) * 0.008, CZ - 0.03 + k * 0.012, seg=8)
# stół do pisania na nogach z krzesłem: pergamin, księga, kałamarz i świeca
DX, DZ = qx0 + 0.5, qz1 - 0.35
boxs('interior', 'wood', 0.5, 0.04, 0.32, DX, G + 0.3, DZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('interior', 'woodDark', 0.04, 0.3, 0.04, DX + sx * 0.21, G, DZ + sz * 0.12)
b.box('interior', 'canvas', 0.2, 0.006, 0.15, DX, G + 0.34, DZ, 0.2)                                    # pergamin
b.box('interior', 'woodDark', 0.13, 0.035, 0.1, DX - 0.15, G + 0.34, DZ + 0.03, -0.3)                    # księga
b.box('interior', 'canvas', 0.12, 0.025, 0.09, DX - 0.15, G + 0.345, DZ + 0.03, -0.3)
b.prism('interior', 'dark', 0.018, 0.014, 0.03, DX + 0.13, G + 0.34, DZ + 0.08, seg=8)                   # kałamarz
b.box('interior', 'white', 0.004, 0.08, 0.004, DX + 0.135, G + 0.36, DZ + 0.08, roll=0.4)                # pióro
b.prism('interior', 'white', 0.015, 0.015, 0.05, DX + 0.16, G + 0.34, DZ - 0.08, seg=6)
b.prism('interior', 'ember', 0.01, 0.0, 0.03, DX + 0.16, G + 0.39, DZ - 0.08, seg=5)
CHZ = DZ - 0.3
b.box('interior', 'woodDark', 0.2, 0.03, 0.2, DX, G + 0.17, CHZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('interior', 'woodDark', 0.03, 0.17 if sz > 0 else 0.48, 0.03, DX + sx * 0.085, G, CHZ + sz * 0.085)
b.box('interior', 'woodDark', 0.2, 0.18, 0.025, DX, G + 0.3, CHZ - 0.085)
block(DX - 0.12, DX + 0.12, CHZ - 0.12, CHZ + 0.12)
# szafa: plecy przy ścianie, dwoje drzwi z płycinami i kutymi uchwytami, gzyms i cokół
WX, WZ = qx1 - 0.25, qz1 - 0.2
boxs('interior', 'woodDark', 0.4, 0.8, 0.3, WX, G + 0.03, WZ)
b.box('interior', 'woodDark', 0.44, 0.03, 0.32, WX, G, WZ)
b.box('interior', 'woodDark', 0.46, 0.05, 0.34, WX, G + 0.83, WZ)
for ox in (-0.1, 0.1):
    b.box('interior', 'wood', 0.17, 0.66, 0.012, WX + ox, G + 0.1, WZ - 0.156)
    b.box('interior', 'woodDark', 0.11, 0.22, 0.008, WX + ox, G + 0.18, WZ - 0.165)
    b.box('interior', 'woodDark', 0.11, 0.22, 0.008, WX + ox, G + 0.48, WZ - 0.165)
    b.box('interior', 'iron', 0.012, 0.06, 0.012, WX + ox * 0.2, G + 0.42, WZ - 0.168)

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
# kołowrót między słupkami (wałek z korbą), lina i wiadro wiszące na niej nad cembrowiną
ROLL = G + 0.8
b.box('base', 'wood', 0.56, 0.07, 0.07, wx, ROLL - 0.035, wz, bottom=True)                 # wałek
b.box('base', 'rope', 0.12, 0.08, 0.08, wx + 0.08, ROLL - 0.04, wz, bottom=True)           # nawinięta lina
for s in (-1, 1):
    b.box('base', 'woodDark', 0.06, 0.08, 0.08, wx + s * 0.3, ROLL - 0.04, wz, bottom=True)  # łożyska na słupkach
b.box('base', 'iron', 0.03, 0.025, 0.025, wx + 0.345, ROLL - 0.012, wz, bottom=True)       # oś korby
b.box('base', 'iron', 0.02, 0.16, 0.02, wx + 0.36, ROLL - 0.16, wz, bottom=True)           # ramię korby
b.box('base', 'woodDark', 0.07, 0.025, 0.025, wx + 0.39, ROLL - 0.17, wz, bottom=True)     # rączka
BY = G + 0.5    # spód wiadra
b.box('base', 'rope', 0.012, ROLL - 0.04 - (BY + 0.2), 0.012, wx + 0.08, BY + 0.2, wz, bottom=True)   # lina
b.prism('base', 'wood', 0.06, 0.075, 0.12, wx + 0.08, BY, wz, seg=10)                       # wiadro (szersze u góry)
for y in (BY + 0.02, BY + 0.09):
    b.prism('base', 'iron', 0.066 + (y - BY) * 0.12, 0.066 + (y - BY) * 0.12, 0.012, wx + 0.08, y, wz, seg=10, top=False)
b.box('base', 'iron', 0.15, 0.012, 0.012, wx + 0.08, BY + 0.19, wz, bottom=True)            # kabłąk
for s in (-1, 1):
    b.box('base', 'iron', 0.012, 0.08, 0.012, wx + 0.08 + s * 0.07, BY + 0.11, wz, bottom=True)
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
# pieniek z wbitym toporem przy stosie drewna, obok kilka szczap
PX, PZ = cx(1) + 0.55, cz(4) - 0.25
b.prism('base', 'wood', 0.11, 0.1, 0.17, PX, G, PZ, seg=12)
b.box('base', 'steel', 0.012, 0.07, 0.1, PX + 0.01, G + 0.12, PZ + 0.02, bottom=True)
b.box('base', 'woodDark', 0.024, 0.34, 0.024, PX + 0.01, G + 0.15, PZ - 0.02, tilt=-0.55)
for k, (ox, oz, r) in enumerate(((0.12, 0.13, 0.3), (-0.13, 0.12, 1.4), (0.16, -0.06, 2.2))):
    b.box('base', 'wood', 0.05, 0.04, 0.2, PX + ox, G, PZ + oz, r)
block(PX - 0.14, PX + 0.14, PZ - 0.14, PZ + 0.14, 0, 0.4)
# stojak z włóczniami i tarczą pod ścianą koszar
RX, RZ = cx(7) + 0.3, cz(6)
for oz in (-0.25, 0.25):
    b.box('base', 'woodDark', 0.05, 0.6, 0.05, RX, G, RZ + oz)
for y in (0.12, 0.46):
    b.box('base', 'woodDark', 0.06, 0.04, 0.56, RX, G + y, RZ)
for k in range(4):
    z = RZ - 0.18 + k * 0.12
    b.box('base', 'woodDark', 0.02, 0.8, 0.02, RX - 0.03, G, z, roll=-0.08)
    tx_, ty_ = RX - 0.03 + 0.8 * math.sin(0.08), G + 0.8 * math.cos(0.08)
    b.box('base', 'steel', 0.012, 0.09, 0.03, tx_, ty_ - 0.005, z, roll=-0.08)
b.box('base', 'woodDark', 0.025, 0.28, 0.24, RX - 0.08, G, RZ + 0.42, roll=-0.18)
b.box('base', 'iron', 0.03, 0.06, 0.06, RX - 0.08 - 0.012 - 0.14 * math.sin(0.18), G + 0.11, RZ + 0.42, roll=-0.18)
block(RX - 0.15, RX + 0.18, RZ - 0.3, RZ + 0.56, 0, 0.9)
# koryto z wodą dla koni przy studni
QX, QZ = wx + 0.62, wz
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.16, 0.56, QX + sx * 0.09, G, QZ)
for sz in (-1, 1):
    b.box('base', 'woodDark', 0.15, 0.16, 0.03, QX, G, QZ + sz * 0.265)
b.box('base', 'wood', 0.15, 0.03, 0.5, QX, G, QZ)
b.box('base', 'water', 0.15, 0.002, 0.5, QX, G + 0.12, QZ, bottom=False)
block(QX - 0.12, QX + 0.12, QZ - 0.3, QZ + 0.3, 0, 0.3)
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
    ['chodnik do donżonu', [-3.3, WY, -5.0], [-1.4, WY - 0.05, -5.0], OUT, 18],
    ['komnata królowej', [-1.2, WY, -4.85], [1.0, WY - 0.15, -5.5], ['base', 'interior', 'floor', 'ceiling'], 16],
    ['komnata: kominek i toaletka', [0.6, WY, -4.8], [-0.9, WY - 0.1, -5.7], ['base', 'interior', 'floor', 'ceiling'], 16],
    ['donżon od pola', [0, 1.6, -9.0], [0, 2.6, -5.5], OUT, 22],
    ['dach donżonu', [2.5, 6.5, -8.0], [0, 3.9, -5.2], OUT, 20],
]
b.save('keep', maxe=0.45, rays=16, reach=0.5, extra={'lights': lights, 'solid': solid, 'floorY': G, 'wallY': WALK, 'portLift': 0.86, 'views': VIEWS, 'banners': BANNERS, 'fishSpots': FISH_SPOTS})
