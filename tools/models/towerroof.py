"""Wspólne części kamiennych wież (stonetower.py, stonetower_big.py): zdejmowany dach nad pomostem i sprzęt łuczników.

Dach stoi na czterech dębowych słupach wpuszczonych w deski pomostu, wszystko w grupie 'roof' — gra zdejmuje ją po
kliknięciu wieży (openTop w pliku modelu), więc widać wtedy pomost z łucznikami, klapę zejścia i ich zapasy.
Sprzęt pomostu leży w 'base' (zostaje widoczny także z dachem).
"""
import math

from logs import log


def roof(b, deck, R, post, eave=0.9, rise=0.72, mat='slate'):
    """Dach czterospadowy z łupka: okap na wysokości deck+eave, połowa boku R (z okapem), słupy w ±post."""
    E = deck + eave
    apex = E + rise
    # słupy z kamiennymi podkładkami (żeby nie stały gołym drewnem na deskach)
    for sx in (-1, 1):
        for sz in (-1, 1):
            b.box('roof', 'castleDark', 0.13, 0.04, 0.13, sx * post, deck + 0.01, sz * post)
            b.box('roof', 'woodDark', 0.08, eave - 0.1, 0.08, sx * post, deck + 0.05, sz * post)
            # miecz (zastrzał) pod oczepem, w obie strony
            for ax in ('x', 'z'):
                d = -0.2
                p0 = (sx * post, E - 0.34, sz * post)
                p1 = (sx * post + (d * sx if ax == 'x' else 0), E - 0.09, sz * post + (d * sz if ax == 'z' else 0))
                log(b, 'roof', 'woodDark', p0, p1, r=0.02, seg=5)
    # oczepy (belki wieńca) na słupach
    for z in (-post, post):
        b.box('roof', 'woodDark', 2 * post + 0.16, 0.08, 0.09, 0, E - 0.1, z)
    for x in (-post, post):
        b.box('roof', 'woodDark', 0.09, 0.08, 2 * post - 0.1, x, E - 0.095, 0)
    # połacie z łupka (z grubością: od spodu widać deskowanie okapu) i ciemniejszy, wysunięty okap pod nimi
    mid = (0, E + rise * 0.3, 0)
    for m, dy, rr, t in ((mat, 0.0, R, 0.045), ('woodDark', -0.05, R - 0.03, 0.03)):
        c = [(-rr, E + dy, -rr), (rr, E + dy, -rr), (rr, E + dy, rr), (-rr, E + dy, rr)]
        top = (0, apex + dy, 0)
        for k in range(4):
            b.slope('roof', m, [c[k], c[(k + 1) % 4], top], away=mid, t=t)
    # krokwie narożne (widać je od dołu, z pomostu)
    for sx in (-1, 1):
        for sz in (-1, 1):
            log(b, 'roof', 'woodDark', (sx * post, E - 0.05, sz * post), (0, apex - 0.14, 0), r=0.028, seg=5)
    # kalenice narożne z ciemniejszego kamienia i iglica z gałką
    for sx in (-1, 1):
        for sz in (-1, 1):
            log(b, 'roof', 'castleDark', (sx * (R - 0.02), E + 0.04, sz * (R - 0.02)), (0, apex + 0.03, 0), r=0.022, seg=5)
    b.prism('roof', 'iron', 0.014, 0.014, 0.3, 0, apex - 0.02, 0, seg=6)
    b.prism('roof', 'gold', 0.035, 0.0, 0.07, 0, apex + 0.27, 0, seg=6)
    return apex


def barrel(b, x, z, deck, r=0.1, h=0.22):
    """Beczka z wodą na płonące strzały (obręcze z grubością, woda pod krawędzią)"""
    b.prism('base', 'wood', r, r + 0.01, h, x, deck, z, seg=10)
    for y in (deck + 0.04, deck + h - 0.05):
        b.prism('base', 'iron', r + 0.011, r + 0.012, 0.016, x, y, z, seg=10, top=False)
    b.prism('base', 'dark', r - 0.01, r - 0.01, 0.005, x, deck + h - 0.002, z, seg=10)


def quiver_basket(b, x, z, deck):
    """Kosz z wikliny pełen strzał (lotki z gęsich piór)"""
    b.prism('base', 'basket', 0.065, 0.08, 0.16, x, deck, z, seg=10)
    for k in range(9):
        a = k * 2.4
        rr = 0.015 + (k % 3) * 0.018
        b.box('base', 'plank', 0.007, 0.17, 0.007, x + math.cos(a) * rr, deck + 0.12, z + math.sin(a) * rr, roll=0.06 * math.cos(a))
        b.box('base', 'white', 0.003, 0.035, 0.014, x + math.cos(a) * rr, deck + 0.27, z + math.sin(a) * rr, rot=a)


