"""Karczma (4×3 pola): piętrowy dom z szachulca na kamiennej podmurówce, strzecha, komin, ganek z ławami i szyldem.
Na dole izba: szynkwas z beczkami i półką kufli, palenisko z kotłem, stoły z ławami, wędliny pod belkami.
Piętro i dach (grupa 'shell') znikają przy podglądzie wnętrza; sufit z belkami ('ceiling') widać tylko z izby.

Uruchomienie (z katalogu repo):  python tools/models/tavern.py
Układ: środek działki = (0, 0), 1 = jedno pole, przód (drzwi, ganek) = +z. Wejście: pole przed środkiem przodu.
Do modelu zapisujemy też znaczniki dla gry: okna (świecą nocą), komin (dym), ogień, miejsca dla gości,
prostokąty, po których chodzi spacerowicz, i przeszkody.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
solid, open_ = [], []
windows, chimneys, flames, seats = [], [], [], []
def block(x0, x1, z0, z1, y0=0.0, y1=9.0):
    solid.append([round(min(x0, x1), 3), round(max(x0, x1), 3), round(min(z0, z1), 3), round(max(z0, z1), 3), round(y0, 3), round(y1, 3)])
def boxs(group, mat, w, h, d, x, y, z, rot=0.0, **kw):
    b.box(group, mat, w, h, d, x, y, z, rot, **kw)
    c, s = abs(math.cos(rot)), abs(math.sin(rot))
    ww, dd = w * c + d * s, w * s + d * c
    block(x - ww / 2, x + ww / 2, z - dd / 2, z + dd / 2, y - 0.05, y + h)

P = 0.12                 # posadzka izby (wierzch podmurówki)
X0, X1, Z0, Z1 = -1.8, 1.8, -1.4, 0.75    # obrys ścian parteru
H1 = P + 0.9             # strop parteru
H2 = H1 + 0.62           # okap
T = 0.08                 # grubość ściany
DOOR = (0.3, 0.7, 0.66)   # drzwi naprzeciw pola wejścia (działka parzystej szerokości: wejście pół pola w prawo)
DM = (DOOR[0] + DOOR[1]) / 2
JET = 0.08               # piętro wysunięte nad parterem

# ---------------- podmurówka, posadzka ----------------
b.box('base', 'stone', X1 - X0 + 0.08, P, Z1 - Z0 + 0.08, 0, 0, (Z0 + Z1) / 2)
b.box('base', 'stoneDark', X1 - X0 + 0.14, 0.04, Z1 - Z0 + 0.14, 0, 0, (Z0 + Z1) / 2)
b.box('floor', 'plank', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, (Z0 + Z1) / 2)

# ---------------- ściany z otworami ----------------
def wall_x(group, mat, z, x0, x1, y0, y1, holes, depth=T):
    """Ściana wzdłuż x w płaszczyźnie z, z otworami (u0, u1, v0, v1) w układzie (x, y)"""
    xs = sorted({x0, x1, *[h[0] for h in holes], *[h[1] for h in holes]})
    for a, c in zip(xs, xs[1:]):
        hs = [h for h in holes if h[0] <= a and h[1] >= c]
        if not hs:
            b.box(group, mat, c - a, y1 - y0, depth, (a + c) / 2, y0, z)
            continue
        u0, u1, v0, v1 = hs[0]
        if v0 > y0: b.box(group, mat, c - a, v0 - y0, depth, (a + c) / 2, y0, z)
        if v1 < y1: b.box(group, mat, c - a, y1 - v1, depth, (a + c) / 2, v1, z)
def wall_z(group, mat, x, z0, z1, y0, y1, holes, depth=T):
    zs = sorted({z0, z1, *[h[0] for h in holes], *[h[1] for h in holes]})
    for a, c in zip(zs, zs[1:]):
        hs = [h for h in holes if h[0] <= a and h[1] >= c]
        if not hs:
            b.box(group, mat, depth, y1 - y0, c - a, x, y0, (a + c) / 2)
            continue
        u0, u1, v0, v1 = hs[0]
        if v0 > y0: b.box(group, mat, depth, v0 - y0, c - a, x, y0, (a + c) / 2)
        if v1 < y1: b.box(group, mat, depth, y1 - v1, c - a, x, v1, (a + c) / 2)

def window(group, x, y0, y1, z, w, nx, nz, shutters=True):
    """Okno: rama, krzyż szprosów, parapet, okiennice odchylone na boki; szybę (świecącą nocą) dokłada gra"""
    h = y1 - y0
    if nz:
        zz = z + nz * T / 2
        b.box(group, 'woodDark', w + 0.05, 0.03, 0.05, x, y0 - 0.03, zz)            # parapet
        b.box(group, 'woodDark', w + 0.04, 0.03, 0.03, x, y1, zz)                   # nadproże
        b.box(group, 'woodDark', 0.02, h, 0.02, x, y0, zz - nz * 0.03)              # szpros
        b.box(group, 'woodDark', w, 0.02, 0.02, x, y0 + h / 2, zz - nz * 0.03)
        windows.append([round(x, 3), round(y0 + h / 2, 3), round(z, 3), 0, nz, round(w, 3), round(h, 3), group])
        if shutters:
            for side in (-1, 1):
                b.box(group, 'wood', w / 2, h + 0.02, 0.02, x + side * (w / 2 + w / 4 + 0.01), y0 - 0.01, zz + nz * 0.04, side * nz * 0.5)
    else:
        xx = x + nx * T / 2
        b.box(group, 'woodDark', 0.05, 0.03, w + 0.05, xx, y0 - 0.03, z)
        b.box(group, 'woodDark', 0.03, 0.03, w + 0.04, xx, y1, z)
        b.box(group, 'woodDark', 0.02, h, 0.02, xx - nx * 0.03, y0, z)
        b.box(group, 'woodDark', 0.02, 0.02, w, xx - nx * 0.03, y0 + h / 2, z)
        windows.append([round(x, 3), round(y0 + h / 2, 3), round(z, 3), nx, 0, round(w, 3), round(h, 3), group])
        if shutters:
            for side in (-1, 1):
                b.box(group, 'wood', 0.02, h + 0.02, w / 2, xx + nx * 0.04, y0 - 0.01, z + side * (w / 2 + w / 4 + 0.01), -side * nx * 0.5)

def frame_x(group, z, x0, x1, y0, y1, posts, braces=True, out=1):
    """Szachulec na licu ściany wzdłuż x: słupy, oczepy, rygiel i zastrzały"""
    zz = z + out * (T / 2 + 0.008)
    for x in posts:
        b.box(group, 'woodDark', 0.06, y1 - y0, 0.025, x, y0, zz)
    b.box(group, 'woodDark', x1 - x0, 0.05, 0.025, (x0 + x1) / 2, y0, zz)
    b.box(group, 'woodDark', x1 - x0, 0.05, 0.025, (x0 + x1) / 2, y1 - 0.05, zz)
    if braces:
        for a, c in zip(posts, posts[1:]):
            if c - a < 0.45:
                continue
            ln = math.hypot(c - a, y1 - y0 - 0.1)
            ang = math.atan2(y1 - y0 - 0.1, c - a)
            b.box(group, 'woodDark', 0.04, ln, 0.022, a + 0.03, y0 + 0.05, zz, roll=-(math.pi / 2 - ang))
def frame_z(group, x, z0, z1, y0, y1, posts, out=1):
    xx = x + out * (T / 2 + 0.008)
    for z in posts:
        b.box(group, 'woodDark', 0.025, y1 - y0, 0.06, xx, y0, z)
    b.box(group, 'woodDark', 0.025, 0.05, z1 - z0, xx, y0, (z0 + z1) / 2)
    b.box(group, 'woodDark', 0.025, 0.05, z1 - z0, xx, y1 - 0.05, (z0 + z1) / 2)

# parter: drzwi i dwa okna z przodu, dwa z tyłu, po jednym z boków
FW = [(-1.45, -1.1, P + 0.32, P + 0.64), (-0.65, -0.3, P + 0.32, P + 0.64), (1.1, 1.45, P + 0.32, P + 0.64)]
front_holes = [(DOOR[0], DOOR[1], P, P + DOOR[2])] + FW
wall_x('base', 'plaster', Z1 - T / 2, X0, X1, P, H1, front_holes)
wall_x('base', 'plaster', Z0 + T / 2, X0, X1, P, H1, [(-0.3, 0.0, P + 0.34, P + 0.62), (0.75, 1.05, P + 0.34, P + 0.62)])
wall_z('base', 'plaster', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [(-0.5, -0.2, P + 0.34, P + 0.62)])
wall_z('base', 'plaster', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [])
for u0, u1, v0, v1 in FW:
    window('base', (u0 + u1) / 2, v0, v1, Z1 - T / 2, u1 - u0, 0, 1)
window('base', -0.15, P + 0.34, P + 0.62, Z0 + T / 2, 0.3, 0, -1)
window('base', 0.9, P + 0.34, P + 0.62, Z0 + T / 2, 0.3, 0, -1)
window('base', X0 + T / 2, P + 0.34, P + 0.62, -0.35, 0.3, -1, 0)
frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, -1.5, -1.05, -0.7, -0.25, DOOR[0] - 0.03, DOOR[1] + 0.03, 1.05, 1.5, X1 - 0.03], braces=False)
frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, -1.1, -0.35, 0.05, 0.7, 1.1, X1 - 0.03], out=-1)
frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.55, -0.15, Z1 - 0.03], out=-1)
frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.35, Z1 - 0.03])
# drzwi otwarte do izby, nadproże, próg
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.08, 0.05, T + 0.03, DM, P + DOOR[2], Z1 - T / 2)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.04, 0.02, 0.12, DM, P, Z1 - 0.01)
b.box('interior', 'wood', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.03, DOOR[0] + 0.02, P, Z1 - T - 0.17, math.pi / 2 - 0.25)
for yy in (P + 0.12, P + 0.48):
    b.box('interior', 'iron', 0.02, 0.02, 0.26, DOOR[0] + 0.04, yy, Z1 - T - 0.17, -0.25)
# ściany parteru dla spacerowicza (z przerwą na drzwi)
block(X0, DOOR[0], Z1 - T, Z1); block(DOOR[1], X1, Z1 - T, Z1)
block(X0, X1, Z0, Z0 + T); block(X0, X0 + T, Z0, Z1); block(X1 - T, X1, Z0, Z1)

# ---------------- piętro (wysunięte), strzecha, komin — znikają przy podglądzie wnętrza ----------------
for x in (-1.65, -1.1, -0.55, 0.0, 0.55, 1.1, 1.65):   # końce belek stropowych pod wysunięciem
    b.box('shell', 'woodDark', 0.06, 0.06, JET + 0.06, x, H1 - 0.03, Z1 + JET / 2 - 0.02)
b.box('shell', 'woodDark', X1 - X0 + 0.04, 0.06, 0.06, 0, H1, Z1 + JET - 0.02)
UZ1 = Z1 + JET
UW = [(-1.4, -1.12, H1 + 0.18, H1 + 0.44), (-0.62, -0.34, H1 + 0.18, H1 + 0.44), (0.36, 0.64, H1 + 0.18, H1 + 0.44), (1.12, 1.4, H1 + 0.18, H1 + 0.44)]
wall_x('shell', 'plaster', UZ1 - T / 2, X0, X1, H1 + 0.06, H2, UW)
wall_x('shell', 'plaster', Z0 + T / 2, X0, X1, H1, H2, [(-0.2, 0.1, H1 + 0.18, H1 + 0.42)])
wall_z('shell', 'plaster', X0 + T / 2, Z0 + T, UZ1 - T, H1, H2, [])
wall_z('shell', 'plaster', X1 - T / 2, Z0 + T, UZ1 - T, H1, H2, [])
for u0, u1, v0, v1 in UW:
    window('shell', (u0 + u1) / 2, v0, v1, UZ1 - T / 2, u1 - u0, 0, 1)
window('shell', -0.05, H1 + 0.18, H1 + 0.42, Z0 + T / 2, 0.3, 0, -1, shutters=False)
frame_x('shell', UZ1 - T / 2, X0, X1, H1 + 0.06, H2, [X0 + 0.03, -1.47, -1.05, -0.69, -0.27, 0.29, 0.71, 1.05, 1.47, X1 - 0.03])
frame_x('shell', Z0 + T / 2, X0, X1, H1, H2, [X0 + 0.03, -0.9, -0.25, 0.15, 0.9, X1 - 0.03], out=-1)
frame_z('shell', X0 + T / 2, Z0, UZ1, H1, H2, [Z0 + 0.03, (Z0 + UZ1) / 2, UZ1 - 0.03], out=-1)
frame_z('shell', X1 - T / 2, Z0, UZ1, H1, H2, [Z0 + 0.03, (Z0 + UZ1) / 2, UZ1 - 0.03])
# strzecha: gruby dach dwuspadowy z okapem, kalenica z żerdzi
RISE = 1.0
b.gable('shell', 'thatch', X0 - 0.02, X1 + 0.02, Z0 - 0.02, UZ1 + 0.02, H2, RISE, along_x=True, over=0.16, end_mat='plaster')
b.gable('shell', 'thatchDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, UZ1 + 0.02, H2 - 0.04, RISE, along_x=True, over=0.2)
b.box('shell', 'woodDark', X1 - X0 + 0.35, 0.05, 0.07, 0, H2 + RISE - 0.01, (Z0 + UZ1) / 2)
for sx in (-1, 1):   # szczyty: belki w trójkącie
    xx = sx * (X1 + 0.03)
    b.box('shell', 'woodDark', 0.025, RISE - 0.05, 0.05, xx, H2, (Z0 + UZ1) / 2)
# komin z kamienia przy prawej ścianie (dym z niego rysuje gra)
CX, CZ = 1.52, -0.75
b.box('shell', 'stone', 0.28, H2 + RISE + 0.35 - H1, 0.28, CX, H1, CZ)
b.box('shell', 'stoneDark', 0.32, 0.05, 0.32, CX, H2 + RISE + 0.35, CZ)
b.box('shell', 'dark', 0.2, 0.005, 0.2, CX, H2 + RISE + 0.4, CZ)
chimneys.append([CX, round(H2 + RISE + 0.42, 3), CZ])

# ---------------- izba ----------------
b.box('ceiling', 'wood', X1 - X0 - 2 * T, 0.02, Z1 - Z0 - 2 * T, 0, H1 - 0.02, (Z0 + Z1) / 2, bottom=True)
for x in (-1.4, -0.7, 0.0, 0.7, 1.4):
    b.box('ceiling', 'woodDark', 0.07, 0.07, Z1 - Z0 - 2 * T, x, H1 - 0.09, (Z0 + Z1) / 2, bottom=True)
    for k, z in enumerate((-1.0, -0.5)):   # wędliny i warkocze czosnku pod belkami
        b.box('ceiling', 'bread' if (k + int(x * 10)) % 2 else 'apple', 0.035, 0.1, 0.035, x + 0.05, H1 - 0.2, z)
# szynkwas wzdłuż tylnej ściany po lewej, za nim beczki i półka z kuflami
boxs('interior', 'woodDark', 1.3, 0.32, 0.16, -1.0, P, -0.85)
b.box('interior', 'wood', 1.35, 0.03, 0.2, -1.0, P + 0.32, -0.85)
for i, x in enumerate((-1.5, -1.25, -1.0, -0.75, -0.5)):
    b.prism('interior', 'wood', 0.08, 0.075, 0.24, x, P, Z0 + T + 0.1, seg=10)
    b.prism('interior', 'iron', 0.082, 0.082, 0.015, x, P + 0.17, Z0 + T + 0.1, seg=10)
    block(x - 0.08, x + 0.08, Z0 + T, Z0 + T + 0.2)
b.box('interior', 'woodDark', 1.3, 0.02, 0.1, -1.0, P + 0.52, Z0 + T + 0.05)
for i in range(9):
    b.prism('interior', 'woodDark', 0.018, 0.016, 0.05, -1.58 + i * 0.145, P + 0.54, Z0 + T + 0.05, seg=6)
for x in (-1.45, -1.1, -0.75, -0.5):
    b.prism('interior', 'woodDark', 0.022, 0.02, 0.06, x, P + 0.35, -0.85, seg=6)   # kufle na szynkwasie
# palenisko przy prawej ścianie: kamienny okap, ogień, kocioł
HZ = -0.75
boxs('interior', 'stone', 0.22, 0.66, 0.6, X1 - T - 0.11, P, HZ)
b.box('interior', 'dark', 0.02, 0.32, 0.36, X1 - T - 0.225, P + 0.04, HZ)
b.box('interior', 'stoneDark', 0.28, 0.06, 0.66, X1 - T - 0.14, P + 0.66, HZ)
b.prism('interior', 'iron', 0.07, 0.08, 0.09, X1 - T - 0.3, P + 0.06, HZ, seg=10)
for zz in (HZ - 0.08, HZ + 0.08):
    b.box('interior', 'iron', 0.015, 0.16, 0.015, X1 - T - 0.3, P, zz)
flames.append([round(X1 - T - 0.26, 3), P + 0.03, HZ])
# trzy stoły z ławami, na nich kufle, chleb i świeca (przejście od drzwi do szynkwasu zostaje wolne)
TABLES = [(-0.95, 0.2), (1.05, 0.2), (0.1, -0.7)]
for tx, tz in TABLES:
    boxs('interior', 'wood', 0.6, 0.035, 0.3, tx, P + 0.24, tz)
    for sx in (-1, 1):
        b.box('interior', 'woodDark', 0.05, 0.24, 0.24, tx + sx * 0.24, P, tz)
    for sz in (-1, 1):
        boxs('interior', 'woodDark', 0.56, 0.14, 0.09, tx, P, tz + sz * 0.27)
    for i, (ox, oz) in enumerate(((-0.18, -0.06), (0.05, 0.07), (0.2, -0.04))):
        b.prism('interior', 'woodDark', 0.022, 0.02, 0.06, tx + ox, P + 0.275, tz + oz, seg=6)
    b.bun('interior', tx - 0.02, P + 0.275, tz - 0.02, w=0.085, rot=0.3 + tx)   # bochenek ze skanu na stole
    b.prism('interior', 'white', 0.012, 0.012, 0.05, tx + 0.12, P + 0.275, tz + 0.06, seg=5)
    b.prism('interior', 'ember', 0.009, 0.0, 0.025, tx + 0.12, P + 0.325, tz + 0.06, seg=5)
    seats.append([round(tx - 0.12, 3), round(tz - 0.27, 3), 0.0])
    seats.append([round(tx + 0.12, 3), round(tz + 0.27, 3), round(math.pi, 3)])
# drabina na piętro w rogu
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.03, 0.95, 0.03, 1.55 + sx * 0.1, P, 0.5, tilt=-0.25)
for k in range(6):
    b.box('interior', 'wood', 0.22, 0.02, 0.025, 1.55, P + 0.12 + k * 0.15, 0.5 - (0.12 + k * 0.15) * 0.25)
block(1.4, 1.7, 0.3, 0.65)
# w izbie chodzi się między ścianami (drzwi z ganku)
open_.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
open_.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])

# ---------------- ganek: deski, daszek na słupach, ławy ze stołem, beczki, szyld ----------------
GZ0, GZ1 = Z1, 1.4
b.box('base', 'roadWood', X1 - X0, 0.05, GZ1 - GZ0, 0, P - 0.05, (GZ0 + GZ1) / 2)
for x in (X0 + 0.05, -0.9, 0.1, 1.1, X1 - 0.05):
    boxs('base', 'woodDark', 0.07, 0.68, 0.07, x, P, GZ1 - 0.04)
b.box('base', 'woodDark', X1 - X0 + 0.1, 0.06, 0.07, 0, P + 0.68, GZ1 - 0.04)
# daszek opada OD ściany NA zewnątrz (woda spływa przed ganek): wysoko przy ścianie, pod belkami piętra,
# nisko nad belką na słupach. Tył deski chowa się w ścianie parteru, przód wystaje okapem przed słupy.
GT = 0.13                       # spadek daszku (rad)
GD, GC = 0.86, 1.13             # długość deski (w spadku) i środek w z
GBZ = GZ1 - 0.04                # belka na słupach
GY = P + 0.746 + (GBZ - GC) / math.cos(GT) * math.sin(GT)   # spód deski 6 mm nad belką
b.box('base', 'roadWood', X1 - X0 + 0.2, 0.04, GD, 0, GY, GC, tilt=GT)
# krokwie pod deskami (wpuszczone w nie o 1 cm) i deska czołowa na okapie
for x in (X0 + 0.05, -0.9, 0.1, 1.1, X1 - 0.05):
    b.box('base', 'woodDark', 0.045, 0.045, GD - 0.06, x, GY - 0.045 * math.cos(GT) + 0.01, GC - 0.01, tilt=GT)
EZ = GC + GD / 2 * math.cos(GT)                 # przednia krawędź daszku
EY = GY - GD / 2 * math.sin(GT)
b.box('base', 'woodDark', X1 - X0 + 0.22, 0.06, 0.025, 0, EY - 0.03, EZ + 0.008, tilt=GT)
for tx in (-1.3, -0.45):
    boxs('base', 'wood', 0.66, 0.04, 0.24, tx, P + 0.24, 1.07)
    for sz in (-1, 1):
        boxs('base', 'woodDark', 0.66, 0.13, 0.09, tx, P, 1.07 + sz * 0.2)
    for x in (tx - 0.2, tx, tx + 0.18):
        b.prism('base', 'woodDark', 0.022, 0.02, 0.06, x, P + 0.28, 1.07, seg=6)
    seats.append([round(tx - 0.13, 3), 0.87, 0.0])
    seats.append([round(tx + 0.12, 3), 1.27, round(math.pi, 3)])
for x, z in ((1.3, 0.97), (1.52, 1.07), (1.4, 1.22)):
    b.prism('base', 'wood', 0.1, 0.09, 0.26, x, P, z, seg=10)
    b.prism('base', 'iron', 0.102, 0.102, 0.015, x, P + 0.18, z, seg=10)
    block(x - 0.1, x + 0.1, z - 0.1, z + 0.1)
# szyld na kutym wysięgniku nad gankiem: deska z kuflem
SX = -0.35
b.box('base', 'iron', 0.4, 0.02, 0.02, SX - 0.1, P + 0.68, GZ1 + 0.02)
for dx in (-0.1, 0.1):
    b.box('base', 'iron', 0.008, 0.1, 0.008, SX + dx, P + 0.58, GZ1 + 0.02)
b.box('base', 'woodDark', 0.3, 0.22, 0.035, SX, P + 0.36, GZ1 + 0.02)
b.box('base', 'plank', 0.25, 0.17, 0.04, SX, P + 0.385, GZ1 + 0.02)
b.prism('base', 'woodDark', 0.035, 0.03, 0.08, SX, P + 0.43, GZ1 + 0.045, seg=8)
b.prism('base', 'white', 0.036, 0.03, 0.02, SX, P + 0.51, GZ1 + 0.045, seg=8)
# latarnie przy drzwiach
for sx in (-1, 1):
    x = DM + sx * 0.32
    b.box('base', 'iron', 0.02, 0.02, 0.08, x, P + 0.6, Z1 + 0.04)
    b.prism('base', 'iron', 0.035, 0.035, 0.08, x, P + 0.52, Z1 + 0.08, seg=6, top=True)
    b.prism('base', 'ember', 0.02, 0.0, 0.05, x, P + 0.53, Z1 + 0.08, seg=5)
open_.append([X0, X1, GZ0 - 0.02, GZ1 + 0.4])

E = P + 0.46
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor', 'ceiling']
VIEWS = [
    ['karczma z przodu', [0.4, 0.6, 3.8], [0, 0.7, 0], OUT, 22],
    ['ganek', [0.5, E, 1.9], [-1.0, 0.3, 1.0], OUT, 18],
    ['izba od drzwi', [0.5, E, 0.5], [-0.6, 0.35, -1.2], ROOM, 16],
    ['szynkwas', [0.0, E, -0.2], [-1.2, 0.35, -1.1], ROOM, 16],
    ['palenisko', [0.3, E, 0.1], [1.7, 0.3, -0.75], ROOM, 16],
    ['z izby na ganek', [0.3, E, -1.1], [0.5, 0.4, 1.4], ROOM, 16],
]
b.save('tavern', maxe=0.3, rays=16, reach=0.4, extra={
    'solid': solid, 'open': open_, 'floorY': P, 'windows': windows, 'chimneys': chimneys, 'flames': flames,
    'seats': seats, 'pennant': [-2.0, round(H2 + RISE - 0.15, 3), -0.35], 'views': VIEWS})
