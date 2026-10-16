"""Miecz strażnika (wczytywany przez guard.py do guard.json jako 'sword' i 'swordFar').

Układ gry, początek w dłoni (środek chwytu), klinga w dół (−y):
- rękojeść owinięta rzemieniem (zgrubienia owijki), głowica tarczowa z nitem,
- jelec z kutego pręta o ośmiokątnym przekroju, końce lekko opuszczone ku klindze, z kulkami,
- klinga o przekroju soczewki z wgłębionym zbroczem do 2/3 długości, zwężająca się do sztychu,
  krawędzie jaśniejsze (naostrzone), środek ciemniejszy.
Wszystko bryły zamknięte (denka, czubek domknięty w jednym wierzchołku).
"""
import math

import bmesh
from mathutils import Vector

from common import Mesh, bake_ao, hexrgb


def g2b(x, y, z):
    return (x, -z, y)


def _tri(m):
    m.idx = [t for f in m.idx for t in ([f] if len(f) == 3 else [(f[0], f[k], f[k + 1]) for k in range(1, len(f) - 1)])]
    return m


def _rings(bm, rings, cap0=True, cap1=True):
    for a, b in zip(rings, rings[1:]):
        n = len(a)
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    if cap0:
        bm.faces.new(list(reversed(rings[0])))
    if cap1:
        bm.faces.new(rings[-1])


def turned(profile, seg, depth=1.0):
    """Bryła toczona wokół osi y z profilu [(promień, y)], domknięta denkami"""
    bm = bmesh.new()
    rings = [[bm.verts.new(g2b(math.sin(2 * math.pi * k / seg) * r, y, math.cos(2 * math.pi * k / seg) * r * depth)) for k in range(seg)] for r, y in profile]
    _rings(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def sweep(path, radii, seg, flat=1.0):
    """Pręt wzdłuż łamanej (układ gry), przekrój wielokąta, denka na końcach"""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(path):
        p = Vector(p)
        d = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        u = d.cross(up).normalized(); v = d.cross(u).normalized()
        rings.append([bm.verts.new(g2b(*(p + (u * math.cos(2 * math.pi * k / seg) + v * math.sin(2 * math.pi * k / seg) * flat) * radii[i]))) for k in range(seg)])
    _rings(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def blade(far):
    """Klinga: przekrój soczewki (8 wierzchołków, ze zbroczem — wgłębieniem w środku obu płazów)"""
    bm = bmesh.new()
    y0, y1, tip = -0.024, -0.262, -0.305
    steps = 4 if far else 12
    rings = []
    for s in range(steps + 1):
        t = s / steps
        y = y0 + (y1 - y0) * t
        w = 0.0125 - 0.004 * t            # połowa szerokości: zwęża się ku sztychowi
        th = 0.0034 - 0.0012 * t          # połowa grubości
        fuller = 0.0 if far or t > 0.66 else th * 0.55 * min(1.0, (0.66 - t) * 8, t * 12 + 0.4)
        sec = [(w, 0), (w * 0.45, th), (0, th - fuller), (-w * 0.45, th), (-w, 0), (-w * 0.45, -th), (0, -th + fuller), (w * 0.45, -th)]
        rings.append([bm.verts.new(g2b(x, y, z)) for x, z in sec])
    # sztych: zbiega się do jednego wierzchołka
    apex = bm.verts.new(g2b(0, tip, 0))
    last = rings[-1]
    for k in range(len(last)):
        bm.faces.new((last[k], last[(k + 1) % len(last)], apex))
    _rings(bm, rings, cap0=True, cap1=False)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def build(far=False):
    STEEL = hexrgb(0x8a9097)
    parts = []
    # klinga: krawędzie (|x| blisko szerokości) jaśniejsze, środek i zbrocze ciemniejsze
    parts.append(Mesh(blade(far), lambda x, y, z: tuple(c * (0.78 + 0.32 * min(1.0, abs(x) / 0.011)) for c in STEEL), 'metal'))
    # jelec: kuty pręt, końce opuszczone ku klindze, na końcach kulki
    seg = 4 if far else 8
    guard = [(-0.042, -0.03, 0), (-0.03, -0.022, 0), (0, -0.019, 0), (0.03, -0.022, 0), (0.042, -0.03, 0)]
    parts.append(Mesh(sweep(guard, [0.0045, 0.0055, 0.0065, 0.0055, 0.0045], seg, flat=0.8), hexrgb(0x6e737a), 'metal'))
    if not far:
        for sx in (-1, 1):
            parts.append(Mesh(turned([(0.0001, -0.0365), (0.0045, -0.034), (0.006, -0.03), (0.0045, -0.026), (0.0001, -0.0235)], 8), hexrgb(0x6e737a), 'metal'))
            parts[-1].pos = [(x + sx * 0.043, y, z) for x, y, z in parts[-1].pos]
        # tuleja pod jelcem (wchodzi na klingę)
        parts.append(Mesh(turned([(0.007, -0.026), (0.0085, -0.022), (0.008, -0.016)], 8, depth=0.55), hexrgb(0x5d6168), 'metal'))
    # rękojeść owinięta rzemieniem: zgrubienia co kilka milimetrów
    prof = [(0.0068, -0.016)]
    n = 3 if far else 9
    for k in range(n + 1):
        y = -0.014 + 0.054 * k / n
        prof += [(0.0076, y), (0.0082 if k < n else 0.0076, y + 0.003)]
    prof.append((0.0068, 0.042))
    parts.append(Mesh(turned(prof, 6 if far else 10), hexrgb(0x3a2416), 'leather'))
    # głowica tarczowa (spłaszczona) z nitem na wierzchu
    parts.append(Mesh(turned([(0.004, 0.041), (0.011, 0.044), (0.0145, 0.05), (0.011, 0.056), (0.004, 0.059)], 8 if far else 16, depth=0.5), hexrgb(0x9a7a3a), 'metal'))
    if not far:
        parts.append(Mesh(turned([(0.0001, 0.058), (0.003, 0.0585), (0.0025, 0.062), (0.0001, 0.0625)], 6), hexrgb(0x7a6230), 'metal'))
    for m in parts:
        _tri(m)
    bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.02)
    # jedna siatka na materiał
    out = []
    for mat in ('metal', 'leather'):
        ms = [m for m in parts if m.mat == mat]
        m0 = ms[0]
        for m in ms[1:]:
            b = len(m0.pos)
            m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
            m0.idx += [tuple(b + i for i in f) for f in m.idx]
        out.append(m0)
    return out
