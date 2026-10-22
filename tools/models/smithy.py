"""Kuźnia (2×2 pola): chata z szachulca ze strzechą i szerokim kominem nad paleniskiem (szkielet: workshop.py).
W izbie: palenisko kowalskie z kamienia z żarem pod kominem, miech obok, kowadło na pniu (tu pracuje kowal),
cebrzyk z wodą do hartowania, na tylnej ścianie gotowe miecze i narzędzia (obcęgi, młoty), w kącie sztaby żelaza
i worek węgla. Przed kuźnią: kamień szlifierski na kozłach z korytem, stojak z mieczami pod daszkiem, sterta
węgla drzewnego i beczka z wodą przy drzwiach.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/smithy.py
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
w = workshop(b, t, chimney=(0.4, None))
P, Z0, Z1, X0, X1, T = w['P'], w['Z0'], w['Z1'], w['X0'], w['X1'], w['T']


def sword(group, x, y, z, along_x=True, up=False, rot=0.0):
    """Miecz w pionie: głownia z żelaza (z grubością), jelec, rękojeść owinięta skórą i głowica.
    y = koniec, na którym miecz stoi albo wisi: przy `up=False` wisi sztychem w dół (y = sztych),
    przy `up=True` stoi sztychem w ziemi (też y = sztych) — kolejność części jest ta sama, różni się tylko podpis."""
    del up
    bw, bt = (0.022, 0.006) if along_x else (0.006, 0.022)
    gw, gd = (0.09, 0.016) if along_x else (0.016, 0.09)
    b.box(group, 'iron', bw, 0.34, bt, x, y, z, rot)                    # głownia
    b.box(group, 'woodDark', bw * 0.35 + 0.004, 0.33, bt + 0.002, x, y + 0.01, z, rot)   # zbrocze (ciemny pas przez środek)
    b.box(group, 'iron', gw, 0.016, gd, x, y + 0.335, z, rot)          # jelec
    b.box(group, 'hide', 0.016, 0.075, 0.016, x, y + 0.346, z, rot)    # rękojeść
    b.box(group, 'iron', 0.026, 0.024, 0.026, x, y + 0.416, z, rot)    # głowica


def tongs(group, x, y, z):
    """Obcęgi kowalskie wiszące na kołku: dwa ramiona rozchylone u dołu, szczęki u góry"""
    for s in (-1, 1):
        b.box(group, 'iron', 0.01, 0.26, 0.01, x + s * 0.012, y, z, roll=s * 0.06)
    b.box(group, 'iron', 0.04, 0.02, 0.014, x, y + 0.255, z)


def hammer(group, x, y, z, rot=0.0, lie=False):
    """Młot: trzonek z drewna i obuch z żelaza. Wisi obuchem do góry albo leży (lie=True) na kowadle"""
    if lie:
        b.box(group, 'wood', 0.2, 0.016, 0.016, x, y, z, rot)
        b.box(group, 'iron', 0.035, 0.03, 0.055, x + math.cos(rot) * 0.09, y - 0.006, z - math.sin(rot) * 0.09, rot)
    else:
        b.box(group, 'wood', 0.016, 0.22, 0.016, x, y, z, rot)
        b.box(group, 'iron', 0.06, 0.035, 0.03, x, y + 0.2, z, rot)


# ---------------- izba ----------------
# palenisko kowalskie pod kominem: kamienny stół na wysokość pasa z rantem, żar wpuszczony w środek
FX, FZ = w['CX'], -0.31
t.boxs('interior', 'stone', 0.36, 0.3, 0.26, FX, P, FZ)
b.box('interior', 'stoneDark', 0.4, 0.03, 0.3, FX, P + 0.29, FZ)                  # płyta paleniska (o 1 cm w dół w stół)
for sx in (-1, 1):                                                                # rant z boków i z przodu
    b.box('interior', 'stoneDark', 0.035, 0.04, 0.3, FX + sx * 0.18, P + 0.315, FZ)
b.box('interior', 'stoneDark', 0.33, 0.04, 0.035, FX, P + 0.315, FZ + 0.13)
b.box('interior', 'dark', 0.24, 0.02, 0.18, FX, P + 0.31, FZ - 0.01)              # węgiel
b.box('interior', 'ember', 0.13, 0.02, 0.1, FX, P + 0.318, FZ - 0.01)             # żar (wystaje 8 mm nad węgiel)
# okap z kamienia nad paleniskiem, prowadzi dym do komina
b.box('interior', 'stoneDark', 0.4, 0.06, 0.18, FX, P + 0.62, FZ - 0.05)
b.box('interior', 'stone', 0.3, 0.12, 0.12, FX, P + 0.67, FZ - 0.07)
# miech po lewej od paleniska: deska, skóra w harmonijkę, deska, dysza do żaru i dźwignia
BX, BZ = FX - 0.29, FZ + 0.02
t.boxs('interior', 'woodDark', 0.2, 0.18, 0.14, BX, P, BZ)                        # kozioł pod miechem
b.box('interior', 'wood', 0.22, 0.018, 0.15, BX, P + 0.175, BZ)
b.box('interior', 'hide', 0.19, 0.06, 0.12, BX, P + 0.19, BZ)
b.box('interior', 'thatchDark', 0.195, 0.008, 0.125, BX, P + 0.215, BZ)           # fałda skóry
b.box('interior', 'wood', 0.22, 0.018, 0.15, BX, P + 0.245, BZ, roll=0.06)
b.box('interior', 'iron', 0.1, 0.02, 0.02, BX + 0.14, P + 0.2, BZ)                # dysza
b.box('interior', 'woodDark', 0.025, 0.025, 0.32, BX - 0.06, P + 0.27, BZ + 0.05, tilt=-0.15)  # dźwignia
# kowadło na pniu przed kowalem (kowal stoi w (0, 0,12) twarzą do tyłu)
AX, AZ = -0.02, -0.11
b.prism('interior', 'bark', 0.075, 0.08, 0.2, AX, P, AZ, seg=10)
b.prism('interior', 'wood', 0.07, 0.07, 0.006, AX, P + 0.197, AZ, seg=10)        # ścięty wierzch pnia
b.box('interior', 'iron', 0.12, 0.03, 0.08, AX, P + 0.2, AZ)                      # stopa
b.box('interior', 'iron', 0.07, 0.045, 0.05, AX, P + 0.225, AZ)                   # talia
b.box('interior', 'iron', 0.19, 0.035, 0.075, AX, P + 0.265, AZ)                  # gładź
b.box('interior', 'iron', 0.07, 0.028, 0.05, AX + 0.125, P + 0.272, AZ)           # róg (rożek)
b.box('interior', 'iron', 0.035, 0.02, 0.03, AX + 0.18, P + 0.276, AZ)
t.block(AX - 0.1, AX + 0.1, AZ - 0.08, AZ + 0.08)
# na kowadle: rozgrzana głownia (żar na końcu) i młot obok
b.box('interior', 'iron', 0.2, 0.006, 0.022, AX - 0.03, P + 0.3, AZ - 0.01, 0.15)
b.box('interior', 'ember', 0.06, 0.008, 0.024, AX + 0.04, P + 0.299, AZ - 0.02, 0.15)
hammer('interior', AX - 0.06, P + 0.308, AZ + 0.02, rot=-0.5, lie=True)
# cebrzyk z wodą do hartowania po prawej ręce kowala
QX, QZ = 0.2, -0.04
b.prism('interior', 'wood', 0.08, 0.09, 0.14, QX, P, QZ, seg=12)
for y in (P + 0.025, P + 0.105):
    b.prism('interior', 'iron', 0.091, 0.091, 0.014, QX, y, QZ, seg=12, top=False)
b.prism('interior', 'water', 0.083, 0.083, 0.005, QX, P + 0.12, QZ, seg=12)
b.box('interior', 'iron', 0.01, 0.22, 0.01, QX + 0.03, P + 0.06, QZ, roll=0.35)   # obcęgi w wodzie
t.block(QX - 0.09, QX + 0.09, QZ - 0.09, QZ + 0.09)
# tylna ściana z lewej: gotowe miecze na kołkach (sztychem w dół) i narzędzia
WZ = Z0 + T + 0.03
b.box('interior', 'woodDark', 0.5, 0.04, 0.025, -0.38, P + 0.6, Z0 + T + 0.013)  # listwa z kołkami
for k, x in enumerate((-0.58, -0.49, -0.4)):
    b.box('interior', 'woodDark', 0.02, 0.02, 0.05, x, P + 0.58, WZ)
    sword('interior', x, P + 0.17, WZ + 0.01)
tongs('interior', -0.29, P + 0.33, WZ + 0.01)
hammer('interior', -0.2, P + 0.38, WZ + 0.01)
hammer('interior', -0.15, P + 0.36, WZ + 0.01, rot=0.2)
# lewa ściana: sztaby żelaza na deskach i worek węgla
for k in range(3):
    b.box('interior', 'woodDark', 0.04, 0.03, 0.26, X0 + T + 0.08 + k * 0.1, P, 0.04)
for k in range(5):
    b.box('interior', 'iron', 0.075, 0.03, 0.22, X0 + T + 0.07 + (k % 3) * 0.085, P + 0.028 + (k // 3) * 0.028, 0.04 + (k % 2) * 0.01)
t.block(X0 + T, X0 + T + 0.28, -0.1, 0.18)
b.sack('interior', X0 + T + 0.12, P, 0.28, w=0.15, rot=0.4)
b.box('interior', 'dark', 0.08, 0.02, 0.06, X0 + T + 0.12, P + 0.135, 0.28, 0.4)  # węgiel z worka
# w przednim kącie przy drzwiach: skrzynka z ćwiekami i obręcze
b.box('interior', 'wood', 0.16, 0.08, 0.12, X1 - T - 0.1, P, Z1 - T - 0.42)
b.box('interior', 'iron', 0.13, 0.006, 0.09, X1 - T - 0.1, P + 0.078, Z1 - T - 0.42)

# ---------------- przed kuźnią ----------------
# kamień szlifierski na kozłach z korytkiem wody pod spodem (lewy przedni róg)
GX, GZ, GY, GR = -0.6, 0.72, 0.26, 0.14
for dz in (-0.07, 0.07):
    for dx in (-0.09, 0.09):
        b.box('base', 'woodDark', 0.03, 0.3, 0.03, GX + dx, 0.0, GZ + dz, roll=-dx * 1.4)
    b.box('base', 'woodDark', 0.24, 0.03, 0.03, GX, 0.2, GZ + dz)
b.wheel('base', GX, GY, GZ, GR, t=0.05, rot=math.pi / 2, mat='stone', tire='stoneDark')
b.box('base', 'iron', 0.015, 0.015, 0.22, GX, GY - 0.0075, GZ)                    # oś
b.box('base', 'iron', 0.015, 0.1, 0.015, GX, GY - 0.1, GZ + 0.11)                 # korba
b.box('base', 'wood', 0.18, 0.06, 0.1, GX, 0.04, GZ)                              # korytko
b.box('base', 'water', 0.15, 0.005, 0.07, GX, 0.095, GZ)
t.block(GX - 0.13, GX + 0.13, GZ - 0.1, GZ + 0.1)
# stojak z mieczami pod prawą ścianą, z daszkiem (miecze stoją sztychem w belce)
SX, SZ = 0.86, -0.05
for z in (-0.4, 0.3):
    b.box('base', 'woodDark', 0.04, 0.7, 0.04, SX, 0.0, SZ + z)
b.box('base', 'woodDark', 0.04, 0.04, 0.8, SX, 0.66, SZ - 0.05)
b.box('base', 'wood', 0.2, 0.025, 0.92, SX + 0.02, 0.72, SZ - 0.05, roll=-0.2)
b.box('base', 'woodDark', 0.08, 0.05, 0.74, SX, 0.06, SZ - 0.05)                 # belka z gniazdami
b.box('base', 'woodDark', 0.03, 0.03, 0.74, SX, 0.48, SZ - 0.05)                 # poprzeczka, o którą opierają się rękojeści
for z in (-0.3, -0.15, 0.0, 0.15):
    sword('base', SX + 0.02, 0.08, SZ + z, along_x=False)
t.block(SX - 0.05, SX + 0.05, SZ - 0.45, SZ + 0.35)
# sterta węgla drzewnego pod lewą ścianą i kilka sztab żelaza
for k, (x, z, r, h) in enumerate(((-0.85, -0.3, 0.12, 0.1), (-0.83, -0.1, 0.1, 0.08), (-0.88, -0.45, 0.08, 0.06))):
    b.prism('base', 'dark', r, r * 0.35, h, x, 0.0, z, seg=8, phase=k * 0.7)
for k in range(3):
    b.box('base', 'iron', 0.07, 0.028, 0.2, -0.82 + k * 0.08, 0.0 + (k == 1) * 0.026, 0.12)
t.block(-0.98, -0.72, -0.55, 0.24)
# beczka z wodą przy drzwiach
b.prism('base', 'wood', 0.08, 0.09, 0.22, 0.62, 0.0, 0.62, seg=10)
for y in (0.04, 0.17):
    b.prism('base', 'iron', 0.091, 0.091, 0.014, 0.62, y, 0.62, seg=10, top=False)
b.prism('base', 'water', 0.075, 0.075, 0.005, 0.62, 0.205, 0.62, seg=10)
t.block(0.53, 0.71, 0.53, 0.71)

w['flames'].append([FX, round(P + 0.33, 3), FZ])
E = P + 0.42
VIEWS = [
    ['kuźnia z przodu', [0.2, 0.5, 2.4], [0, 0.45, 0], ['base', 'shell'], 22],
    ['izba od drzwi', [0.35, E, 0.3], [0.1, 0.25, -0.4], ['base', 'interior', 'floor', 'ceiling'], 16],
    ['kowadło i palenisko', [-0.3, E, 0.25], [0.25, 0.3, -0.3], ['base', 'interior', 'floor', 'ceiling'], 18],
    ['szlifierz z przodu', [GX + 0.35, 0.45, GZ + 0.7], [GX, GY, GZ], ['base', 'shell'], 22],
    ['stojak z mieczami', [SX + 0.7, 0.45, SZ + 0.2], [SX, 0.3, SZ], ['base', 'shell'], 22],
]
b.save('smithy', maxe=0.22, rays=16, reach=0.3, extra={
    'solid': t.solid, 'open': t.open, 'floorY': P, 'windows': t.windows, 'chimneys': w['chimneys'], 'flames': w['flames'],
    'pennant': w['pennant'], 'views': VIEWS})
