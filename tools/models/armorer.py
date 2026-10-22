"""Warsztat płatnerza (2×2 pola): chata z szachulca ze strzechą i kominem po lewej (szkielet: workshop.py).
W izbie: stół z kolczugą w robocie (rzędy kółek, szczypce, kosz drutu) — tu pracuje płatnerz, na tylnej ścianie
półka z hełmami stożkowymi, w kącie kukła z gotową kolczugą, małe palenisko pod kominem do wyżarzania drutu.
Przed warsztatem: dwa stojaki z kolczugami na sprzedaż, beczka z kółkami w piasku (czyszczenie kolczug) i
kloc z bijakiem do nitowania.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/armorer.py
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
w = workshop(b, t, chimney=(-0.42, None))
P, Z0, Z1, X0, X1, T = w['P'], w['Z0'], w['Z1'], w['X0'], w['X1'], w['T']


def mail(group, x, y, z, w=0.22, h=0.3, d=0.12, rot=0.0, sleeves=True):
    """Kolczuga na kukle/stojaku: tułów, krótkie rękawy, rozszerzony dół; rzędy kółek jako ciemne pasy
    wystające 5 mm z lica (z przodu i z tyłu), na szyi skórzany kołnierz. y = dół kolczugi."""
    c, s = math.cos(rot), math.sin(rot)

    def at(lx, lz):
        return x + lx * c + lz * s, z - lx * s + lz * c

    b.box(group, 'iron', w + 0.03, 0.1, d + 0.02, x, y, z, rot)                      # dół (szerszy)
    b.box(group, 'iron', w, h - 0.09, d, x, y + 0.095, z, rot)                       # tułów
    b.box(group, 'hide', w * 0.55, 0.035, d * 0.8, x, y + h, z, rot)                 # kołnierz
    if sleeves:
        for sx in (-1, 1):
            ax, az = at(sx * (w / 2 + 0.04), 0)
            b.box(group, 'iron', 0.08, 0.13, d * 0.8, ax, y + h - 0.16, az, rot, roll=sx * 0.35)
    for k in range(5):                                                               # rzędy kółek
        yy = y + 0.03 + k * (h - 0.06) / 5
        ww = w + (0.035 if k == 0 else 0.008)
        for sz in (-1, 1):
            px, pz = at(0, sz * ((d + (0.02 if k == 0 else 0)) / 2 + 0.003))
            b.box(group, 'dark', ww, 0.008, 0.006, px, yy, pz, rot)


def helmet(group, x, y, z, rot=0.0):
    """Hełm stożkowy z nosalem: walcowy dzwon, stożek, obręcz i nosal z przodu (+z po obrocie)"""
    b.prism(group, 'iron', 0.055, 0.052, 0.045, x, y, z, seg=12)
    b.prism(group, 'iron', 0.052, 0.006, 0.06, x, y + 0.044, z, seg=12)
    b.prism(group, 'dark', 0.058, 0.058, 0.012, x, y + 0.002, z, seg=12, top=False)
    b.box(group, 'iron', 0.014, 0.05, 0.008, x + math.sin(rot) * 0.057, y - 0.03, z + math.cos(rot) * 0.057, rot)


def stand(group, x, z, rot=0.0):
    """Kukła na kolczugę: słup na krzyżaku z deski, poprzeczka na barki i głowa z kloca"""
    c, s = math.cos(rot), math.sin(rot)
    b.box(group, 'woodDark', 0.24, 0.03, 0.04, x, 0.0, z, rot)
    b.box(group, 'woodDark', 0.04, 0.03, 0.24, x, 0.0, z, rot)
    b.box(group, 'wood', 0.035, 0.62, 0.035, x, 0.025, z, rot)
    b.box(group, 'woodDark', 0.26, 0.03, 0.035, x, 0.5, z, rot)
    b.prism(group, 'wood', 0.04, 0.04, 0.08, x, 0.6, z, seg=8)
    del c, s


# ---------------- izba ----------------
# stół płatnerza przed nim (płatnerz stoi w (0, 0,12) twarzą do tyłu): kolczuga rozłożona płasko, rzędy kółek
t.boxs('interior', 'wood', 0.64, 0.035, 0.22, 0.04, P + 0.28, -0.15)
for sx in (-1, 1):
    b.box('interior', 'woodDark', 0.04, 0.28, 0.18, 0.04 + sx * 0.27, P, -0.15)
b.box('interior', 'woodDark', 0.52, 0.025, 0.025, 0.04, P + 0.08, -0.15)
b.box('interior', 'iron', 0.3, 0.01, 0.16, -0.02, P + 0.312, -0.16)              # kolczuga w robocie
for k in range(6):
    b.box('interior', 'dark', 0.3, 0.006, 0.008, -0.02, P + 0.32, -0.225 + k * 0.026)
b.box('interior', 'iron', 0.1, 0.01, 0.07, 0.15, P + 0.312, -0.2)                 # luźne kółka
b.prism('interior', 'iron', 0.035, 0.035, 0.02, 0.24, P + 0.312, -0.1, seg=10)    # zwój drutu
b.prism('interior', 'dark', 0.018, 0.018, 0.022, 0.24, P + 0.312, -0.1, seg=8)
for s in (-1, 1):                                                                  # szczypce
    b.box('interior', 'iron', 0.12, 0.008, 0.01, 0.14, P + 0.318, -0.08 + s * 0.006, s * 0.08)
# półka z hełmami na tylnej ścianie (prawa część; palenisko jest z lewej)
SY = P + 0.5
b.box('interior', 'woodDark', 0.5, 0.025, 0.12, 0.3, SY, Z0 + T + 0.065)
for x in (0.12, 0.48):
    b.box('interior', 'woodDark', 0.025, 0.1, 0.1, x, SY - 0.1, Z0 + T + 0.055)
for k, x in enumerate((0.16, 0.3, 0.44)):
    helmet('interior', x, SY + 0.025, Z0 + T + 0.07, rot=0.0)
# pod półką: kosz z kółkami i skrzynka z nitami
b.prism('interior', 'basket', 0.08, 0.1, 0.1, 0.4, P, Z0 + T + 0.12, seg=10)
b.prism('interior', 'iron', 0.07, 0.07, 0.008, 0.4, P + 0.09, Z0 + T + 0.12, seg=10)
# kukła z gotową kolczugą w lewym przednim kącie
KX, KZ = X0 + T + 0.16, Z1 - T - 0.2
b.box('interior', 'woodDark', 0.22, 0.03, 0.04, KX, P, KZ)
b.box('interior', 'woodDark', 0.04, 0.03, 0.22, KX, P, KZ)
b.box('interior', 'wood', 0.035, 0.58, 0.035, KX, P + 0.025, KZ)
b.box('interior', 'woodDark', 0.24, 0.03, 0.035, KX, P + 0.48, KZ)
mail('interior', KX, P + 0.2, KZ, w=0.2, h=0.29, d=0.11, rot=math.pi / 2)
helmet('interior', KX, P + 0.53, KZ, rot=math.pi / 2)
t.block(KX - 0.14, KX + 0.14, KZ - 0.12, KZ + 0.12)
# żar w palenisku pod kominem (do wyżarzania drutu), kleszcze przy nim
b.box('interior', 'ember', 0.1, 0.02, 0.012, w['CX'], P + 0.04, Z0 + T + 0.15)
b.box('interior', 'iron', 0.01, 0.26, 0.01, w['CX'] + 0.2, P, Z0 + T + 0.06, roll=-0.12)

# ---------------- przed warsztatem ----------------
# dwa stojaki z kolczugami pod prawą ścianą, licem na zewnątrz (w +x), żeby rękawy nie wchodziły w ścianę
for k, z in enumerate((-0.32, 0.12)):
    stand('base', 0.87, z, rot=math.pi / 2)
    mail('base', 0.87, 0.2, z, w=0.2, h=0.29, d=0.11, rot=math.pi / 2)
    if k == 0:
        helmet('base', 0.87, 0.64, z, rot=math.pi / 2)
    t.block(0.79, 0.95, z - 0.16, z + 0.16)
# beczka z piaskiem i kolczugą do szorowania (lewy przedni róg) — piasek wpuszczony, kolczuga wystaje
RX, RZ = -0.62, 0.7
b.prism('base', 'wood', 0.1, 0.11, 0.26, RX, 0.0, RZ, seg=12)
for y in (0.04, 0.2):
    b.prism('base', 'iron', 0.111, 0.111, 0.016, RX, y, RZ, seg=12, top=False)
b.prism('base', 'soil', 0.092, 0.092, 0.005, RX, 0.25, RZ, seg=12)
b.box('base', 'iron', 0.1, 0.05, 0.07, RX + 0.02, 0.235, RZ - 0.01, 0.4, roll=0.3)
b.box('base', 'woodDark', 0.025, 0.3, 0.025, RX - 0.04, 0.16, RZ + 0.03, roll=0.4)  # kij do mieszania
t.block(RX - 0.12, RX + 0.12, RZ - 0.12, RZ + 0.12)
# kloc z małym kowadełkiem (bijak) do nitowania kółek przy drzwiach
NX, NZ = 0.15, 0.72
b.prism('base', 'bark', 0.08, 0.085, 0.24, NX, 0.0, NZ, seg=10)
b.prism('base', 'wood', 0.075, 0.075, 0.006, NX, 0.237, NZ, seg=10)
b.box('base', 'iron', 0.06, 0.05, 0.05, NX, 0.24, NZ)
b.box('base', 'iron', 0.1, 0.012, 0.012, NX + 0.02, 0.288, NZ + 0.03, 0.6)           # młotek do nitów
b.box('base', 'woodDark', 0.012, 0.012, 0.12, NX + 0.07, 0.288, NZ + 0.08, 0.6)
t.block(NX - 0.09, NX + 0.09, NZ - 0.09, NZ + 0.09)

E = P + 0.42
VIEWS = [
    ['warsztat z przodu', [0.2, 0.5, 2.4], [0, 0.45, 0], ['base', 'shell'], 22],
    ['izba od drzwi', [0.35, E, 0.3], [-0.05, 0.3, -0.45], ['base', 'interior', 'floor', 'ceiling'], 16],
    ['kukła z kolczugą', [0.25, E, 0.05], [KX, P + 0.35, KZ], ['base', 'interior', 'floor', 'ceiling'], 18],
    ['stojaki z kolczugami', [1.7, 0.45, -0.1], [0.87, 0.35, -0.1], ['base', 'shell'], 22],
    ['beczka i kloc', [-0.1, 0.45, 1.6], [-0.2, 0.2, 0.7], ['base', 'shell'], 22],
]
b.save('armorer', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': w['chimneys'], 'flames': w['flames'],
    'pennant': w['pennant'], 'views': VIEWS})
