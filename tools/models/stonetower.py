"""Kamienna wieża obronna (2×2 pola): kwadratowa baszta z ciosów na szerszym cokole, gzyms w połowie, strzelnice
na każdej ścianie, okute drzwi na kamiennych schodkach, u góry wysunięty na wspornikach (machikuły) chodnik
z blankami i deskami pomostu, drzewce z chorągwią na rogu.

Łucznicy stoją na pomoście (gra: STONE_TOWER_TOP = DECK). Wszystko w grupie 'base' (wieża nie ma wnętrza do odkrycia).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/stonetower.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()

S = 0.74        # połowa boku trzonu
DECK = 2.3      # pomost (wierzch trzonu)
OUT = 0.86      # połowa boku chodnika na wspornikach
WALL = 0.09     # grubość przedpiersia
PAR = 0.22      # wysokość przedpiersia (do wcięć blank)

# ---------------- cokół i trzon ----------------
b.box('base', 'castleDark', 2 * S + 0.2, 0.18, 2 * S + 0.2, 0, 0, 0, bottom=False)          # cokół
b.box('base', 'castleDark', 2 * S + 0.1, 0.1, 2 * S + 0.1, 0, 0.18, 0)                     # odsadzka nad cokołem
b.box('base', 'castle', 2 * S, DECK - 0.28 - 0.18, 2 * S, 0, 0.28, 0, top=False)             # trzon (od góry przykryty płytą chodnika)
b.box('base', 'castleDark', 2 * S + 0.06, 0.07, 2 * S + 0.06, 0, 1.25, 0)                  # gzyms w połowie
# narożniki z jaśniejszych, większych ciosów (na przemian długie i krótkie), wystają odrobinę z lica
for sx in (-1, 1):
    for sz in (-1, 1):
        for k in range(7):
            y = 0.3 + k * 0.26
            if 1.2 < y + 0.2 and y < 1.33:
                continue  # gzyms
            long = k % 2 == 0
            w = 0.3 if long else 0.18
            b.box('base', 'stoneDark', w, 0.2, 0.18 if long else 0.3, sx * (S - w / 2 + 0.015), y, sz * (S - (0.18 if long else 0.3) / 2 + 0.015))

# ---------------- wsporniki (machikuły) i chodnik ----------------
for side in range(4):
    for i in range(5):
        f = -S + 0.14 + i * (2 * S - 0.28) / 4
        x, z = (f, S) if side == 0 else (f, -S) if side == 1 else (S, f) if side == 2 else (-S, f)
        dx, dz = (0, 1) if side == 0 else (0, -1) if side == 1 else (1, 0) if side == 2 else (-1, 0)
        # trzy stopnie wspornika: każdy wysunięty dalej
        for j, (o, h) in enumerate(((0.04, 0.08), (0.08, 0.07), (0.12, 0.06))):
            b.box('base', 'castleDark', 0.1 if dz else 2 * o, h, 2 * o if dz else 0.1, x + dx * o, DECK - 0.36 + j * 0.08, z + dz * o)
# płyta chodnika (wysunięta na wspornikach), od spodu też ściana (widać ją z ziemi)
b.box('base', 'castleDark', 2 * OUT, 0.12, 2 * OUT, 0, DECK - 0.12, 0, bottom=True)
# deski pomostu w środku przedpiersia
for i in range(8):
    x = -OUT + WALL + (i + 0.5) * (2 * (OUT - WALL)) / 8
    b.box('base', 'plank', (2 * (OUT - WALL)) / 8 - 0.01, 0.02, 2 * (OUT - WALL), x, DECK, 0)
# klapa zejścia na schody w trzonie
b.box('base', 'woodDark', 0.3, 0.025, 0.3, -0.35, DECK + 0.005, -0.35)
b.box('base', 'iron', 0.08, 0.02, 0.02, -0.35, DECK + 0.03, -0.25)

# ---------------- przedpiersie z blankami ----------------
for side in range(4):
    if side < 2:
        z = OUT - WALL / 2 if side == 0 else -OUT + WALL / 2
        b.box('base', 'castle', 2 * OUT, PAR, WALL, 0, DECK, z)
        b.merlons_line('base', 'castle', -OUT + 0.12, z, OUT - 0.12, z, DECK + PAR, step=0.3, w=0.17, h=0.17, t=WALL)
    else:
        x = OUT - WALL / 2 if side == 2 else -OUT + WALL / 2
        b.box('base', 'castle', WALL, PAR, 2 * OUT - 2 * WALL, x, DECK, 0)
        b.merlons_line('base', 'castle', x, -OUT + 0.12, x, OUT - 0.12, DECK + PAR, step=0.3, w=0.17, h=0.17, t=WALL)
# ciemniejsza listwa na koronie przedpiersia
for z in (OUT - WALL / 2, -OUT + WALL / 2):
    b.box('base', 'castleDark', 2 * OUT + 0.02, 0.03, WALL + 0.02, 0, DECK + PAR - 0.03, z)
for x in (OUT - WALL / 2, -OUT + WALL / 2):
    b.box('base', 'castleDark', WALL + 0.02, 0.03, 2 * OUT - 2 * WALL, x, DECK + PAR - 0.03, 0)

# ---------------- strzelnice: wąskie, ciemne szczeliny z kamiennym obramieniem ----------------
for y in (0.72, 1.62):
    for side in range(4):
        if side == 0 and y < 1:
            continue  # nad drzwiami bez dolnej strzelnicy
        off = 0.0 if y > 1 else 0.28
        nx, nz = ((0, 1), (0, -1), (1, 0), (-1, 0))[side]
        x, z = nx * S + (off if nz else 0), nz * S + (off if nx else 0)
        along_x = nz != 0
        b.box('base', 'castleDark', 0.13 if along_x else 0.03, 0.36, 0.03 if along_x else 0.13, x + nx * 0.012, y - 0.03, z + nz * 0.012)
        b.box('base', 'dark', 0.045 if along_x else 0.03, 0.28, 0.03 if along_x else 0.045, x + nx * 0.022, y + 0.01, z + nz * 0.022)

# ---------------- drzwi ----------------
DZ = S
b.box('base', 'castleDark', 0.5, 0.82, 0.06, 0, 0.28, DZ + 0.02)          # obramienie
b.box('base', 'castleDark', 0.56, 0.08, 0.08, 0, 1.08, DZ + 0.03)         # nadproże
b.box('base', 'dark', 0.38, 0.72, 0.03, 0, 0.28, DZ + 0.045)               # wnęka
for i in range(4):  # deski skrzydła
    b.box('base', 'woodDark', 0.085, 0.68, 0.035, -0.135 + i * 0.09, 0.28, DZ + 0.06)
for y in (0.42, 0.78):  # okucia
    b.box('base', 'iron', 0.36, 0.035, 0.012, 0, y, DZ + 0.08)
b.prism('base', 'iron', 0.025, 0.025, 0.01, 0.1, 0.6, DZ + 0.085, seg=8, top=True)
# schodki pod drzwi
b.box('base', 'stoneDark', 0.6, 0.1, 0.22, 0, 0.0, DZ + 0.2, bottom=False)
b.box('base', 'stoneDark', 0.56, 0.09, 0.14, 0, 0.1, DZ + 0.14)
b.box('base', 'stoneDark', 0.52, 0.09, 0.08, 0, 0.19, DZ + 0.12)

# ---------------- chorągiew na rogu ----------------
PX, PZ = -OUT + 0.06, -OUT + 0.06
b.box('base', 'woodDark', 0.045, 0.95, 0.045, PX, DECK + PAR, PZ)
b.prism('base', 'gold', 0.035, 0.0, 0.07, PX, DECK + PAR + 0.95, PZ, seg=6)
b.box('base', 'flag', 0.32, 0.22, 0.012, PX + 0.18, DECK + PAR + 0.66, PZ)

VIEWS = [
    ['wieża od drzwi (oczy chłopa)', [0.4, 0.5, 2.6], [0, 1.3, 0], ['base'], 22],
    ['pod machikułami', [0.95, 0.3, 1.3], [0.4, 2.2, 0.5], ['base'], 18],
    ['pomost łuczników', [0.0, DECK + 0.45, -0.1], [0.6, DECK + 0.2, 0.7], ['base'], 16],
]
b.save('stonetower', maxe=0.2, rays=16, reach=0.3, extra={'deck': DECK, 'views': VIEWS})
