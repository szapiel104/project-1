"""Skóry z polowania (Michał 12.11.2026, myśliwy): dwie zwinięte skóry przewiązane rzemieniem, z wierzchniej zwisa płat
z łapą. Niesie je myśliwy do składu (render/loads.ts) i leżą tak samo na stosach w składzie (render/buildings.ts — PILES.hides).

Układ: rulony wzdłuż osi x (w poprzek rąk), spód w y ≈ -0,05, długość ok. 0,3.
Kolor z wierzchołków (barwa sierści, ciemniejsza strona mięsna, rzemień); tekstura płótna/skóry dokłada gra.
Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/hides.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import log  # noqa: E402

b = Building()
R = 0.042
# dwa rulony: dolny i wierzchni przesunięty w bok i obrócony (nie leżą równo jak z fabryki)
rolls = [((-0.15, -0.05 + R, -0.03), (0.15, -0.05 + R, -0.036), 'hide', 0.3),
         ((-0.13, -0.05 + R * 2.75, 0.012), (0.14, -0.05 + R * 2.7, 0.03), 'hideLight', 1.1)]
for (p0, p1, m, tw) in rolls:
    # zwój: zewnętrzna warstwa sierści, w środku ciemniejszy przekrój (strona mięsna zwinięta do środka)
    log(b, 'base', m, p0, p1, r=R, r1=R * 0.93, seg=11, ends='hideDark', twist=tw)
    # nieregularny brzeg zwoju: kilka zgrubień wzdłuż (fałdy skóry), wystają ponad walec
    for k in range(4):
        t = 0.18 + k * 0.21
        c = [p0[i] + (p1[i] - p0[i]) * t for i in range(3)]
        b.crystal('base', m, c[0], c[1] + R * 0.35, c[2] + R * 0.45, R * 0.42, seed=3.1 + k * 1.7 + tw, sx=1.6, sy=0.55, sz=0.8, seg=8)
# płat zwisający z wierzchniego rulonu (dwie warstwy: sierść i strona mięsna) z łapą na końcu
top = rolls[1][0]
fx, fy, fz = 0.06, top[1] - 0.005, 0.012 + R + 0.004
b.box('base', 'hideLight', 0.11, 0.09, 0.006, fx, fy - 0.045, fz, rot=0.08)
b.box('base', 'hideDark', 0.105, 0.085, 0.006, fx, fy - 0.045, fz - 0.007, rot=0.08)
log(b, 'base', 'hideLight', (fx + 0.03, fy - 0.09, fz), (fx + 0.045, fy - 0.135, fz + 0.012), r=0.012, r1=0.008, seg=6, ends='hideDark')
b.crystal('base', 'hideDark', fx + 0.047, fy - 0.14, fz + 0.014, 0.012, seed=8.2, seg=6)
# rzemienie: dwie pętle obejmujące oba rulony (pierścienie z grubością, odsunięte od skóry o kilka mm)
for x in (-0.085, 0.09):
    cy, cz = -0.05 + R * 1.85, -0.005
    n = 14
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        ry, rz = R * 1.95, R * 1.18
        q0 = (x, cy + math.sin(a0) * ry, cz + math.cos(a0) * rz)
        q1 = (x, cy + math.sin(a1) * ry, cz + math.cos(a1) * rz)
        log(b, 'base', 'cord', q0, q1, r=0.006, seg=5, ends='cord')

b.save('hides', maxe=0.2, rays=8, reach=0.05, extra={'views': [['skóry', [0.35, 0.3, 0.5], [0, 0, 0], ['base'], 20]]})
