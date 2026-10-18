"""Drewniana wieża strażnicza (2×2 pola), surowa jak u straży Starego Obozu: cztery okorowane bale na kamiennych
podkładach, zbiegające się lekko ku górze i sięgające aż pod dach; na dwóch kondygnacjach zastrzały na krzyż,
złącza okręcone liną. Na legarach pomost z desek wysunięty poza nogi, dookoła przedpiersie z pionowych desek
z poręczą, w jednym rogu ławka (tu siada łucznik bez walki), kosz strzał i beczka z wodą, na słupie róg alarmowy.
Nad pomostem dach czterospadowy ze strzechy w dwóch warstwach, na szczycie żerdź z proporcem. Od przodu (+z)
drabina oparta o krawędź pomostu, wejście przerwą w przedpiersiu między dwoma wyższymi słupkami.

Łucznicy stoją na pomoście (gra: WATCH_TOWER_TOP = DECK). Wieża nie ma wnętrza: wszystko w 'base', dach w 'roof'.
Pod wieżą zostaje wolne miejsce między nogami: gdy dochodzi do niej mur, gra stawia tam bale częstokołu.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/watchtower.py
Układ: środek działki = (0, 0), działka ±1, przód (drabina) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import lash, log  # noqa: E402

b = Building()

DECK = 1.95     # wierzch desek pomostu (tu stoją łucznicy)
B0 = 0.74       # rozstaw nóg przy ziemi (połowa)
B1 = 0.62       # rozstaw nóg pod pomostem
EAVE = DECK + 0.8
OUT = 0.82      # połowa boku pomostu (deski wystają poza nogi)
PAR = 0.3       # wysokość przedpiersia
LEG = 0.075


def leg_at(y):
    """Połowa rozstawu nóg na wysokości y (nogi lekko zbiegają się ku górze, nad pomostem już prosto)"""
    f = min(1.0, y / DECK)
    return B0 + (B1 - B0) * f


# ---------------- kamienne podkłady i nogi ----------------
for sx in (-1, 1):
    for sz in (-1, 1):
        b.prism('base', 'stoneDark', 0.13, 0.11, 0.09, sx * B0, 0.0, sz * B0, seg=7, phase=0.3 * sx)
        log(b, 'base', 'bark', (sx * B0, 0.08, sz * B0), (sx * B1, DECK, sz * B1), r=LEG + 0.01, r1=LEG, seg=8)
        log(b, 'base', 'bark', (sx * B1, DECK, sz * B1), (sx * (B1 - 0.01), EAVE + 0.02, sz * (B1 - 0.01)), r=LEG, r1=LEG - 0.01, seg=8)

# ---------------- rygle i zastrzały na krzyż (dwie kondygnacje) ----------------
TIERS = (0.12, 1.02, DECK - 0.16)
for side in range(4):
    for i in range(len(TIERS)):
        y = TIERS[i]
        h = leg_at(y)
        # rygiel poziomy na tej wysokości (nieco przed nogami, żeby nie siedział w nich licem w lico)
        o = h + LEG + 0.025
        if side == 0:
            p0, p1 = (-h - 0.05, y, o), (h + 0.05, y, o)
        elif side == 1:
            p0, p1 = (-h - 0.05, y, -o), (h + 0.05, y, -o)
        elif side == 2:
            p0, p1 = (o, y, -h - 0.05), (o, y, h + 0.05)
        else:
            p0, p1 = (-o, y, -h - 0.05), (-o, y, h + 0.05)
        if i > 0:  # najniższy rygiel tylko z boków i z tyłu (przód zostaje wolny pod drabinę)
            log(b, 'base', 'woodDark', p0, p1, r=0.035, seg=6)
        elif side != 0:
            log(b, 'base', 'woodDark', p0, p1, r=0.035, seg=6)
    # zastrzały między rygłami: krzyż w każdej kondygnacji, przed ryglem
    for i in range(len(TIERS) - 1):
        ya, yb = TIERS[i] + 0.04, TIERS[i + 1] - 0.04
        ha, hb = leg_at(ya), leg_at(yb)
        oa, ob = ha + LEG + 0.07, hb + LEG + 0.07
        for d in (-1, 1):
            if side == 0 and i == 0 and d == 1:
                continue  # z przodu na dole tylko jeden zastrzał, drugi zasłaniałby drabinę
            if side == 0:
                p0, p1 = (d * ha, ya, oa), (-d * hb, yb, ob)
            elif side == 1:
                p0, p1 = (d * ha, ya, -oa), (-d * hb, yb, -ob)
            elif side == 2:
                p0, p1 = (oa, ya, d * ha), (ob, yb, -d * hb)
            else:
                p0, p1 = (-oa, ya, d * ha), (-ob, yb, -d * hb)
            log(b, 'base', 'wood' if d > 0 else 'woodDark', p0, p1, r=0.028, seg=6)
# linowe oploty na złączach nóg z ryglami
for sx in (-1, 1):
    for sz in (-1, 1):
        for y in TIERS[1:]:
            h = leg_at(y)
            lash(b, 'base', (sx * h, y + 0.03, sz * h), (sx * (B1 - B0) / DECK, 1, sz * (B1 - B0) / DECK), r=LEG + 0.018, w=0.05)

# ---------------- legary i pomost ----------------
# legary wzdłuż z leżą na dwóch podciągach przy nogach, dookoła belki obrzeża — pod każdą krawędzią desek coś jest
for z in (-B1, B1):
    b.box('base', 'woodDark', 2 * OUT + 0.02, 0.075, 0.09, 0, DECK - 0.19, z)
for x in (-0.42, 0.0, 0.42):
    b.box('base', 'woodDark', 0.08, 0.07, 2 * OUT - 0.04, x, DECK - 0.11, 0)
for s in (-1, 1):
    b.box('base', 'woodDark', 2 * OUT - 0.04, 0.07, 0.07, 0, DECK - 0.11, s * (OUT - 0.055))
    b.box('base', 'woodDark', 0.07, 0.07, 2 * OUT - 0.18, s * (OUT - 0.055), DECK - 0.11, 0)
NP = 9
for i in range(NP):
    w = 2 * OUT / NP
    x = -OUT + (i + 0.5) * w
    # końce desek nierówne, ale nigdy krótsze niż obrzeże (żadna deska przedpiersia nie wisi nad pustką)
    z0, z1 = -OUT - 0.015 * abs(math.sin(i * 2.3)), OUT + 0.015 * abs(math.cos(i * 1.7))
    b.box('base', 'plank' if i % 3 else 'wood', w - 0.008, 0.035, z1 - z0, x, DECK - 0.04, (z0 + z1) / 2)

# ---------------- przedpiersie: słupki, pionowe deski, poręcz na wierzchu ----------------
# z przodu przerwa nad drabiną (wejście na pomost), obramowana dwoma wyższymi słupkami
LX, GAP = 0.25, 0.19          # oś drabiny i połowa szerokości wejścia
IN = OUT - 0.02               # lico desek przedpiersia
BT = 0.03                     # grubość desek
PIN = IN - BT / 2 - 0.028     # słupki od środka, przytulone do desek
PAR_TOP = DECK + PAR
posts = {0: [-PIN, -0.27, LX - GAP - 0.03, LX + GAP + 0.03, PIN], 1: [-PIN, -0.27, 0.27, PIN],
         2: [-PIN, 0.0, PIN], 3: [-PIN, 0.0, PIN]}
for side, fs in posts.items():
    for f in fs:
        if side == 0:
            x, z = f, PIN
        elif side == 1:
            x, z = f, -PIN
        elif side == 2:
            x, z = PIN, f
        else:
            x, z = -PIN, f
        tall = side == 0 and abs(abs(f - LX) - GAP - 0.03) < 0.01
        log(b, 'base', 'bark', (x, DECK - 0.01, z), (x, PAR_TOP + (0.12 if tall else 0.035), z), r=0.028, seg=6)
for side in range(4):
    n = 13
    for i in range(n):
        f = -IN + (i + 0.5) * 2 * IN / n
        w = 2 * IN / n - 0.006
        if side == 0 and abs(f - LX) < GAP + w / 2:
            continue
        hh = PAR - 0.012 * abs(math.sin(i * 1.9 + side))   # wierzchy nierówne, ale zawsze pod poręczą
        if side == 0:
            b.box('base', 'wood', w, hh, BT, f, DECK - 0.005, IN)
        elif side == 1:
            b.box('base', 'wood', w, hh, BT, f, DECK - 0.005, -IN)
        elif side == 2:
            b.box('base', 'wood', BT, hh, w, IN, DECK - 0.005, f)
        else:
            b.box('base', 'wood', BT, hh, w, -IN, DECK - 0.005, f)
# poręcz z żerdzi leży na deskach i słupkach (wpuszczona o włos w ich wierzch)
RY = PAR_TOP + 0.018
RZ = IN - 0.012
log(b, 'base', 'bark', (-IN, RY, -RZ), (IN, RY, -RZ), r=0.026, seg=6)
log(b, 'base', 'bark', (RZ, RY, -IN), (RZ, RY, IN), r=0.026, seg=6)
log(b, 'base', 'bark', (-RZ, RY, -IN), (-RZ, RY, IN), r=0.026, seg=6)
log(b, 'base', 'bark', (-IN, RY, RZ), (LX - GAP - 0.03, RY, RZ), r=0.026, seg=6)
log(b, 'base', 'bark', (LX + GAP + 0.03, RY, RZ), (IN, RY, RZ), r=0.026, seg=6)

# ---------------- na pomoście: ławka, kosz strzał, beczka z wodą, róg ----------------
# ławka w lewym przednim rogu (tam siada łucznik bez walki, ok. (-0.42, 0.38))
BX, BZ = -0.47, 0.52
b.box('base', 'woodDark', 0.42, 0.03, 0.14, BX, DECK + 0.14, BZ)
for sx in (-1, 1):
    b.box('base', 'woodDark', 0.03, 0.14, 0.11, BX + sx * 0.17, DECK, BZ)
# kosz strzał przy tylnym przedpiersiu
QX, QZ = 0.12, -0.62
b.prism('base', 'basket', 0.065, 0.08, 0.16, QX, DECK, QZ, seg=10)
for k in range(9):
    a = k * 2.4
    rr = 0.015 + (k % 3) * 0.018
    b.box('base', 'plank', 0.007, 0.17, 0.007, QX + math.cos(a) * rr, DECK + 0.12, QZ + math.sin(a) * rr, roll=0.06 * math.cos(a))
    b.box('base', 'white', 0.003, 0.035, 0.014, QX + math.cos(a) * rr, DECK + 0.27, QZ + math.sin(a) * rr, rot=a)
# beczka z wodą (na płonące strzały) w prawym tylnym rogu
WX, WZ = 0.56, -0.56
b.prism('base', 'wood', 0.1, 0.11, 0.22, WX, DECK, WZ, seg=10)
for y in (DECK + 0.04, DECK + 0.17):
    b.prism('base', 'iron', 0.111, 0.112, 0.016, WX, y, WZ, seg=10, top=False)
b.prism('base', 'dark', 0.09, 0.09, 0.005, WX, DECK + 0.218, WZ, seg=10)
# róg alarmowy na rzemieniu przy prawym przednim słupie
HX, HZ = B1 - 0.01, B1 + 0.09
# kołek wbity w słup i rzemień, na którym wisi róg
log(b, 'base', 'woodDark', (B1 - 0.01, DECK + 0.62, B1 + 0.04), (HX, DECK + 0.62, HZ + 0.015), r=0.012, seg=5)
log(b, 'base', 'rope', (HX, DECK + 0.625, HZ + 0.005), (HX + 0.02, DECK + 0.5, HZ + 0.02), r=0.005, seg=4, ends='rope')
# wygięty róg wołu: odcinki po łuku, coraz grubsze ku czaszy, okuta czasza
pts = []
for k in range(7):
    a = k / 6 * 1.9
    pts.append((HX + 0.02 - (1 - math.cos(a)) * 0.06 - k * 0.012, DECK + 0.5 - math.sin(a) * 0.09, HZ + 0.02))  # róg wygina się do środka pomostu, nie przez przedpiersie
for k in range(6):
    r0, r1 = 0.006 + k * 0.0045, 0.006 + (k + 1) * 0.0045
    log(b, 'base', 'white', pts[k], pts[k + 1], r=r0, r1=r1, seg=7, ends='white')
log(b, 'base', 'iron', pts[6], (pts[6][0], pts[6][1] + 0.012, pts[6][2] + 0.008), r=0.036, seg=8, ends='dark')

# ---------------- dach czterospadowy ze strzechy (dwie warstwy) ----------------
APEX = EAVE + 0.62
R0 = 0.98
mid = (0, EAVE + 0.15, 0)
for mat, dy, rr in (('thatch', 0.0, R0), ('thatchDark', -0.05, R0 + 0.05)):
    c = [(-rr, EAVE + dy, -rr), (rr, EAVE + dy, -rr), (rr, EAVE + dy, rr), (-rr, EAVE + dy, rr)]
    top = (0, APEX + dy, 0)
    for k in range(4):
        b.slope('roof', mat, [c[k], c[(k + 1) % 4], top], away=mid, t=0.04)
# krokwie pod strzechą (widać je z pomostu) i belki wieńca na słupach
for sx in (-1, 1):
    for sz in (-1, 1):
        log(b, 'roof', 'woodDark', (sx * (B1 - 0.01), EAVE - 0.04, sz * (B1 - 0.01)), (0, APEX - 0.12, 0), r=0.025, seg=5)
for z in (-B1, B1):
    b.box('roof', 'woodDark', 2 * B1 + 0.12, 0.06, 0.07, 0, EAVE - 0.06, z + (0.0 if z > 0 else 0.0))
for x in (-B1, B1):
    b.box('roof', 'woodDark', 0.07, 0.06, 2 * B1 - 0.08, x, EAVE - 0.075, 0)
# wiązanie strzechy na szczycie i żerdź z proporcem
b.prism('roof', 'thatchDark', 0.09, 0.03, 0.14, 0, APEX - 0.1, 0, seg=8)
# żerdź z proporcem w osobnej grupie: cienka, więc daleka wersja (LOD) by ją zjadła
log(b, 'flagpole', 'woodDark', (0, APEX - 0.05, 0), (0, APEX + 0.55, 0), r=0.018, seg=6)
for side in (1, -1):  # proporzec z dwóch warstw, żeby był widoczny z obu stron
    b.box('flagpole', 'flag', 0.3, 0.14, 0.006, 0.16, APEX + 0.36, side * 0.004)

# ---------------- drabina od przodu ----------------
# oparta o krawędź pomostu w przerwie przedpiersia; żerdzie wystają nad pomost jako uchwyty przy wchodzeniu
FOOTZ, TOPY = 1.0, DECK + 0.36
EDGE = OUT + 0.022            # krawędź pomostu, o którą opiera się drabina
TOPZ = FOOTZ - (FOOTZ - EDGE) * TOPY / (DECK - 0.03)
b.box('base', 'stoneDark', 0.4, 0.04, 0.12, LX, 0.0, FOOTZ, bottom=False)      # płaski kamień pod stopami drabiny
for sx in (-1, 1):
    log(b, 'base', 'bark', (LX + sx * 0.14, 0.04, FOOTZ), (LX + sx * 0.14, TOPY, TOPZ), r=0.024, seg=6)
    # żerdzie przywiązane do słupków wejścia
    lash(b, 'base', (LX + sx * 0.14, DECK + 0.2, FOOTZ - (FOOTZ - EDGE) * (DECK + 0.2) / (DECK - 0.03)), (0, 1, -0.1), r=0.034, w=0.03)
n = 9
for k in range(n):
    y = 0.22 + k * (DECK - 0.3) / (n - 1)
    z = FOOTZ - (FOOTZ - EDGE) * y / (DECK - 0.03)
    log(b, 'base', 'wood', (LX - 0.155, y, z), (LX + 0.155, y, z), r=0.016, seg=5)

VIEWS = [
    ['wieża od drabiny (oczy chłopa)', [0.5, 0.5, 2.8], [0, 1.3, 0], ['base', 'roof'], 24],
    ['pod pomostem', [0.15, 0.35, 0.9], [0.0, DECK, -0.2], ['base', 'roof'], 18],
    ['na pomoście', [0.25, DECK + 0.5, 0.45], [-0.4, DECK + 0.1, -0.5], ['base', 'roof'], 16],
    ['pod okapem', [1.25, DECK + 0.25, 1.25], [0.0, EAVE + 0.2, 0.0], ['base', 'roof'], 20],
]
b.save('watchtower', maxe=0.2, rays=16, reach=0.3, extra={'deck': DECK, 'views': VIEWS})
