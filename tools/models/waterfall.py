"""Wodospad pod skalną ścianą nad jeziorem albo rzeką (Gothic: surowa, mokra skała, omszone głazy).

Skalny próg z wyżłobioną rynną na krawędzi, kaskada w dwóch stopniach (woda spada na półkę w połowie ściany,
przelewa się przez nią i spada do misy), u stóp ściany mokre głazy, wokół misy omszone kamienie.
Gra wstawia model tam, gdzie woda na planszy dochodzi do skały (src/render/streams.ts), i skaluje go
do wysokości progu (model ma 5 pól wysokości; szerokość i głębokość prawie bez zmian).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/waterfall.py  →  src/render/models/waterfall.json
Układ (jak w grze): y w górę, z = w stronę wody, x w poprzek. (0, 0, 0) = tafla wody pod ścianą.
Siatki: 'rock' (skała i głazy, kolor wierzchołków = barwa, mech i cień w zagłębieniach; teksturę skały daje gra)
i 'water' (wstęgi wody: nurt w rynnie, dwa spady i przelew przez półkę; wygląd i ruch robi shader gry).
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
H = 5.0          # wysokość progu w modelu (krawędź rynny)
MID = 2.45       # półka w połowie ściany


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


def block(cx, cy, cz, sx, sy, sz, rough=0.1, moss_top=0.0, color=None):
    """Kanciasty blok skały (warstwa ściany): sześcian podzielony i poszarpany, lekko zwężony ku górze"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=2, use_grid_fill=True)
    ph = rnd() * 10
    for v in bm.verts:
        x, y, z = v.co.x, v.co.z, -v.co.y
        # ścięte krawędzie: narożniki cofnięte (bryła bardziej jak łupana skała niż pudełko)
        corner = (abs(x) + abs(y) + abs(z)) / 3
        k = 1 - max(0.0, corner - 0.6) * 0.45
        n = smooth_noise(x * 1.3 + ph, y * 1.7, z * 1.3 - ph) * rough + (noise(x + ph, y + ph, z) - 0.5) * rough * 0.6
        taper = 1 - (y + 1) * 0.04
        gx = cx + x * sx * k * taper * (1 + n)
        gy = cy + y * sy * k * (1 + n * 0.5)
        gz = cz + z * sz * k * taper * (1 + n)
        v.co.x, v.co.y, v.co.z = gx, -gz, gy
    bmesh.ops.triangulate(bm, faces=bm.faces)
    base = color or rock_color()

    def col(x, y, z):
        c = base(x, y, z)
        if moss_top > 0:
            up = max(0.0, (y - cy) / max(sy, 1e-3))
            m = moss_top * min(1.0, up * 1.4) * (0.5 + noise(x * 9, y * 9, z * 9) * 0.6)
            c = tuple(a * (1 - m) + b * m for a, b in zip(c, MOSS))
        return c
    return Mesh(bm, col, 'rock')


parts = []

# --- ściana: warstwy skalne (poziome ławice łupanych bloków), środek cofnięty — woda wyżłobiła rynnę
y = 0.0
row = 0
while y < H - 0.3:
    hy = 0.5 + rnd() * 0.4
    x = -1.75 + rnd() * 0.2
    while x < 1.75:
        wx = 0.28 + rnd() * 0.4
        center = abs(x + wx) < 0.62
        # boki cofają się w głąb (tam model przechodzi w zbocze gry), bloki na siebie zachodzą jak łupana skała
        zc = -0.7 if center else -0.2 - rnd() * 0.35 - max(0.0, abs(x + wx) - 1.1) * 0.6
        parts.append(block(x + wx, y + hy + (rnd() - 0.5) * 0.3, zc, wx * 1.12, hy * 1.08, 0.62 + rnd() * 0.25, rough=0.22, moss_top=0.25 if not center else 0.0))
        x += wx * 2 - 0.12
    y += hy * 2 - 0.18
    row += 1

# --- wierzch progu: płyty po bokach i niższa, wysunięta płyta pod rynną (z niej spada woda)
for xs in (-1.2, -0.7, 0.7, 1.2):
    parts.append(block(xs, H - 0.12 + rnd() * 0.08, -0.6, 0.3, 0.2, 0.75, rough=0.1, moss_top=0.8))
parts.append(block(0.0, H - 0.34, -0.3, 0.42, 0.16, 0.52, rough=0.08, moss_top=0.3))
parts.append(stone(-0.45, H - 0.1, 0.0, 0.2, 0.3, 0.28, rough=0.2, moss_top=0.5))
parts.append(stone(0.47, H - 0.12, 0.02, 0.22, 0.3, 0.26, rough=0.2, moss_top=0.5))
# tylna część półki nad ścianą (łączy model z płaskowyżem za krawędzią)
for xs in (-0.9, 0.0, 0.9):
    parts.append(block(xs, H - 0.3, -1.4, 0.55, 0.24, 0.5, rough=0.1, moss_top=0.9))

