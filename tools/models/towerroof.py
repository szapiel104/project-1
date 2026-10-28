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
