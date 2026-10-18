"""Obóz zbójów w puszczy (3×3 pola), w klimacie obozów bandytów z Gothica: surowo, brudno, prowizorycznie.
Z tyłu dwa szałasy — daszek z gałęzi i słomy przykryty skórami na rozwidlonych palach i namiot ze skór na żerdziach —
w środku barłogi ze słomy i futer. Tył i boki osłania zasieka z zaostrzonych pali, przewiązanych żerdzią. Z przodu,
przy samej krawędzi działki, ognisko w kręgu kamieni z rożnem (zbóje siedzą przy nim tuż przed obozem), kłody do
siedzenia, stojak z włóczniami, a w rogu łup: skrzynie (jedna otwarta, z bryłami rudy), worki i beczka.
Na skraju słup z rozpiętą skórą — znak, że to czyjś obóz.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/banditcamp.py  →  src/render/models/banditcamp.json
Układ: środek działki = (0, 0), działka ±1,5, przód (ognisko, wejście) = +z, y = 0 to ziemia.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
fires = []


def jit(k, a, s=1.0):
    """Stały „przypadek” z liczby (bez random: model wychodzi zawsze taki sam)"""
    return math.sin(k * 12.9898 + a * 78.233) * s


def stick(group, mat, p0, p1, r, seg=6, tip=0.0, r1=None, ends='wood'):
    """Kij / pal / żerdź od p0 do p1: zamknięty walec (oba denka), z `tip` > 0 zaostrzony szpic na końcu p1"""
    r1 = r if r1 is None else r1
    ax = [p1[i] - p0[i] for i in range(3)]
    L = math.sqrt(sum(a * a for a in ax))
    d = [a / L for a in ax]
    up = (0, 1, 0) if abs(d[1]) < 0.9 else (1, 0, 0)
    u = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
    ul = math.sqrt(sum(a * a for a in u))
    u = [a / ul for a in u]
    v = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0])
    end = [p1[i] - d[i] * tip for i in range(3)]

    def ring(c, rr):
        return [tuple(c[i] + (u[i] * math.cos(2 * math.pi * k / seg) + v[i] * math.sin(2 * math.pi * k / seg)) * rr for i in range(3)) for k in range(seg)]
    lo, hi = ring(p0, r), ring(end, r1)
    mid = [(p0[i] + end[i]) / 2 for i in range(3)]
    for k in range(seg):
        k2 = (k + 1) % seg
        b.poly(group, mat, [lo[k], lo[k2], hi[k2], hi[k]], away=mid)
    b.poly(group, ends, lo, away=tuple(p1))   # denko przy p0 patrzy od p1
    if tip > 0:
        for k in range(seg):
            b.poly(group, mat, [hi[k], hi[(k + 1) % seg], tuple(p1)], away=mid)
    else:
        b.poly(group, ends, hi, away=tuple(p0))


def tri_slab(group, mat, a, c, e, away, t=0.02):
    """Trójkątny płat z grubością (skóra rozpięta na boku szałasu)"""
    b.slope(group, mat, [a, c, e], away, t)


# udeptanej ziemi nie ma w modelu: maluje ją gra na terenie (scene.ts), nierówną plamą, która miękko przechodzi w trawę

# ---------------- szałas z gałęzi i słomy na rozwidlonych palach (lewy tył) ----------------
AX0, AX1, AZF, AZB, AH = -1.28, -0.12, -0.42, -1.36, 0.8
for x in (AX0 + 0.04, AX1 - 0.04):
    stick('base', 'bark', (x, 0, AZF), (x, AH + 0.06, AZF), 0.03)                              # pal
    stick('base', 'bark', (x, AH - 0.04, AZF), (x - 0.06, AH + 0.12, AZF + 0.02), 0.016)        # widełki
stick('base', 'bark', (AX0 - 0.08, AH, AZF), (AX1 + 0.08, AH, AZF), 0.028)                     # kalenica
for k in range(6):                                                                             # krokwie do ziemi
    x = AX0 + 0.06 + (AX1 - AX0 - 0.12) * k / 5
    stick('base', 'bark', (x, AH + 0.01, AZF + 0.01), (x + jit(k, 1, 0.03), 0.0, AZB - 0.04), 0.018)
# poszycie: gałęzie ze słomą, na nich dwie skóry (jedna krzywo, z dziurą zasłoniętą łatą)
b.slope('base', 'thatchDark', [(AX0, AH + 0.035, AZF + 0.02), (AX1, AH + 0.035, AZF + 0.02), (AX1, 0.03, AZB), (AX0, 0.03, AZB)], (-0.7, -1, -0.5), t=0.035)
b.slope('base', 'hide', [(AX0 + 0.06, AH + 0.06, AZF + 0.04), (AX0 + 0.62, AH + 0.06, AZF + 0.04), (AX0 + 0.66, 0.18, AZB + 0.16), (AX0 + 0.02, 0.2, AZB + 0.14)], (-0.7, -1, -0.5), t=0.012)
b.slope('base', 'hide', [(AX0 + 0.58, AH + 0.065, AZF + 0.05), (AX1 - 0.05, AH + 0.065, AZF + 0.05), (AX1 - 0.08, 0.34, AZB + 0.34), (AX0 + 0.6, 0.3, AZB + 0.3)], (-0.7, -1, -0.5), t=0.012)
b.slope('base', 'sack', [(-0.62, 0.62, -0.62), (-0.42, 0.62, -0.62), (-0.42, 0.44, -0.84), (-0.62, 0.44, -0.84)], (-0.5, -1, -0.5), t=0.008)   # łata
# lewy bok zasłonięty skórą, prawy otwarty (widać barłóg)
tri_slab('base', 'hide', (AX0 + 0.01, AH, AZF + 0.01), (AX0 + 0.01, 0.02, AZB), (AX0 + 0.01, 0.02, AZF + 0.01), (AX0 + 1, 0.3, -0.8))
# barłóg: słoma, futro, zwinięty koc
b.box('base', 'hay', 0.82, 0.05, 0.42, -0.72, 0.0, -0.9, rot=0.05)
b.box('base', 'hide', 0.56, 0.025, 0.34, -0.78, 0.05, -0.88, rot=0.12)
stick('base', 'sack', (-0.98, 0.075, -0.68), (-0.62, 0.075, -0.7), 0.05, seg=8, ends='sack')

# ---------------- namiot ze skór na żerdziach (prawy tył) ----------------
TX, TZF, TZB, TW, TH = 0.76, -0.48, -1.38, 0.5, 0.86
for z in (TZF, TZB):   # para skrzyżowanych żerdzi na każdym końcu
    stick('base', 'bark', (TX - TW - 0.02, 0.0, z), (TX + 0.08, TH + 0.1, z), 0.02)
    stick('base', 'bark', (TX + TW + 0.02, 0.0, z), (TX - 0.08, TH + 0.1, z), 0.02)
stick('base', 'bark', (TX, TH + 0.02, TZF + 0.12), (TX, TH + 0.02, TZB - 0.08), 0.022)          # kalenica
for s in (-1, 1):      # połacie ze skór (zszywane z kilku płatów: dwa odcienie)
    away = (TX - s * 1.0, 0.2, (TZF + TZB) / 2)
    b.slope('base', 'hide', [(TX, TH, TZF), (TX, TH, (TZF + TZB) / 2), (TX + s * TW, 0.02, (TZF + TZB) / 2), (TX + s * TW, 0.02, TZF)], away, t=0.014)
    b.slope('base', 'hideDark', [(TX, TH, (TZF + TZB) / 2), (TX, TH, TZB), (TX + s * TW, 0.02, TZB), (TX + s * TW, 0.02, (TZF + TZB) / 2)], away, t=0.014)
tri_slab('base', 'hideDark', (TX - TW, 0.02, TZB + 0.01), (TX + TW, 0.02, TZB + 0.01), (TX, TH, TZB + 0.01), (TX, 0.3, 0.0))   # tył zamknięty
# wejście: skóra odchylona na bok, przywiązana do żerdzi
tri_slab('base', 'hide', (TX - 0.04, TH - 0.04, TZF + 0.02), (TX - TW + 0.06, 0.04, TZF + 0.02), (TX - 0.26, 0.04, TZF + 0.14), (TX + 0.5, 0.3, TZF - 0.6))
for k in range(5):     # kołki odciągów przy ziemi
    z = TZF + (TZB - TZF) * k / 4
    for s in (-1, 1):
        b.box('base', 'woodDark', 0.025, 0.07, 0.025, TX + s * (TW + 0.06), 0.0, z, tilt=-s * 0.3)
b.box('base', 'hay', 0.62, 0.04, 0.5, TX, 0.0, (TZF + TZB) / 2 - 0.05)
b.box('base', 'hideDark', 0.4, 0.025, 0.36, TX + 0.05, 0.04, (TZF + TZB) / 2 - 0.08, rot=-0.2)

# ---------------- zasieka z zaostrzonych pali: tył i boki ----------------
def stakes(p0, p1, n, out, k0):
    for k in range(n):
        f = (k + 0.5) / n
        x = p0[0] + (p1[0] - p0[0]) * f + jit(k, k0, 0.02)
        z = p0[1] + (p1[1] - p0[1]) * f + jit(k0, k, 0.02)
        h = 0.56 + abs(jit(k, k0 + 3, 0.18))
        lean = 0.1 + abs(jit(k + 7, k0, 0.05))
        stick('base', 'bark', (x, -0.02, z), (x + out[0] * lean * h, h, z + out[1] * lean * h), 0.032 + abs(jit(k, k0 + 5, 0.006)), tip=0.1)
    # żerdź przewiązująca pale
    stick('base', 'woodDark', (p0[0] + out[0] * 0.04, 0.3, p0[1] + out[1] * 0.04), (p1[0] + out[0] * 0.04, 0.3, p1[1] + out[1] * 0.04), 0.018)


E = 1.42
stakes((-E, -E), (E, -E), 20, (0, -1), 1)
stakes((-E, -E + 0.14), (-E, 0.36), 12, (-1, 0), 2)
stakes((E, -E + 0.14), (E, 0.36), 12, (1, 0), 3)

# ---------------- ognisko z rożnem (przy przedniej krawędzi: zbóje siedzą tuż przed obozem) ----------------
FX, FZ = 0.0, 0.92
for k in range(9):
    a = 2 * math.pi * k / 9 + 0.2
    s = 0.07 + (k % 3) * 0.012
    b.prism('base', 'rock' if k % 2 else 'rockDark', s, s * 0.6, s * 0.85, FX + math.cos(a) * 0.26, -0.01, FZ + math.sin(a) * 0.26, seg=6, phase=k)
b.prism('base', 'ash', 0.21, 0.19, 0.016, FX, 0.0, FZ, seg=12)
for k in range(5):
    a = k / 5 * 2 * math.pi
    b.box('base', 'bark', 0.045, 0.27, 0.045, FX + math.cos(a) * 0.11, 0.012, FZ + math.sin(a) * 0.11, -a + math.pi / 2, tilt=-0.6)
b.prism('base', 'ember', 0.1, 0.07, 0.03, FX, 0.016, FZ, seg=10)
fires.append([FX, 0.04, FZ])
for s in (-1, 1):      # rożen: dwa rozwidlone kije i drąg z kawałem mięsa
    stick('base', 'woodDark', (FX + s * 0.34, 0.0, FZ), (FX + s * 0.34, 0.44, FZ), 0.016)
    stick('base', 'woodDark', (FX + s * 0.34, 0.38, FZ), (FX + s * 0.4, 0.5, FZ), 0.01)
stick('base', 'woodDark', (FX - 0.42, 0.42, FZ), (FX + 0.42, 0.42, FZ), 0.011)
b.box('base', 'bread', 0.15, 0.08, 0.09, FX + 0.02, 0.34, FZ - 0.045, rot=0.2)
b.box('base', 'bread', 0.09, 0.06, 0.07, FX - 0.15, 0.36, FZ - 0.035, rot=-0.3)
# kłody do siedzenia po bokach ogniska
for (x, z, a) in ((-0.62, 0.86, 1.35), (0.64, 0.84, 1.75)):
    c, s = math.sin(a), math.cos(a)
    stick('base', 'bark', (x - c * 0.22, 0.07, z - s * 0.22), (x + c * 0.22, 0.07, z + s * 0.22), 0.07, seg=8)

# ---------------- stojak z bronią (lewy przód) ----------------
RX, RZ = -1.06, 0.48
for dx in (-0.2, 0.2):
    stick('base', 'woodDark', (RX + dx, 0.0, RZ), (RX + dx, 0.5, RZ), 0.02)
stick('base', 'woodDark', (RX - 0.25, 0.44, RZ), (RX + 0.25, 0.44, RZ), 0.016)
for k, dx in enumerate((-0.13, 0.0, 0.14)):
    top = (RX + dx + 0.05, 0.86, RZ - 0.1)
    stick('base', 'woodDark', (RX + dx - 0.02, 0.0, RZ + 0.12), top, 0.012)
    stick('base', 'iron', top, (top[0] + 0.012, top[1] + 0.12, top[2] - 0.03), 0.018, seg=4, tip=0.09)
# topór oparty o pal
stick('base', 'woodDark', (RX + 0.3, 0.0, RZ + 0.08), (RX + 0.27, 0.42, RZ - 0.02), 0.012)
b.box('base', 'iron', 0.1, 0.07, 0.014, RX + 0.29, 0.34, RZ - 0.0, rot=0.3)

# ---------------- łup (prawy przód): skrzynie, otwarta z rudą, worki, beczka ----------------
def chest(x, z, rot, w=0.34, h=0.2, d=0.22, open_=False):
    c, s = math.cos(rot), math.sin(rot)
    if open_:
        t = 0.022   # skrzynia bez wieka: cztery ściany i dno z grubością
        for (ox, oz, ww, dd) in ((0, d / 2 - t / 2, w, t), (0, -d / 2 + t / 2, w, t), (w / 2 - t / 2, 0, t, d - 2 * t), (-w / 2 + t / 2, 0, t, d - 2 * t)):
            b.box('base', 'woodDark', ww, h, dd, x + ox * c + oz * s, 0.0, z - ox * s + oz * c, rot=rot)
        b.box('base', 'woodDark', w - 2 * t, 0.03, d - 2 * t, x, 0.0, z, rot=rot)
        # wieko odchylone do tyłu, oparte o skrzynię
        b.box('base', 'woodDark', w, 0.022, d, x - 0.0 * c - (d / 2 + 0.01) * s, h, z + 0.0 * s - (d / 2 + 0.01) * c, rot=rot, tilt=1.25)
    else:
        b.box('base', 'woodDark', w, h, d, x, 0.0, z, rot=rot)
        b.box('base', 'wood', w + 0.012, 0.03, d + 0.012, x, h - 0.03, z, rot=rot)
    for ox in (-w * 0.3, w * 0.3):   # okucia
        b.box('base', 'iron', 0.03, h + 0.008, d + 0.012, x + ox * c, 0.0, z - ox * s, rot=rot)


chest(0.92, 0.66, 0.25)
chest(1.08, 1.02, -0.15, open_=True)
for k, (ox, oz, r) in enumerate(((0.0, 0.0, 0.06), (0.06, -0.03, 0.045), (-0.07, 0.025, 0.045), (0.03, 0.05, 0.04))):
    b.crystal('base', 'magicOre', 1.08 + ox, 0.2, 1.02 + oz, r, seed=k * 3.1, sy=0.8)
for (x, z) in ((0.62, 1.12), (0.78, 1.26)):
    b.prism('base', 'sack', 0.085, 0.075, 0.15, x, 0.0, z, seg=9, phase=x)
    b.prism('base', 'sack', 0.075, 0.025, 0.05, x, 0.15, z, seg=9, phase=x)
# beczka z obręczami (obręcze o włos szersze od klepek)
BX, BZ = 1.22, 0.3
b.prism('base', 'woodDark', 0.13, 0.15, 0.17, BX, 0.0, BZ, seg=12)
b.prism('base', 'woodDark', 0.15, 0.13, 0.17, BX, 0.17, BZ, seg=12)
for y in (0.05, 0.27):
    b.prism('base', 'iron', 0.148 + (0.012 if y < 0.1 else 0.006), 0.152 + (0.008 if y < 0.1 else 0.002), 0.03, BX, y, BZ, seg=12)

# ---------------- znak obozu: słup z rozpiętą skórą (prawy bok, przy zasiece) ----------------
PX, PZ = 1.24, -0.14
stick('base', 'bark', (PX, 0.0, PZ), (PX, 1.42, PZ), 0.035, tip=0.12)
stick('base', 'bark', (PX - 0.26, 1.08, PZ), (PX + 0.26, 1.08, PZ), 0.016)
b.slope('base', 'hide', [(PX - 0.22, 1.06, PZ + 0.035), (PX + 0.22, 1.06, PZ + 0.035), (PX + 0.17, 0.62, PZ + 0.05), (PX - 0.2, 0.66, PZ + 0.05)], (PX, 0.8, PZ - 1), t=0.012)
for (dx, dy) in ((-0.2, 1.04), (0.2, 1.04)):
    b.box('base', 'rope', 0.02, 0.05, 0.02, PX + dx, dy, PZ + 0.04)

OUT = ['base']
VIEWS = [
    ['obóz z przodu', [0.5, 1.3, 3.6], [0, 0.3, 0], OUT, 24],
    ['ognisko i łup', [1.6, 0.8, 2.2], [0.5, 0.25, 0.8], OUT, 22],
    ['szałasy z tyłu', [-0.4, 1.6, -3.2], [0, 0.35, -0.6], OUT, 24],
    ['z ziemi przy ogniu', [-0.3, 0.45, 1.9], [0, 0.35, 0], OUT, 18],
]
b.save('banditcamp', maxe=0.22, rays=14, reach=0.3, extra={'campfires': fires, 'flames': [], 'views': VIEWS})
