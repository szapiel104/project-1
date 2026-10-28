"""Rudera z desek (2×1 pola) — najtańsza chata, jak szałasy Starego Obozu w Gothicu 1: prostokątna buda z
krzywo przybitych, poszarzałych desek na czterech okorowanych słupach, między deskami szpary (prześwituje),
gdzieniegdzie łata z pionowej deski albo brak deski. Płaski dach dwuspadowy z desek kładzionych z kalenicy na okap
(między nimi szczeliny, pod spodem ciemny podbitek), szczyty z desek. Drzwi bez skrzydła: otwór zasłonięty skórą
odgiętą na bok. W środku ubita ziemia (na niej gra kładzie posłania — 4 miejsca), skrzynka, pieniek do siedzenia,
garnek i kupka słomy. Pod ścianą parę polan i wiadro.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/shack.py
Układ: środek działki = (0, 0), działka x ±1, z ±0,5, przód (wejście) = +z. Pole wejścia: przed prawą połową
przodu (działka parzystej szerokości), więc otwór jest w prawej połowie ściany.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from shackparts import backing, door_hide, ridge_cap  # noqa: E402
from timber import Timber  # noqa: E402

b = Building()
t = Timber(b, T=0.05)


def jit(k, a, s=1.0):
    """Stały „przypadek” z liczby (bez random: model wychodzi zawsze taki sam)"""
    return math.sin(k * 12.9898 + a * 78.233) * s


X0, X1, Z0, Z1 = -0.86, 0.86, -0.4, 0.4
H1 = 0.66                 # okap
RISE = 0.2                # płaski dach
PT = 0.022                # grubość deski
BH, GAP = 0.082, 0.016    # wysokość deski i szpara między deskami
DOOR = (0.2, 0.58, 0.6)   # otwór wejścia (x od, x do, wysokość)
DM = (DOOR[0] + DOOR[1]) / 2
P = 0.012                 # klepisko

# ---------------- klepisko (na nim śpią) i ubita ziemia przed wejściem ----------------
b.box('base', 'soil', X1 - X0 + 0.22, 0.006, Z1 - Z0 + 0.22, 0, 0, 0)
b.box('base', 'soil', 0.6, 0.004, 0.3, DM, 0, Z1 + 0.22)
b.box('floor', 'soil', X1 - X0 - 0.16, 0.008, Z1 - Z0 - 0.08, 0, P - 0.006, 0)   # ciemna, ubita ziemia (nie jasny pył)

# ---------------- słupy z okorowanych pni (narożniki i po bokach drzwi) ----------------
posts = [(X0, Z0), (X1, Z0), (X0, Z1), (X1, Z1), (0.0, Z0), (DOOR[0] - 0.03, Z1), (DOOR[1] + 0.03, Z1)]
for k, (x, z) in enumerate(posts):
    lean = jit(k, 1, 0.012)
    b.prism('base', 'bark', 0.035, 0.03, H1 + 0.03, x + lean, 0.0, z, seg=7, phase=k * 0.4)


def boards_x(z, out, x0, x1, skip=(), patch=None, door=None):
    """Ściana z poziomych desek wzdłuż x w płaszczyźnie z (lico na zewnątrz w stronę out): szpary, krzywizny, braki"""
    zz = z + out * (0.035 + PT / 2)
    y, row = 0.03, 0
    while y + BH <= H1 + 0.01:
        segs = [(x0, x1)]
        if door and y < door[2]:
            segs = [(x0, door[0] - 0.035), (door[1] + 0.035, x1)]
        for a, c in segs:
            if c - a < 0.04 or (row, a > 0) in skip:
                continue
            # deska nie jest równa: końce przesunięte, lekko przekrzywiona, czasem krótsza
            a2 = a - 0.03 + jit(row, a * 3, 0.02)
            c2 = c + 0.03 + jit(row, c * 5, 0.02)
            if (row * 7 + int(a * 10)) % 9 == 0:
                c2 -= 0.12 + abs(jit(row, 3, 0.05))   # krótsza deska: dziura na końcu
            tilt = jit(row, a + 2, 0.022)
            mat = 'wood' if (row + int(a * 4)) % 3 else 'woodDark'
            b.box('base', mat, c2 - a2, BH - abs(jit(row, 9, 0.008)), PT, (a2 + c2) / 2, y, zz + jit(row, a, 0.004), roll=tilt)
        y += BH + GAP + jit(row, 4, 0.004)
        row += 1
    # od środka ciemne deski: przez szpary nie prześwituje niebo
    backing(b, 'x', z + out * (0.035 - 0.006), x0 - 0.02, x1 + 0.02, H1, holes=[door] if door else ())
    if patch:   # łata: pionowa deska przybita na szparach, o włos przed licem
        px, ph = patch
        b.box('base', 'woodDark', 0.075, ph, PT, px, 0.08, zz + out * (PT + 0.006), roll=jit(3, px, 0.06))


def boards_z(x, out, z0, z1, skip=(), patch=None):
    """To samo dla ściany wzdłuż z w płaszczyźnie x"""
    xx = x + out * (0.035 + PT / 2)
    y, row = 0.03, 0
    while y + BH <= H1 + 0.01:
        if row not in skip:
            a2 = z0 - 0.03 + jit(row, z0 * 3 + x, 0.02)
            c2 = z1 + 0.03 + jit(row, z1 * 5 + x, 0.02)
            tilt = jit(row, x + 7, 0.025)
            mat = 'wood' if (row + int(x * 4)) % 3 else 'woodDark'
            # pudło obrócone o 90°: długość wzdłuż z
            b.box('base', mat, c2 - a2, BH - abs(jit(row, 11, 0.008)), PT, xx + jit(row, x, 0.004), y, (a2 + c2) / 2, rot=math.pi / 2, roll=tilt)
        y += BH + GAP + jit(row, 6 + x, 0.004)
        row += 1
    backing(b, 'z', x + out * (0.035 - 0.006), z0 - 0.02, z1 + 0.02, H1)
    if patch:
        pz, ph = patch
        b.box('base', 'woodDark', 0.075, ph, PT, xx + out * (PT + 0.006), 0.08, pz, rot=math.pi / 2, roll=jit(5, pz, 0.06))


boards_x(Z1, 1, X0, X1, skip={(5, False)}, patch=(-0.48, 0.42), door=DOOR)     # przód z otworem wejścia
boards_x(Z0, -1, X0, X1, skip={(2, True)}, patch=(0.32, 0.5))                   # tył: jednej deski brak
boards_z(X0, -1, Z0, Z1, skip={4}, patch=(0.08, 0.38))
boards_z(X1, 1, Z0, Z1, patch=(-0.12, 0.46))
# belka nad wejściem i próg z płaskiego kamienia
b.box('base', 'woodDark', DOOR[1] - DOOR[0] + 0.14, 0.05, 0.06, DM, DOOR[2], Z1 + 0.035)
b.box('base', 'rockDark', DOOR[1] - DOOR[0] + 0.02, 0.022, 0.12, DM, 0.0, Z1 + 0.1)
# skóra zamiast drzwi: zwinięta w rulon pod belką i przewiązana sznurami (przejście wolne)
door_hide(b, DOOR[0], DOOR[1], DOOR[2], Z1 + 0.075)

# ---------------- dach: deski z kalenicy na okap, szczeliny, ciemny podbitek pod spodem ----------------
OV = 0.1
zm = (Z0 + Z1) / 2
mid = (0.0, H1 + RISE * 0.3, zm)
# podbitek: pełna płyta o 3 cm pod deskami (przez szczeliny widać ciemne drewno, a nie niebo)
b.slope('shell', 'woodDark', [(X0 - OV, H1 - 0.03, Z0 - OV), (X1 + OV, H1 - 0.03, Z0 - OV), (X1 + OV, H1 + RISE - 0.03, zm), (X0 - OV, H1 + RISE - 0.03, zm)], mid, t=0.015)
b.slope('shell', 'woodDark', [(X1 + OV, H1 - 0.03, Z1 + OV), (X0 - OV, H1 - 0.03, Z1 + OV), (X0 - OV, H1 + RISE - 0.03, zm), (X1 + OV, H1 + RISE - 0.03, zm)], mid, t=0.015)
W = 0.13
n = int((X1 - X0 + 2 * OV) / (W + 0.012))
for side, ze in ((-1, Z0 - OV), (1, Z1 + OV)):
    for k in range(n):
        x = X0 - OV + (k + 0.5) * (X1 - X0 + 2 * OV) / n
        w = W - abs(jit(k, side, 0.015))
        drop = abs(jit(k, side + 3, 0.04))          # deska nie dochodzi równo do okapu
        lift = jit(k, side + 5, 0.006)              # i nie leży idealnie płasko
        ze2 = ze - side * drop
        f = (ze2 - zm) / (ze - zm)
        ye = H1 + RISE - RISE * f + lift
        pts = [(x - w / 2, ye, ze2), (x + w / 2, ye, ze2), (x + w / 2, H1 + RISE + 0.012 + lift, zm), (x - w / 2, H1 + RISE + 0.012 + lift, zm)]
        if side > 0:
            pts = [pts[1], pts[0], pts[3], pts[2]]
        b.slope('shell', 'wood' if k % 4 else 'woodDark', pts, mid, t=PT)
# deska kalenicowa i dwa kamienie przyciskające dach
ridge_cap(b, 'x', X0 - OV - 0.02, X1 + OV + 0.02, zm, H1 + RISE + 0.012, RISE, Z1 + OV - zm)
for x, z in ((-0.45, Z1 - 0.02), (0.5, Z0 + 0.05)):
    b.crystal('shell', 'rock', x, H1 + RISE * 0.55, z, 0.05, seed=x, sy=0.6)
# szczyty z desek
for sx, x in ((-1, X0), (1, X1)):
    b.gable_boards('shell', 'wood', 'z', x + sx * 0.04, Z0, Z1, H1 - 0.01, RISE, sx, t=PT, step=0.11)

# ---------------- izba ----------------
# skrzynka pod tylną ścianą (środek, między posłaniami), pieniek, garnek, kupka słomy w kącie przy drzwiach
t.boxs('interior', 'woodDark', 0.2, 0.12, 0.13, -0.02, P, Z0 + 0.13)
b.box('interior', 'iron', 0.21, 0.012, 0.02, -0.02, P + 0.09, Z0 + 0.2)
b.prism('interior', 'wood', 0.055, 0.055, 0.11, 0.06, P, 0.08, seg=9)
b.prism('interior', 'rockDark', 0.032, 0.042, 0.06, -0.08, P, 0.12, seg=9)
b.pyramid('interior', 'hay', 0.18, 0.14, 0.07, 0.42, P, Z1 - 0.12)
# w izbie chodzi się między ścianami
t.block(X0 - 0.05, X1 + 0.05, Z0 - 0.06, Z0 + 0.02)
t.block(X0 - 0.06, X0 + 0.02, Z0, Z1)
t.block(X1 - 0.02, X1 + 0.06, Z0, Z1)
t.block(X0 - 0.05, DOOR[0], Z1 - 0.02, Z1 + 0.06)
t.block(DOOR[1], X1 + 0.05, Z1 - 0.02, Z1 + 0.06)
t.open.append([X0 + 0.04, X1 - 0.04, Z0 + 0.04, Z1 - 0.04])
t.open.append([DOOR[0], DOOR[1], Z1 - 0.05, Z1 + 0.1])

# ---------------- przed budą: parę polan pod ścianą, wiadro ----------------
for k, (dx, y) in enumerate(((-0.1, 0.004), (-0.165, 0.004), (-0.133, 0.06))):
    b.box('base', 'bark', 0.058, 0.056, 0.34 + jit(k, 2, 0.03), X0 + dx, y, -0.08 + jit(k, 4, 0.02), rot=jit(k, 6, 0.05))
b.prism('base', 'woodDark', 0.05, 0.06, 0.1, -0.6, 0.0, Z1 + 0.13, seg=10)
b.prism('base', 'iron', 0.062, 0.062, 0.012, -0.6, 0.075, Z1 + 0.13, seg=10)

E = 0.4
OUT, ROOM = ['base', 'shell'], ['base', 'interior', 'floor']
VIEWS = [
    ['buda z przodu', [0.3, 0.45, 2.0], [0, 0.35, 0], OUT, 22],
    ['przez szpary z boku', [1.6, 0.35, 0.3], [0, 0.3, 0], OUT, 20],
    ['izba od wejścia', [DM, E, 0.35], [-0.4, 0.15, -0.3], ROOM, 16],
]
b.save('shack', maxe=0.24, rays=14, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': [], 'chimneys': [], 'flames': [],
    'pennant': [round(X1 + 0.06, 3), round(H1 + RISE - 0.05, 3), 0.0], 'views': VIEWS})
