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
from logs import lash, log  # noqa: E402

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
# trzy okrągłe żerdzie z korą zbiegają się nad ogniem, krzyżują w jednym punkcie (przewiązane liną) i wystają
# kawałek ponad wiązanie; z wiązania zwisa łańcuch na hak, na nim kociołek z kabłąkiem. Kociołek wisi wysoko,
# nad płomieniem, który rysuje gra (sięga ok. 0,45 nad ziemię: liże dno) — wcześniej płomień przechodził przez kociołek.
APEX = (0.0, 0.84, 0.0)
for k in range(3):
    a = k * 2 * math.pi / 3 + 0.5
    foot = (math.cos(a) * 0.34, F - 0.01, math.sin(a) * 0.34)
    # przedłużenie za wiązanie: ta sama prosta, 12 cm dalej
    d = [APEX[i] - foot[i] for i in range(3)]
    L = math.sqrt(sum(v * v for v in d))
    top = tuple(APEX[i] + d[i] / L * 0.12 for i in range(3))
    log(b, 'base', 'bark', foot, top, r=0.016, r1=0.012, seg=6, ends='wood', twist=k)
lash(b, 'base', (APEX[0], APEX[1] + 0.005, APEX[2]), (0, 1, 0), r=0.03, w=0.04, seg=8)
# łańcuch: ogniwa na przemian w dwóch płaszczyznach (każde z grubością)
CH0, CH1 = APEX[1] - 0.02, 0.645
n = 7
for k in range(n):
    y = CH0 - (CH0 - CH1) * (k + 0.5) / n
    h = (CH0 - CH1) / n * 1.15
    if k % 2:
        b.box('base', 'iron', 0.022, h, 0.006, 0, y - h / 2, 0)
    else:
        b.box('base', 'iron', 0.006, h, 0.022, 0, y - h / 2, 0)
# hak i kabłąk kociołka (pałąk z grubością w łuku nad kociołkiem)
b.box('base', 'iron', 0.008, 0.03, 0.008, 0, CH1 - 0.03, 0)
POT = 0.47                     # dno kociołka
RIM = POT + 0.12
for k in range(7):
    a0, a1 = math.pi * k / 7, math.pi * (k + 1) / 7
    p0 = (math.cos(a0) * 0.1, RIM + math.sin(a0) * 0.055, 0.0)
    p1 = (math.cos(a1) * 0.1, RIM + math.sin(a1) * 0.055, 0.0)
    log(b, 'base', 'iron', p0, p1, r=0.005, seg=5, ends='iron')
# kociołek: brzuchaty, okopcony od spodu, z wodą pod krawędzią; uszy kabłąka po bokach
b.prism('base', 'dark', 0.06, 0.095, 0.05, 0, POT, 0, seg=12)
b.prism('base', 'iron', 0.095, 0.1, 0.07, 0, POT + 0.05, 0, seg=12)
b.prism('base', 'iron', 0.1, 0.104, 0.012, 0, RIM - 0.004, 0, seg=12, top=False)
b.prism('base', 'water', 0.088, 0.088, 0.004, 0, RIM - 0.016, 0, seg=12)
for sx in (-1, 1):
    b.box('base', 'iron', 0.012, 0.024, 0.016, sx * 0.104, RIM - 0.022, 0)

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
