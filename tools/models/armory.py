"""Zbrojownia (2×2 pola): kamienny dom z ciosu na cokole, dach z łupka, wąskie okna z kratą, ciężkie drzwi okute
żelazem (otwarte do środka), nad drzwiami tarcza w barwach pana ze skrzyżowanymi włóczniami. Pod ścianą stojak
z włóczniami i beczka ze strzałami. W środku kamienna posadzka i puste stojaki pod ścianami: broń (włócznie, łuki)
układa gra według stanu zbrojowni. Dach i szczyty (grupa 'shell') znikają przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  python tools/models/armory.py  →  src/render/models/armory.json
Układ: środek działki = (0, 0), 1 = jedno pole, przód (drzwi) = +z. Wejście: pole przed prawą połową przodu
(działka parzystej szerokości), więc drzwi są pół pola w prawo od środka (jak w chacie).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.1)
T = t.T

P = 0.12                         # posadzka
X0, X1, Z0, Z1 = -0.76, 0.76, -0.62, 0.58
H1 = P + 0.86                    # okap
RISE = 0.55
DOOR = (0.28, 0.6, 0.62)
DM = (DOOR[0] + DOOR[1]) / 2
ZM = (Z0 + Z1) / 2

# ---------------- cokół i posadzka ----------------
b.box('base', 'stoneDark', X1 - X0 + 0.12, P, Z1 - Z0 + 0.12, 0, 0, ZM)
b.box('floor', 'cut', X1 - X0 - 2 * T, 0.008, Z1 - Z0 - 2 * T, 0, P, ZM)

# ---------------- ściany z ciosu: drzwi z przodu, wąskie okna z kratą po bokach i z tyłu ----------------
WIN = 0.1
W_Y0, W_Y1 = P + 0.42, P + 0.66
t.wall_x('base', 'stone', Z1 - T / 2, X0, X1, P, H1, [(DOOR[0], DOOR[1], P, P + DOOR[2]), (-0.45 - WIN / 2, -0.45 + WIN / 2, W_Y0, W_Y1)])
t.wall_x('base', 'stone', Z0 + T / 2, X0, X1, P, H1, [(-0.3 - WIN / 2, -0.3 + WIN / 2, W_Y0, W_Y1), (0.3 - WIN / 2, 0.3 + WIN / 2, W_Y0, W_Y1)])
t.wall_z('base', 'stone', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [(-WIN / 2, WIN / 2, W_Y0, W_Y1)])
t.wall_z('base', 'stone', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(-WIN / 2, WIN / 2, W_Y0, W_Y1)])
# ościeża okien (ciemny kamień) i żelazne kraty
def slit_x(x, z, out):
    for sx in (-1, 1):
        b.box('base', 'stoneDark', 0.03, W_Y1 - W_Y0, T + 0.02, x + sx * (WIN / 2 + 0.015), W_Y0, z)
    b.box('base', 'stoneDark', WIN + 0.1, 0.04, T + 0.04, x, W_Y0 - 0.04, z + out * 0.01)
    b.box('base', 'stoneDark', WIN + 0.1, 0.04, T + 0.02, x, W_Y1, z)
    for k in (-1, 1):
        b.box('base', 'iron', 0.012, W_Y1 - W_Y0, 0.012, x + k * WIN / 4, W_Y0, z)
    b.box('base', 'iron', WIN, 0.012, 0.012, x, (W_Y0 + W_Y1) / 2, z)
    b.box('base', 'dark', WIN, W_Y1 - W_Y0, 0.004, x, W_Y0, z - out * (T / 2 - 0.004))
def slit_z(x, z, out):
    for sz in (-1, 1):
        b.box('base', 'stoneDark', T + 0.02, W_Y1 - W_Y0, 0.03, x, W_Y0, z + sz * (WIN / 2 + 0.015))
    b.box('base', 'stoneDark', T + 0.04, 0.04, WIN + 0.1, x + out * 0.01, W_Y0 - 0.04, z)
    b.box('base', 'stoneDark', T + 0.02, 0.04, WIN + 0.1, x, W_Y1, z)
    for k in (-1, 1):
        b.box('base', 'iron', 0.012, W_Y1 - W_Y0, 0.012, x, W_Y0, z + k * WIN / 4)
    b.box('base', 'iron', 0.012, 0.012, WIN, x, (W_Y0 + W_Y1) / 2, z)
    b.box('base', 'dark', 0.004, W_Y1 - W_Y0, WIN, x - out * (T / 2 - 0.004), W_Y0, z)
slit_x(-0.45, Z1 - T / 2, 1)
slit_x(-0.3, Z0 + T / 2, -1); slit_x(0.3, Z0 + T / 2, -1)
slit_z(X0 + T / 2, 0.0, -1); slit_z(X1 - T / 2, 0.0, 1)
# narożniki z większych ciosów (wiązanie murów) i gzyms pod okapem
for x in (X0, X1):
    for z in (Z0, Z1):
        for k in range(4):
            big = k % 2 == 0
            w, d = (0.2, 0.12) if big else (0.12, 0.2)     # na przemian długi i krótki cios, wystają o 1,5 cm
            b.box('base', 'cutDark', w, 0.18, d, x - math.copysign(w / 2 - 0.015, x), P + 0.02 + k * 0.21, z - math.copysign(d / 2 - 0.015, z))
b.box('base', 'cutDark', X1 - X0 + 0.06, 0.05, Z1 - Z0 + 0.06, 0, H1 - 0.05, ZM)
# drzwi: kamienne ościeże z łukiem z klińców, ciężkie skrzydło okute żelazem, otwarte do środka
for sx in (-1, 1):
    b.box('base', 'cutDark', 0.06, DOOR[2], T + 0.04, DM + sx * ((DOOR[1] - DOOR[0]) / 2 + 0.03), P, Z1 - T / 2)
for k in range(7):
    a = math.pi * (k + 0.5) / 7
    r = (DOOR[1] - DOOR[0]) / 2 + 0.03
    b.box('base', 'cutDark', 0.07, 0.06, T + 0.05, DM - math.cos(a) * r, P + DOOR[2] - 0.05 + math.sin(a) * 0.08, Z1 - T / 2, roll=a - math.pi / 2)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.1, 0.03, 0.16, DM, 0.0, Z1 + 0.1)     # próg
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, P - 0.01, 0.14, DM, 0.0, Z1 + 0.13, bottom=True)
DW = DOOR[1] - DOOR[0] - 0.02
dz = Z1 - T - DW / 2 - 0.01
b.box('base', 'woodDark', DW, DOOR[2] - 0.03, 0.04, DOOR[1] - 0.03, P + 0.01, dz, math.pi / 2)
for yy in (P + 0.1, P + 0.3, P + DOOR[2] - 0.14):
    b.box('base', 'iron', DW - 0.02, 0.035, 0.012, DOOR[1] - 0.055, yy, dz, math.pi / 2)
t.block(X0, DOOR[0], Z1 - T, Z1); t.block(DOOR[1], X1, Z1 - T, Z1)
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)

# ---------------- tarcza nad drzwiami: barwy pana, skrzyżowane włócznie ----------------
SY = P + DOOR[2] + 0.1
b.box('base', 'woodDark', 0.24, 0.24, 0.03, DM, SY - 0.02, Z1 + 0.02)
b.box('base', 'flag', 0.2, 0.17, 0.02, DM, SY + 0.03, Z1 + 0.045)
b.prism('base', 'flag', 0.1, 0.0, 0.08, DM, SY - 0.05, Z1 + 0.045, seg=3, phase=math.pi)   # dolny szpic
for sgn in (-1, 1):   # krótkie włócznie skrzyżowane za tarczą (pod okapem)
    L, a = 0.34, 0.75
    b.box('base', 'wood', 0.016, L, 0.016, DM + sgn * math.sin(a) * L / 2, SY - 0.05, Z1 + 0.03, roll=sgn * a)
    b.prism('base', 'iron', 0.018, 0.0, 0.05, DM - sgn * math.sin(a) * L / 2, SY - 0.05 + math.cos(a) * L, Z1 + 0.03, seg=4)

# ---------------- dach z łupka (dwie warstwy), szczyty z kamienia, kalenica z gąsiorów ----------------
b.gable('shell', 'slate', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.12)
b.gable('shell', 'woodDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1 - 0.03, RISE, along_x=True, over=0.14)
for sx, x in ((-1, X0), (1, X1)):
    t.gable_end('shell', 'stone', x, Z0, Z1, H1, RISE, out=sx)
b.box('shell', 'stoneDark', X1 - X0 + 0.3, 0.06, 0.1, 0, H1 + RISE - 0.02, ZM)
# komin nad kuźniczką (naprawa broni) z tyłu
b.box('shell', 'stone', 0.18, 0.5, 0.18, -0.45, H1 + 0.2, Z0 + 0.22)
b.box('shell', 'stoneDark', 0.22, 0.05, 0.22, -0.45, H1 + 0.7, Z0 + 0.22)

# ---------------- wnętrze: puste stojaki pod ścianami (broń układa gra), kowadło do naprawy ----------------
# stojak pod tylną ścianą: dwa słupki i belka z kołkami
for x0, x1 in ((-0.6, -0.05), (0.08, 0.6)):
    for x in (x0, x1):
        b.box('interior', 'woodDark', 0.04, 0.62, 0.04, x, P, Z0 + T + 0.05)
    for y in (P + 0.25, P + 0.5):
        b.box('interior', 'wood', x1 - x0, 0.035, 0.04, (x0 + x1) / 2, y, Z0 + T + 0.07)
        for k in range(5):
            b.box('interior', 'woodDark', 0.015, 0.015, 0.06, x0 + (k + 0.5) * (x1 - x0) / 5, y + 0.03, Z0 + T + 0.1)
    t.block(x0 - 0.03, x1 + 0.03, Z0 + T, Z0 + T + 0.12, 0, P + 0.62)
# kowadło na pniu i skrzynia z grotami
b.prism('interior', 'bark', 0.08, 0.07, 0.2, -0.5, P, 0.25, seg=9)
b.box('interior', 'iron', 0.16, 0.06, 0.07, -0.5, P + 0.2, 0.25)
b.box('interior', 'iron', 0.07, 0.03, 0.05, -0.39, P + 0.23, 0.25)
t.block(-0.6, -0.4, 0.15, 0.35, 0, P + 0.26)
t.boxs('interior', 'woodDark', 0.24, 0.14, 0.16, -0.52, P, -0.1)
b.box('interior', 'iron', 0.2, 0.01, 0.12, -0.52, P + 0.14, -0.1)
t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
t.open.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])

# ---------------- przed zbrojownią: stojak z włóczniami i beczka ze strzałami ----------------
RX, RZ = -0.42, Z1 + 0.12
for x in (RX - 0.22, RX + 0.22):
    b.box('base', 'woodDark', 0.04, 0.32, 0.04, x, 0.0, RZ)
b.box('base', 'woodDark', 0.5, 0.035, 0.05, RX, 0.3, RZ)
b.box('base', 'woodDark', 0.5, 0.03, 0.08, RX, 0.04, RZ + 0.02)
for k in range(4):
    x = RX - 0.15 + k * 0.1
    b.box('base', 'wood', 0.016, 0.62, 0.016, x, 0.05, RZ + 0.05, tilt=-0.18)
    b.prism('base', 'iron', 0.018, 0.0, 0.06, x, 0.65, RZ - 0.06, seg=4)
b.prism('base', 'wood', 0.08, 0.085, 0.2, 0.86, 0.0, 0.28, seg=10)
for y in (0.03, 0.16):
    b.prism('base', 'iron', 0.088, 0.088, 0.015, 0.86, y, 0.28, seg=10)
for k in range(7):
    a = 2 * math.pi * k / 7
    x, z = 0.86 + math.cos(a) * 0.04, 0.28 + math.sin(a) * 0.04
    b.box('base', 'wood', 0.008, 0.16, 0.008, x, 0.2, z)
    b.box('base', 'white', 0.02, 0.04, 0.004, x, 0.33, z)

E = P + 0.46
OUT = ['base', 'shell']
VIEWS = [
    ['zbrojownia z przodu', [0.4, 0.5, 2.6], [0, 0.6, 0], OUT, 22],
    ['przez drzwi', [DM, E, 1.3], [-0.1, P + 0.2, -0.4], ['base', 'shell', 'interior', 'floor'], 18],
    ['w środku', [0.4, E, 0.25], [-0.3, P + 0.3, -0.5], ['base', 'shell', 'interior', 'floor'], 16],
]
b.save('armory', maxe=0.26, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': [], 'chimneys': [[-0.45, round(H1 + 0.75, 3), round(Z0 + 0.22, 3)]], 'flames': [],
    'pennant': [round(X1 + 0.05, 3), round(H1 + RISE - 0.08, 3), round(ZM, 3)], 'views': VIEWS})
