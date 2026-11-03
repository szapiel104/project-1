"""Głazy i skały z gry 0 A.D. (© Wildfire Games, CC BY-SA 3.0) — siatki i tekstury do gry (Michał 3.11.2026:
„czemu nie ma różnych wersji kamieni”, „tekstury skał jak z taniej gry”).

Źródła (repozytorium github.com/0ad/0ad, binaries/data/mods/public/art/):
  meshes/gaia/stone_granite_la_{a..g}.dae, stone_granite_me_{a..g}.dae, stone_granite_sm_{a,b}.dae,
  stone_granite_boulder_{a..c}.dae, stone_furrowed_0{1..4}.dae — kształty głazów (granit: duże, średnie, małe,
  okrągłe głazy; bruzdowane skały pustyni)
  textures/skins/gaia/stone_temperate_01{,_norm}.png — skała umiarkowana (łęgi, wyżyna, step, północ)
  textures/skins/gaia/stone_sahara_01{,_norm}.png — skała pustyni
  textures/skins/gaia/stonequarry_desert{,_norm}.png — bruzdowana skała pustyni

    python3 tools/models/rocks_0ad.py /katalog/art   (katalog z podkatalogami meshes/ i textures/)

Zasada (CLAUDE.md, „nie odchudzać modeli z paczek”): oryginalne trójkąty, UV i normalne, tekstury w pełnej
rozdzielczości paczki. Zmiana tylko: oś Z w górę → Y w górę (x, z, −y — wyznacznik +1, bez lustra), środek w (0, 0),
skala: najszerszy bok = 1 pole, spód lekko pod ziemią (8% wysokości), jak głaz wrośnięty w grunt.

Wynik:
  src/render/models/rocks0ad.json — { rocks: [{ name, kind, tex, pos, nrm, uv, idx }], credit }
  public/textures/cc0/oad_stone_{temperate,sahara,quarry}.jpg + _n.jpg (mapy normalnych bez zmian)
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
OUT = os.path.join(ROOT, 'src', 'render', 'models', 'rocks0ad.json')

# rodzaj → pliki siatek i tekstura
SETS = [
    ('large', 'temperate', [f'stone_granite_la_{c}' for c in 'abcdefg']),
    ('medium', 'temperate', [f'stone_granite_me_{c}' for c in 'abcdefg']),
    ('small', 'temperate', ['stone_granite_sm_a', 'stone_granite_sm_b']),
    ('boulder', 'temperate', [f'stone_granite_boulder_{c}' for c in 'abc']),
    ('furrowed', 'quarry', [f'stone_furrowed_0{i}' for i in range(1, 5)]),
]
TEXTURES = {
    'temperate': 'stone_temperate_01', 'sahara': 'stone_sahara_01', 'quarry': 'stonequarry_desert',
}


def pack(pos, nrm, uv, idx):
    e = lambda b: base64.b64encode(b).decode()
    return {
        'pos': e(b''.join(struct.pack('<3f', *p) for p in pos)),
        'nrm': e(b''.join(struct.pack('<3b', *[max(-127, min(127, round(c * 127))) for c in n]) for n in nrm)),
        'uv': e(b''.join(struct.pack('<2f', *u) for u in uv)),
        'idx': e(b''.join(struct.pack('<3H', *f) for f in idx)),
    }


def matrix_of(s):
    """Przekształcenie węzła sceny (matrix albo translate/rotate/scale) jako macierz 4×4"""
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
    """Siatka z .dae (trójkąty, wejścia VERTEX/NORMAL/TEXCOORD), z przekształceniem węzła, w układzie Z w górę"""
    s = open(path).read()
    arr = {re.search(r'id="([^"]+)"', m.group(1)).group(1): [float(x) for x in m.group(2).split()] for m in re.finditer(r'<float_array([^>]*)>([^<]*)<', s)}
    pos = next(v for k, v in arr.items() if 'osition' in k)
    nrm = next(v for k, v in arr.items() if 'ormal' in k)
    uvs = next(v for k, v in arr.items() if 'map' in k.lower() or 'uv' in k.lower() or 'texcoord' in k.lower())
    tri = re.search(r'<(triangles|polylist)[^>]*>(.*?)</\1>', s, re.S).group(2)
    off = {}
    for m in re.finditer(r'<input([^>]*)/?>', tri):
        a = m.group(1)
        sem, o = re.search(r'semantic="([^"]+)"', a), re.search(r'offset="(\d+)"', a)
        if sem and o:
            off.setdefault(sem.group(1), int(o.group(1)))
    stride = max(int(x) for x in re.findall(r'offset="(\d+)"', tri)) + 1
    vc = re.search(r'<vcount>([^<]*)</vcount>', tri)
    if vc and any(int(x) != 3 for x in vc.group(1).split()):
        raise SystemExit(f'{path}: wielokąty inne niż trójkąty')
    p = [int(x) for x in re.search(r'<p>([^<]*)</p>', tri).group(1).split()]
    corners = [p[i:i + stride] for i in range(0, len(p), stride)]
    P = np.array([pos[c[off['VERTEX']] * 3:c[off['VERTEX']] * 3 + 3] for c in corners])
    N = np.array([nrm[c[off['NORMAL']] * 3:c[off['NORMAL']] * 3 + 3] for c in corners])
    U = np.array([uvs[c[off['TEXCOORD']] * 2:c[off['TEXCOORD']] * 2 + 2] for c in corners])
    M = matrix_of(s)
    P = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
    N = N @ np.linalg.inv(M[:3, :3])  # normalne przez odwrotną transpozycję
    return P, N, U


def to_game(P, N, U):
    G = np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)
    GN = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1)
    G[:, 0] -= (G[:, 0].min() + G[:, 0].max()) / 2
    G[:, 2] -= (G[:, 2].min() + G[:, 2].max()) / 2
    k = 1.0 / max(np.ptp(G[:, 0]), np.ptp(G[:, 2]))
    G *= k
    G[:, 1] -= G[:, 1].min() + 0.08 * np.ptp(G[:, 1])
    # wierzchołki o tej samej pozycji, normalnej i UV scalamy (indeksowana siatka, mniej danych)
    key = {}
    pos, nrm, uv, idx = [], [], [], []
    face = []
    for g, n, u in zip(G, GN, U):
        n = n / (np.linalg.norm(n) or 1)
        kk = (tuple(np.round(g, 5)), tuple(np.round(n, 3)), tuple(np.round(u, 5)))
        if kk not in key:
            key[kk] = len(pos)
            pos.append(tuple(map(float, g))); nrm.append(tuple(map(float, n))); uv.append((float(u[0]), float(u[1])))
        face.append(key[kk])
        if len(face) == 3:
            idx.append(tuple(face)); face = []
    return pos, nrm, uv, idx, float(np.ptp(G[:, 1]))


def save_tex(src, name):
    for suf, out in (('', ''), ('_norm', '_n')):
        im = Image.open(os.path.join(SRC, 'textures', 'skins', 'gaia', src + suf + '.png')).convert('RGB')
        im.save(os.path.join(TEX, f'oad_stone_{name}{out}.jpg'), quality=95)
        print(f'oad_stone_{name}{out}', im.size)


rocks = []
for kind, tex, names in SETS:
    for n in names:
        P, N, U = collada(os.path.join(SRC, 'meshes', 'gaia', n + '.dae'))
        pos, nrm, uv, idx, hgt = to_game(P, N, U)
        rocks.append({'name': n, 'kind': kind, 'tex': tex, 'h': round(hgt, 3), **pack(pos, nrm, uv, idx)})
        print(n, kind, len(idx), 'trójkątów, wysokość', round(hgt, 2))
for name, src in TEXTURES.items():
    save_tex(src, name)
with open(OUT, 'w') as f:
    json.dump({'rocks': rocks, 'credit': '0 A.D. (Wildfire Games), CC BY-SA 3.0'}, f, separators=(',', ':'))
print('rocks0ad', os.path.getsize(OUT), 'B')
