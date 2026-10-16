"""Piekarnia (2×2 pola): szachulcowy dom na kamiennej podmurówce, strzecha, z tyłu wystaje kopulasty piec chlebowy
z cegły pod własnym daszkiem, nad nim komin. Z przodu okiennica-lada z bochenkami i szyld z obwarzankiem.
W środku: czeluść pieca z żarem, stół do formowania z bochenkami, dzieża z ciastem, worki mąki, półka z chlebem,
łopata piekarska. Dach i szczyty (grupa 'shell') znikają, gdy piekarz pracuje (podgląd wnętrza).

Uruchomienie (z katalogu repo):  python tools/models/bakery.py  →  src/render/models/bakery.json
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
t = Timber(b, T=0.08)
T = t.T
chimneys, flames = [], []

P = 0.1                          # posadzka
X0, X1, Z0, Z1 = -0.78, 0.78, -0.5, 0.62
H1 = P + 0.78                    # okap
RISE = 0.62
DOOR = (0.28, 0.6, 0.6)
DM = (DOOR[0] + DOOR[1]) / 2
ZM = (Z0 + Z1) / 2
HATCH = (-0.6, -0.15, P + 0.3, P + 0.56)     # okno-lada od frontu

# ---------------- podmurówka i podłoga ----------------
b.box('base', 'stone', X1 - X0 + 0.08, P, Z1 - Z0 + 0.08, 0, 0, ZM)
b.box('base', 'stoneDark', X1 - X0 + 0.14, 0.035, Z1 - Z0 + 0.14, 0, 0, ZM)
b.box('floor', 'plank', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, ZM)

# ---------------- ściany: drzwi i lada z przodu, czeluść pieca z tyłu, okno z boku ----------------
OV = (-0.48, -0.08)                          # otwór w tylnej ścianie na czeluść pieca
t.wall_x('base', 'plaster', Z1 - T / 2, X0, X1, P, H1, [(DOOR[0], DOOR[1], P, P + DOOR[2]), HATCH])
t.wall_x('base', 'plaster', Z0 + T / 2, X0, X1, P, H1, [(OV[0], OV[1], P, P + 0.4)])
t.wall_z('base', 'plaster', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [])
t.wall_z('base', 'plaster', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(-0.05, 0.19, P + 0.34, P + 0.56)])
t.window('base', X1 - T / 2, P + 0.34, P + 0.56, 0.07, 0.24, 1, 0)
t.frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, HATCH[0] - 0.03, HATCH[1] + 0.03, DOOR[0] - 0.03, DOOR[1] + 0.03, X1 - 0.03], braces=False)
t.frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, OV[0] - 0.03, OV[1] + 0.03, 0.4, X1 - 0.03], out=-1)
t.frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.1, 0.25, Z1 - 0.03], out=-1)
t.frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, -0.09, 0.23, Z1 - 0.03])
b.box('base', 'woodDark', 0.04, 0.5, 0.022, X0 + 0.2, P + 0.06, Z1 + 0.015, roll=0.5)
# lada: okiennica opuszczona poziomo na wspornikach, na niej bochenki; nad nią daszek z desek
HX = (HATCH[0] + HATCH[1]) / 2
HW = HATCH[1] - HATCH[0]
b.box('base', 'woodDark', HW + 0.06, 0.035, 0.05, HX, HATCH[2] - 0.035, Z1 + 0.005)
b.box('base', 'wood', HW, 0.025, 0.18, HX, HATCH[2] - 0.01, Z1 + 0.09, bottom=True)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.025, 0.16, 0.025, HX + sx * (HW / 2 - 0.03), HATCH[2] - 0.17, Z1 + 0.13, tilt=0.6, bottom=True)
b.box('base', 'woodDark', 0.012, HATCH[3] - HATCH[2], 0.012, HX, HATCH[2], Z1 - T / 2)
b.slope('base', 'roadWood', [(HATCH[0] - 0.06, HATCH[3] + 0.06, Z1), (HATCH[1] + 0.06, HATCH[3] + 0.06, Z1),
                             (HATCH[1] + 0.06, HATCH[3] - 0.02, Z1 + 0.2), (HATCH[0] - 0.06, HATCH[3] - 0.02, Z1 + 0.2)], away=(HX, 0, Z1 - 0.5), t=0.02)
def loaf(group, x, y, z, rot=0.0, s=1.0):
    """Bochenek: owalny, wypieczony, z jaśniejszym nacięciem na grzbiecie"""
    c, si = math.cos(rot), math.sin(rot)
    rings = []
    for k, (rr, yy) in enumerate(((0.05, 0.0), (0.062, 0.018), (0.055, 0.036), (0.032, 0.05), (0.0, 0.055))):
        rings.append([(x + (math.cos(a) * rr * 1.4 * c + math.sin(a) * rr * 0.9 * si) * s, y + yy * s,
                       z + (-math.cos(a) * rr * 1.4 * si + math.sin(a) * rr * 0.9 * c) * s) for a in [2 * math.pi * j / 10 for j in range(10)]])
    for i in range(len(rings) - 1):
        for j in range(10):
            j2 = (j + 1) % 10
            q = [rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]]
            if i == len(rings) - 2:
                b.poly(group, 'bread', [rings[i][j], rings[i][j2], rings[i + 1][0]], away=(x, y + 0.01, z))
            else:
                b.poly(group, 'bread', q, away=(x, y + 0.02 * s, z))
    b.poly(group, 'bread', rings[0], away=(x, y + 0.1, z))
    b.box(group, 'crust', 0.1 * s, 0.006, 0.014 * s, x, y + 0.05 * s, z, rot)
for k, (dx, rot) in enumerate(((-0.14, 0.2), (0.0, -0.1), (0.14, 0.3))):
    loaf('base', HX + dx, HATCH[2] + 0.015, Z1 + 0.09, rot, 0.85)
# drzwi uchylone do środka, nadproże, kamienny próg
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.08, 0.05, T + 0.03, DM, P + DOOR[2], Z1 - T / 2)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.06, 0.03, 0.14, DM, 0.0, Z1 + 0.1)
b.box('interior', 'wood', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[1] - 0.02, P, Z1 - T - 0.14, -(math.pi / 2 - 0.3))
t.block(X0, DOOR[0], Z1 - T, Z1); t.block(DOOR[1], X1, Z1 - T, Z1)
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)

# ---------------- piec chlebowy z tyłu: ceglana kopuła na cokole, pod daszkiem, komin ----------------
OX, OZ, OR = (OV[0] + OV[1]) / 2, Z0 - 0.26, 0.3
b.box('base', 'stoneDark', 0.7, P + 0.12, 0.56, OX, 0.0, Z0 - 0.24, bottom=True)
y0 = P + 0.12
for r0, r1, h in ((OR, OR * 0.97, 0.1), (OR * 0.97, OR * 0.85, 0.1), (OR * 0.85, OR * 0.62, 0.08), (OR * 0.62, OR * 0.3, 0.07), (OR * 0.3, 0.0, 0.04)):
    b.prism('base', 'stone', r0, r1, h, OX, y0, OZ, seg=14)
    y0 += h
# daszek nad piecem (deski), oparty o tylną ścianę
DY = P + 0.62
b.slope('base', 'roadWood', [(OX - 0.42, DY + 0.18, Z0 - 0.02), (OX + 0.42, DY + 0.18, Z0 - 0.02),
                             (OX + 0.42, DY - 0.06, Z0 - 0.62), (OX - 0.42, DY - 0.06, Z0 - 0.62)], away=(OX, 0, Z0 - 0.3), t=0.025)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.05, DY - 0.08, 0.05, OX + sx * 0.38, 0.0, Z0 - 0.58)
# komin z cegły nad piecem, przez strzechę
CX, CZ = OX, Z0 + 0.12
CH = H1 + RISE * 0.55 + 0.35
b.box('shell', 'stone', 0.24, CH - DY, 0.24, CX, DY, CZ)
b.box('shell', 'stoneDark', 0.28, 0.05, 0.28, CX, CH, CZ)
b.box('shell', 'dark', 0.16, 0.005, 0.16, CX, CH + 0.05, CZ)
chimneys.append([CX, round(CH + 0.07, 3), CZ])
# czeluść pieca od środka: łuk z cegieł, żar, płomień (pali się, gdy piekarz piecze)
b.box('interior', 'stoneDark', OV[1] - OV[0] + 0.1, 0.42, 0.06, OX, P, Z0 + T + 0.02)
b.box('interior', 'dark', OV[1] - OV[0] - 0.08, 0.18, 0.01, OX, P + 0.12, Z0 + T + 0.055)
b.box('interior', 'ember', OV[1] - OV[0] - 0.12, 0.03, 0.06, OX, P + 0.12, Z0 + T + 0.02)
flames.append([OX, round(P + 0.13, 3), round(Z0 + T + 0.03, 3)])
b.box('interior', 'stoneDark', OV[1] - OV[0] + 0.2, 0.03, 0.12, OX, P + 0.11, Z0 + T + 0.1)   # przypiecek
t.block(OV[0] - 0.1, OV[1] + 0.1, Z0, Z0 + T + 0.16)

# ---------------- strzecha, szczyty, kalenica ----------------
b.gable('shell', 'thatch', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.16)
b.gable('shell', 'thatchDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1 - 0.04, RISE, along_x=True, over=0.19)
for sx, x in ((-1, X0), (1, X1)):
    t.gable_end('shell', 'plaster', x, Z0, Z1, H1, RISE, out=sx)
b.box('shell', 'thatchDark', X1 - X0 + 0.38, 0.07, 0.14, 0, H1 + RISE - 0.04, ZM)

# ---------------- wnętrze: stół z bochenkami, dzieża, worki, półka z chlebem, łopata ----------------
TX, TZ = 0.28, -0.18
t.boxs('interior', 'wood', 0.52, 0.035, 0.28, TX, P + 0.26, TZ)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('interior', 'woodDark', 0.035, 0.26, 0.035, TX + sx * 0.22, P, TZ + sz * 0.1)
t.block(TX - 0.26, TX + 0.26, TZ - 0.14, TZ + 0.14, 0, P + 0.3)
b.box('interior', 'white', 0.3, 0.004, 0.18, TX - 0.05, P + 0.295, TZ)            # mąka rozsypana na blacie
for x, z, r in ((TX + 0.14, TZ - 0.04, 0.3), (TX + 0.1, TZ + 0.07, -0.2), (TX - 0.12, TZ + 0.02, 0.1)):
    loaf('interior', x, P + 0.295, z, r)
# dzieża z ciastem
b.prism('interior', 'woodDark', 0.13, 0.15, 0.14, -0.05, P, 0.25, seg=12)
b.prism('interior', 'iron', 0.152, 0.152, 0.012, -0.05, P + 0.11, 0.25, seg=12)
b.prism('interior', 'white', 0.13, 0.08, 0.04, -0.05, P + 0.14, 0.25, seg=12)
t.block(-0.2, 0.1, 0.1, 0.4, 0, P + 0.18)
# worki mąki pod lewą ścianą
for x, z, s in ((X0 + T + 0.1, 0.3, 1.0), (X0 + T + 0.11, 0.12, 0.9), (X0 + T + 0.26, 0.38, 0.85)):
    b.prism('interior', 'sack', 0.075 * s, 0.06 * s, 0.17 * s, x, P, z, seg=9)
    b.prism('interior', 'rope', 0.035 * s, 0.03 * s, 0.03 * s, x, P + 0.17 * s, z, seg=7)
t.block(X0 + T, X0 + T + 0.36, 0.02, 0.48, 0, P + 0.2)
# półka z chlebem na prawej ścianie
b.box('interior', 'woodDark', 0.08, 0.02, 0.5, X1 - T - 0.04, P + 0.5, -0.25)
for z in (-0.42, -0.27, -0.12):
    loaf('interior', X1 - T - 0.05, P + 0.52, z, math.pi / 2, 0.8)
# łopata piekarska oparta o piec
b.box('interior', 'wood', 0.022, 0.5, 0.022, OV[1] + 0.1, P, Z0 + T + 0.12, roll=0.3)
b.box('interior', 'wood', 0.13, 0.13, 0.01, OV[1] + 0.06, P + 0.02, Z0 + T + 0.12, roll=0.3)
# drewno do pieca
for k in range(3):
    b.box('interior', 'bark', 0.24, 0.05, 0.05, X0 + T + 0.16, P + k * 0.05, Z0 + T + 0.08 + (k % 2) * 0.04)
t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
t.open.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])

# ---------------- przed piekarnią: szyld z obwarzankiem, ława z koszem, stos drewna przy piecu ----------------
SX = DOOR[1] + 0.1
b.box('base', 'iron', 0.02, 0.02, 0.3, SX, P + 0.66, Z1 + 0.14)
b.box('base', 'woodDark', 0.012, 0.012, 0.012, SX, P + 0.6, Z1 + 0.28)
# obwarzanek: pierścień z rogalików pod wysięgnikiem
for k in range(12):
    a0, a1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
    R, r = 0.08, 0.025
    cy, cz = P + 0.5, Z1 + 0.28
    for j in range(6):
        b0, b1 = 2 * math.pi * j / 6, 2 * math.pi * (j + 1) / 6
        P4 = lambda a, bb: (SX + math.sin(bb) * r, cy + math.cos(a) * (R + math.cos(bb) * r), cz + math.sin(a) * (R + math.cos(bb) * r))
        b.poly('base', 'bread', [P4(a0, b0), P4(a1, b0), P4(a1, b1), P4(a0, b1)], away=(SX, cy + math.cos((a0 + a1) / 2) * R, cz + math.sin((a0 + a1) / 2) * R))
# ława z koszem bochenków
b.box('base', 'wood', 0.4, 0.03, 0.13, -0.45, 0.2, Z1 + 0.32)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.2, 0.11, -0.45 + sx * 0.16, 0.0, Z1 + 0.32)
b.prism('base', 'basket', 0.1, 0.12, 0.08, -0.45, 0.23, Z1 + 0.32, seg=10)
for x, z, r in ((-0.48, Z1 + 0.3, 0.4), (-0.41, Z1 + 0.35, -0.3)):
    loaf('base', x, 0.29, z, r, 0.75)
# polana przy piecu
for k in range(5):
    b.box('base', 'bark', 0.07, 0.07, 0.36, X1 - 0.18 - (k % 3) * 0.08, (k // 3) * 0.07, Z0 - 0.24)

E = P + 0.46
VIEWS = [
    ['piekarnia z przodu', [0.4, 0.5, 2.5], [0, 0.6, 0], ['base', 'shell'], 22],
    ['piec z tyłu', [-0.6, 0.6, -2.3], [-0.2, 0.4, 0], ['base', 'shell'], 22],
    ['wnętrze z góry (piekarz przy pracy)', [0.2, 1.8, 1.1], [0, 0.2, -0.1], ['base', 'interior', 'floor'], 22],
    ['od drzwi', [DM, E, 0.4], [-0.2, 0.25, -0.5], ['base', 'interior', 'floor'], 16],
]
b.save('bakery', maxe=0.26, rays=16, reach=0.4, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': chimneys, 'flames': flames,
    'pennant': [round(X1 + 0.05, 3), round(H1 + RISE - 0.08, 3), round(ZM, 3)], 'views': VIEWS})