# --- półka w połowie: woda spada na nią i przelewa się przez krawędź
parts.append(block(0.0, MID - 0.2, 0.2, 0.62, 0.2, 0.58, rough=0.1, moss_top=0.35))
parts.append(stone(-0.72, MID - 0.05, 0.1, 0.3, 0.35, 0.36, rough=0.2, moss_top=0.5))
parts.append(stone(0.74, MID - 0.08, 0.12, 0.3, 0.35, 0.34, rough=0.2, moss_top=0.5))

# --- u stóp: mokre kamienie pod spadem i omszone głazy wokół misy
parts.append(stone(-0.55, 0.05, 0.75, 0.32, 0.28, 0.3, rough=0.2, flat_bottom=True))
parts.append(stone(0.62, 0.0, 0.7, 0.28, 0.24, 0.3, rough=0.2, flat_bottom=True))
for k in range(9):
    a = math.pi * (0.08 + 0.84 * k / 8)
    if abs(a - math.pi / 2) < 0.28:
        continue  # przód misy otwarty: woda odpływa
    r = 1.75 + rnd() * 0.35
    sx = 0.3 + rnd() * 0.25
    parts.append(stone(math.cos(a) * r * 1.15, -0.05 + rnd() * 0.08, 1.15 - math.sin(a) * 0.25 + math.sin(a) * r * 0.05 + (0.0 if abs(math.cos(a)) > 0.5 else 0.6),
                       sx, sx * 0.7, sx * 0.9, rough=0.22, moss_top=0.85, flat_bottom=True))

bake_ao([(m, (0, 0, 0)) for m in parts], rays=16, reach=0.6)
rock = parts[0]
for m in parts[1:]:
    base = len(rock.pos)
    rock.pos += m.pos; rock.nrm += m.nrm; rock.col += m.col
    rock.idx += [tuple(base + i for i in f) for f in m.idx]


# --- woda: wstęgi z dwóch warstw (przód i tył), po kolei: nurt w rynnie, spad 1, przelew przez półkę, spad 2
def strip(points, widths):
    """Wstęga przez punkty (x, y, z) środka; widths = półszerokość w każdym punkcie. Dwie warstwy (grubość ok. 4 cm)."""
    bm = bmesh.new()
    rows = []
    for (x, y, z), w in zip(points, widths):
        row = []
        for side in (-1, 1):
            row.append(bm.verts.new((x + side * w, -z, y)))
        rows.append(row)
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        bm.faces.new((a[0], a[1], b[1], b[0]))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return Mesh(bm, (1, 1, 1), 'water')


def arc(p0, p1, n, drop_shape=2.0):
    """Łuk spadu: z p0 woda wylatuje poziomo (y spada z kwadratem czasu), dolatuje do p1"""
    out = []
    for i in range(n + 1):
        t = i / n
        out.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t ** drop_shape, p0[2] + (p1[2] - p0[2]) * t))
    return out


water_parts = []
chan = [(0.0, H - 0.1, -1.7 + i * 0.25) for i in range(8)]
chan.append((0.0, H - 0.1, 0.16))
water_parts.append(strip(chan, [0.24 + i * 0.012 for i in range(len(chan))]))
fall1 = arc((0.0, H - 0.1, 0.16), (0.0, MID + 0.04, 0.42), 14)
water_parts.append(strip(fall1, [0.36 + (i / 14) * 0.16 for i in range(15)]))
over = [(0.0, MID + 0.04, 0.42), (0.0, MID + 0.05, 0.58), (0.0, MID + 0.02, 0.74)]
water_parts.append(strip(over, [0.44, 0.48, 0.5]))
fall2 = arc((0.0, MID + 0.02, 0.74), (0.0, -0.04, 1.15), 14)
water_parts.append(strip(fall2, [0.56 + (i / 14) * 0.24 for i in range(15)]))
water = water_parts[0]
for m in water_parts[1:]:
    base = len(water.pos)
    water.pos += m.pos; water.nrm += m.nrm; water.col += m.col
    water.idx += [tuple(base + i for i in f) for f in m.idx]

out = {'rock': pack(rock), 'water': pack(water)}
print('skała', len(rock.idx), 'trójkątów; woda', len(water.idx))
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print('waterfall', os.path.getsize(OUT) // 1024, 'KB')
