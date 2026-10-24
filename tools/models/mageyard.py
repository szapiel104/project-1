"""Wspólne części dużych siedzib magów (5×5 pól): przesunięcie gotowej zabudowy, plac z płyt, niski mur z bramą.

Siedziby magów składają się z dawnej zabudowy 3×3 (wieża / sala, przesunięta w tył działki) i dobudowanego przed nią
dziedzińca: plac z płyt kamiennych, niski mur wokół z bramą od przodu, dodatkowe skrzydła i ozdoby w skryptach budynków.
"""
import math


def shift(b, dx, dz, *marks):
    """Przesuwa wszystko, co już stoi w budynku (wielokąty, kosze, jedzenie) i listy znaczników [x, y, z, ...]"""
    for key, polys in b.parts.items():
        b.parts[key] = [[(x + dx, y, z + dz) for x, y, z in p] for p in polys]
    for s in b.baskets:
        s[1] += dx; s[3] += dz
    for f in b.foods:
        f[2] += dx; f[4] += dz
    for lst in marks:
        for m in lst:
            m[0] = round(m[0] + dx, 4)
            m[2] = round(m[2] + dz, 4)


def flagstones(b, x0, x1, z0, z1, step=0.3, mats=('castle', 'castleDark'), skip=lambda x, z: False, y=0.0, h=0.025, seed=0.0):
    """Plac z płyt: siatka płyt o lekko różnej wielkości, z wąskimi fugami (płyty nie stykają się licem w lico)"""
    nx, nz = max(1, round((x1 - x0) / step)), max(1, round((z1 - z0) / step))
    sx, sz = (x1 - x0) / nx, (z1 - z0) / nz
    for i in range(nx):
        for j in range(nz):
            cx, cz = x0 + (i + 0.5) * sx, z0 + (j + 0.5) * sz
            if skip(cx, cz):
                continue
            r = (math.sin(i * 12.9898 + j * 78.233 + seed) * 43758.5453) % 1.0
            mat = mats[int(r * len(mats)) % len(mats)]
            b.box('base', mat, sx - 0.022, h + 0.006 * r, sz - 0.022, cx, y, cz, rot=(r - 0.5) * 0.04)


def low_wall(b, x0, x1, z0, z1, gate_w=0.9, h=0.42, t=0.16, mat='castle', cap='castleDark', side_gaps=()):
    """Niski mur z ciosów wokół dziedzińca, z czapą; od przodu (z1) brama o szerokości gate_w.
    side_gaps: dodatkowe przerwy [(bok, środek, szerokość)], bok 'l' / 'r' / 'b'."""
    def run(ax, a0, a1, fixed, along_x):
        segs = [(a0, a1)]
        cuts = []
        if along_x and fixed == z1:
            cuts.append(((x0 + x1) / 2, gate_w))
        for side, c, w in side_gaps:
            if (side == 'l' and not along_x and fixed == x0) or (side == 'r' and not along_x and fixed == x1) or (side == 'b' and along_x and fixed == z0):
                cuts.append((c, w))
        for c, w in cuts:
            out = []
            for s0, s1 in segs:
                if s0 < c - w / 2 < s1 or s0 < c + w / 2 < s1:
                    out += [(s0, c - w / 2), (c + w / 2, s1)]
                else:
                    out.append((s0, s1))
            segs = [(s0, s1) for s0, s1 in out if s1 - s0 > 0.05]
        for s0, s1 in segs:
            L, m = s1 - s0, (s0 + s1) / 2
            if along_x:
                b.box('base', mat, L, h, t, m, 0.0, fixed)
                b.box('base', cap, L + 0.03, 0.05, t + 0.05, m, h, fixed)
            else:
                b.box('base', mat, t, h, L, fixed, 0.0, m)
                b.box('base', cap, t + 0.05, 0.05, L + 0.03, fixed, h, m)
        return segs
    run('x', x0 - t / 2, x1 + t / 2, z1, True)
    run('x', x0 - t / 2, x1 + t / 2, z0, True)
    run('z', z0 + t / 2, z1 - t / 2, x0, False)
    run('z', z0 + t / 2, z1 - t / 2, x1, False)
    # słupki co ok. 1 pole (grubsze, z wyższą czapą), na rogach też
    for x in (x0, x1):
        for z in (z0, z1):
            b.box('base', cap, t + 0.08, h + 0.12, t + 0.08, x, 0.0, z)
            b.box('base', mat, t + 0.12, 0.05, t + 0.12, x, h + 0.12, z)


