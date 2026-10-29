"""Porcja mięsa (Michał 29.10.2026): na desce wędzona szynka z kością, kawał boczku i pęto kiełbasy. Ta sama bryła leży
w spichlerzu (stosy warstwami, render/buildings.ts — PILES.meat) i jedzie w rękach chłopa niosącego mięso (render/loads.ts).

Układ: deska na spodzie w y = -0,15 (jak inne porcje w spichlerzu), szerokość ok. 0,36 × 0,26.
Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/meat.py
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402
from logs import log  # noqa: E402

b = Building()
Y = -0.15
# deska
b.box('base', 'woodDark', 0.36, 0.025, 0.26, 0, Y, 0)
T = Y + 0.025
# szynka: gruszkowata, przypieczona skórka, kość wystająca z wąskiego końca
b.crystal('base', 'meatDark', -0.04, T + 0.06, -0.02, 0.08, seed=1.3, sx=1.5, sy=0.75, sz=1.05, seg=10)
b.crystal('base', 'meatDark', 0.07, T + 0.045, -0.02, 0.05, seed=2.1, sx=1.2, sy=0.8, sz=0.9, seg=8)
log(b, 'base', 'bone', (0.1, T + 0.05, -0.02), (0.165, T + 0.06, -0.02), r=0.011, seg=6, ends='bone')
b.crystal('base', 'bone', 0.17, T + 0.06, -0.02, 0.016, seed=4.0, seg=6)
# boczek: płaski płat z pasami słoniny
for k, (y, m) in enumerate(((T, 'meat'), (T + 0.012, 'white'), (T + 0.02, 'meat'))):
    b.box('base', m, 0.13, 0.012 if k != 1 else 0.008, 0.08, -0.08, y, 0.075, rot=0.15)
# pęto kiełbasy: zawinięte w pętlę ogniwa
for k in range(7):
    a0, a1 = k * 2 * math.pi / 7, (k + 0.85) * 2 * math.pi / 7
    p0 = (0.09 + math.cos(a0) * 0.05, T + 0.014, 0.07 + math.sin(a0) * 0.045)
    p1 = (0.09 + math.cos(a1) * 0.05, T + 0.014, 0.07 + math.sin(a1) * 0.045)
    log(b, 'base', 'meatDark', p0, p1, r=0.013, seg=6, ends='meatDark')

b.save('meat', maxe=0.2, rays=8, reach=0.05, extra={'views': [['mięso', [0.3, 0.4, 0.6], [0, -0.1, 0], ['base'], 20]]})
