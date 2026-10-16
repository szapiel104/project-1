"""Warsztat łuczarza (2×2 pola): chata z szachulca ze strzechą i kominem (szkielet: workshop.py).
W izbie: stół z łęczyskiem w obróbce, strugiem i wiórami (tu pracuje łuczarz), na tylnej ścianie gotowe łuki
na kołkach, w kącie beczka ze strzałami, kosz z lotkami, wiązka surowych kijów. Przed warsztatem: tarcza
ze słomy na kozłach, stojak z łukami do sezonowania, beczka strzał.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/fletcher.py
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
w = workshop(b, t, chimney=(0.45, None))
P, Z0, Z1, X0, X1, T = w['P'], w['Z0'], w['Z1'], w['X0'], w['X1'], w['T']


def bow(group, x, y, z, along_x=True, r=0.24, n=10, mat='woodDark', string=True):
    """Łuk: wygięte łęczysko z odcinków (z grubością) i cięciwa; łuk stoi pionowo, brzuszkiem do ściany"""
    pts = []
    for k in range(n + 1):
        a = -0.95 + 1.9 * k / n
        pts.append((math.sin(a) * r * 0.32, math.cos(a) * r - r * 0.6 + r * 0.35, a))
    for k in range(n):
        (u0, v0, a0), (u1, v1, a1) = pts[k], pts[k + 1]
        L = math.hypot(u1 - u0, v1 - v0)
        ang = math.atan2(u1 - u0, v1 - v0)
        if along_x:
            b.box(group, mat, 0.018, L + 0.004, 0.018, x + u0, y + v0, z, roll=-ang)
        else:
            b.box(group, mat, 0.018, L + 0.004, 0.018, x, y + v0, z + u0, tilt=ang)
    if string:
        (u0, v0, _), (u1, v1, _) = pts[0], pts[-1]
        if along_x:
            b.box(group, 'rope', 0.005, v0 - v1 if v0 > v1 else v1 - v0, 0.005, x + u0, y + min(v0, v1), z)
        else:
            b.box(group, 'rope', 0.005, abs(v0 - v1), 0.005, x, y + min(v0, v1), z + u0)


# ---------------- izba ----------------
# stół roboczy przed łuczarzem (stoi w (0, 0,12) twarzą do tyłu)
t.boxs('interior', 'wood', 0.62, 0.035, 0.2, -0.02, P + 0.28, -0.14)
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.04, 0.28, 0.16, -0.02 + sx * 0.26, P, -0.14)
b.box('interior', 'woodDark', 0.5, 0.025, 0.025, -0.02, P + 0.08, -0.14)
# na stole: łęczysko w obróbce, strug, wióry, nóż
b.box('interior', 'wood', 0.55, 0.022, 0.022, -0.02, P + 0.316, -0.17, rot=0.05)
b.box('interior', 'iron', 0.12, 0.012, 0.025, 0.12, P + 0.316, -0.08)
b.box('interior', 'woodDark', 0.025, 0.02, 0.06, 0.19, P + 0.316, -0.08)
b.box('interior', 'woodDark', 0.025, 0.02, 0.06, 0.05, P + 0.316, -0.08)
for k in range(6):
    b.box('interior', 'plank', 0.05, 0.004, 0.012, -0.2 + k * 0.05, P + 0.316, -0.1 + (k % 2) * 0.03, rot=k * 0.7)
b.box('interior', 'sawdust', 0.4, 0.004, 0.25, -0.02, P + 0.012, 0.02)
# gotowe łuki na kołkach na tylnej ścianie (lewa część, prawą zajmuje palenisko)
for k, x in enumerate((-0.52, -0.3, -0.08)):
    b.box('interior', 'woodDark', 0.025, 0.025, 0.06, x, P + 0.62, Z0 + T + 0.03)
    bow('interior', x, P + 0.22, Z0 + T + 0.04, along_x=True)
# beczka strzał w lewym przednim kącie i kosz z lotkami
BX, BZ = X0 + T + 0.12, Z1 - T - 0.12
b.prism('interior', 'wood', 0.09, 0.1, 0.24, BX, P, BZ, seg=10)
for y in (P + 0.05, P + 0.19):
    b.prism('interior', 'iron', 0.101, 0.101, 0.015, BX, y, BZ, seg=10, top=False)
for k in range(9):
    a = k * 2.4
    rr = 0.02 + (k % 3) * 0.022
    b.box('interior', 'plank', 0.008, 0.2, 0.008, BX + math.cos(a) * rr, P + 0.2, BZ + math.sin(a) * rr)
    b.box('interior', 'white', 0.004, 0.04, 0.016, BX + math.cos(a) * rr, P + 0.38, BZ + math.sin(a) * rr, rot=a)
t.block(BX - 0.11, BX + 0.11, BZ - 0.11, BZ + 0.11)
b.prism('interior', 'basket', 0.08, 0.1, 0.1, X0 + T + 0.12, P, -0.05, seg=10)
for k in range(5):
    b.box('interior', 'white', 0.02, 0.006, 0.05, X0 + T + 0.08 + k * 0.02, P + 0.1, -0.06 + (k % 2) * 0.03, rot=k)
# wiązka surowych kijów oparta o ścianę z prawej
for k in range(5):
    b.box('interior', 'bark', 0.02, 0.7, 0.02, X1 - T - 0.05 - k * 0.025, P, 0.1 + (k % 2) * 0.02, roll=0.18)

# ---------------- przed warsztatem: tarcza na kozłach, stojak z łukami, beczka strzał ----------------
# tarcza ze słomy (kopa) na kozłach w lewym przednim rogu, z kołami namalowanymi farbą i dwiema strzałami
TX, TZ = -0.62, 0.78
for s in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.42, 0.03, TX + s * 0.14, 0.0, TZ - 0.08, tilt=0.25)
    b.box('base', 'woodDark', 0.03, 0.42, 0.03, TX + s * 0.14, 0.0, TZ + 0.12, tilt=-0.35)
b.prism('base', 'thatch', 0.17, 0.17, 0.06, TX, 0.24, TZ, seg=16)
for rr, m in ((0.14, 'white'), (0.1, 'thatchDark'), (0.06, 'flag'), (0.025, 'white')):
    b.prism('base', m, rr, rr, 0.004, TX, 0.3, TZ, seg=16)
for k, (dx, dz) in enumerate(((0.03, 0.02), (-0.06, -0.04))):
    b.box('base', 'plank', 0.008, 0.18, 0.008, TX + dx, 0.3, TZ + dz, tilt=0.3 + k * 0.1, bottom=True)
# stojak z łukami do sezonowania pod prawą ścianą, z daszkiem
SX, SZ = 0.86, -0.05
for z in (-0.4, 0.3):
    b.box('base', 'woodDark', 0.04, 0.7, 0.04, SX, 0.0, SZ + z)
b.box('base', 'woodDark', 0.04, 0.04, 0.8, SX, 0.66, SZ - 0.05)
b.box('base', 'wood', 0.2, 0.025, 0.92, SX + 0.02, 0.72, SZ - 0.05, roll=-0.2)
for k, z in enumerate((-0.3, -0.12, 0.06, 0.22)):
    bow('base', SX, 0.2, SZ + z, along_x=False, string=k % 2 == 0, mat='wood' if k % 2 else 'woodDark')
t.block(SX - 0.05, SX + 0.05, SZ - 0.45, SZ + 0.35)
# beczka strzał przy drzwiach
b.prism('base', 'wood', 0.08, 0.09, 0.22, 0.62, 0.0, 0.6, seg=10)
for k in range(7):
    a = k * 2.2
    b.box('base', 'plank', 0.008, 0.18, 0.008, 0.62 + math.cos(a) * 0.03, 0.18, 0.6 + math.sin(a) * 0.03)
    b.box('base', 'white', 0.004, 0.035, 0.016, 0.62 + math.cos(a) * 0.03, 0.35, 0.6 + math.sin(a) * 0.03, rot=a)

E = P + 0.42
VIEWS = [
    ['warsztat z przodu', [0.2, 0.5, 2.4], [0, 0.45, 0], ['base', 'shell'], 22],
    ['izba od drzwi', [0.35, E, 0.3], [-0.2, 0.25, -0.5], ['base', 'interior', 'floor', 'ceiling'], 16],
]
b.save('fletcher', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': w['chimneys'], 'flames': w['flames'],
    'pennant': w['pennant'], 'views': VIEWS})
