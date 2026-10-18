"""Koszary (3×3 pola): z tyłu działki długi dom straży — kamienna podmurówka, szachulec, strzecha, komin nad
paleniskiem; z przodu plac ćwiczeń z ubitej ziemi: dwie słomiane kukły z tarczami, tarcza łucznicza ze słomy,
stojak z włóczniami, koryto z wodą, ława i sztandar w barwach pana przy wejściu na plac.
W domu: prycze piętrowe pod tylną ścianą, stół z ławami, palenisko z ogniem, skrzynia, kołki z tarczami.
Dach i szczyty (grupa 'shell') znikają przy podglądzie wnętrza.

Uruchomienie (z katalogu repo):  python tools/models/barracks.py  →  src/render/models/barracks.json
Układ: środek działki = (0, 0), 1 = jedno pole, przód (plac i wejście) = +z. Wejście: pole przed środkiem przodu.
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

P = 0.12                         # posadzka domu
X0, X1, Z0, Z1 = -1.36, 1.36, -1.42, -0.2
H1 = P + 0.8                     # okap
RISE = 0.7
DOOR = (-0.17, 0.17, 0.62)
ZM = (Z0 + Z1) / 2

# ---------------- plac ćwiczeń: ubita ziemia z krawężnikiem z kamieni ----------------
b.box('base', 'soil', 2.86, 0.015, 1.5, 0, 0, 0.66)
for k in range(15):
    x = -1.4 + k * 0.2
    b.box('base', 'rock', 0.13, 0.05, 0.1, x, 0, 1.43, rot=0.3 * (k % 3))
for k in range(7):
    for sx in (-1, 1):
        b.box('base', 'rock', 0.1, 0.05, 0.13, sx * 1.42, 0, 0.0 + k * 0.2, rot=0.25 * (k % 2))

# ---------------- dom: podmurówka, podłoga z desek ----------------
b.box('base', 'stone', X1 - X0 + 0.08, P, Z1 - Z0 + 0.08, 0, 0, ZM)
b.box('base', 'stoneDark', X1 - X0 + 0.14, 0.035, Z1 - Z0 + 0.14, 0, 0, ZM)
b.box('floor', 'plank', X1 - X0 - 2 * T, 0.01, Z1 - Z0 - 2 * T, 0, P, ZM)

# ---------------- ściany: drzwi i dwa okna z przodu, okna z tyłu, okno w szczycie ----------------
WINS = [(-0.95, -0.7), (0.7, 0.95)]
WY = (P + 0.36, P + 0.58)
t.wall_x('base', 'plaster', Z1 - T / 2, X0, X1, P, H1, [(DOOR[0], DOOR[1], P, P + DOOR[2])] + [(a, c, WY[0], WY[1]) for a, c in WINS])
t.wall_x('base', 'plaster', Z0 + T / 2, X0, X1, P, H1, [(-0.55, -0.31, WY[0], WY[1]), (0.31, 0.55, WY[0], WY[1])])
t.wall_z('base', 'plaster', X0 + T / 2, Z0 + T, Z1 - T, P, H1, [])
t.wall_z('base', 'plaster', X1 - T / 2, Z0 + T, Z1 - T, P, H1, [(ZM - 0.12, ZM + 0.12, WY[0], WY[1])])
for a, c in WINS:
    t.window('base', (a + c) / 2, WY[0], WY[1], Z1 - T / 2, c - a, 0, 1)
for x in (-0.43, 0.43):
    t.window('base', x, WY[0], WY[1], Z0 + T / 2, 0.24, 0, -1)
t.window('base', X1 - T / 2, WY[0], WY[1], ZM, 0.24, 1, 0)
t.frame_x('base', Z1 - T / 2, X0, X1, P, H1, [X0 + 0.03, WINS[0][0] - 0.03, WINS[0][1] + 0.03, DOOR[0] - 0.03, DOOR[1] + 0.03, WINS[1][0] - 0.03, WINS[1][1] + 0.03, X1 - 0.03], braces=False)
t.frame_x('base', Z0 + T / 2, X0, X1, P, H1, [X0 + 0.03, -0.9, -0.58, -0.28, 0.28, 0.58, 0.9, X1 - 0.03], out=-1)
t.frame_z('base', X0 + T / 2, Z0, Z1, P, H1, [Z0 + 0.03, ZM - 0.2, ZM + 0.2, Z1 - 0.03], out=-1)
t.frame_z('base', X1 - T / 2, Z0, Z1, P, H1, [Z0 + 0.03, ZM - 0.15, ZM + 0.15, Z1 - 0.03])
for x, r in ((-0.45, 0.55), (0.45, -0.55), (-1.15, -0.55), (1.15, 0.55)):
    b.box('base', 'woodDark', 0.04, 0.5, 0.022, x, P + 0.06, Z1 + 0.015, roll=r)
# drzwi uchylone do środka, nadproże, kamienny próg i stopień
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.08, 0.05, T + 0.03, 0, P + DOOR[2], Z1 - T / 2)
b.box('base', 'stoneDark', DOOR[1] - DOOR[0] + 0.12, P, 0.16, 0, 0.0, Z1 + 0.1, bottom=True)
b.box('interior', 'wood', DOOR[1] - DOOR[0] - 0.02, DOOR[2] - 0.02, 0.025, DOOR[1] - 0.02, P, Z1 - T - 0.14, -(math.pi / 2 - 0.3))
t.block(X0, DOOR[0], Z1 - T, Z1); t.block(DOOR[1], X1, Z1 - T, Z1)
t.block(X0, X1, Z0, Z0 + T); t.block(X0, X0 + T, Z0, Z1); t.block(X1 - T, X1, Z0, Z1)

# ---------------- strzecha, szczyty, kalenica, komin nad paleniskiem ----------------
b.gable('shell', 'thatch', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1, RISE, along_x=True, over=0.18)
b.gable('shell', 'thatchDark', X0 - 0.02, X1 + 0.02, Z0 - 0.02, Z1 + 0.02, H1 - 0.04, RISE, along_x=True, over=0.21)
for sx, x in ((-1, X0), (1, X1)):
    t.gable_end('shell', 'plaster', x, Z0, Z1, H1, RISE, out=sx)
b.box('shell', 'thatchDark', X1 - X0 + 0.44, 0.08, 0.15, 0, H1 + RISE - 0.04, ZM)
FX, FZ = X0 + T + 0.22, Z0 + T + 0.2
CH = H1 + RISE * 0.7 + 0.3
b.box('shell', 'stone', 0.26, CH - H1, 0.26, FX, H1, FZ)
b.box('shell', 'stoneDark', 0.3, 0.05, 0.3, FX, CH, FZ)
b.box('shell', 'dark', 0.17, 0.005, 0.17, FX, CH + 0.05, FZ)
chimneys.append([FX, round(CH + 0.07, 3), FZ])

# ---------------- wnętrze: palenisko, prycze, stół z ławami, skrzynia, tarcze na kołkach ----------------
b.box('interior', 'stoneDark', 0.42, 0.12, 0.36, FX, P, FZ)
b.box('interior', 'stoneDark', 0.42, 0.6, 0.1, FX, P + 0.12, Z0 + T + 0.05)
b.box('interior', 'ash', 0.26, 0.01, 0.2, FX, P + 0.12, FZ + 0.02)
for k in range(3):
    b.box('interior', 'bark', 0.2, 0.035, 0.035, FX, P + 0.13 + k * 0.025, FZ + 0.02, rot=k * 1.0)
flames.append([FX, round(P + 0.14, 3), round(FZ + 0.02, 3)])
t.block(FX - 0.21, FX + 0.21, Z0, FZ + 0.18, 0, P + 0.7)
# prycze piętrowe pod tylną ścianą: rama, dwa poziomy z siennikiem i kocem
for bx in (-0.55, 0.0, 0.55, 1.05):
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box('interior', 'woodDark', 0.04, 0.62, 0.04, bx + sx * 0.2, P, Z0 + T + 0.2 + sz * 0.15)
    for y in (P + 0.1, P + 0.4):
        b.box('interior', 'wood', 0.42, 0.03, 0.34, bx, y, Z0 + T + 0.2)
        b.box('interior', 'hay', 0.38, 0.04, 0.3, bx, y + 0.03, Z0 + T + 0.2)
        b.box('interior', 'sack', 0.24, 0.015, 0.31, bx + 0.06, y + 0.07, Z0 + T + 0.2)
    t.block(bx - 0.23, bx + 0.23, Z0 + T, Z0 + T + 0.38, 0, P + 0.62)
# stół z ławami pośrodku
TX, TZ = -0.2, Z1 - 0.42
t.boxs('interior', 'wood', 0.7, 0.035, 0.26, TX, P + 0.26, TZ)
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.04, 0.26, 0.2, TX + sx * 0.3, P, TZ)
    b.box('interior', 'wood', 0.66, 0.03, 0.1, TX, P + 0.15, TZ + sx * 0.22)
    for ex in (-1, 1):
        b.box('interior', 'woodDark', 0.03, 0.15, 0.08, TX + ex * 0.28, P, TZ + sx * 0.22)
t.block(TX - 0.35, TX + 0.35, TZ - 0.28, TZ + 0.28, 0, P + 0.3)
for x in (-0.38, -0.12, 0.08):   # kubki i miska na stole
    b.prism('interior', 'woodDark', 0.025, 0.022, 0.06, TX + x + 0.2, P + 0.295, TZ, seg=6)
# skrzynia na rynsztunek i stojak z mieczami przy prawej ścianie
t.boxs('interior', 'woodDark', 0.36, 0.2, 0.2, X1 - T - 0.2, P, Z1 - 0.25)
b.box('interior', 'iron', 0.36, 0.02, 0.02, X1 - T - 0.2, P + 0.12, Z1 - 0.15)
# tarcze w barwach pana na kołkach na lewej ścianie
for z in (ZM - 0.15, ZM + 0.2):
    for k in range(10):
        a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
        r = 0.11
        cx, cy = X0 + T + 0.02, P + 0.5
        b.poly('interior', 'flag', [(cx, cy, z), (cx, cy + math.cos(a0) * r, z + math.sin(a0) * r), (cx, cy + math.cos(a1) * r, z + math.sin(a1) * r)], away=(cx - 1, cy, z))
    b.box('interior', 'iron', 0.03, 0.04, 0.04, X0 + T + 0.025, P + 0.48, z)
t.open.append([X0 + T, X1 - T, Z0 + T, Z1 - T])
t.open.append([DOOR[0], DOOR[1], Z1 - T - 0.02, Z1 + 0.05])

# ---------------- plac: kukły, tarcza łucznicza, stojak z włóczniami, koryto, ława, sztandar ----------------
def dummy(x, z, rot=0.0):
    """Słomiana kukła na palu z poprzeczką i tarczą"""
    b.box('base', 'woodDark', 0.05, 0.72, 0.05, x, 0.0, z)
    t.block(x - 0.12, x + 0.12, z - 0.12, z + 0.12, 0, 0.8)
    c, s = math.cos(rot), math.sin(rot)
    b.box('base', 'woodDark', 0.42, 0.04, 0.04, x, 0.52, z, rot)
    b.prism('base', 'hay', 0.11, 0.13, 0.3, x, 0.36, z, seg=10)
    b.prism('base', 'rope', 0.135, 0.135, 0.025, x, 0.5, z, seg=10)
    b.prism('base', 'hay', 0.08, 0.05, 0.12, x, 0.66, z, seg=8)
    b.prism('base', 'hay', 0.05, 0.0, 0.05, x, 0.78, z, seg=8)
    # tarcza na lewym ramieniu kukły (do przodu)
    sx, sz = x - c * 0.16 + s * 0.08, z + s * 0.16 + c * 0.08
    b.box('base', 'wood', 0.18, 0.24, 0.025, sx, 0.34, sz, rot)
    b.box('base', 'iron', 0.05, 0.05, 0.03, sx + s * 0.01, 0.43, sz + c * 0.01, rot)
dummy(-0.85, 0.5, 0.2)
dummy(-0.3, 0.65, -0.15)
# tarcza łucznicza: słomiany krąg na kozłach, z kolorowymi pierścieniami
AX, AZ = 0.95, 0.35
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.04, 0.62, 0.04, AX + sx * 0.18, 0.0, AZ - 0.05, tilt=0.18)
b.box('base', 'woodDark', 0.04, 0.5, 0.04, AX, 0.0, AZ - 0.22, tilt=-0.5)
CY = 0.5
for r, mat, dz in ((0.26, 'hay', 0.0), (0.2, 'white', 0.012), (0.13, 'flag', 0.02), (0.06, 'gold', 0.028)):
    for k in range(16):
        a0, a1 = 2 * math.pi * k / 16, 2 * math.pi * (k + 1) / 16
        b.poly('base', mat, [(AX, CY, AZ + 0.04 + dz), (AX + math.cos(a0) * r, CY + math.sin(a0) * r, AZ + 0.04 + dz),
                             (AX + math.cos(a1) * r, CY + math.sin(a1) * r, AZ + 0.04 + dz)], away=(AX, CY, AZ - 1))
for k in range(16):   # grubość słomianego krążka i tył
    a0, a1 = 2 * math.pi * k / 16, 2 * math.pi * (k + 1) / 16
    r = 0.26
    b.poly('base', 'hay', [(AX + math.cos(a0) * r, CY + math.sin(a0) * r, AZ - 0.04), (AX + math.cos(a1) * r, CY + math.sin(a1) * r, AZ - 0.04),
                           (AX + math.cos(a1) * r, CY + math.sin(a1) * r, AZ + 0.04), (AX + math.cos(a0) * r, CY + math.sin(a0) * r, AZ + 0.04)], away=(AX, CY, AZ))
    b.poly('base', 'hay', [(AX, CY, AZ - 0.04), (AX + math.cos(a0) * r, CY + math.sin(a0) * r, AZ - 0.04), (AX + math.cos(a1) * r, CY + math.sin(a1) * r, AZ - 0.04)], away=(AX, CY, AZ + 1))
for dx, dy in ((0.05, 0.03), (-0.08, -0.1), (0.12, 0.12)):   # strzały wbite w tarczę
    b.box('base', 'wood', 0.008, 0.008, 0.26, AX + dx, CY + dy, AZ + 0.17)
    b.box('base', 'white', 0.002, 0.03, 0.05, AX + dx, CY + dy - 0.015, AZ + 0.28)
t.block(AX - 0.28, AX + 0.28, AZ - 0.3, AZ + 0.08, 0, 0.8)
# stojak z włóczniami przy domu
RX, RZ = 0.75, Z1 + 0.18
for x in (RX - 0.3, RX + 0.3):
    b.box('base', 'woodDark', 0.05, 0.4, 0.05, x, 0.0, RZ)
b.box('base', 'woodDark', 0.66, 0.04, 0.06, RX, 0.38, RZ)
b.box('base', 'woodDark', 0.66, 0.03, 0.1, RX, 0.05, RZ + 0.03)
for k in range(6):
    x = RX - 0.25 + k * 0.1
    b.box('base', 'wood', 0.018, 0.9, 0.018, x, 0.06, RZ + 0.07, tilt=-0.16)
    b.prism('base', 'iron', 0.02, 0.0, 0.07, x, 0.94, RZ - 0.08, seg=4)
t.block(RX - 0.33, RX + 0.33, RZ - 0.05, RZ + 0.12, 0, 1.0)
# koryto z wodą i ława pod ścianą
b.box('base', 'woodDark', 0.5, 0.14, 0.2, -0.85, 0.0, Z1 + 0.18)
b.box('base', 'dark', 0.44, 0.005, 0.14, -0.85, 0.12, Z1 + 0.18)
t.block(-1.1, -0.6, Z1 + 0.08, Z1 + 0.28, 0, 0.15)
b.box('base', 'wood', 0.5, 0.03, 0.12, 0.25, 0.19, 1.1)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.19, 0.1, 0.25 + sx * 0.2, 0.0, 1.1)
# sztandar w barwach pana przy wejściu na plac
FPX, FPZ = -1.25, 1.25
b.box('base', 'woodDark', 0.06, 1.7, 0.06, FPX, 0.0, FPZ)
b.prism('base', 'gold', 0.035, 0.0, 0.07, FPX, 1.7, FPZ, seg=6)
b.box('base', 'woodDark', 0.04, 0.04, 0.42, FPX, 1.55, FPZ + 0.2)
# sztandar z herbem rysuje gra (src/render/banners.ts): wisi z poprzeczki, płachtą w bok (+x)
BANNERS = [[FPX, 1.55, round(FPZ + 0.22, 3), round(math.pi / 2, 4), 0.4, 0.62, 1, 'base']]
t.block(FPX - 0.06, FPX + 0.06, FPZ - 0.06, FPZ + 0.06)

E = P + 0.46
VIEWS = [
    ['koszary z placem', [0.8, 1.1, 3.8], [0, 0.5, 0], ['base', 'shell'], 26],
    ['dom z tyłu', [-0.8, 0.8, -3.4], [0, 0.6, -0.8], ['base', 'shell'], 24],
    ['wnętrze z góry', [0.3, 2.2, 0.6], [0, 0.2, -0.8], ['base', 'interior', 'floor'], 24],
    ['od drzwi', [0.0, E, Z1 - 0.05], [-0.4, 0.3, -1.1], ['base', 'interior', 'floor'], 16],
]
b.save('barracks', maxe=0.3, rays=16, reach=0.4, extra={'banners': BANNERS,
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': chimneys, 'flames': flames, 'views': VIEWS})
