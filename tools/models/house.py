"""Chata (2×2 pola): szachulec na kamiennej podmurówce, gruba strzecha, kamienny komin nad paleniskiem.
W izbie: palenisko pod tylną ścianą z kociołkiem, ława ze stołem, skrzynia, półka z garnkami, warkocze czosnku
pod belkami. Wzdłuż obu boków zostaje wolna podłoga: tam gra kładzie posłania śpiących (8 miejsc).
Dach i szczyty (grupa 'shell') znikają przy podglądzie wnętrza; sufit ('ceiling') widać tylko spacerem w izbie.

Uruchomienie (z katalogu repo):  python tools/models/house.py
Układ: środek działki = (0, 0), 1 = jedno pole, przód (drzwi) = +z. Wejście: pole przed prawą połową przodu
(działka parzystej szerokości), więc drzwi są pół pola w prawo od środka.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.08)
T = t.T
chimneys, flames = [], []

P = 0.1                          # posadzka
X0, X1, Z0, Z1 = -0.78, 0.78, -0.62, 0.62
H1 = P + 0.82                    # okap
RISE = 0.66
DOOR = (0.28, 0.6, 0.62)
DM = (DOOR[0] + DOOR[1]) / 2

# ---------------- podmurówka i podłoga (na niej śpią) ----------------
b.box('base', 'stone', X1 - X0 + 0.08, P, Z1 - Z0 + 0.08, 0, 0, 0)
b.box('base', 'stoneDark', X1 - X0 + 0.14, 0.035, Z1 - Z0 + 0.14, 0, 0, 0)
b.box('floor', 'plank', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, 0)

# ---------------- ściany: drzwi i okno z przodu, okno z tyłu i z obu boków ----------------
FW = (-0.5, -0.2, P + 0.34, P + 0.6)
t.wall_x('base', 'plaster', Z1 - T / 2, X0, X1, P, H1, [(DOOR[0], DOOR[1], P, P + DOOR[2]), FW])
t.wall_x('base', 'plaster', Z0 + T / 2, X0, X1, P, H1, [(-0.6, -0.36, P + 0.36, P + 0.58)])
t.wall_z('base', 'plaster', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [(-0.12, 0.12, P + 0.36, P + 0.58)])
t.wall_z('base', 'plaster', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(-0.12, 0.12, P + 0.36, P + 0.58)])
t.window('base', (FW[0] + FW[1]) / 2, FW[2], FW[3], Z1 - T / 2, FW[1] - FW[0], 0, 1)
t.window('base', -0.48, P + 0.36, P + 0.58, Z0 + T / 2, 0.24, 0, -1)
t.window('base', X0 + T / 2, P + 0.36, P + 0.58, 0.0, 0.24, -1, 0)
t.window('base', X1 - T / 2, P + 0.36, P + 0.58, 0.0, 0.24, 1, 0)
t.frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, -0.55, -0.15, DOOR[0] - 0.03, DOOR[1] + 0.03, X1 - 0.03], braces=False)
b.box('base', 'woodDark', 0.04, 0.5, 0.022, -0.66, P + 0.06, Z1 + 0.015, roll=-0.5)
t.frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, -0.65, -0.3, 0.1, X1 - 0.03], out=-1)
t.frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.17, 0.17, Z1 - 0.03], out=-1)
t.frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.17, 0.17, Z1 - 0.03])
# drzwi z desek uchylone do środka, okute; nadproże i kamienny próg
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.08, 0.05, T + 0.03, DM, P + DOOR[2], Z1 - T / 2)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.03, 0.14, DM, 0.0, Z1 + 0.1)
b.box('interior', 'wood', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[1] - 0.02, P, Z1 - T - 0.14, -(math.pi / 2 - 0.3))
for yy in (P + 0.1, P + 0.46):
    b.box('interior', 'iron', 0.02, 0.02, 0.22, DOOR[1] - 0.04, yy, Z1 - T - 0.13, 0.3)
t.block(X0, DOOR[0], Z1 - T, Z1); t.block(DOOR[1], X1, Z1 - T, Z1)
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)

# ---------------- strzecha (dwie warstwy, okap), szczyty z belką, kalenica, komin ----------------
b.gable('shell', 'thatch', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.17)
b.gable('shell', 'thatchDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1 - 0.04, RISE, along_x=True, over=0.21)
for sx, x in ((-1, X0), (1, X1)):
    t.gable_end('shell', 'plaster', x, Z0, Z1, H1, RISE, out=sx)
# kalenica: wałek słomy wzdłuż x
b.box('shell', 'thatchDark', X1 - X0 + 0.42, 0.07, 0.13, 0, H1 + RISE - 0.035, 0)
for k in range(5):   # kołki przytrzymujące kalenicę
    b.box('shell', 'woodDark', 0.025, 0.025, 0.2, X0 + 0.12 + k * (X1 - X0 - 0.24) / 4, H1 + RISE + 0.02, 0)
# komin nad paleniskiem przy tylnej ścianie
CX, CZ = -0.05, -0.47
b.box('shell', 'stone', 0.24, RISE + 0.42, 0.24, CX, H1, CZ)
b.box('shell', 'stoneDark', 0.29, 0.05, 0.29, CX, H1 + RISE + 0.42, CZ)
b.box('shell', 'dark', 0.16, 0.005, 0.16, CX, H1 + RISE + 0.47, CZ)
chimneys.append([CX, round(H1 + RISE + 0.49, 3), CZ])

# ---------------- izba ----------------
b.box('ceiling', 'wood', X1 - X0 - 2 * T, 0.02, Z1 - Z0 - 2 * T, 0, H1 - 0.02, 0, bottom=True)
for x in (-0.45, 0.0, 0.45):
    b.box('ceiling', 'woodDark', 0.06, 0.06, Z1 - Z0 - 2 * T, x, H1 - 0.08, 0, bottom=True)
for x, z, m in ((-0.4, 0.1, 'apple'), (0.05, -0.15, 'bread'), (0.42, 0.2, 'apple')):
    b.box('ceiling', m, 0.03, 0.09, 0.03, x, H1 - 0.18, z)
# palenisko pod tylną ścianą: kamienne obramienie, okap, ogień, kociołek na haku
t.boxs('interior', 'stone', 0.36, 0.5, 0.16, CX, P, Z0 + T + 0.08)
b.box('interior', 'dark', 0.22, 0.24, 0.02, CX, P + 0.03, Z0 + T + 0.165)
b.box('interior', 'stoneDark', 0.42, 0.05, 0.22, CX, P + 0.5, Z0 + T + 0.1)
b.prism('interior', 'iron', 0.05, 0.06, 0.07, CX, P + 0.08, Z0 + T + 0.2, seg=10)
b.box('interior', 'iron', 0.012, 0.18, 0.012, CX, P + 0.15, Z0 + T + 0.2)
flames.append([CX, round(P + 0.02, 3), round(Z0 + T + 0.2, 3)])
# stół z ławą na środku (między posłaniami), na nim miska, dzban i chleb
t.boxs('interior', 'wood', 0.3, 0.03, 0.22, -0.05, P + 0.2, 0.1)
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.03, 0.2, 0.18, -0.05 + sx * 0.12, P, 0.1)
t.boxs('interior', 'woodDark', 0.3, 0.11, 0.07, -0.05, P, 0.3)
b.prism('interior', 'rockDark', 0.03, 0.04, 0.08, -0.12, P + 0.23, 0.08, seg=8)
b.prism('interior', 'wood', 0.05, 0.035, 0.025, 0.02, P + 0.23, 0.12, seg=10)
b.bun('interior', 0.0, P + 0.23, 0.04, w=0.075, rot=0.4)   # bochenek ze skanu na stole
# skrzynia pod oknem z przodu, półka z garnkami nad nią
t.boxs('interior', 'woodDark', 0.24, 0.14, 0.13, -0.38, P, Z1 - T - 0.08)
b.box('interior', 'iron', 0.25, 0.015, 0.02, -0.38, P + 0.1, Z1 - T - 0.01)
b.box('interior', 'woodDark', 0.3, 0.02, 0.07, 0.38, P + 0.5, Z0 + T + 0.035)
for k, m in enumerate(('rockDark', 'wood', 'rockDark')):
    b.prism('interior', m, 0.025, 0.03, 0.05, 0.28 + k * 0.1, P + 0.52, Z0 + T + 0.035, seg=8)
# w izbie chodzi się między ścianami (drzwi z przodu)
t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
t.open.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])

# ---------------- przed chatą: drewno pod ścianą, beczka na deszczówkę, skrzynka z kwiatami ----------------
for row in range(3):
    for k in range(5 - row):
        x = X0 - 0.12
        z = -0.32 + k * 0.105 + row * 0.0525
        cy = 0.045 + row * 0.08
        ring = [(x - 0.15, cy + math.cos(2 * math.pi * j / 7) * 0.04, z + math.sin(2 * math.pi * j / 7) * 0.04) for j in range(7)]
        for j in range(7):
            j2 = (j + 1) % 7
            a0, a1 = ring[j], ring[j2]
            b.poly('base', 'wood', [a0, a1, (a1[0] + 0.3, a1[1], a1[2]), (a0[0] + 0.3, a0[1], a0[2])], away=(x, cy, z))
        b.poly('base', 'plank', [(p[0] + 0.3, p[1], p[2]) for p in ring], away=(x - 1, cy, z))
        b.poly('base', 'plank', list(ring), away=(x + 1, cy, z))
b.prism('base', 'wood', 0.09, 0.08, 0.24, DOOR[1] + 0.15, 0.0, Z1 + 0.14, seg=10)
for y in (0.05, 0.18):
    b.prism('base', 'iron', 0.092, 0.092, 0.015, DOOR[1] + 0.15, y, Z1 + 0.14, seg=10)
b.box('base', 'wood', 0.3, 0.06, 0.08, (FW[0] + FW[1]) / 2, P + 0.26, Z1 + 0.06)
for k in range(5):
    b.prism('base', 'apple' if k % 2 else 'gold', 0.025, 0.0, 0.05, (FW[0] + FW[1]) / 2 - 0.12 + k * 0.06, P + 0.32, Z1 + 0.06, seg=5)

E = P + 0.46
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor', 'ceiling']
VIEWS = [
    ['chata z przodu', [0.3, 0.5, 2.2], [0, 0.5, 0], OUT, 22],
    ['izba od drzwi', [DM, E, 0.45], [-0.3, 0.3, -0.5], ROOM, 16],
    ['palenisko', [0.4, E, 0.2], [CX, 0.25, -0.6], ROOM, 16],
]
b.save('house', maxe=0.24, rays=16, reach=0.35, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': chimneys, 'flames': flames,
    'pennant': [round(X1 + 0.05, 3), round(H1 + RISE - 0.1, 3), 0.0], 'views': VIEWS})