def stone_pile(b, x, z, deck, seed=0.0):
    """Kupka kamieni do zrzucania przez blanki"""
    pts = [(0, 0, 0.07), (0.09, 0.02, 0.06), (-0.07, 0.05, 0.065), (0.03, -0.08, 0.055), (0.0, 0.0, 0.05)]
    for k, (dx, dz, r) in enumerate(pts):
        y = deck + r * 0.7 + (0.07 if k == len(pts) - 1 else 0)
        b.crystal('base', 'stoneDark', x + dx, y, z + dz, r, seed=seed + k * 1.7, sy=0.75, seg=7)


def deck_with_hole(b, deck, OUT, WALL, n, cx, cz, half, stone='castle'):
    """Pomost: kamienna warstwa pod deskami i deski w poprzek, z otworem klatki schodowej (cx, cz, połowa boku half).
    Deski nad otworem są przecięte, kamień dookoła otworu to cztery płyty (żeby przez otwór było widać schody)."""
    L = OUT - 0.005
    x0, x1, z0, z1 = cx - half, cx + half, cz - half, cz + half
    # kamień 3 cm pod deskami: ramka wokół otworu
    for (a0, a1, c0, c1) in ((-L, L, -L, z0), (-L, L, z1, L), (-L, x0, z0, z1), (x1, L, z0, z1)):
        if a1 - a0 > 0.01 and c1 - c0 > 0.01:
            b.box('base', stone, a1 - a0, 0.03, c1 - c0, (a0 + a1) / 2, deck - 0.04, (c0 + c1) / 2)
    w = 2 * (OUT - WALL) / n
    for i in range(n):
        x = -OUT + WALL + (i + 0.5) * w
        segs = [(-(OUT - WALL), OUT - WALL)]
        if x + w / 2 > x0 and x - w / 2 < x1:
            segs = [(-(OUT - WALL), z0 - 0.005), (z1 + 0.005, OUT - WALL)]
        for c0, c1 in segs:
            if c1 - c0 > 0.02:
                b.box('base', 'plank', w - 0.012, 0.02, c1 - c0, x, deck, (c0 + c1) / 2)
    # obramienie otworu z ciemnych belek (wystają 5 mm nad deski)
    for (bw, bd, bx, bz) in ((2 * half + 0.06, 0.03, cx, z0 - 0.015), (2 * half + 0.06, 0.03, cx, z1 + 0.015),
                             (0.03, 2 * half, x0 - 0.015, cz), (0.03, 2 * half, x1 + 0.015, cz)):
        b.box('base', 'woodDark', bw, 0.025, bd, bx, deck, bz)


def stairwell(b, deck, cx, cz, half, floor_y):
    """Klatka schodowa pod otworem w pomoście: ściany szybu z ciosów (widać je z góry), podłoga z desek na dole,
    strome drewniane schody od podłogi do otworu, odchylona klapa obok otworu i latarnia na dole."""
    x0, x1, z0, z1 = cx - half, cx + half, cz - half, cz + half
    top = deck - 0.06
    h = top - floor_y
    T = 0.03
    for (bw, bd, bx, bz) in ((2 * half + 2 * T, T, cx, z0 - T / 2), (2 * half + 2 * T, T, cx, z1 + T / 2),
                             (T, 2 * half, x0 - T / 2, cz), (T, 2 * half, x1 + T / 2, cz)):
        b.box('base', 'castlePlain', bw, h, bd, bx, floor_y, bz)
    b.box('base', 'plank', 2 * half, 0.02, 2 * half, cx, floor_y, cz)
    # schody: dwa policzki od podłogi przy -z do otworu przy +z, stopnie co ~10 cm wysokości
    sw = half - 0.03
    for sx in (-1, 1):
        log(b, 'base', 'woodDark', (cx + sx * sw, floor_y + 0.02, z0 + 0.03), (cx + sx * sw, deck - 0.01, z1 - 0.03), r=0.014, seg=5)
    n = max(5, int(h / 0.1))
    for k in range(1, n):
        f = k / n
        y = floor_y + 0.02 + (deck - 0.03 - floor_y) * f
        z = z0 + 0.03 + (z1 - z0 - 0.06) * f
        b.box('base', 'plank', 2 * sw - 0.02, 0.015, 0.05, cx, y - 0.008, z)
    # klapa odchylona na deski obok otworu (od strony -x), z okuciem
    lx = x0 - half - 0.05
    b.box('base', 'woodDark', 2 * half - 0.03, 0.022, 2 * half - 0.03, lx, deck + 0.02, cz)
    for zz in (cz - half * 0.5, cz + half * 0.5):
        b.box('base', 'iron', 2 * half - 0.08, 0.008, 0.03, lx, deck + 0.042, zz)
    b.prism('base', 'iron', 0.02, 0.02, 0.012, lx + half - 0.06, deck + 0.042, cz, seg=8)
    # latarnia na dole szybu (świeci zawsze; gra rysuje światło w miejscu znacznika lamps)
    b.prism('base', 'iron', 0.022, 0.022, 0.05, x1 - 0.05, floor_y + 0.02, z0 + 0.05, seg=6)
    return [round(x1 - 0.05, 3), round(floor_y + 0.06, 3), round(z0 + 0.05, 3), 'base']
