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
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('plants', os.path.getsize(OUT) // 1024, 'KB')
