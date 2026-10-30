"""Chlew (3×2 pola, Michał 29.10.2026): po lewej szopa świniopasa z desek pod strzechą — otwarta od strony zagrody,
w środku słoma, pod okapem wisi wędzona szynka; po prawej zagroda z plecionki na palach z furtką od frontu. W zagrodzie
koryto wydrążone z kłody z pomyjami, nieregularne kałuże błota, rozrzucona słoma, wiadro, worek żołędzi i widły oparte
o płot. Świnie (render/village.ts) chodzą po zagrodzie w prostokącie `pen` z modelu, nocą leżą.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/pigsty.py
Układ: środek działki = (0, 0), działka x ±1,5, z ±1, przód (furtka) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import lash, log  # noqa: E402

b = Building()


def jit(k, a, s=1.0):
    return math.sin(k * 12.9898 + a * 78.233) * s


# ---------------- szopa świniopasa (lewa część) ----------------
SX0, SX1, SZ0, SZ1 = -1.45, -0.6, -0.95, 0.15
H = 0.5                       # wysokość ściany z tyłu
HF = 0.62                     # przód szopy wyżej (dach pulpitowy spada do tyłu)
for (x, z) in ((SX0, SZ0), (SX1, SZ0), (SX0, SZ1), (SX1, SZ1)):
    log(b, 'base', 'bark', (x, -0.02, z), (x, (HF if z == SZ1 else H) + 0.02, z), r=0.035, r1=0.03, seg=7)
# ściany z desek: tył i lewy bok pełne, prawy bok (od zagrody) do połowy wysokości, przód otwarty
for k in range(6):
    y = 0.02 + k * 0.085
    b.box('base', 'plank', SX1 - SX0 - 0.06, 0.075, 0.025, (SX0 + SX1) / 2, y, SZ0 + 0.02, roll=jit(k, 1, 0.01))
    b.box('base', 'plank', 0.025, 0.075, SZ1 - SZ0 - 0.06, SX0 + 0.02, y, (SZ0 + SZ1) / 2, roll=jit(k, 2, 0.01))
    if k < 3:
        b.box('base', 'plank', 0.025, 0.075, SZ1 - SZ0 - 0.06, SX1 - 0.02, y, (SZ0 + SZ1) / 2, roll=jit(k, 3, 0.01))
# belki oczepu i dach pulpitowy ze strzechy (z grubością), okap z każdej strony
for z, y in ((SZ0, H), (SZ1, HF)):
    b.box('base', 'woodDark', SX1 - SX0 + 0.08, 0.05, 0.05, (SX0 + SX1) / 2, y - 0.02, z)
OV = 0.12
b.slope('roof', 'thatch', [(SX0 - OV, H + 0.04, SZ0 - OV), (SX1 + OV, H + 0.04, SZ0 - OV), (SX1 + OV, HF + 0.07, SZ1 + OV), (SX0 - OV, HF + 0.07, SZ1 + OV)],
        away=((SX0 + SX1) / 2, 0.0, (SZ0 + SZ1) / 2), t=0.05)
# w środku: gruba warstwa słomy i snopek w kącie
b.crystal('base', 'hay', (SX0 + SX1) / 2, 0.0, (SZ0 + SZ1) / 2 - 0.05, 0.3, seed=1.0, sx=1.2, sy=0.12, sz=1.4, seg=9)
b.prism('base', 'hay', 0.11, 0.09, 0.2, SX0 + 0.16, 0.0, SZ0 + 0.16, seg=10)
lash(b, 'base', (SX0 + 0.16, 0.12, SZ0 + 0.16), (0, 1, 0), r=0.1, w=0.02, seg=10)
# wędzona szynka na haku pod okapem przodu szopy i wianek kiełbas
HX = SX0 + 0.25
log(b, 'base', 'rope', (HX, HF - 0.02, SZ1 + 0.02), (HX, HF - 0.12, SZ1 + 0.02), r=0.005, seg=4)
b.crystal('base', 'meat', HX, HF - 0.25, SZ1 + 0.02, 0.06, seed=2.0, sx=0.9, sy=1.6, sz=0.8, seg=8)
b.prism('base', 'bone', 0.012, 0.012, 0.05, HX, HF - 0.16, SZ1 + 0.02, seg=6)
for k in range(5):
    a = -0.6 + k * 0.3
    b.crystal('base', 'meatDark', HX + 0.18 + math.sin(a) * 0.06, HF - 0.12 - math.cos(a) * 0.06, SZ1 + 0.02, 0.022, seed=k + 5, sx=1.0, sy=1.5, sz=1.0, seg=6)

# ---------------- zagroda z plecionki (prawa część) ----------------
PX0, PX1, PZ0, PZ1 = -0.6, 1.42, -0.92, 0.92
GATE = (0.15, 0.55)           # furtka w płocie od frontu (x od, x do)
FH = 0.32                     # wysokość płotu
posts = []
for i in range(9):
    posts.append((PX0 + (PX1 - PX0) * i / 8, PZ1))
    posts.append((PX0 + (PX1 - PX0) * i / 8, PZ0))
for i in range(1, 6):
    posts.append((PX1, PZ0 + (PZ1 - PZ0) * i / 6))
for (x, z) in posts:
    log(b, 'base', 'bark', (x, -0.02, z), (x + jit(x, z, 0.01), FH + 0.04, z), r=0.022, r1=0.018, seg=6)


def wattle(a0, a1, fixed, along_x):
    """Plecionka między palami: trzy rzędy giętych witek (wałki z grubością)"""
    for k, y in enumerate((0.08, 0.17, 0.26)):
        wob = 0.006 * (1 if k % 2 else -1)
        p0 = (a0, y, fixed + wob) if along_x else (fixed + wob, y, a0)
        p1 = (a1, y, fixed - wob) if along_x else (fixed - wob, y, a1)
        log(b, 'base', 'wattle', p0, p1, r=0.016, seg=6)


wattle(PX0, PX1, PZ0, True)
wattle(PX0, GATE[0], PZ1, True)
wattle(GATE[1], PX1, PZ1, True)
wattle(PZ0, PZ1, PX1, False)
wattle(SZ1 + 0.02, PZ1, PX0, False)
# furtka z desek na skobli, uchylona do środka zagrody
GA = 0.5
gx0 = GATE[0]
for k in range(3):
    y = 0.05 + k * 0.1
    dx, dz = math.cos(GA) * (GATE[1] - GATE[0]), -math.sin(GA) * (GATE[1] - GATE[0])
    log(b, 'base', 'plank', (gx0 + 0.02, y, PZ1 - 0.01), (gx0 + dx, y, PZ1 + dz - 0.01), r=0.014, seg=4)
log(b, 'base', 'plank', (gx0 + 0.02, 0.06, PZ1 - 0.01), (gx0 + math.cos(GA) * 0.38, 0.26, PZ1 - math.sin(GA) * 0.38 - 0.01), r=0.012, seg=4)

# koryto z wydrążonej kłody przy tylnym płocie, w nim pomyje
TX, TZ, TL = 0.45, PZ0 + 0.17, 0.62
b.box('base', 'woodDark', TL, 0.1, 0.16, TX, 0.0, TZ)
b.box('base', 'dark', TL - 0.06, 0.006, 0.1, TX, 0.096, TZ)          # pomyje w korycie (o włos niżej od brzegów)
for x in (TX - TL / 2 + 0.06, TX + TL / 2 - 0.06):
    b.box('base', 'bark', 0.07, 0.05, 0.2, x, 0.0, TZ)

# kałuże błota: nieregularne, płaskie plamy (bez prostokątów), lekko nad ziemią
for k, (cx, cz, r) in enumerate(((0.2, 0.15, 0.32), (0.95, -0.3, 0.24), (1.05, 0.5, 0.16))):
    pts = []
    for i in range(12):
        a = i * 2 * math.pi / 12
        rr = r * (1 + jit(k * 3 + i, 1.3, 0.22))
        pts.append((cx + math.cos(a) * rr, 0.008 + k * 0.001, cz + math.sin(a) * rr * 0.8))
    b.poly('base', 'mud', pts, away=(cx, -1.0, cz))
# rozrzucona słoma po zagrodzie
for k in range(14):
    x, z = -0.45 + (k * 0.37) % 1.8, -0.75 + (k * 0.53) % 1.5
    b.box('base', 'hay', 0.09, 0.006, 0.012, x, 0.012, z, rot=k * 1.3)
# wiadro z pomyjami przy furtce, worek żołędzi pod szopą, widły oparte o płot
b.prism('base', 'wood', 0.05, 0.06, 0.11, 0.75, 0.0, PZ1 - 0.12, seg=10)
b.prism('base', 'iron', 0.062, 0.062, 0.014, 0.75, 0.08, PZ1 - 0.12, seg=10, top=False)
b.prism('base', 'dark', 0.05, 0.05, 0.005, 0.75, 0.1, PZ1 - 0.12, seg=10)
b.crystal('base', 'sack', -0.42, 0.07, PZ1 - 0.15, 0.09, seed=3.0, sx=0.9, sy=1.1, sz=0.8, seg=8)
for k in range(4):
    b.crystal('base', 'woodDark', -0.32 + k * 0.03, 0.01, PZ1 - 0.04 + (k % 2) * 0.03, 0.012, seed=k + 9, seg=5)   # rozsypane żołędzie
log(b, 'base', 'woodDark', (PX1 - 0.04, 0.0, 0.62), (PX1 - 0.02, 0.5, 0.48), r=0.01, seg=5)
for k in (-1, 0, 1):
    log(b, 'base', 'iron', (PX1 - 0.02, 0.5, 0.48), (PX1 - 0.015 + k * 0.012, 0.6, 0.45), r=0.004, seg=4)

VIEWS = [
    ['chlew od furtki', [0.6, 0.7, 2.6], [0.1, 0.2, 0], ['base'], 26],
    ['zagroda z góry', [0.4, 2.4, 1.2], [0.4, 0.0, 0.0], ['base'], 30],
    ['szopa i szynka', [-0.6, 0.5, 1.4], [-1.0, 0.35, -0.2], ['base'], 22],
]
b.save('pigsty', maxe=0.25, rays=14, reach=0.3, extra={'windows': [], 'chimneys': [], 'flames': [],
       # zagroda dla świń (prostokąt x0, x1, z0, z1 w układzie modelu, z zapasem od płotu i koryta)
       'pen': [round(PX0 + 0.12, 3), round(PX1 - 0.12, 3), round(TZ + 0.14, 3), round(PZ1 - 0.15, 3)], 'views': VIEWS})
