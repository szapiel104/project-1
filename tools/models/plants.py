"""Krzak i głaz z Blendera, każdy w dwóch wersjach: z bliska (pełny kształt) i z daleka (ten sam obrys z kilku ścian).
Instancjonowane w terrain.ts tysiącami, więc liczba trójkątów jest ważna: krzak z bliska ok. 220 (dawniej 320),
z daleka ok. 60; głaz z bliska 80, z daleka 20. Kolor nadaje gra (barwa instancji: zieleń liści, szarość skały);
tu tylko cień w zagłębieniach i jaśniejsze czubki (kolory wierzchołków w szarości).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/plants.py  →  src/render/models/plants.json
Układ: stoi na ziemi w (0, 0, 0), wymiary jak dawne bryły z kodu (krzak ok. 0,6 × 0,4 pola, głaz o promieniu 0,34).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, evaluated, reset, sphere  # noqa: E402

reset()
from body import pack  # noqa: E402
import bmesh  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'plants.json')


def noise(x, y, z):
    return (math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1.0


def lumpy(k, amp):
    """Kształt kępy liści: wierzchołki kuli wypchnięte szumem (gałązki, dziury), spód lekko spłaszczony"""
    def f(x, y, z):
        n = 1 + amp * (math.sin(x * 7 + k) * math.cos(z * 6 - k * 2) + 0.6 * math.sin(y * 9 + k * 3))
        return x * n, y * n * (0.82 if y < 0 else 1.0), z * n
    return f


# kępy krzaka: (środek, promień) — ten sam układ co dawny krzak z czterech kul
CLUMPS = [((0.0, 0.2, 0.0), 0.25), ((-0.2, 0.15, 0.06), 0.19), ((0.19, 0.16, -0.05), 0.2), ((0.03, 0.14, 0.2), 0.16)]


def shade_leaf(x, y, z):
    # cień i jaśniejsze czubki: im wyżej, tym jaśniej (słońce z góry), plamki
    k = 0.72 + min(0.28, y * 0.7) + (noise(x * 9, y * 9, z * 9) - 0.5) * 0.12
    return (k, k, k)


def bush(far):
    parts = []
    use = CLUMPS if not far else CLUMPS[:3]
    for i, (c, r) in enumerate(use):
        rr = r * (1.08 if far else 1.0)  # z daleka mniej kęp, więc trochę większe (ten sam obrys)
        ob = sphere(f'clump{i}{far}', c, (rr, rr * 0.9, rr), seg=5 if far else 7, rings=3 if far else 5, shape=lumpy(i * 1.7, 0.06 if far else 0.11))
        parts.append(Mesh(evaluated(ob), shade_leaf, 'leaves'))
    return parts


def shade_rock(x, y, z):
    k = 0.78 + min(0.22, y * 0.6) + (noise(x * 13, y * 13, z * 13) - 0.5) * 0.14
    return (k, k * 0.98, k * 0.95)


def shade_boulder(x, y, z):
    """Głaz polny (Michał 29.10.2026: „ładniejsze, nie takie świecące”): ciemniejszy, u dołu ziemisty, przy ziemi
    i w zagłębieniach ciemny, plamy porostów na wierzchu, ziarno skały"""
    base = 0.6 + min(0.16, y * 0.45) + (noise(x * 17, y * 17, z * 17) - 0.5) * 0.16
    if y < 0.05:
        base *= 0.7 + y * 6          # wilgotny, ziemisty spód
    r, g, b = base, base * 0.97, base * 0.92
    if y > 0.12 and noise(x * 5.3, z * 5.3, 1.7) > 0.72:   # porost / mech na górze
        r, g, b = r * 0.82, g * 0.95, b * 0.72
    return (r, g, b)


def boulder(variant, far):
    """Trzy odmiany głazu: 0 — obły, otoczak z płaskimi ścianami; 1 — kanciasty, pęknięty blok; 2 — duży kamień
    z mniejszym opartym o bok. Spód obcięty prawie płasko i lekko wkopany."""
    parts = []
    specs = {0: [((0, 0, 0), (0.36, 0.3, 0.24), 3 if not far else 1, 1.0, 0.0)],
             1: [((0, 0, 0), (0.3, 0.26, 0.3), 3 if not far else 1, 2.6, 1.0)],
             2: [((0.03, 0, 0), (0.3, 0.26, 0.23), 3 if not far else 1, 1.3, 2.0), ((-0.27, 0.12, -0.02), (0.15, 0.14, 0.12), 2 if not far else 1, 1.8, 3.0)]}[variant]
    for (cx, cy, cz), (rx, ry, rz), sub, sharp, seed in specs:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
        for v in bm.verts:
            x, y, z = v.co.x, v.co.y, v.co.z
            # kilka nałożonych fal: duże wybrzuszenia i drobniejsze szczerby; `sharp` ścina ściany (kanciasty blok)
            n = 1 + 0.14 * math.sin(x * 3.1 + seed) * math.cos(y * 2.7 - seed) + 0.08 * math.sin(z * 5.3 + seed * 2) + 0.05 * math.sin((x + y) * 9 + seed)
            if sharp > 1.5:
                m = max(abs(x), abs(y), abs(z))
                x, y, z = x / (m ** 0.55), y / (m ** 0.55), z / (m ** 0.55)
            v.co.x, v.co.y, v.co.z = cx + x * n * rx, cy + y * n * ry, z * n * rz   # Blender: z = góra
            if v.co.z < -0.05:
                v.co.z = -0.05 + (v.co.z + 0.05) * 0.15
        # spód na ziemi, lekko wkopany (3 cm). Do 30.10.2026 bryłę podnosiło o 0,7 promienia — spód wisiał ok. 8 cm nad
        # trawą i głazy „latały” (Michał)
        low = min(v.co.z for v in bm.verts)
        for v in bm.verts:
            v.co.z += -low - 0.03
        bmesh.ops.triangulate(bm, faces=bm.faces)
        parts.append(Mesh(bm, shade_boulder, 'rock'))
    return parts


def rock(far):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1 if far else 2, radius=0.34)  # w Blenderze 1 = sam dwudziestościan
    for v in bm.verts:
        # bryła z płaskimi ścianami: przesunięcie zależne od kierunku (szczelna), spód obcięty prawie płasko
        x, y, z = v.co.x, v.co.y, v.co.z
        n = 1 + 0.16 * math.sin(x * 9.1 + 1.3) * math.cos(y * 7.7 - 0.4) + 0.1 * math.sin(z * 11.3 + 2.1)
        v.co.x, v.co.y, v.co.z = x * n * 1.05, y * n * 0.95, z * n * 0.62  # Blender z = góra: głaz niższy niż szeroki
        if v.co.z < -0.06:
            v.co.z = -0.06 + (v.co.z + 0.06) * 0.15
    for v in bm.verts:
        v.co.z += 0.07   # stoi na ziemi, lekko w niej osadzony
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return [Mesh(bm, shade_rock, 'rock')]


out = {}
for k in range(3):
    for far in (False, True):
        parts = boulder(k, far)
        bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.12)
        m0 = parts[0]
        for m in parts[1:]:
            base = len(m0.pos)
            m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
            m0.idx += [tuple(base + i for i in f) for f in m.idx]
        m0.idx = [t for f in m0.idx for t in ([f] if len(f) == 3 else [(f[0], f[k2], f[k2 + 1]) for k2 in range(1, len(f) - 1)])]
        out[f'boulder{k}' + ('Far' if far else '')] = pack(m0)
        print('głaz', k, 'daleka' if far else 'bliska', len(m0.idx), 'trójkątów')
for name, fn in (('bush', bush), ('rock', rock)):
    for far in (False, True):
        parts = fn(far)
        bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.12)
        # jedna siatka na wersję (wszystko w jednym materiale)
        m0 = parts[0]
        for m in parts[1:]:
            base = len(m0.pos)
            m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
            m0.idx += [tuple(base + i for i in f) for f in m.idx]
        m0.idx = [t for f in m0.idx for t in ([f] if len(f) == 3 else [(f[0], f[k], f[k + 1]) for k in range(1, len(f) - 1)])]
        out[name + ('Far' if far else '')] = pack(m0)
        print(name, 'daleka' if far else 'bliska', len(m0.idx), 'trójkątów')


def drywall():
    """Murek z polnych kamieni (jedno pole długości, wzdłuż x): dwie warstwy płaskich kamieni na przemian,
    na wierzchu kamienie kładzione na sztorc; każdy kamień to zamknięta, lekko nieregularna bryła"""
    rnd_s = [17]

    def rnd():
        rnd_s[0] = (rnd_s[0] * 16807) % 2147483647
        return rnd_s[0] / 2147483647
    parts = []
    L = 1.02
    for course, (y0, hgt) in enumerate(((0.0, 0.085), (0.08, 0.075))):
        x = -L / 2 + (0.06 if course else 0)
        while x < L / 2 - 0.04:
            w = 0.12 + rnd() * 0.1
            w = min(w, L / 2 - x)
            for side in (-1, 1):
                bm = bmesh.new()
                bmesh.ops.create_cube(bm, size=1.0)
                d = 0.075 + rnd() * 0.02
                for v in bm.verts:
                    # Blender: x wzdłuż muru, y w poprzek, z w górę; wierzchołki trochę rozrzucone (polny kamień)
                    v.co.x = (x + w / 2) + v.co.x * (w - 0.012) + (rnd() - 0.5) * 0.02
                    v.co.y = side * (d / 2 + 0.003) + v.co.y * d * 0.95 + (rnd() - 0.5) * 0.015
                    v.co.z = y0 + (v.co.z + 0.5) * hgt * (0.85 + rnd() * 0.2)
                bmesh.ops.triangulate(bm, faces=bm.faces)
                parts.append(Mesh(bm, shade_rock, 'rock'))
            x += w + 0.008
    # wierzch: kamienie na sztorc, w poprzek muru
    x = -L / 2 + 0.03
    while x < L / 2 - 0.05:
        w = 0.05 + rnd() * 0.04
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x = (x + w / 2) + v.co.x * w + (rnd() - 0.5) * 0.012
            v.co.y = v.co.y * 0.17 + (rnd() - 0.5) * 0.015
            v.co.z = 0.158 + (v.co.z + 0.5) * (0.06 + rnd() * 0.03)
        bmesh.ops.triangulate(bm, faces=bm.faces)
        parts.append(Mesh(bm, shade_rock, 'rock'))
        x += w + 0.012
    bake_ao([(m, (0, 0, 0)) for m in parts], rays=12, reach=0.08)
    m0 = parts[0]
    for m in parts[1:]:
        base = len(m0.pos)
        m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
        m0.idx += [tuple(base + i for i in f) for f in m.idx]
    return m0


wall = drywall()
out['drywall'] = pack(wall)
print('murek', len(wall.idx), 'trójkątów')
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('plants', os.path.getsize(OUT) // 1024, 'KB')
