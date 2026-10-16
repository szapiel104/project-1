"""Warsztat włóczniarza (2×2 pola): chata z szachulca ze strzechą i kominem (szkielet: workshop.py).
W izbie: kozioł do strugania (ława z dociskiem) z drzewcem w obróbce i wiórami (tu pracuje włóczniarz), na tylnej
ścianie drzewca na wieszakach, kosz z grotami, mała kowadło-podstawka do osadzania grotów. Przed warsztatem: stojak
z gotowymi włóczniami, wiązka surowych drzewc pod wiatką, pniak z toporkiem.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/poleturner.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from timber import Timber  # noqa: E402
from workshop import workshop  # noqa: E402

b = Building()
t = Timber(b, T=0.08)
w = workshop(b, t, wall='plaster', chimney=(-0.45, None))
P, Z0, Z1, X0, X1, T = w['P'], w['Z0'], w['Z1'], w['X0'], w['X1'], w['T']


def spear(group, x, y, z, L=0.95, lean=0.0, rot_axis='z'):
    """Włócznia stojąca: drzewce i żelazny grot (czworokątny), pochylona o `lean` wokół osi x albo z"""
    if rot_axis == 'z':
        b.box(group, 'wood', 0.022, L, 0.022, x, y, z, roll=lean)
        tx, ty = x - math.sin(lean) * L, y + math.cos(lean) * L
        b.pyramid(group, 'iron', 0.035, 0.035, 0.11, tx, ty, z)
        b.box(group, 'rope', 0.03, 0.03, 0.03, tx + math.sin(lean) * 0.03, ty - 0.03, z)
    else:
        b.box(group, 'wood', 0.022, L, 0.022, x, y, z, tilt=lean)
        tz, ty = z + math.sin(lean) * L, y + math.cos(lean) * L
        b.pyramid(group, 'iron', 0.035, 0.035, 0.11, x, ty, tz)
        b.box(group, 'rope', 0.03, 0.03, 0.03, x, ty - 0.03, tz - math.sin(lean) * 0.03)


# ---------------- izba: kozioł do strugania przed włóczniarzem (stoi w (0, 0,12) twarzą do tyłu) ----------------
HZ = -0.16
t.boxs('interior', 'wood', 0.7, 0.05, 0.14, 0.0, P + 0.2, HZ, rot=0.0)                 # ława
for x in (-0.28, 0.28):
    for dz in (-0.05, 0.05):
        b.box('interior', 'woodDark', 0.035, 0.22, 0.035, x, P, HZ + dz * 2, tilt=dz * 3)
b.box('interior', 'woodDark', 0.16, 0.14, 0.1, 0.18, P + 0.25, HZ)                    # docisk
b.box('interior', 'woodDark', 0.035, 0.035, 0.2, 0.18, P + 0.13, HZ + 0.09)
b.box('interior', 'wood', 0.9, 0.022, 0.022, 0.02, P + 0.29, HZ - 0.03, rot=0.12)     # drzewce w obróbce
b.box('interior', 'iron', 0.2, 0.012, 0.02, -0.1, P + 0.3, HZ + 0.05)                  # strug z dwoma uchwytami
for x in (-0.21, 0.01):
    b.box('interior', 'woodDark', 0.03, 0.03, 0.03, x, P + 0.3, HZ + 0.05)
b.box('interior', 'sawdust', 0.5, 0.004, 0.32, 0.0, P + 0.012, 0.0)
for k in range(7):
    b.box('interior', 'plank', 0.06, 0.004, 0.012, -0.22 + k * 0.07, P + 0.016, -0.02 + (k % 3) * 0.05, rot=k * 0.9)
# drzewca na wieszakach na tylnej ścianie (prawa część; lewą zajmuje palenisko)
for y in (P + 0.32, P + 0.56):
    for x in (-0.05, 0.55):
        b.box('interior', 'woodDark', 0.03, 0.03, 0.08, x, y, Z0 + T + 0.04)
for k in range(4):
    b.box('interior', 'wood', 0.75, 0.02, 0.02, 0.25, P + 0.35 + (k // 2) * 0.24 + 0.03, Z0 + T + 0.05 + (k % 2) * 0.025)
# kosz z grotami i podstawka do osadzania grotów przy prawej ścianie
b.prism('interior', 'basket', 0.08, 0.1, 0.1, X1 - T - 0.13, P, 0.12, seg=10)
for k in range(5):
    b.pyramid('interior', 'iron', 0.03, 0.03, 0.07, X1 - T - 0.15 + (k % 3) * 0.03, P + 0.1, 0.1 + (k // 3) * 0.04)
t.boxs('interior', 'bark', 0.16, 0.2, 0.16, X1 - T - 0.13, P, -0.2)
b.box('interior', 'iron', 0.14, 0.04, 0.07, X1 - T - 0.13, P + 0.2, -0.2)
b.box('interior', 'woodDark', 0.02, 0.02, 0.16, X1 - T - 0.08, P + 0.24, -0.18, rot=0.5)

# ---------------- przed warsztatem: stojak z gotowymi włóczniami, wiązka drzewc, pniak ----------------
# stojak (dwie belki z wycięciami) pod lewą częścią frontu
RX0, RX1, RZ = -0.82, -0.28, 0.84
for x in (RX0, RX1):
    b.box('base', 'woodDark', 0.05, 0.55, 0.05, x, 0.0, RZ)
b.box('base', 'woodDark', RX1 - RX0 + 0.08, 0.05, 0.06, (RX0 + RX1) / 2, 0.51, RZ)
b.box('base', 'woodDark', RX1 - RX0 + 0.08, 0.04, 0.12, (RX0 + RX1) / 2, 0.02, RZ - 0.06)
for k in range(5):
    spear('base', RX0 + 0.06 + k * (RX1 - RX0 - 0.12) / 4, 0.03, RZ - 0.09, L=0.85, lean=0.08, rot_axis='x')
t.block(RX0 - 0.04, RX1 + 0.04, RZ - 0.15, RZ + 0.05)
# wiązka surowych drzewc pod daszkiem przy prawej ścianie
SX = X1 + 0.13
for z in (Z0 + 0.05, Z1 - 0.05):
    b.box('base', 'woodDark', 0.04, 0.55, 0.04, SX + 0.08, 0.0, z)
b.box('base', 'wood', 0.24, 0.025, Z1 - Z0 + 0.14, SX + 0.02, 0.56, (Z0 + Z1) / 2, roll=-0.25)
for row in range(3):
    for k in range(4 - row):
        z0 = Z0 + 0.05
        x = SX - 0.06 + k * 0.045 + row * 0.022
        y = 0.03 + row * 0.04
        b.box('base', 'bark', 0.03, 0.03, Z1 - Z0 - 0.04, x, y, (Z0 + Z1) / 2, bottom=True)
t.block(SX - 0.1, SX + 0.12, Z0, Z1)
# pniak z toporkiem przy drzwiach
b.prism('base', 'bark', 0.09, 0.08, 0.16, 0.66, 0.0, 0.66, seg=8)
b.prism('base', 'wood', 0.08, 0.08, 0.004, 0.66, 0.16, 0.66, seg=8)
b.box('base', 'woodDark', 0.025, 0.24, 0.025, 0.68, 0.15, 0.66, roll=-0.5)
b.box('base', 'iron', 0.08, 0.06, 0.02, 0.64, 0.16, 0.66, roll=-0.5)

E = P + 0.42
VIEWS = [
    ['warsztat z przodu', [0.2, 0.5, 2.4], [0, 0.45, 0], ['base', 'shell'], 22],
    ['izba od drzwi', [0.35, E, 0.3], [-0.2, 0.25, -0.5], ['base', 'interior', 'floor', 'ceiling'], 16],
]
b.save('poleturner', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': w['chimneys'], 'flames': w['flames'],
    'pennant': w['pennant'], 'views': VIEWS})
