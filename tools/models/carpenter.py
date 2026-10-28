"""Warsztat cieśli (2×2 pola): chata z szachulca ze strzechą i kominem (szkielet: workshop.py), tu powstają drabiny
szturmowe. W izbie: dwa kozły z drabiną w robocie (żerdzie z korą, część szczebli już wbita), piła ramowa, świder,
młotek i wióry (tu pracuje cieśla), na tylnej ścianie zapas szczebli i narzędzia na kołkach. Przed warsztatem: trzy
gotowe drabiny oparte o stojak przy froncie, sągi żerdzi pod daszkiem przy prawej ścianie, pniak z siekierą.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/carpenter.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402
from workshop import workshop  # noqa: E402
from logs import lash, log  # noqa: E402

b = Building()
t = Timber(b, T=0.08)
w = workshop(b, t, wall='plaster', chimney=(-0.45, None))
P, Z0, Z1, X0, X1, T = w['P'], w['Z0'], w['Z1'], w['X0'], w['X1'], w['T']


def ladder(group, p0, p1, width=0.2, rungs=6, r=0.016, done=None):
    """Drabina z dwóch żerdzi z korą od p0 (stopa) do p1 (szczyt), szczeble z jaśniejszego drewna przywiązane łykiem.
    `done` = ile szczebli już jest (drabina w robocie); domyślnie wszystkie."""
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    L = math.sqrt(dx * dx + dy * dy + dz * dz)
    # bok drabiny: poziomo, prostopadle do jej osi
    sx, sz = -dz, dx
    n = math.hypot(sx, sz) or 1.0
    sx, sz = sx / n * width / 2, sz / n * width / 2
    for s in (-1, 1):
        log(b, group, 'bark', (p0[0] + s * sx, p0[1], p0[2] + s * sz), (p1[0] + s * sx, p1[1], p1[2] + s * sz), r=r, r1=r * 0.85, seg=6)
    k = rungs if done is None else done
    for i in range(k):
        f = (i + 0.7) / (rungs + 0.4)
        c = (p0[0] + dx * f, p0[1] + dy * f, p0[2] + dz * f)
        log(b, group, 'wood', (c[0] - sx * 1.18, c[1], c[2] - sz * 1.18), (c[0] + sx * 1.18, c[1], c[2] + sz * 1.18), r=r * 0.7, seg=5)
        for s in (-1, 1):
            lash(b, group, (c[0] + s * sx, c[1], c[2] + s * sz), (dx / L, dy / L, dz / L), r=r + 0.006, w=0.016, seg=6)


def trestle(group, x, z, h, rot=0.0):
    """Kozioł: belka na dwóch parach rozstawionych nóg"""
    c, s = math.cos(rot), math.sin(rot)
    b.box(group, 'woodDark', 0.07, 0.05, 0.3, x, P + h - 0.05, z, rot=rot)
    for k in (-1, 1):
        ox, oz = s * k * 0.12, c * k * 0.12
        for sp in (-1, 1):
            log(b, group, 'woodDark', (x + ox + c * sp * 0.08, P, z + oz - s * sp * 0.08), (x + ox, P + h - 0.05, z + oz), r=0.014, seg=5)


# ---------------- izba: dwa kozły z drabiną w robocie (cieśla stoi w (0, 0,12) twarzą do tyłu) ----------------
HZ = -0.16
trestle('interior', -0.3, HZ, 0.24, rot=math.pi / 2)
trestle('interior', 0.32, HZ, 0.24, rot=math.pi / 2)
ladder('interior', (-0.45, P + 0.245, HZ), (0.48, P + 0.245, HZ), width=0.2, rungs=6, done=4)
# piła ramowa oparta o kozioł, świder i młotek na drabinie
b.box('interior', 'woodDark', 0.03, 0.32, 0.03, 0.46, P, HZ + 0.17, roll=-0.2)
b.box('interior', 'woodDark', 0.03, 0.32, 0.03, 0.2, P, HZ + 0.17, roll=-0.2)
b.box('interior', 'woodDark', 0.28, 0.025, 0.025, 0.36, P + 0.29, HZ + 0.17)
b.box('interior', 'iron', 0.27, 0.035, 0.004, 0.3, P + 0.04, HZ + 0.17, roll=-0.2)
b.box('interior', 'woodDark', 0.16, 0.02, 0.02, 0.05, P + 0.275, HZ + 0.04)                 # świder
b.box('interior', 'iron', 0.012, 0.012, 0.09, 0.12, P + 0.268, HZ + 0.04)
b.box('interior', 'woodDark', 0.13, 0.016, 0.016, -0.12, P + 0.275, HZ - 0.05, rot=0.4)     # młotek
b.box('interior', 'iron', 0.04, 0.035, 0.03, -0.06, P + 0.27, HZ - 0.03, rot=0.4)
# wióry i ścinki pod kozłami
b.box('interior', 'sawdust', 0.6, 0.004, 0.36, 0.0, P + 0.012, HZ + 0.06)
for k in range(8):
    b.box('interior', 'plank', 0.07, 0.006, 0.014, -0.26 + k * 0.075, P + 0.016, HZ + 0.02 + (k % 3) * 0.06, rot=k * 0.8)
# zapas szczebli na tylnej ścianie (półka) i narzędzia na kołkach
b.box('interior', 'woodDark', 0.6, 0.03, 0.1, 0.25, P + 0.4, Z0 + T + 0.05)
for k in range(9):
    log(b, 'interior', 'wood', (0.0 + k * 0.006, P + 0.43 + (k % 3) * 0.022, Z0 + T + 0.02 + (k // 3) * 0.028), (0.5 + k * 0.006, P + 0.43 + (k % 3) * 0.022, Z0 + T + 0.02 + (k // 3) * 0.028), r=0.009, seg=5)
for x in (0.0, 0.25, 0.5):
    b.box('interior', 'woodDark', 0.025, 0.025, 0.06, x, P + 0.6, Z0 + T + 0.03)
b.box('interior', 'iron', 0.1, 0.07, 0.008, 0.25, P + 0.53, Z0 + T + 0.05)                   # siekiera ciesielska
b.box('interior', 'woodDark', 0.02, 0.2, 0.02, 0.27, P + 0.42, Z0 + T + 0.05)

# ---------------- przed warsztatem: gotowe drabiny oparte o stojak, sągi żerdzi, pniak z siekierą ----------------
RX0, RX1, RZ = -0.84, -0.26, 0.86
for x in (RX0, RX1):
    b.box('base', 'woodDark', 0.05, 0.7, 0.05, x, 0.0, RZ)
b.box('base', 'woodDark', RX1 - RX0 + 0.08, 0.05, 0.06, (RX0 + RX1) / 2, 0.66, RZ)
for k in range(3):
    x = RX0 + 0.12 + k * 0.17
    ladder('base', (x, 0.0, RZ - 0.32 + k * 0.02), (x, 0.7, RZ - 0.03), width=0.13, rungs=6, r=0.013)
t.block(RX0 - 0.04, RX1 + 0.04, RZ - 0.36, RZ + 0.05)
# żerdzie pod daszkiem przy prawej ścianie
SX = X1 + 0.13
for z in (Z0 + 0.05, Z1 - 0.05):
    b.box('base', 'woodDark', 0.04, 0.55, 0.04, SX + 0.08, 0.0, z)
b.box('base', 'wood', 0.24, 0.025, Z1 - Z0 + 0.14, SX + 0.02, 0.56, (Z0 + Z1) / 2, roll=-0.25)
for row in range(3):
    for k in range(4 - row):
        x = SX - 0.06 + k * 0.045 + row * 0.022
        y = 0.03 + row * 0.04
        log(b, 'base', 'bark', (x, y, Z0 + 0.02), (x, y, Z1 - 0.02), r=0.018, seg=6)
t.block(SX - 0.1, SX + 0.12, Z0, Z1)
# pniak z siekierą przy drzwiach
b.prism('base', 'bark', 0.09, 0.08, 0.16, 0.66, 0.0, 0.66, seg=8)
b.prism('base', 'wood', 0.08, 0.08, 0.004, 0.66, 0.16, 0.66, seg=8)
b.box('base', 'woodDark', 0.025, 0.24, 0.025, 0.68, 0.15, 0.66, roll=-0.5)
b.box('base', 'iron', 0.08, 0.06, 0.02, 0.64, 0.16, 0.66, roll=-0.5)

E = P + 0.42
VIEWS = [
    ['warsztat z przodu', [0.2, 0.5, 2.4], [0, 0.45, 0], ['base', 'shell'], 22],
    ['izba od drzwi', [0.35, E, 0.3], [-0.2, 0.25, -0.5], ['base', 'interior', 'floor', 'ceiling'], 16],
    ['drabiny przy stojaku', [-0.5, 0.5, 1.8], [-0.55, 0.35, 0.7], ['base', 'shell'], 20],
]
b.save('carpenter', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': w['chimneys'], 'flames': w['flames'],
    'pennant': w['pennant'], 'views': VIEWS})
