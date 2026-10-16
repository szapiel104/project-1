"""Obozowisko (2×2 pola): lekkie miejsce dla ludzi bez pracy — ognisko w kręgu polnych kamieni (popiół, polana
w stożek, żar; płomień dokłada gra w punkcie 'flames'), dookoła sześć stołków na trzech nogach i jedna kłoda,
trójnóg z kociołkiem nad ogniem, mały stos drewna na opał. Bez dachu i ścian — sama wydeptana ziemia.

Uruchomienie (z katalogu repo):  python tools/models/camp.py  →  src/render/models/camp.json
Układ: środek działki = (0, 0), ognisko w środku, 1 = jedno pole, przód = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
F = 0.0                          # ziemia (teren)

# bez podstawki: wydeptaną ziemię wokół ogniska maluje gra na terenie (trawa znika, ziemia ciemnieje)

# ---------------- ognisko: kamienie, popiół, polana, żar ----------------
b.prism('base', 'ash', 0.24, 0.22, 0.02, 0, F, 0, seg=12)
for k in range(10):
    a = k / 10 * 2 * math.pi + 0.2
    r = 0.3
    s = 0.075 + (k % 3) * 0.012
    x, z = math.cos(a) * r, math.sin(a) * r
    b.prism('base', 'rock' if k % 2 else 'rockDark', s, s * 0.6, s * 0.9, x, F - 0.01, z, seg=6, phase=k)
for k in range(5):   # polana ułożone w stożek, oparte o siebie nad środkiem
    a = k / 5 * 2 * math.pi
    b.box('base', 'bark', 0.05, 0.3, 0.05, math.cos(a) * 0.13, F + 0.01, math.sin(a) * 0.13, -a + math.pi / 2, tilt=-0.6)
b.prism('base', 'ember', 0.12, 0.08, 0.035, 0, F + 0.02, 0, seg=10)

# ---------------- trójnóg z kociołkiem ----------------
for k in range(3):
    a = k * 2 * math.pi / 3 + 0.5
    b.box('base', 'woodDark', 0.025, 0.76, 0.025, math.cos(a) * 0.3, F, math.sin(a) * 0.3, -a + math.pi / 2, tilt=-0.36)
b.box('base', 'iron', 0.008, 0.2, 0.008, 0, 0.5, 0)
b.prism('base', 'iron', 0.07, 0.1, 0.06, 0, 0.36, 0, seg=10, top=False)
b.prism('base', 'iron', 0.1, 0.085, 0.05, 0, 0.42, 0, seg=10)
b.prism('base', 'dark', 0.08, 0.08, 0.004, 0, 0.47, 0, seg=10)

# ---------------- stołki na trzech nogach i kłoda ----------------
SEATS = []
for k in range(6):
    a = k / 6 * 2 * math.pi + 0.3
    if k == 3:
        continue                 # tu leży kłoda
    x, z = math.cos(a) * 0.62, math.sin(a) * 0.62
    H = 0.17
    b.prism('base', 'wood', 0.08, 0.08, 0.03, x, H, z, seg=10)
    for j in range(3):
        la = j * 2 * math.pi / 3 + a
        b.box('base', 'woodDark', 0.022, H + 0.005, 0.022, x + math.cos(la) * 0.05, F - 0.005, z + math.sin(la) * 0.05, -la, tilt=0.18)
    SEATS.append([round(x, 3), round(z, 3), round(math.atan2(-x, -z), 3)])
# kłoda do siedzenia (walec wzdłuż stycznej do kręgu)
a = 3 / 6 * 2 * math.pi + 0.3
lx, lz = math.cos(a) * 0.62, math.sin(a) * 0.62
tx, tz = -math.sin(a), math.cos(a)
R, L = 0.08, 0.5
for k in range(10):
    a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
    def P(u, ang):
        nx, nz = math.cos(a), math.sin(a)
        return (lx + tx * u + nx * math.cos(ang) * R, F + R + math.sin(ang) * R, lz + tz * u + nz * math.cos(ang) * R)
    b.poly('base', 'bark', [P(-L / 2, a0), P(L / 2, a0), P(L / 2, a1), P(-L / 2, a1)], away=(lx, F + R, lz))
for u in (-L / 2, L / 2):
    nx, nz = math.cos(a), math.sin(a)
    ring = [(lx + tx * u + nx * math.cos(2 * math.pi * k / 10) * R, F + R + math.sin(2 * math.pi * k / 10) * R, lz + tz * u + nz * math.cos(2 * math.pi * k / 10) * R) for k in range(10)]
    b.poly('base', 'wood', ring, away=(lx - tx * u * 3, F + R, lz - tz * u * 3))
SEATS.append([round(lx, 3), round(lz, 3), round(math.atan2(-lx, -lz), 3)])

# ---------------- stos drewna na opał ----------------
# mały: kilka polan na dwa dni palenia, w dwóch warstwach (dolna 3, górna 2 w rowkach dolnej)
for row in range(2):
    for k in range(3 - row):
        b.box('base', 'bark', 0.26, 0.07, 0.07, 0.74, F + row * 0.065, -0.6 + k * 0.08 + row * 0.04, 0.6)

VIEWS = [['obozowisko', [0.6, 0.9, 2.0], [0, 0.2, 0], ['base'], 26]]
b.save('camp', maxe=0.25, rays=12, reach=0.3, extra={
    'windows': [], 'chimneys': [], 'flames': [[0.0, round(F + 0.03, 3), 0.0]], 'seats': SEATS, 'views': VIEWS})
