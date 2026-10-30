"""Rynek (3×3 pola): plac z ubitej ziemi i kamiennych płyt, na nim dwa kramy pod pasiastymi daszkami z płótna.
Lewy kram (czerwone pasy) z jedzeniem: jabłka, bochenki, worki zboża. Prawy kram (niebieskie pasy) z towarem:
deski, sztaby żelaza, beczka piwa. Z tyłu placu skrzynie i beczki kupców, z przodu słup z szyldem — złota moneta
na desce (tu przychodzi się handlować). Sprzedaż i kupno działają od ręki (sim/systems/market.ts).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/market.py
Układ: środek działki = (0, 0), 1 = jedno pole, przód (szyld, wejście) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from common import reset  # noqa: E402
from logs import log  # noqa: E402

reset()
b = Building()

P = 0.04  # wierzch placu

# ---------------- plac: ubita ziemia i kamienne płyty pod kramami ----------------
b.box('base', 'soil', 2.92, P - 0.005, 2.92, 0, 0, 0)
for sx in (-1, 1):
    b.box('base', 'castleDark', 1.3, P + 0.012 - (P - 0.005), 0.98, sx * 0.72, P - 0.005, -0.25)


def stall(cx, cz, stripe, goods):
    """Kram: cztery słupy, lada z desek, pochyły daszek w pasy (wyżej z tyłu, niżej nad ladą)"""
    W, D = 1.12, 0.72
    x0, x1 = cx - W / 2, cx + W / 2
    zb, zf = cz - D / 2, cz + D / 2
    yb, yf = 1.28, 1.02                     # wysokość daszku z tyłu i z przodu
    for x in (x0 + 0.04, x1 - 0.04):
        log(b, 'base', 'woodDark', (x, P, zb + 0.04), (x, yb, zb + 0.04), r=0.035, seg=7)
        log(b, 'base', 'woodDark', (x, P, zf - 0.04), (x, yf, zf - 0.04), r=0.035, seg=7)
    # belki pod daszkiem (wzdłuż boków)
    for x in (x0 + 0.04, x1 - 0.04):
        log(b, 'base', 'wood', (x, yb - 0.04, zb - 0.02), (x, yf - 0.04, zf + 0.02), r=0.026, seg=6)
    # daszek: pasy płótna na przemian, z grubością (widać go też od spodu); wystaje przed ladę
    n = 7
    OV = 0.1
    for k in range(n):
        a = x0 - 0.03 + (W + 0.06) * k / n
        c = x0 - 0.03 + (W + 0.06) * (k + 1) / n
        mat = 'canvas' if k % 2 == 0 else stripe
        b.slope('base', mat, [(a, yb + 0.005, zb - 0.04), (c, yb + 0.005, zb - 0.04),
                              (c, yf - 0.03, zf + OV), (a, yf - 0.03, zf + OV)], away=(cx, 0.0, cz), t=0.014)
    # falbana z przodu daszku: krótkie języki płótna (dwie warstwy = zamknięta płytka)
    for k in range(n):
        a = x0 - 0.03 + (W + 0.06) * k / n
        mat = 'canvas' if k % 2 == 0 else stripe
        b.box('base', mat, (W + 0.06) / n - 0.004, 0.09, 0.01, a + (W + 0.06) / n / 2, yf - 0.03 - 0.12, zf + OV + 0.01)
    # lada: przód z desek, blat z jaśniejszej deski, półka pod spodem
    LZ = zf - 0.12
    b.box('base', 'wood', W - 0.12, 0.42, 0.05, cx, P, LZ + 0.1)
    b.box('base', 'plank', W - 0.06, 0.04, 0.34, cx, P + 0.42, LZ)
    b.box('base', 'woodDark', W - 0.16, 0.025, 0.28, cx, P + 0.16, LZ - 0.02)
    for x in (cx - W / 2 + 0.1, cx + W / 2 - 0.1):
        b.box('base', 'woodDark', 0.05, 0.42, 0.05, x, P, LZ - 0.12)
    goods(cx, P + 0.46, LZ)
    # tył kramu: skrzynia i worki
    b.box('base', 'wood', 0.24, 0.2, 0.2, cx - 0.3, P, zb + 0.18, rot=0.1)
    b.box('base', 'woodDark', 0.25, 0.02, 0.21, cx - 0.3, P + 0.2, zb + 0.18, rot=0.1)


def food(cx, y, z):
    # kosze z jabłkami i bochenki na blacie, worki zboża pod ladą
    b.prism('base', 'basket', 0.11, 0.12, 0.09, cx - 0.32, y, z - 0.03)
    for k in range(5):
        a = k * 1.3
        b.apple('base', cx - 0.32 + math.cos(a) * 0.05, y + 0.07, z - 0.03 + math.sin(a) * 0.05, w=0.05, rot=a)
    b.apple('base', cx - 0.32, y + 0.1, z - 0.03, w=0.05, rot=0.4)
    b.box('base', 'woodDark', 0.3, 0.015, 0.2, cx + 0.05, y, z - 0.02)            # deska pod chleb
    for k, (dx, dz) in enumerate(((-0.06, -0.04), (0.06, -0.04), (0.0, 0.05))):
        b.bun('base', cx + 0.05 + dx, y + 0.015, z - 0.02 + dz, w=0.1, rot=k * 1.1)
    b.prism('base', 'basket', 0.09, 0.1, 0.08, cx + 0.36, y, z - 0.02)
    for k in range(4):
        a = k * 1.6 + 0.3
        b.apple('base', cx + 0.36 + math.cos(a) * 0.04, y + 0.06, z - 0.02 + math.sin(a) * 0.04, w=0.045, rot=a)
    for dx in (-0.25, 0.0, 0.25):
        b.sack('base', cx + dx, P, z + 0.3, w=0.16, rot=dx * 3)


def wares(cx, y, z):
    # sztaby żelaza w stosie, deski, mała beczka
    for k, (dx, dy) in enumerate(((-0.05, 0.0), (0.05, 0.0), (0.0, 0.035))):
        b.box('base', 'iron', 0.07, 0.035, 0.22, cx - 0.3 + dx, y + dy, z - 0.03, rot=0.05 * k)
    for k in range(3):
        b.box('base', 'plank', 0.42, 0.022, 0.09, cx + 0.08, y + k * 0.023, z - 0.05 + (k % 2) * 0.02, rot=0.04 * (k - 1))
    # beczka piwa przed ladą: walec z obręczami (obręcze o kilka mm szersze)
    bx, bz = cx + 0.4, z + 0.32
    b.prism('base', 'wood', 0.1, 0.1, 0.26, bx, P, bz, seg=14)
    for hy in (0.04, 0.2):
        b.prism('base', 'iron', 0.106, 0.106, 0.022, bx, P + hy, bz, seg=14)
    b.prism('base', 'woodDark', 0.085, 0.085, 0.01, bx, P + 0.26, bz, seg=14)
    for dx in (-0.25, 0.0):
        b.sack('base', cx + dx, P, z + 0.3, w=0.15, rot=dx * 4 + 0.5)


stall(-0.72, -0.25, 'robeRed', food)
stall(0.72, -0.25, 'robeBlue', wares)

# ---------------- tył placu: skrzynie i beczki kupców ----------------
for (x, z, r, h) in ((-0.15, -1.15, 0.0, 0.26), (0.18, -1.2, 0.3, 0.22), (0.02, -1.18, 0.15, 0.2)):
    yb = P if h != 0.2 else P + 0.26
    b.box('base', 'wood', 0.3, h, 0.26, x, yb, z, rot=r)
    b.box('base', 'woodDark', 0.31, 0.02, 0.27, x, yb + h, z, rot=r)
for (x, z) in ((1.25, -1.15), (1.1, -0.85)):
    b.prism('base', 'wood', 0.12, 0.12, 0.32, x, P, z, seg=14)
    for hy in (0.05, 0.25):
        b.prism('base', 'iron', 0.127, 0.127, 0.024, x, P + hy, z, seg=14)
    b.prism('base', 'woodDark', 0.1, 0.1, 0.01, x, P + 0.32, z, seg=14)

# ---------------- przód: słup z szyldem (złota moneta na desce) ----------------
SX, SZ = -0.15, 1.15
log(b, 'base', 'woodDark', (SX, P, SZ), (SX, 1.25, SZ), r=0.04, seg=8)
log(b, 'base', 'woodDark', (SX - 0.02, 1.18, SZ), (SX + 0.45, 1.18, SZ), r=0.025, seg=6)   # ramię
for x in (SX + 0.17, SX + 0.37):
    b.box('base', 'iron', 0.008, 0.08, 0.008, x, 1.09, SZ)                                  # łańcuszki
b.box('base', 'plank', 0.32, 0.22, 0.03, SX + 0.27, 0.87, SZ)                               # deska szyldu
b.prism('base', 'gold', 0.075, 0.075, 0.012, SX + 0.27, 0.98, SZ + 0.022, seg=16)            # moneta (stoi pionowo niżej)

VIEWS = [
    ['rynek (oczy chłopa)', [0.2, 0.5, 2.6], [0, 0.5, -0.2], ['base'], 34],
    ['pod daszkiem', [-0.72, 0.6, 0.9], [-0.72, 0.5, -0.3], ['base'], 30],
    ['z boku', [2.4, 0.7, 0.3], [0, 0.5, -0.2], ['base'], 32],
]
b.save('market', maxe=0.15, rays=16, reach=0.25, extra={'views': VIEWS})
