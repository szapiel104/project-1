"""Skórzane kaftany od kaletnika (Michał 13.11.2026): trzy złożone kaftany jeden na drugim, każdy z ciemniejszym pasem,
kołnierzem i rzemykami, lekko przekrzywione. Niesie je chłop do zbrojowni (render/loads.ts) i leżą tak na stosach
w zbrojowni (render/buildings.ts — PILES.leather). Spód w y ≈ -0,05, szerokość ok. 0,26.
Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/jerkins.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402

b = Building()
y = -0.05
for k, (mat, rot, dx) in enumerate((('hide', 0.05, 0.0), ('hideLight', -0.12, 0.012), ('hide', 0.18, -0.01))):
    t = 0.028
    # tułów złożony na pół: dwie warstwy skóry, wierzchnia minimalnie mniejsza (nie leżą lico w lico)
    b.box('base', mat, 0.24, t, 0.17, dx, y, 0.0, rot=rot)
    b.box('base', mat, 0.228, 0.008, 0.16, dx, y + t, 0.0, rot=rot)
    # rękawy podwinięte pod spód widać jako wałki po bokach
    for side in (-1, 1):
        b.crystal('base', mat, dx + side * 0.115, y + t * 0.55, 0.0, 0.022, seed=k * 2.1 + side, sx=0.8, sy=0.7, sz=3.0, seg=7)
    # ciemny pas w poprzek i kołnierz przy krawędzi
    b.box('base', 'hideDark', 0.245, 0.006, 0.026, dx, y + t + 0.008, 0.035, rot=rot)
    b.box('base', 'hideDark', 0.08, 0.012, 0.03, dx, y + t + 0.008, -0.07, rot=rot)
    # rzemyki sznurowania: trzy krótkie wiązania na środku
    for j in range(3):
        b.box('base', 'cord', 0.03, 0.005, 0.006, dx, y + t + 0.014, -0.03 + j * 0.03, rot=rot + 0.4)
    y += t + 0.012
b.save('jerkins', maxe=0.2, rays=8, reach=0.05, extra={'views': [['kaftany', [0.35, 0.3, 0.45], [0, 0, 0], ['base'], 20]]})
