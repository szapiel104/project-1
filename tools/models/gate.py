"""Brama w częstokole (1 pole), w duchu obozów z Gothica: dwie baszty z bali zaostrzonych u góry,
nad przejazdem pomost dla straży z balustradą i daszkiem z gontu, przed nim rząd zaostrzonych pali,
zastrzały pod belką, dwuskrzydłowe wrota z pionowych desek z ryglami, zastrzałem i okuciami.

Skrzydła wrót są w osobnych grupach 'leafL' i 'leafR' (zapisane w położeniu zamkniętym); gra obraca je
wokół zawiasów (HINGE) przy otwieraniu.

Uruchomienie (z katalogu repo):  python tools/models/gate.py
Układ: środek pola = (0, 0), mur biegnie wzdłuż x, przód (na zewnątrz) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()

HINGE = 0.36          # zawiasy skrzydeł (x = ±HINGE)
DOOR_H = 1.22         # wysokość wrót
BEAM_Y = 1.36         # spód belki nad przejazdem
DECK_Y = 1.5          # pomost straży
TOWER_X = 0.5         # oś baszt
TOP = 2.15            # wysokość bali baszt (bez szpicy)


def log(group, x, z, h, r, y=0.0, tip=0.22, seg=7, lean=0.0, mat='bark'):
    """Pionowy bal z zaostrzonym czubkiem"""
    b.prism(group, mat, r * 1.05, r, h, x, y, z, seg=seg, top=False, phase=lean)
    b.prism(group, mat, r, 0.0, tip, x, y + h, z, seg=seg, phase=lean)


def hlog(group, x0, x1, y, z, r, mat='bark', seg=7):
    """Poziomy bal wzdłuż x (walec)"""
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        pts = [(x0, y + math.cos(a0) * r, z + math.sin(a0) * r), (x1, y + math.cos(a0) * r, z + math.sin(a0) * r),
               (x1, y + math.cos(a1) * r, z + math.sin(a1) * r), (x0, y + math.cos(a1) * r, z + math.sin(a1) * r)]
        b.poly(group, mat, pts, away=((x0 + x1) / 2, y, z))
    for xx in (x0, x1):
        ring = [(xx, y + math.cos(2 * math.pi * k / seg) * r, z + math.sin(2 * math.pi * k / seg) * r) for k in range(seg)]
        b.poly(group, 'wood', ring, away=((x0 + x1) / 2, y, z))   # jaśniejszy przekrój ściętego bala


# ---------------- baszty: po pięć grubych bali w gnieździe, różnej wysokości ----------------
for sx in (-1, 1):
    cx = sx * TOWER_X
    cluster = [(0.0, 0.0, 0.0), (0.11, 0.1, -0.12), (-0.11, 0.1, -0.06), (0.1, -0.11, 0.08), (-0.1, -0.1, 0.1)]
    for i, (dx, dz, dh) in enumerate(cluster):
        log('base', cx + dx * sx, dz, TOP + dh + (0.05 if i == 0 else 0), 0.085 if i == 0 else 0.075, tip=0.24, lean=i * 0.4)
    # kamienie u podnóża (bale wkopane, obsypane)
    for k, (dx, dz) in enumerate(((0.2, 0.16), (-0.18, 0.2), (0.22, -0.14), (-0.2, -0.18), (0.02, 0.24))):
        b.prism('base', 'stoneDark', 0.06 + 0.01 * (k % 2), 0.035, 0.05, cx + dx * sx * 0.8, 0.0, dz, seg=5, phase=k)
    # trzy opaski z liny ściągające gniazdo bali
    for y in (0.35, 1.0, 1.75):
        b.prism('base', 'rope', 0.165, 0.165, 0.03, cx, y, 0.0, seg=10, top=False)

# ---------------- belka nad przejazdem, zastrzały, pomost straży ----------------
for z in (-0.13, 0.13):
    hlog('base', -TOWER_X - 0.08, TOWER_X + 0.08, BEAM_Y + 0.05, z, 0.06)
# zastrzały: od baszty skośnie pod belkę
for sx in (-1, 1):
    for z in (-0.13, 0.13):
        b.box('base', 'woodDark', 0.05, 0.36, 0.05, sx * (TOWER_X - 0.1), BEAM_Y - 0.3, z, roll=sx * 0.75)
# legary i deski pomostu (lekko wysunięty na zewnątrz)
for z in (-0.2, 0.0, 0.2):
    b.box('base', 'woodDark', 2 * TOWER_X + 0.1, 0.05, 0.06, 0, BEAM_Y + 0.1, z)
for i in range(9):
    x = -TOWER_X + 0.05 + i * (2 * TOWER_X - 0.1) / 8
    b.box('base', 'plank', (2 * TOWER_X - 0.1) / 8 - 0.008, 0.025, 0.56, x, DECK_Y - 0.035, 0.0, rot=0.0)
# balustrada od środka obozu (tył) i parapet z zaostrzonych pali od zewnątrz (przód)
b.box('base', 'woodDark', 2 * TOWER_X - 0.15, 0.04, 0.04, 0, DECK_Y + 0.32, -0.27)
for i in range(5):
    b.box('base', 'woodDark', 0.04, 0.34, 0.04, -0.36 + i * 0.18, DECK_Y - 0.01, -0.27)
for i in range(11):
    x = -TOWER_X + 0.07 + i * (2 * TOWER_X - 0.14) / 10
    h = 0.42 + (0.05 if i % 2 else 0.0)
    log('base', x, 0.29, h, 0.035, y=DECK_Y - 0.06, tip=0.1, seg=5, lean=i)
hlog('base', -TOWER_X + 0.02, TOWER_X - 0.02, DECK_Y + 0.18, 0.31, 0.025, mat='woodDark', seg=5)   # wiązanie pali

# ---------------- daszek z gontu nad pomostem ----------------
RY = DECK_Y + 0.62
for sx in (-1, 1):
    for z in (-0.24, 0.22):
        b.box('base', 'woodDark', 0.045, RY - DECK_Y, 0.045, sx * 0.34, DECK_Y - 0.01, z)
b.box('base', 'woodDark', 0.78, 0.05, 0.05, 0, RY - 0.03, -0.24)
b.box('base', 'woodDark', 0.78, 0.05, 0.05, 0, RY - 0.03, 0.22)
b.gable('shell', 'wood', -0.42, 0.42, -0.3, 0.28, RY, 0.3, along_x=True, over=0.08, end_mat='woodDark')
b.gable('shell', 'woodDark', -0.42, 0.42, -0.3, 0.28, RY - 0.025, 0.3, along_x=True, over=0.1)
b.box('shell', 'woodDark', 1.0, 0.04, 0.05, 0, RY + 0.29, -0.01)   # kalenica

# ---------------- próg i ślady kół ----------------
hlog('base', -HINGE - 0.02, HINGE + 0.02, 0.025, 0.0, 0.03, mat='woodDark', seg=6)
for sx in (-1, 1):   # oporne kamienie przy zawiasach
    b.box('base', 'stoneDark', 0.08, 0.06, 0.12, sx * (HINGE + 0.04), 0.0, 0.0)

# ---------------- pochodnie w uchwytach na basztach od zewnątrz ----------------
flames = []
for sx in (-1, 1):
    x, y, z = sx * (TOWER_X - 0.02), 1.0, 0.2
    b.box('base', 'iron', 0.03, 0.03, 0.1, x, y, z - 0.02)
    b.prism('base', 'woodDark', 0.02, 0.026, 0.22, x, y - 0.05, z + 0.04, seg=6)
    b.prism('base', 'rope', 0.03, 0.03, 0.04, x, y + 0.15, z + 0.04, seg=6)
    flames.append([round(x, 3), round(y + 0.19, 3), round(z + 0.04, 3)])


# ---------------- skrzydła wrót (zamknięte; gra obraca je wokół zawiasów) ----------------
def leaf(group, side):
    """side = -1: lewe skrzydło (zawias x = -HINGE, deski do środka), +1: prawe"""
    hx = side * HINGE
    W = HINGE - 0.008
    n = 5
    for i in range(n):
        x0 = hx - side * (W * i / n)
        x1 = hx - side * (W * (i + 1) / n - 0.006)
        h = DOOR_H - (0.02 if i % 2 else 0.0)
        b.box(group, 'plank', abs(x1 - x0), h, 0.05, (x0 + x1) / 2, 0.04, 0.0)
        # zaostrzone końce desek (jak pale częstokołu)
        b.pyramid(group, 'plank', abs(x1 - x0), 0.05, 0.08, (x0 + x1) / 2, 0.04 + h, 0.0)
    mid = hx - side * W / 2
    # rygle od środka obozu (tył) i zastrzał w kształt litery Z
    for y in (0.25, 0.95):
        b.box(group, 'woodDark', W - 0.02, 0.08, 0.035, mid, y, -0.042)
    ang = math.atan2(0.62, W - 0.08)
    b.box(group, 'woodDark', 0.06, math.hypot(0.62, W - 0.08), 0.03, hx - side * 0.05, 0.31, -0.042, roll=side * (math.pi / 2 - ang))
    # okucia od zewnątrz: dwie żelazne taśmy z gwoździami i kółko-kołatka
    for y in (0.22, 0.98):
        b.box(group, 'iron', W - 0.03, 0.05, 0.012, hx - side * (W - 0.03) / 2, y, 0.03)
        for k in range(4):
            b.box(group, 'iron', 0.018, 0.018, 0.01, hx - side * (0.05 + k * (W - 0.1) / 3), y + 0.016, 0.04)
    b.prism(group, 'iron', 0.035, 0.035, 0.012, hx - side * (W - 0.07), 0.62, 0.035, seg=8, top=False)


leaf('leafL', -1)
leaf('leafR', 1)

VIEWS = [
    ['brama z zewnątrz (oczy chłopa)', [0.2, 0.5, 2.0], [0, 0.9, 0], ['base', 'shell', 'leafL', 'leafR'], 22],
    ['brama od środka obozu', [-0.4, 0.5, -1.9], [0, 0.9, 0], ['base', 'shell', 'leafL', 'leafR'], 22],
    ['przejazd (wrota otwarte, spod belki)', [0.0, 0.45, 0.9], [0, 1.4, -0.4], ['base', 'shell'], 18],
    ['pomost straży', [-0.25, DECK_Y + 0.45, -0.15], [0.4, DECK_Y + 0.25, 0.4], ['base', 'shell'], 16],
]
b.save('gate', maxe=0.2, rays=16, reach=0.3, extra={'hinge': HINGE, 'flames': flames, 'views': VIEWS, 'pennant': [0.0, RY + 0.32, -0.01]})
