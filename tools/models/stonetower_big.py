"""Większe kamienne wieże obronne — ten sam styl co stonetower.py (ciosy, machikuły, blanki), ale szersze i wyższe:

  stonetower_big    (3×3 pola, „Duża baszta”): trzon na cokole z przyporami, gzyms w połowie, dwa rzędy strzelnic,
                    machikuły i chodnik z blankami, na narożnikach okrągłe wieżyczki (wykusze) z blankami.
  stonetower_great  (4×4 pola, „Wielka baszta”): skarpowany cokół, dwa gzymsy, trzy rzędy strzelnic, ostrołukowy
                    portal, wykusze na rogach pod stożkowymi daszkami z łupka, obszerny pomost.

Łucznicy stoją na pomoście (gra czyta 'deck' z pliku). Wszystko w grupie 'base' (wieża nie ma wnętrza do odkrycia).
Koksownik (tools/models/brazier.py) gra stawia na pomoście w rogu 'brazierAt'.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/stonetower_big.py
Układ: środek działki = (0, 0), przód (drzwi) = +z.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from building import Building  # noqa: E402


def tower(name, S, DECK, OUT, cornices, slits, bartizan_r, cones, plinth_batter):
    b = Building()
    WALL = 0.1      # grubość przedpiersia
    PAR = 0.24      # wysokość przedpiersia (do wcięć blank)

    # ---------------- cokół (skarpa) i trzon ----------------
    if plinth_batter:
        # skarpowany cokół: trzy coraz węższe stopnie ciosów
        for k, (pad, h) in enumerate(((0.34, 0.16), (0.24, 0.16), (0.14, 0.14))):
            y = sum(hh for _, hh in ((0.34, 0.16), (0.24, 0.16), (0.14, 0.14))[:k])
            b.box('base', 'castleDark', 2 * S + pad, h, 2 * S + pad, 0, y, 0, bottom=False if k == 0 else None)
        y0 = 0.46
    else:
        b.box('base', 'castleDark', 2 * S + 0.24, 0.2, 2 * S + 0.24, 0, 0, 0, bottom=False)
        b.box('base', 'castleDark', 2 * S + 0.12, 0.1, 2 * S + 0.12, 0, 0.2, 0)
        y0 = 0.3
    b.box('base', 'castle', 2 * S, DECK - 0.12 - y0 + 0.01, 2 * S, 0, y0, 0, top=False)  # trzon aż pod płytę chodnika
    for cy in cornices:   # gzymsy
        b.box('base', 'castleDark', 2 * S + 0.07, 0.08, 2 * S + 0.07, 0, cy, 0)
        b.box('base', 'castleDark', 2 * S + 0.03, 0.04, 2 * S + 0.03, 0, cy - 0.04, 0)

    # przypory w połowie każdej ściany (tylko na dole, łagodnie zwężające się)
    for side in range(4):
        nx, nz = ((0, 1), (0, -1), (1, 0), (-1, 0))[side]
        for f in (-0.5, 0.5):
            along = f * S
            for k, (o, h) in enumerate(((0.16, 0.55), (0.11, 0.35), (0.06, 0.25))):
                y = y0 + sum(hh for _, hh in ((0.16, 0.55), (0.11, 0.35), (0.06, 0.25))[:k])
                x, z = nx * (S + o / 2) + (along if nz else 0), nz * (S + o / 2) + (along if nx else 0)
                b.box('base', 'castleDark', 0.22 if nz else o, h, o if nz else 0.22, x, y - 0.005, z)

    # narożniki z jaśniejszych, większych ciosów (na przemian długie i krótkie), wystają odrobinę z lica
    n = int((DECK - 0.5 - y0) / 0.26)
    for sx in (-1, 1):
        for sz in (-1, 1):
            for k in range(n):
                y = y0 + k * 0.26
                if any(cy - 0.06 < y + 0.2 and y < cy + 0.1 for cy in cornices):
                    continue
                long = k % 2 == 0
                w = 0.34 if long else 0.2
                d = 0.2 if long else 0.34
                b.box('base', 'stoneDark', w, 0.2, d, sx * (S - w / 2 + 0.015), y, sz * (S - d / 2 + 0.015))

    # ---------------- wsporniki (machikuły) i chodnik ----------------
    per = max(5, int(2 * S / 0.3))
    for side in range(4):
        for i in range(per):
            f = -S + 0.16 + i * (2 * S - 0.32) / (per - 1)
            x, z = (f, S) if side == 0 else (f, -S) if side == 1 else (S, f) if side == 2 else (-S, f)
            dx, dz = ((0, 1), (0, -1), (1, 0), (-1, 0))[side]
            for j, (o, h) in enumerate(((0.05, 0.09), (0.1, 0.08), (0.15, 0.07))):
                b.box('base', 'castleDark', 0.11 if dz else 2 * o, h, 2 * o if dz else 0.11, x + dx * o, DECK - 0.4 + j * 0.09, z + dz * o)
    # Płyta chodnika bez wierzchu: ciemny cios (castleDark) gra rysuje „o włos bliżej” kamery (withAo w buildings.ts),
    # więc z daleka jej wierzch przebijał przez deski pomostu 2 cm wyżej i pomost ciemniał. Pod deskami leży zwykły
    # kamień (bez przesunięcia), 3 cm niżej od ich wierzchu, a płyta zostaje tylko z boków i od spodu.
    b.box('base', 'castleDark', 2 * OUT, 0.12, 2 * OUT, 0, DECK - 0.12, 0, top=False, bottom=True)   # płyta chodnika
    b.box('base', 'castle', 2 * OUT - 0.01, 0.03, 2 * OUT - 0.01, 0, DECK - 0.04, 0)
    planks = int(2 * (OUT - WALL) / 0.2)
    for i in range(planks):
        x = -OUT + WALL + (i + 0.5) * (2 * (OUT - WALL)) / planks
        b.box('base', 'plank', (2 * (OUT - WALL)) / planks - 0.012, 0.02, 2 * (OUT - WALL), x, DECK, 0)
    # klapa zejścia na schody w trzonie
    b.box('base', 'woodDark', 0.34, 0.025, 0.34, -OUT + 0.45, DECK + 0.005, -OUT + 0.45)
    b.box('base', 'iron', 0.09, 0.02, 0.02, -OUT + 0.45, DECK + 0.03, -OUT + 0.57)

    # ---------------- przedpiersie z blankami ----------------
    br = bartizan_r
    for side in range(4):
        if side < 2:
            z = OUT - WALL / 2 if side == 0 else -OUT + WALL / 2
            b.box('base', 'castle', 2 * OUT, PAR, WALL, 0, DECK, z)
            b.merlons_line('base', 'castle', -OUT + br + 0.08, z, OUT - br - 0.08, z, DECK + PAR, step=0.3, w=0.17, h=0.18, t=WALL)
            b.box('base', 'castleDark', 2 * OUT + 0.02, 0.03, WALL + 0.02, 0, DECK + PAR - 0.03, z)
        else:
            x = OUT - WALL / 2 if side == 2 else -OUT + WALL / 2
            b.box('base', 'castle', WALL, PAR, 2 * OUT - 2 * WALL, x, DECK, 0)
            b.merlons_line('base', 'castle', x, -OUT + br + 0.08, x, OUT - br - 0.08, DECK + PAR, step=0.3, w=0.17, h=0.18, t=WALL)
            b.box('base', 'castleDark', WALL + 0.02, 0.03, 2 * OUT - 2 * WALL, x, DECK + PAR - 0.03, 0)

    # ---------------- wykusze (okrągłe wieżyczki) na narożnikach ----------------
    seg = 14
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * (OUT - br * 0.55), sz * (OUT - br * 0.55)
            # wspornik: odwrócony stożek z ciosów pod wieżyczką
            b.prism('base', 'castleDark', 0.05, br, 0.42, cx, DECK - 0.54, cz, seg=seg, top=False)
            # ściana wieżyczki, wyższa od przedpiersia
            th = PAR + 0.3
            b.prism('base', 'castle', br, br, th, cx, DECK - 0.12, cz, seg=seg, top=False)
            b.prism('base', 'castleDark', br + 0.02, br + 0.02, 0.04, cx, DECK - 0.12 + th - 0.05, cz, seg=seg, top=False)
            # podłoga wieżyczki (wierzch, na wysokości pomostu)
            b.prism('base', 'plank', br - 0.05, br - 0.05, 0.02, cx, DECK - 0.005, cz, seg=seg)
            # strzelnice w wieżyczce: patrzą na zewnątrz, po bokach narożnika
            for a in (math.atan2(sx, sz) - 0.75, math.atan2(sx, sz), math.atan2(sx, sz) + 0.75):
                px, pz = cx + math.sin(a) * (br + 0.012), cz + math.cos(a) * (br + 0.012)
                b.box('base', 'dark', 0.05, 0.22, 0.03, px, DECK + 0.08, pz, rot=a)
            if cones:
                # stożkowy daszek z łupka i kulka na szczycie
                b.prism('base', 'castleDark', br + 0.06, br + 0.06, 0.03, cx, DECK - 0.12 + th, cz, seg=seg)
                b.prism('base', 'slate', br + 0.08, 0.0, 0.62, cx, DECK - 0.12 + th + 0.03, cz, seg=seg)
                b.prism('base', 'iron', 0.012, 0.012, 0.16, cx, DECK - 0.12 + th + 0.6, cz, seg=6)
                b.prism('base', 'gold', 0.03, 0.0, 0.06, cx, DECK - 0.12 + th + 0.74, cz, seg=6)
            else:
                b.merlons_ring('base', 'castle', cx, cz, br - 0.045, DECK - 0.12 + th, n=7, w=0.13, h=0.15, t=0.08)

    # ---------------- strzelnice ----------------
    for row, y in enumerate(slits):
        for side in range(4):
            nx, nz = ((0, 1), (0, -1), (1, 0), (-1, 0))[side]
            offs = (-S * 0.5, S * 0.5) if row % 2 == 0 else (0.0,)
            for off in offs:
                if side == 0 and row == 0 and abs(off) < 0.45:
                    continue  # nad drzwiami
                x, z = nx * S + (off if nz else 0), nz * S + (off if nx else 0)
                along_x = nz != 0
                b.box('base', 'castleDark', 0.14 if along_x else 0.03, 0.4, 0.03 if along_x else 0.14, x + nx * 0.012, y - 0.03, z + nz * 0.012)
                b.box('base', 'dark', 0.05 if along_x else 0.03, 0.32, 0.03 if along_x else 0.05, x + nx * 0.022, y + 0.01, z + nz * 0.022)

    # ---------------- drzwi (ostrołuk z klińców) ----------------
    DZ = S
    dw, dh = (0.5, 0.9) if S < 1.3 else (0.62, 1.05)
    b.box('base', 'castleDark', dw + 0.14, dh + 0.06, 0.06, 0, y0 - 0.02, DZ + 0.02)              # obramienie
    for k in range(7):                                                                            # kliny łuku
        a = math.pi * (k + 0.5) / 7
        px, py = math.cos(a) * (dw / 2 + 0.04), y0 + dh + math.sin(a) * 0.2
        b.box('base', 'stoneDark', 0.1, 0.12, 0.07, px, py, DZ + 0.03, rot=0, roll=a - math.pi / 2)
    b.box('base', 'dark', dw - 0.1, dh - 0.08, 0.03, 0, y0, DZ + 0.045)                            # wnęka
    boards = 5 if S < 1.3 else 6
    for i in range(boards):
        bw = (dw - 0.14) / boards
        b.box('base', 'woodDark', bw - 0.006, dh - 0.12, 0.035, -(dw - 0.14) / 2 + bw * (i + 0.5), y0, DZ + 0.06)
    for y in (y0 + 0.16, y0 + dh * 0.62):
        b.box('base', 'iron', dw - 0.12, 0.04, 0.012, 0, y, DZ + 0.08)
    b.prism('base', 'iron', 0.03, 0.03, 0.01, 0.13, y0 + dh * 0.42, DZ + 0.085, seg=8, top=True)
    # schody pod drzwi
    for k in range(3):
        b.box('base', 'stoneDark', dw + 0.2 - k * 0.04, y0 / 3, 0.28 - k * 0.08, 0, k * y0 / 3, DZ + 0.24 - k * 0.04, bottom=False if k == 0 else None)

    # ---------------- chorągiew na drzewcu przy wykuszu ----------------
    PX, PZ = -OUT + br * 0.55, -OUT + br * 0.55
    pole_y = DECK - 0.12 + PAR + 0.3 + (0.78 if cones else 0.18)
    b.box('base', 'woodDark', 0.05, 1.0, 0.05, PX, pole_y - 0.2, PZ)
    b.prism('base', 'gold', 0.04, 0.0, 0.08, PX, pole_y + 0.8, PZ, seg=6)
    banners = [[round(PX + 0.028, 3), round(pole_y + 0.6, 3), round(PZ, 3), 0, 0.4, 0.28, 0, 'base']]

    views = [
        ['wieża od drzwi (oczy chłopa)', [0.5, 0.5, 2 * S + 1.6], [0, DECK * 0.55, 0], ['base'], 22],
        ['pod machikułami', [S + 0.25, 0.3, S + 0.6], [S * 0.5, DECK, S * 0.6], ['base'], 18],
        ['pomost łuczników', [0.0, DECK + 0.45, -0.2], [OUT * 0.8, DECK + 0.2, OUT * 0.9], ['base'], 16],
    ]
    # koksownik w rogu pomostu, z dala od klapy i drzewca (gra go tam stawia)
    brazier = [round(OUT - br * 1.6 - 0.12, 3), DECK, round(OUT - 0.32, 3)]
    b.save(name, maxe=0.22, rays=16, reach=0.3, extra={'deck': DECK, 'views': views, 'banners': banners, 'brazierAt': brazier})


tower('stonetower_big', S=1.15, DECK=2.95, OUT=1.3, cornices=(1.55,), slits=(0.9, 2.05), bartizan_r=0.24, cones=False, plinth_batter=False)
tower('stonetower_great', S=1.55, DECK=3.55, OUT=1.74, cornices=(1.35, 2.55), slits=(0.95, 1.95, 3.0), bartizan_r=0.3, cones=True, plinth_batter=True)
