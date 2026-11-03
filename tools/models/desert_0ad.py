"""Roślinność pustyni z gry 0 A.D. (© Wildfire Games, CC BY-SA 3.0): palmy daktylowe, uschnięte palmy, suche krzewy,
rośliny pustynne i suche trawy (Michał 3.11.2026: „na pustyni przyszuszone trawy, kaktusy, palmy — wszystko pobierz
i dodaj”; kaktusów 0 A.D. nie ma).

Źródła (repozytorium github.com/0ad/0ad, binaries/data/mods/public/art/):
  meshes/gaia/palm_date_new_{1..6}.dae      + textures/skins/gaia/palm_date_new_{1,2}.png (+ _norm)
  meshes/gaia/palm_dead_{1..5}.dae          + palm_dead.png
  meshes/gaia/bush_dese_a_{1,2}.dae         + bush_dese_a.dds, bush_dese_dry_{a,b,c}.dds
  meshes/gaia/wrld_plant_bush_dry{1..3}.dae + wrld_plant_bush_dry_a.dds
  meshes/gaia/plant_desert_0{1,2}.dae       + bush_desert_{a..d}.dds
  meshes/gaia/grass_large_2_tall.dae        + grass_steppe.png
  meshes/gaia/grass_la_tall_{a,b}.dae       + grass_field_dry_a.dds
  meshes/gaia/cross_large_{short,tall}.dae  + grass_field_dry_b.dds

    python3 tools/models/desert_0ad.py /katalog/art

Zasada (CLAUDE.md): oryginalne trójkąty, UV i normalne, tekstury w pełnej rozdzielczości paczki. Zmiany: oś Z w górę →
Y w górę (x, z, −y, wyznacznik +1), środek podstawy w (0, 0, 0), wysokość = 1 (gra skaluje do rodzaju rośliny).
Wielokąty (polylist/polygons) dzielone wachlarzem na trójkąty.

Wynik: src/render/models/desert0ad.json — { plants: [{ name, kind, tex: [...], w, pos, nrm, uv, idx }], credit }
       public/textures/cc0/oad_<tekstura>.jpg + oad_<tekstura>_a.jpg (maska przezroczystości, jak maskedTex)
"""
import base64
import json
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
TEX = os.path.join(ROOT, 'public', 'textures', 'cc0')
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'desert0ad.json')

SETS = [
    ('palm', ['palm_date_new_1', 'palm_date_new_2'], [f'palm_date_new_{i}' for i in range(1, 7)]),
    ('deadpalm', ['palm_dead'], [f'palm_dead_{i}' for i in range(1, 6)]),
    ('bush', ['bush_dese_a', 'bush_dese_dry_a', 'bush_dese_dry_b', 'bush_dese_dry_c'], ['bush_dese_a_1', 'bush_dese_a_2']),
    ('drybush', ['wrld_plant_bush_dry_a'], [f'wrld_plant_bush_dry{i}' for i in range(1, 4)]),
    ('desertplant', ['bush_desert_a', 'bush_desert_b', 'bush_desert_c', 'bush_desert_d'], ['plant_desert_01', 'plant_desert_02']),
    ('grass', ['grass_steppe'], ['grass_large_2_tall']),
    ('grass', ['grass_field_dry_a'], ['grass_la_tall_a', 'grass_la_tall_b']),
    ('grass', ['grass_field_dry_b'], ['cross_large_short', 'cross_large_tall']),
]


def pack(pos, nrm, uv, idx):
    e = lambda b: base64.b64encode(b).decode()
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


def matrix_of(s):
    M = np.eye(4)
    node = re.search(r'<node[^>]*>(.*?)<instance_geometry', s, re.S)
    if not node:
        return M
    body = node.group(1)
    m = re.search(r'<matrix[^>]*>([^<]*)<', body)
    if m:
        return np.array([float(x) for x in m.group(1).split()]).reshape(4, 4)
    for kind, val in re.findall(r'<(translate|rotate|scale)[^>]*>([^<]*)<', body):
        v = [float(x) for x in val.split()]
        T = np.eye(4)
        if kind == 'translate':
            T[:3, 3] = v
        elif kind == 'scale':
            T[0, 0], T[1, 1], T[2, 2] = v
        else:
            ax, ang = np.array(v[:3]), np.radians(v[3])
            if np.linalg.norm(ax) > 0 and ang:
                ax = ax / np.linalg.norm(ax)
                K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
                T[:3, :3] = np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K
        M = M @ T
    return M


