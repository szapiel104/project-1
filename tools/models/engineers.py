"""Cech inżynierów (2×2 pola): warsztat z szachulca ze strzechą i kominem (szkielet: workshop.py).
W izbie: duży stół kreślarski z rozpiętym planem, cyrklem i węgielkiem, na półce drewniany model trebusza,
skrzynia z narzędziami, belki i deski pod ścianą, zwoje planów w koszu.

Obejście: z lewej dźwig na kozłach z wysięgnikiem, krążkiem i ciosanym blokiem w linowym oplocie, pod nim taczka
z kamieniami. Z prawej sprzęt do gaszenia pożarów (stąd inżynierowie biorą wodę): beczkowóz z wodą na dwóch kołach,
stojak z wiadrami, bosak i drabina pod ścianą.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/engineers.py
Układ: środek działki = (0, 0), działka ±1, przód (drzwi) = +z. Drzwi z przodu po prawej (x 0,2–0,5).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import lash, log  # noqa: E402
from timber import Timber  # noqa: E402
from workshop import workshop  # noqa: E402

b = Building()
t = Timber(b, T=0.08)
w = workshop(b, t, chimney=(-0.45, None))
P, Z0, Z1, X0, X1, T = w['P'], w['Z0'], w['Z1'], w['X0'], w['X1'], w['T']

# ---------------- izba ----------------
# stół kreślarski przed inżynierem (stoi w (0, 0,12) twarzą do tyłu), blat lekko pochylony
DX, DZ = 0.0, -0.16
t.boxs('interior', 'wood', 0.66, 0.035, 0.28, DX, P + 0.28, DZ, tilt=-0.12)
for sx in (-1, 1):
    for sz in (-1, 1):
        b.box('interior', 'woodDark', 0.035, 0.28 + (0.03 if sz < 0 else 0), 0.035, DX + sx * 0.29, P, DZ + sz * 0.1)
b.box('interior', 'woodDark', 0.56, 0.025, 0.025, DX, P + 0.08, DZ)
# plan na blacie (dwie warstwy papieru), przyciśnięty kamieniem, cyrkiel i węgielek
b.box('interior', 'white', 0.42, 0.006, 0.2, DX - 0.04, P + 0.322, DZ + 0.005, tilt=-0.12)
b.box('interior', 'cut', 0.05, 0.03, 0.04, DX + 0.15, P + 0.325, DZ + 0.06, tilt=-0.12)
for a in (-0.25, 0.25):
    b.box('interior', 'iron', 0.006, 0.006, 0.11, DX + 0.05 + a * 0.08, P + 0.33, DZ - 0.02, rot=a, tilt=-0.12)
b.box('interior', 'dark', 0.04, 0.012, 0.012, DX - 0.2, P + 0.33, DZ + 0.06, rot=0.4)
# zwoje planów w koszu przy stole
KX, KZ = X1 - T - 0.13, -0.05
b.prism('interior', 'basket', 0.07, 0.085, 0.14, KX, P, KZ, seg=10)
for k in range(5):
    a = k * 2.1
    log(b, 'interior', 'white', (KX + math.cos(a) * 0.03, P + 0.04, KZ + math.sin(a) * 0.03),
        (KX + math.cos(a) * 0.04, P + 0.26 + 0.03 * (k % 2), KZ + math.sin(a) * 0.04), r=0.014, seg=6, ends='white')
t.block(KX - 0.09, KX + 0.09, KZ - 0.09, KZ + 0.09)
# półka na tylnej ścianie z modelem trebusza (prawa część; lewą zajmuje palenisko)
SX, SY, SZ = 0.25, P + 0.5, Z0 + T + 0.07
b.box('interior', 'woodDark', 0.5, 0.025, 0.12, SX, SY, SZ)
for x in (SX - 0.2, SX + 0.2):
    b.box('interior', 'woodDark', 0.025, 0.07, 0.1, x, SY - 0.07, SZ)
# model: podstawa, dwie kozły, ramię z przeciwwagą
b.box('interior', 'wood', 0.2, 0.018, 0.08, SX, SY + 0.025, SZ)
for dz in (-0.03, 0.03):
    log(b, 'interior', 'wood', (SX - 0.06, SY + 0.043, SZ + dz), (SX, SY + 0.15, SZ + dz), r=0.006, seg=4)
    log(b, 'interior', 'wood', (SX + 0.06, SY + 0.043, SZ + dz), (SX, SY + 0.15, SZ + dz), r=0.006, seg=4)
log(b, 'interior', 'woodDark', (SX - 0.12, SY + 0.21, SZ), (SX + 0.07, SY + 0.11, SZ), r=0.006, seg=4)
b.box('interior', 'iron', 0.035, 0.03, 0.035, SX + 0.07, SY + 0.07, SZ)
# skrzynia z narzędziami w lewym przednim kącie (uchylone wieko, w środku młotki i dłuta)
CX, CZ = X0 + T + 0.17, Z1 - T - 0.12
b.box('interior', 'woodDark', 0.3, 0.15, 0.17, CX, P, CZ)
b.box('interior', 'dark', 0.26, 0.004, 0.13, CX, P + 0.146, CZ)
b.box('interior', 'woodDark', 0.3, 0.022, 0.17, CX, P + 0.15, CZ - 0.085, tilt=-1.1)
for k in range(3):
    b.box('interior', 'iron', 0.035, 0.03, 0.02, CX - 0.08 + k * 0.08, P + 0.15, CZ + 0.02)
    b.box('interior', 'wood', 0.012, 0.012, 0.09, CX - 0.08 + k * 0.08, P + 0.155, CZ - 0.02)
for x in (CX - 0.12, CX + 0.12):
    b.box('interior', 'iron', 0.02, 0.16, 0.008, x, P - 0.005, CZ + 0.088)
t.block(CX - 0.16, CX + 0.16, CZ - 0.1, CZ + 0.1)
# belki i deski oparte o lewą ścianę
for k in range(4):
    b.box('interior', 'plank' if k % 2 else 'wood', 0.04, 0.62 - k * 0.03, 0.06, X0 + T + 0.05 + k * 0.012, P, -0.28 + k * 0.075, roll=-0.12)

# ---------------- dźwig na kozłach z blokiem (lewa strona obejścia) ----------------
GX, GZ = -0.62, 0.74
TOPY = 1.28
for sz in (-1, 1):
    log(b, 'base', 'bark', (GX - 0.05, 0.0, GZ + sz * 0.24), (GX, TOPY, GZ), r=0.035, r1=0.03, seg=7)
    b.prism('base', 'stoneDark', 0.055, 0.045, 0.04, GX - 0.05, 0.0, GZ + sz * 0.24, seg=6, phase=sz)
# zastrzał do tyłu i poprzeczka z oplotami
log(b, 'base', 'woodDark', (GX - 0.32, 0.0, GZ), (GX - 0.01, TOPY - 0.05, GZ), r=0.028, seg=6)
log(b, 'base', 'woodDark', (GX - 0.035, 0.45, GZ - 0.16), (GX - 0.035, 0.45, GZ + 0.16), r=0.022, seg=6)
lash(b, 'base', (GX, TOPY - 0.03, GZ), (0, 1, 0), r=0.06, w=0.05)
# wysięgnik: ukośny bal z krążkiem na końcu, lina do bloku i kołowrót przy nogach
BX1, BY1 = GX + 0.72, TOPY + 0.16
log(b, 'base', 'woodDark', (GX - 0.12, TOPY - 0.04, GZ), (BX1, BY1, GZ), r=0.032, r1=0.026, seg=7)
log(b, 'base', 'wood', (BX1, BY1 - 0.03, GZ - 0.025), (BX1, BY1 - 0.03, GZ + 0.025), r=0.05, seg=10)
log(b, 'base', 'rope', (BX1 + 0.04, BY1 - 0.04, GZ), (BX1 + 0.04, 0.62, GZ), r=0.007, seg=5, ends='rope')
log(b, 'base', 'rope', (BX1 - 0.04, BY1 - 0.02, GZ), (GX + 0.06, 0.38, GZ), r=0.007, seg=5, ends='rope')
log(b, 'base', 'wood', (GX + 0.05, 0.36, GZ - 0.18), (GX + 0.05, 0.36, GZ + 0.18), r=0.035, seg=8)
for sz in (-1, 1):
    log(b, 'base', 'woodDark', (GX + 0.05, 0.36, GZ + sz * 0.19), (GX + 0.05, 0.47, GZ + sz * 0.19), r=0.012, seg=5)
# ciosany blok w linowym oplocie, podwieszony nad taczką
KY = 0.4
b.box('base', 'cut', 0.24, 0.18, 0.2, BX1 + 0.04, KY, GZ)
for d in (-1, 1):
    log(b, 'base', 'rope', (BX1 + 0.04 + d * 0.125, KY + 0.005, GZ), (BX1 + 0.04 + d * 0.125, KY + 0.185, GZ), r=0.008, seg=5, ends='rope')
    log(b, 'base', 'rope', (BX1 + 0.04 + d * 0.125, KY + 0.185, GZ), (BX1 + 0.04, 0.62, GZ), r=0.007, seg=5, ends='rope')
b.box('base', 'rope', 0.26, 0.012, 0.215, BX1 + 0.04, KY + 0.1, GZ)
# hak
b.box('base', 'iron', 0.02, 0.04, 0.02, BX1 + 0.04, 0.6, GZ)
t.block(GX - 0.34, GX + 0.08, GZ - 0.28, GZ + 0.28)

# ---------------- taczka z kamieniami pod dźwigiem ----------------
WX, WZ, WR = -0.1, 0.78, 0.35
c, s = math.cos(WR), math.sin(WR)


def at(lx, lz):
    return (WX + lx * c + lz * s, WZ - lx * s + lz * c)


bx, bz = at(0, 0)
b.box('base', 'wood', 0.3, 0.09, 0.22, bx, 0.13, bz, rot=WR)
b.box('base', 'dark', 0.26, 0.004, 0.18, bx, 0.217, bz, rot=WR)
wx, wz = at(0.21, 0)
b.wheel('base', wx, 0.08, wz, 0.075, t=0.03, rot=WR + math.pi / 2, seg=10)
for sz in (-1, 1):
    h0, h1 = at(0.15, sz * 0.12), at(-0.32, sz * 0.13)
    log(b, 'base', 'woodDark', (h0[0], 0.13, h0[1]), (h1[0], 0.2, h1[1]), r=0.013, seg=5)
    lx, lz = at(-0.1, sz * 0.1)
    b.box('base', 'woodDark', 0.025, 0.13, 0.025, lx, 0.0, lz, rot=WR)
for (lx, lz, r) in ((-0.06, -0.04, 0.05), (0.06, 0.03, 0.045), (0.0, 0.06, 0.04), (-0.05, 0.06, 0.038)):
    px, pz = at(lx, lz)
    b.crystal('base', 'rock', px, 0.25, pz, r, seed=lx * 9 + lz, sy=0.75)

# ---------------- sprzęt przeciwpożarowy (prawa strona) ----------------
# beczkowóz: beczka leżąca na ramie, dwa koła, dyszel
FX, FZ = 0.76, 0.74
b.box('base', 'woodDark', 0.07, 0.04, 0.5, FX - 0.1, 0.16, FZ)
b.box('base', 'woodDark', 0.07, 0.04, 0.5, FX + 0.1, 0.16, FZ)
for sx in (-1, 1):
    b.wheel('base', FX + sx * 0.17, 0.12, FZ, 0.12, t=0.035, rot=0.0, seg=12)
log(b, 'base', 'iron', (FX - 0.2, 0.12, FZ), (FX + 0.2, 0.12, FZ), r=0.015, seg=6, ends='iron')
# beczka: klepki z obręczami, oś wzdłuż z
log(b, 'base', 'wood', (FX, 0.3, FZ - 0.2), (FX, 0.3, FZ + 0.2), r=0.13, seg=12, ends='woodDark')
for z in (FZ - 0.15, FZ, FZ + 0.15):
    log(b, 'base', 'iron', (FX, 0.3, z - 0.012), (FX, 0.3, z + 0.012), r=0.137 if abs(z - FZ) > 0.01 else 0.14, seg=12, ends='iron')
b.prism('base', 'woodDark', 0.025, 0.025, 0.04, FX, 0.43, FZ, seg=6)
# dyszel do przodu (żeby beczkowóz było widać od drogi)
log(b, 'base', 'woodDark', (FX, 0.17, FZ + 0.25), (FX - 0.02, 0.06, FZ + 0.25 + 0.22 * 0.9), r=0.02, seg=5)
t.block(FX - 0.22, FX + 0.22, FZ - 0.26, FZ + 0.26)
# stojak z wiadrami pod prawą ścianą warsztatu
RX = X1 + 0.13
for z in (-0.5, 0.25):
    log(b, 'base', 'woodDark', (RX, 0.0, z), (RX, 0.62, z), r=0.022, seg=6)
log(b, 'base', 'woodDark', (RX, 0.55, -0.55), (RX, 0.55, 0.3), r=0.018, seg=6)


def bucket(x, y, z, r=0.055, h=0.09):
    b.prism('base', 'wood', r * 0.8, r, h, x, y, z, seg=9, top=False)
    b.prism('base', 'dark', r * 0.85, r * 0.85, 0.004, x, y + h - 0.02, z, seg=9)
    b.prism('base', 'wood', r + 0.004, r + 0.004, 0.01, x, y + h - 0.01, z, seg=9)
    b.prism('base', 'iron', r * 0.86 + 0.006, r * 0.9 + 0.006, 0.012, x, y + 0.015, z, seg=9, top=False)


for k, z in enumerate((-0.42, -0.24, -0.06, 0.12)):
    log(b, 'base', 'rope', (RX, 0.55, z), (RX, 0.43, z), r=0.005, seg=4, ends='rope')
    bucket(RX, 0.33, z)
bucket(RX + 0.04, 0.0, 0.33)
t.block(RX - 0.06, RX + 0.06, -0.55, 0.36)
# bosak i drabina oparte o tylną ścianę
log(b, 'base', 'bark', (0.42, 0.0, Z0 - 0.12), (0.5, 1.02, Z0 - 0.015), r=0.016, seg=5)
b.box('base', 'iron', 0.08, 0.02, 0.015, 0.5, 1.0, Z0 - 0.02)
b.box('base', 'iron', 0.015, 0.07, 0.015, 0.535, 0.96, Z0 - 0.02)
for sx in (-1, 1):
    log(b, 'base', 'wood', (-0.05 + sx * 0.12, 0.0, Z0 - 0.22), (-0.05 + sx * 0.12, 0.92, Z0 - 0.025), r=0.017, seg=5)
for k in range(5):
    f = (k + 0.7) / 5.6
    log(b, 'base', 'wood', (-0.17, 0.92 * f, Z0 - 0.22 + 0.195 * f), (0.07, 0.92 * f, Z0 - 0.22 + 0.195 * f), r=0.011, seg=5)

E = P + 0.42
VIEWS = [
    ['cech z przodu', [0.2, 0.5, 2.4], [0, 0.45, 0], ['base', 'shell'], 22],
    ['izba od drzwi', [0.35, E, 0.3], [-0.1, 0.25, -0.5], ['base', 'interior', 'floor', 'ceiling'], 16],
    ['dźwig z boku', [-1.6, 0.5, 1.3], [GX + 0.2, 0.7, GZ], ['base', 'shell'], 22],
    ['beczkowóz', [1.6, 0.4, 1.4], [FX, 0.3, FZ - 0.2], ['base', 'shell'], 22],
]
b.save('engineers', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': w['chimneys'], 'flames': w['flames'],
    'pennant': w['pennant'], 'views': VIEWS})
