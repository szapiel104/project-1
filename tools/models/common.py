"""Wspólne narzędzia do budowania modeli postaci w Blenderze (bpy jako moduł, bez okna).

Układ współrzędnych wyniku jest układem gry (Three.js): x w prawo, y w górę, z do przodu (twarz patrzy w +z).
W Blenderze budujemy w (x, y_blender = -z_gry, z_blender = y_gry), a przy zapisie zamieniamy osie.
Każda część to lista siatek (materiał, kolory wierzchołków); części obracane (noga, ręka) mają środek obrotu w (0,0,0).
"""
import math
import bpy  # bmesh i mathutils są dostępne dopiero po wczytaniu bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def reset():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def g2b(x, y, z):
    """Punkt z układu gry do Blendera"""
    return (x, -z, y)


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def skin(name, verts, edges, radii, subsurf=2, decimate=None):
    """Bryła ze szkieletu: wierzchołki (układ gry), krawędzie, promienie (rx, rz) w każdym węźle.
    Modyfikator Skin + wygładzenie dają jedną, ciągłą, organiczną powierzchnię."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([g2b(*v) for v in verts], edges, [])
    ob = link(bpy.data.objects.new(name, me))
    sk = ob.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.6
    for i, r in enumerate(radii):
        sv = me.skin_vertices[0].data[i]
        sv.radius = r
        sv.use_root = i == 0
    if subsurf:
        ss = ob.modifiers.new('sub', 'SUBSURF')
        ss.levels = subsurf
        ss.render_levels = subsurf
    if decimate:
        d = ob.modifiers.new('dec', 'DECIMATE')
        d.ratio = decimate
    return ob


def lathe(name, profile, seg=16, depth=1.0, phi0=0.0, phi=2 * math.pi, closed=True, subsurf=1):
    """Bryła toczona z profilu [(promień, wysokość)] w układzie gry, oś y; depth spłaszcza przód-tył."""
    bm = bmesh.new()
    full = abs(phi - 2 * math.pi) < 1e-6
    n = seg if full else seg + 1
    rings = []
    for r, y in profile:
        ring = []
        for k in range(n):
            a = phi0 + phi * k / seg
            ring.append(bm.verts.new(g2b(math.sin(a) * r, y, math.cos(a) * r * depth)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            k2 = (k + 1) % n
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    for p in me.polygons:
        p.use_smooth = True
    if subsurf:
        ss = ob.modifiers.new('sub', 'SUBSURF')
        ss.levels = subsurf
    return ob


def sphere(name, center, radius, seg=24, rings=16, shape=None):
    """Kula (układ gry) z opcjonalnym kształtowaniem: shape(x, y, z) -> (x, y, z) na kuli jednostkowej."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        # kula w Blenderze: z = góra; przechodzimy na układ gry
        x, y, z = v.co.x, v.co.z, -v.co.y
        if shape:
            x, y, z = shape(x, y, z)
        cx, cy, cz = center
        rx, ry, rz = radius if isinstance(radius, tuple) else (radius, radius, radius)
        v.co = Vector(g2b(cx + x * rx, cy + y * ry, cz + z * rz))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    for p in me.polygons:
        p.use_smooth = True
    return ob


def evaluated(ob):
    """Siatka po modyfikatorach jako bmesh (trójkąty), w układzie gry"""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    bm = bmesh.new()
    bm.from_mesh(ev.to_mesh())
    ev.to_mesh_clear()
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def keep_faces(bm, pred):
    """Zostawia tylko ściany, których środek (układ gry) spełnia warunek"""
    dead = []
    for f in bm.faces:
        c = f.calc_center_median()
        if not pred(c.x, c.z, -c.y):
            dead.append(f)
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')


class Mesh:
    """Siatka gotowa do zapisu: pozycje, normalne, kolory (RGB), indeksy; w układzie gry"""

    def __init__(self, bm, color, mat='leather', dyn=None, show=None):
        bm.normal_update()
        self.pos, self.nrm, self.col, self.idx = [], [], [], []
        self.mat, self.dyn, self.show = mat, dyn, show
        index = {}
        for v in bm.verts:
            index[v.index] = len(self.pos)
            self.pos.append((v.co.x, v.co.z, -v.co.y))
            n = v.normal
            self.nrm.append((n.x, n.z, -n.y))
            c = color(v.co.x, v.co.z, -v.co.y) if callable(color) else color
            self.col.append(c)
        bm.verts.index_update()
        for f in bm.faces:
            self.idx.append(tuple(v.index for v in f.verts))
        bm.free()

    def offset(self, ox, oy, oz):
        self.pos = [(x - ox, y - oy, z - oz) for x, y, z in self.pos]
        return self


def hexrgb(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


def bake_ao(meshes, rays=28, reach=0.12, sample=None):
    """Cień w zagłębieniach: z każdego wierzchołka promienie w półkulę nad nim; zasłonięte przyciemniają kolor.
    meshes: lista (Mesh, przesunięcie do pozy spoczynkowej całej postaci) — z nich powstaje bryła do zasłaniania;
    sample: które z nich przyciemnić (każdą siatkę tylko raz, nawet gdy w pozie występuje dwa razy)"""
    verts, polys = [], []
    for m, (ox, oy, oz) in meshes:
        base = len(verts)
        verts += [Vector((x + ox, y + oy, z + oz)) for x, y, z in m.pos]
        polys += [tuple(base + i for i in f) for f in m.idx]
    tree = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
    dirs = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(rays):
        y = 1 - (i + 0.5) / rays
        r = math.sqrt(1 - y * y)
        dirs.append(Vector((math.cos(golden * i) * r, y, math.sin(golden * i) * r)))
    for m, (ox, oy, oz) in (sample if sample is not None else meshes):
        out = []
        for (x, y, z), n, c in zip(m.pos, m.nrm, m.col):
            p = Vector((x + ox, y + oy, z + oz))
            nn = Vector(n).normalized()
            hit = 0
            tot = 0
            for d in dirs:
                # obrót półkuli do normalnej: odbicie kierunków leżących pod powierzchnią
                dd = d if d.dot(nn) > 0 else -d
                w = dd.dot(nn)
                tot += w
                h = tree.ray_cast(p + nn * 0.002, dd, reach)
                if h[0] is not None:
                    hit += w * (1 - (h[3] / reach) * 0.5)
            ao = 1 - hit / max(tot, 1e-6)
            k = 0.38 + 0.62 * ao
            out.append(tuple(min(1, ch * k) for ch in c))
        m.col = out
