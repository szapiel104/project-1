"""Kamienna wieża obronna (2×2 pola): kwadratowa baszta z ciosów na szerszym cokole, gzyms w połowie, strzelnice
na każdej ścianie, okute drzwi na kamiennych schodkach, u góry wysunięty na wspornikach (machikuły) chodnik
z blankami i deskami pomostu, drzewce z chorągwią na rogu.

Łucznicy stoją na pomoście (gra: STONE_TOWER_TOP = DECK). Bryła w grupie 'base'; nad pomostem dach z łupka na słupach
w grupie 'roof' (towerroof.py), który gra zdejmuje po kliknięciu wieży (openTop) — widać wtedy pomost, klapę zejścia,
kosz strzał, beczkę z wodą i kamienie do zrzucania. Proporzec stoi na iglicy dachu (grupa 'flagpole').

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/stonetower.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import log  # noqa: E402
from towerroof import barrel, quiver_basket, roof, stone_pile  # noqa: E402

b = Building()

S = 0.74        # połowa boku trzonu
DECK = 2.3      # pomost (wierzch trzonu)
OUT = 0.86      # połowa boku chodnika na wspornikach
WALL = 0.09     # grubość przedpiersia
PAR = 0.22      # wysokość przedpiersia (do wcięć blank)

# ---------------- cokół i trzon ----------------
b.box('base', 'castleDark', 2 * S + 0.2, 0.18, 2 * S + 0.2, 0, 0, 0, bottom=False)          # cokół
b.box('base', 'castleDark', 2 * S + 0.1, 0.1, 2 * S + 0.1, 0, 0.18, 0)                     # odsadzka nad cokołem
b.box('base', 'castle', 2 * S, DECK - 0.12 - 0.28 + 0.01, 2 * S, 0, 0.28, 0, top=False)       # trzon aż pod płytę chodnika (bez szpary pod wspornikami)
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
# Płyta chodnika bez wierzchu: ciemny cios (castleDark) gra rysuje „o włos bliżej” kamery (withAo w buildings.ts),
# więc z daleka jej wierzch przebijał przez deski pomostu 2 cm wyżej i pomost ciemniał. Pod deskami leży zwykły
# kamień (bez przesunięcia), 3 cm niżej od ich wierzchu, a płyta zostaje tylko z boków i od spodu.
b.box('base', 'castleDark', 2 * OUT, 0.12, 2 * OUT, 0, DECK - 0.12, 0, top=False, bottom=True)
b.box('base', 'castle', 2 * OUT - 0.01, 0.03, 2 * OUT - 0.01, 0, DECK - 0.04, 0)
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
    b.box('base', 'castleDark', 2 * OUT + 0.02, 0.03, WALL + 0.02, 0, DECK + PAR - 0.025, z)   # wierzch 5 mm nad przedpiersiem
for x in (OUT - WALL / 2, -OUT + WALL / 2):
    b.box('base', 'castleDark', WALL + 0.02, 0.03, 2 * OUT - 2 * WALL - 0.02, x, DECK + PAR - 0.025, 0)   # bez zakładki na listwy z przodu i z tyłu

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

# ---------------- sprzęt łuczników na pomoście (z dala od miejsc łuczników i klapy) ----------------
quiver_basket(b, 0.6, 0.02, DECK + 0.02)
barrel(b, 0.05, -0.6, DECK + 0.02)
stone_pile(b, -0.58, 0.06, DECK + 0.02, seed=1.0)

# ---------------- dach z łupka na słupach (zdejmowany po kliknięciu) ----------------
APEX = roof(b, DECK + 0.02, OUT + 0.08, OUT - WALL - 0.06, eave=0.88, rise=0.7)
# żerdź z proporcem na iglicy: w osobnej grupie (cienka, daleka wersja by ją zjadła); znika razem z dachem
log(b, 'flagpole', 'woodDark', (0, APEX + 0.2, 0), (0, APEX + 0.85, 0), r=0.018, seg=6)
BANNERS = [[0.02, round(APEX + 0.72, 3), 0.0, 0, 0.32, 0.2, 0, 'flagpole']]

VIEWS = [
    ['wieża od drzwi (oczy chłopa)', [0.4, 0.5, 2.6], [0, 1.6, 0], ['base', 'shell'], 22],
    ['pod machikułami', [0.95, 0.3, 1.3], [0.4, 2.2, 0.5], ['base', 'shell'], 18],
    ['pomost łuczników', [0.0, DECK + 0.45, -0.1], [0.6, DECK + 0.2, 0.7], ['base', 'shell'], 16],
    ['pod dachem (z pomostu w górę)', [0.2, DECK + 0.4, 0.3], [0.0, DECK + 1.3, -0.1], ['base', 'shell'], 18],
    ['pomost bez dachu (po kliknięciu)', [1.6, DECK + 1.8, 1.6], [0.0, DECK, 0.0], ['base'], 26],
]
b.save('stonetower', maxe=0.2, rays=16, reach=0.3, extra={'deck': DECK, 'views': VIEWS, 'banners': BANNERS, 'openTop': True})
