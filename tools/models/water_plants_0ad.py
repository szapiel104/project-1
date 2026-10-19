"""Trzciny (pałka wodna) i rośliny pływające z gry 0 A.D. (© Wildfire Games, CC BY-SA 3.0) — siatki i tekstury do gry.

Źródła (repozytorium github.com/0ad/0ad, binaries/data/mods/public/art/):
  meshes/gaia/cattails.dae, textures/skins/gaia/cattails_1.png, cattails_2.png — kępa pałki wodnej (dwie odmiany)
  meshes/gaia/pond_lillies_large.dae, textures/skins/gaia/water_plants_lg.dds — kożuch liści na stawie

    python3 tools/models/water_plants_0ad.py /katalog/z/plikami

Zasada: bez przeróbek. Siatki idą do gry z oryginalnymi trójkątami, UV i normalnymi (tylko obrót osi Z→Y
i skala do pól mapy), tekstury w oryginalnej rozdzielczości (256×512 i 512×512). Jedyna zmiana w obrazie:
kolor pod przezroczystymi pikselami rozlany z sąsiednich (rysunek bez zmian), żeby mipmapy nie ciemniały na brzegach.

Wynik:
  src/render/models/waterplants.json — reeds (pałka), lilies (kożuch liści)
  public/textures/cc0/oad_cattails_1.jpg, oad_cattails_2.jpg, oad_lilies.jpg (+ `_a` maska; przez `maskedTex`)
"""
import base64
import json
import math
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'waterplants.json')

REED_H = 0.95   # wysokość kępy pałki w polach (jak dotychczasowe trzciny: ok. 0,9)
LILY_W = 1.2    # bok kożucha liści w polach (pojedynczy liść wychodzi ok. 0,05 pola)


def pack(pos, nrm, uv, idx):
    e = lambda b: base64.b64encode(b).decode()
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


def collada(path):
    """Prosta siatka z pliku .dae (jedna geometria, trójkąty, wejścia VERTEX/NORMAL/TEXCOORD) w układzie Z w górę."""
    s = open(path).read()
    arr = {m.group(1): [float(x) for x in m.group(2).split()] for m in re.finditer(r'<float_array id="([^"]+)"[^>]*>([^<]*)<', s)}
    pos = next(v for k, v in arr.items() if 'osition' in k)
    nrm = next(v for k, v in arr.items() if 'ormal' in k)
    uvs = next(v for k, v in arr.items() if 'map' in k or 'UV' in k)
    off = {}
    for m in re.finditer(r'<input semantic="(VERTEX|NORMAL|TEXCOORD)"[^>]*offset="(\d+)"', s):
        off[m.group(1)] = int(m.group(2))
    stride = max(off.values()) + 1
    p = [int(x) for blk in re.findall(r'<p>([^<]*)</p>', s) for x in blk.split()]
    corners = [p[i:i + stride] for i in range(0, len(p), stride)]
    P, N, U = [], [], []
    for c in corners:
        vi, ni, ti = c[off['VERTEX']], c[off['NORMAL']], c[off['TEXCOORD']]
        P.append(pos[vi * 3:vi * 3 + 3])
        N.append(nrm[ni * 3:ni * 3 + 3])
        U.append(uvs[ti * 2:ti * 2 + 2])
    return np.array(P), np.array(N), np.array(U)


def to_game(P, N, U, height=None, width=None):
    """Z w górę → Y w górę (x, z, -y); grunt jak w oryginale (y=0), środek w (0, 0); skala do pól."""
    G = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)
    GN = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1)
    G[:, 0] -= (G[:, 0].min() + G[:, 0].max()) / 2
    G[:, 2] -= (G[:, 2].min() + G[:, 2].max()) / 2
    # wysokość zostaje z oryginału: korzenie lekko pod ziemią (w 0 A.D. podstawa kępy jest ok. 5% pod gruntem)
    k = height / (G[:, 1].max() or 1) if height else width / max(np.ptp(G[:, 0]), np.ptp(G[:, 2]))
    G *= k
    # wierzchołki rozpisane po narożnikach trójkątów (płaskie karty, kilkanaście trójkątów — bez scalania)
    pos = [tuple(map(float, g)) for g in G]
    nrm = [tuple(map(float, n / (np.linalg.norm(n) or 1))) for n in GN]
    uv = [(float(u[0]), float(u[1])) for u in U]
    idx = [(i, i + 1, i + 2) for i in range(0, len(pos), 3)]
    return pos, nrm, uv, idx


def bleed(rgba):
    a = rgba[:, :, 3:4] / 255.0
    solid = a > 0.3
    rgb = np.where(solid, rgba[:, :, :3].astype(np.float32), 0)
    w = solid.astype(np.float32)
    for _ in range(24):
        k = lambda x: np.roll(x, 1, 0) + np.roll(x, -1, 0) + np.roll(x, 1, 1) + np.roll(x, -1, 1) + x
        fs, ws = k(rgb), k(w)
        grow = (w == 0) & (ws > 0)
        rgb = np.where(grow, fs / np.maximum(ws, 1e-4), rgb)
        w = np.where(grow, 1.0, w)
    avg = rgba[:, :, :3][solid[:, :, 0]].mean(0)
    rgb = np.where(w > 0, rgb, avg)
    return rgb.clip(0, 255).astype(np.uint8), rgba[:, :, 3]


def save_tex(src, name):
    im = np.array(Image.open(os.path.join(SRC, src)).convert('RGBA'))
    rgb, a = bleed(im)
    Image.fromarray(rgb, 'RGB').save(os.path.join(TEX, name + '.jpg'), quality=95)
    Image.fromarray(np.dstack([a, a, a]), 'RGB').save(os.path.join(TEX, name + '_a.jpg'), quality=95)
    print(name, im.shape[1], 'x', im.shape[0])


out = {}
P, N, U = collada(os.path.join(SRC, 'cattails.dae'))
out['reeds'] = pack(*to_game(P, N, U, height=REED_H))
print('pałka', len(P) // 3, 'trójkątów')
# kożuch liści: w 0 A.D. płaski kwadrat z całą teksturą (dane .dae w calach z obrotami węzła) — ten sam kwadrat
# i te same UV, tylko już leżący płasko w polach gry
h = LILY_W / 2
lp = [(-h, 0, -h), (h, 0, -h), (h, 0, h), (-h, 0, h)]
out['lilies'] = pack(lp, [(0, 1, 0)] * 4, [(0, 1), (1, 1), (1, 0), (0, 0)], [(0, 2, 1), (0, 3, 2)])
save_tex('cattails_1.png', 'oad_cattails_1')
save_tex('cattails_2.png', 'oad_cattails_2')
save_tex('water_plants_lg.dds', 'oad_lilies')
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('waterplants', os.path.getsize(OUT), 'B')