def collada(path):
    """Siatka z .dae: triangles, polylist (z vcount) albo polygons (wiele <p>); wielokąty wachlarzem na trójkąty"""
    s = open(path).read()
    arr = {re.search(r'id="([^"]+)"', m.group(1)).group(1): [float(x) for x in m.group(2).split()] for m in re.finditer(r'<float_array([^>]*)>([^<]*)<', s)}
    pos = next(v for k, v in arr.items() if 'osition' in k)
    nrm = next(v for k, v in arr.items() if 'ormal' in k)
    uvs = next(v for k, v in arr.items() if 'map' in k.lower() or 'uv' in k.lower() or 'texcoord' in k.lower())
    P, N, U = [], [], []
    for m in re.finditer(r'<(triangles|polylist|polygons)[^>]*>(.*?)</\1>', s, re.S):
        kind, tri = m.group(1), m.group(2)
        off = {}
        for im in re.finditer(r'<input([^>]*)/?>', tri):
            a = im.group(1)
            sem, o = re.search(r'semantic="([^"]+)"', a), re.search(r'offset="(\d+)"', a)
            if sem and o:
                off.setdefault(sem.group(1), int(o.group(1)))
        stride = max(int(x) for x in re.findall(r'offset="(\d+)"', tri)) + 1
        polys = []
        if kind == 'polygons':
            for pm in re.finditer(r'<p>([^<]*)</p>', tri):
                p = [int(x) for x in pm.group(1).split()]
                polys.append([p[i:i + stride] for i in range(0, len(p), stride)])
        else:
            p = [int(x) for x in re.search(r'<p>([^<]*)</p>', tri).group(1).split()]
            corners = [p[i:i + stride] for i in range(0, len(p), stride)]
            vc = re.search(r'<vcount>([^<]*)</vcount>', tri)
            counts = [int(x) for x in vc.group(1).split()] if (kind == 'polylist' and vc) else [3] * (len(corners) // 3)
            k = 0
            for c in counts:
                polys.append(corners[k:k + c]); k += c
        for poly in polys:
            for j in range(1, len(poly) - 1):
                for c in (poly[0], poly[j], poly[j + 1]):
                    P.append(pos[c[off['VERTEX']] * 3:c[off['VERTEX']] * 3 + 3])
                    N.append(nrm[c[off['NORMAL']] * 3:c[off['NORMAL']] * 3 + 3])
                    U.append(uvs[c[off['TEXCOORD']] * 2:c[off['TEXCOORD']] * 2 + 2])
    P, N, U = np.array(P), np.array(N), np.array(U)
    M = matrix_of(s)
    P = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
    N = N @ np.linalg.inv(M[:3, :3])
    return P, N, U


def to_game(P, N, U):
    G = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)
    GN = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1)
    # środek podstawy: x, z ze środka pnia/kępy przy ziemi (dolne 10% wysokości), y od najniższego punktu
    lo = G[:, 1].min(); h = np.ptp(G[:, 1])
    base = G[G[:, 1] < lo + h * 0.1]
    G[:, 0] -= (base[:, 0].min() + base[:, 0].max()) / 2
    G[:, 2] -= (base[:, 2].min() + base[:, 2].max()) / 2
    G[:, 1] -= lo
    G /= h
    key = {}
    pos, nrm, uv, idx, face = [], [], [], [], []
    for g, n, u in zip(G, GN, U):
        n = n / (np.linalg.norm(n) or 1)
        kk = (tuple(np.round(g, 5)), tuple(np.round(n, 3)), tuple(np.round(u, 5)))
        if kk not in key:
            key[kk] = len(pos)
            pos.append(tuple(map(float, g))); nrm.append(tuple(map(float, n))); uv.append((float(u[0]), float(u[1])))
        face.append(key[kk])
        if len(face) == 3:
            idx.append(tuple(face)); face = []
    return pos, nrm, uv, idx, float(max(np.ptp(G[:, 0]), np.ptp(G[:, 2])))


def save_tex(name):
    for ext in ('.png', '.dds'):
        p = os.path.join(SRC, 'textures', 'skins', 'gaia', name + ext)
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA')
            break
    else:
        raise SystemExit(f'brak tekstury {name}')
    im.convert('RGB').save(os.path.join(TEX, f'oad_{name}.jpg'), quality=95)
    a = im.getchannel('A')
    Image.merge('RGB', (a, a, a)).save(os.path.join(TEX, f'oad_{name}_a.jpg'), quality=95)
    print('tekstura', name, im.size)


plants, texes = [], set()
for kind, tex, names in SETS:
    texes.update(tex)
    for n in names:
        P, N, U = collada(os.path.join(SRC, 'meshes', 'gaia', n + '.dae'))
        pos, nrm, uv, idx, w = to_game(P, N, U)
        plants.append({'name': n, 'kind': kind, 'tex': tex, 'w': round(w, 3), **pack(pos, nrm, uv, idx)})
        print(n, kind, len(idx), 'trójkątów, szerokość/wysokość', round(w, 2))
for t in sorted(texes):
    save_tex(t)
with open(OUT, 'w') as f:
    json.dump({'plants': plants, 'credit': '0 A.D. (Wildfire Games), CC BY-SA 3.0'}, f, separators=(',', ':'))
print('desert0ad', os.path.getsize(OUT), 'B')
