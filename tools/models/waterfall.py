"""Wodospad pod skalną ścianą nad jeziorem albo rzeką (Gothic: surowa, mokra skała, omszone głazy).

Ścianą jest skała terenu, wodę (nurt na półce i kurtynę wzdłuż zbocza) robi gra (src/render/streams.ts).
Model daje tylko kamienie: omszone głazy przy wylocie na krawędzi progu i mokre głazy wokół misy u stóp.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/waterfall.py  →  src/render/models/waterfall.json
Układ (jak w grze): y w górę, z = w stronę wody, x w poprzek. (0, 0, 0) = tafla wody pod ścianą.
Siatki: 'lip' i 'pool' (kolor wierzchołków = barwa, mech i cień w zagłębieniach; teksturę skały daje gra).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, reset  # noqa: E402

reset()
from body import pack  # noqa: E402
import bmesh  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', 'waterfall.json')


def noise(x, y, z):
    return (math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1.0


def smooth_noise(x, y, z):
    return (math.sin(x * 1.7 + y * 0.9) * math.cos(z * 1.3 - y * 0.6) + math.sin(x * 3.1 - z * 2.3 + y * 1.9) * 0.5) / 1.5


seed_state = [7]


def rnd():
    seed_state[0] = (seed_state[0] * 1664525 + 1013904223) % 4294967296
    return seed_state[0] / 4294967296


MOSS = (0.29, 0.36, 0.17)


def rock_color(wet_below=1.2, moss=0.0):
    def f(x, y, z):
        n = noise(x * 7, y * 7, z * 7)
        k = 0.7 + (n - 0.5) * 0.16 + min(0.12, y * 0.02)
        # mokra skała przy wodzie i za spadem: ciemniejsza
        wet = max(0.0, 1.0 - y / wet_below) * 0.35 + (0.25 if abs(x) < 0.7 and z < 0.3 else 0.0)
        k *= 1.0 - wet
        c = (k, k * 0.98, k * 0.95)
        if moss > 0:
            m = moss * (0.6 + n * 0.5)
            c = tuple(a * (1 - m) + b * m for a, b in zip(c, MOSS))
        return c
    return f


def stone(cx, cy, cz, sx, sy, sz, sub=2, rough=0.18, color=None, moss_top=0.0, flat_bottom=False):
    """Głaz albo blok skały: dwudziestościan podzielony, rozciągnięty i poszarpany szumem; ścięte ściany (fasety).
    Omszony wierzch: moss_top > 0 zielenieje tam, gdzie ściana patrzy w górę."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    ph = rnd() * 10
    for v in bm.verts:
        x, y, z = v.co.x, v.co.z, -v.co.y      # współrzędne gry
        d = 1 + rough * smooth_noise(x * 2 + ph, y * 2 - ph, z * 2) + (noise(x + ph, y, z) - 0.5) * rough * 0.5
        gx, gy, gz = x * d * sx + cx, y * d * sy + cy, z * d * sz + cz
        if flat_bottom:
            gy = max(gy, cy - sy * 0.55)
        v.co.x, v.co.y, v.co.z = gx, -gz, gy
    bmesh.ops.triangulate(bm, faces=bm.faces)
    base = color or rock_color()

    def col(x, y, z):
        c = base(x, y, z)
        if moss_top > 0:
            up = max(0.0, (y - cy) / max(sy, 1e-3))
            m = moss_top * min(1.0, up * 1.6) * (0.55 + noise(x * 9, y * 9, z * 9) * 0.6)
            c = tuple(a * (1 - m) + b * m for a, b in zip(c, MOSS))
        return c
    return Mesh(bm, col, 'rock')


# Ścianą wodospadu jest prawdziwa skała terenu (gra kładzie kurtynę wody wzdłuż zbocza z mapy wysokości).
# Wcześniej model miał własną ścianę z łupanych bloków, ale w grze wyglądała jak słup kamieni przyklejony do góry
# i zasłaniała wodę (18.10). Teraz model to tylko dwie grupy kamieni, skalowane w grze równo we wszystkich osiach:
#   'lip'  — wylot na krawędzi progu: (0, 0, 0) = środek nurtu na krawędzi, woda wypływa w stronę +z, nurt ma
#            wolny pas |x| < 0,4 (kamienie leżą po bokach i nie zasłaniają wody);
#   'pool' — misa u stóp: (0, 0, 0) = miejsce uderzenia wody na tafli, ściana za nią w stronę −z, przód (+z) otwarty.


def merged(meshes):
    m0 = meshes[0]
    for m in meshes[1:]:
        base = len(m0.pos)
        m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
        m0.idx += [tuple(base + i for i in f) for f in m.idx]
    return m0


# --- wylot: dwa omszone głazy po bokach nurtu, za nimi mniejsze kamienie wzdłuż koryta na półce
lip = [
    stone(-0.72, 0.08, -0.05, 0.36, 0.3, 0.4, rough=0.24, moss_top=0.75, flat_bottom=True),
    stone(0.76, 0.06, 0.02, 0.33, 0.27, 0.38, rough=0.24, moss_top=0.75, flat_bottom=True),
    stone(-0.58, 0.02, -0.75, 0.24, 0.17, 0.27, rough=0.22, moss_top=0.85, flat_bottom=True),
    stone(0.6, 0.02, -0.9, 0.22, 0.16, 0.25, rough=0.22, moss_top=0.85, flat_bottom=True),
    stone(-0.52, 0.0, -1.45, 0.17, 0.12, 0.2, rough=0.2, moss_top=0.9, flat_bottom=True),
    stone(0.5, 0.0, -1.6, 0.18, 0.12, 0.2, rough=0.2, moss_top=0.9, flat_bottom=True),
]
bake_ao([(m, (0, 0, 0)) for m in lip], rays=16, reach=0.4)

# --- misa: mokre kamienie u stóp ściany po bokach spadu, dookoła omszone głazy, z przodu odpływ
wet = rock_color(wet_below=0.6)
pool = [
    stone(-0.85, 0.02, -0.55, 0.36, 0.3, 0.34, rough=0.22, color=wet, flat_bottom=True),
    stone(0.9, 0.0, -0.5, 0.32, 0.27, 0.32, rough=0.22, color=wet, flat_bottom=True),
]
for (x, z, r, moss) in ((-1.55, 0.15, 0.42, 0.6), (-1.95, -0.55, 0.36, 0.7), (-1.3, 0.95, 0.3, 0.8),
                        (1.6, 0.2, 0.4, 0.6), (2.0, -0.6, 0.34, 0.7), (1.35, 1.0, 0.28, 0.8),
                        (-0.75, 1.55, 0.2, 0.85), (0.8, 1.6, 0.18, 0.85)):
    pool.append(stone(x, 0.0, z, r * (0.9 + rnd() * 0.3), r * 0.62, r * (0.8 + rnd() * 0.3), rough=0.24, moss_top=moss, flat_bottom=True))
bake_ao([(m, (0, 0, 0)) for m in pool], rays=16, reach=0.5)

out = {'lip': pack(merged(lip)), 'pool': pack(merged(pool))}
print('wylot i misa gotowe')
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('waterfall', os.path.getsize(OUT) // 1024, 'KB')