def gate_pillars(b, x, z, w, h=1.05, mat='castle', cap='castleDark'):
    """Dwa grube filary bramy z czapami; zwraca środki wierzchów filarów (na nich kosze z ogniem albo latarnie)"""
    tops = []
    for s in (-1, 1):
        px = x + s * (w / 2 + 0.11)
        b.box('base', cap, 0.3, 0.12, 0.3, px, 0.0, z)
        b.box('base', mat, 0.24, h - 0.2, 0.24, px, 0.12, z)
        b.box('base', cap, 0.3, 0.08, 0.3, px, h - 0.08, z)
        tops.append((px, h, z))
    return tops


def wing(b, x0, x1, z0, z1, h, roof, wall, dark, rise=0.48, windows=None, door=True):
    """Niskie skrzydło (cele magów): mury z ciosów, dach dwuspadowy z kalenicą wzdłuż z, szczyty z drobnych trójkątów
    (cień w wierzchołkach), drzwi od przodu (z1), po trzy okna w bokach; `windows` — lista znaczników szyb"""
    b.box('base', dark, x1 - x0 + 0.06, 0.12, z1 - z0 + 0.06, (x0 + x1) / 2, 0.0, (z0 + z1) / 2, bottom=False)
    b.box('base', wall, x1 - x0, h - 0.12, z1 - z0, (x0 + x1) / 2, 0.12, (z0 + z1) / 2, top=False)
    b.gable('shell', roof, x0, x1, z0, z1, h, rise, along_x=False, over=0.1)
    xm = (x0 + x1) / 2
    rows = 5
    for z, d in ((z1, 1), (z0, -1)):
        def P(i, j, z=z):
            t = i / rows
            xa, xb = x0 + (xm - x0) * t, x1 + (xm - x1) * t
            n = rows - i
            return (xa + (xb - xa) * (j / n) if n else xm, h + rise * t, z)
        for i in range(rows):
            n = rows - i
            for j in range(n):
                b.poly('shell', wall, [P(i, j), P(i, j + 1), P(i + 1, j) if n > 1 else (xm, h + rise, z)], away=(xm, h, z - d))
                if j < n - 1:
                    b.poly('shell', wall, [P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)], away=(xm, h, z - d))
        b.poly('shell', dark, [(x0, h, z - d * 0.012), (x1, h, z - d * 0.012), (xm, h + rise, z - d * 0.012)], away=(xm, h, z + d))
    if door:
        b.box('base', 'woodDark', 0.3, 0.52, 0.03, xm, 0.12, z1 + 0.01)
        b.box('base', 'iron', 0.31, 0.025, 0.04, xm, 0.42, z1 + 0.012)
        b.box('base', dark, 0.42, 0.07, 0.05, xm, 0.66, z1 + 0.01)
    L = z1 - z0
    for k in range(3):
        z = z0 + L * (k + 0.5) / 3
        for x, sd in ((x0, -1), (x1, 1)):
            b.box('base', dark, 0.05, 0.36, 0.2, x + sd * 0.006, 0.36, z)
            b.box('base', 'dark', 0.03, 0.28, 0.13, x + sd * 0.016, 0.4, z)
            if windows is not None:
                windows.append([round(x + sd * 0.035, 4), 0.68, round(z, 4), sd, 0, 0.11, 0.26, 'base'])
    return xm
