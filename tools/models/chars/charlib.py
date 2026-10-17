"""Postacie ze szkieletem: ciało z MPFB, ubiór i zbroja dopasowane do sylwetki, tekstury pieczone z wersji
szczegółowej na prostą siatkę gry, ruch z nagrań CMU przeniesiony na nasz szkielet. Wynik: jeden plik .glb
(siatka ze skórą, szkielet, animacje, rekwizyty przypięte do dłoni).

Opis i przygotowanie: tools/models/chars/README.md. Przepisy postaci: guard.py itd.

Układ Blendera: z w górę, postać patrzy w -y, lewa strona postaci to +x. Metry.
"""
from __future__ import annotations

import math
import os
import random
import sys

import bpy  # noqa: I001 — bpy najpierw, dopiero potem jego moduły (bmesh, mathutils)
import bmesh
import mathutils
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.environ.get('CHAR_ASSETS', os.path.join(HERE, '.assets'))
MPFB = 'bl_ext.user_default.mpfb'


# ───────────────────────────── ciało ─────────────────────────────

def reset() -> None:
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures, bpy.data.actions):
        for b in list(coll):
            coll.remove(b)


def enable_mpfb() -> None:
    import addon_utils
    if MPFB not in sys.modules:
        addon_utils.enable(MPFB, default_set=True)


def make_body(gender=1.0, age=0.6, muscle=0.7, weight=0.55, height=0.55, proportions=0.6, rig='cmu_mb'):
    """Ciało z MPFB z szkieletem `rig` (cmu_mb = nazwy kości jak w nagraniach CMU). Zwraca (ciało, szkielet).
    Kształt jest zapieczony (bez kluczy kształtu), pomocnicze bryły MPFB usunięte, oczy z MakeHumana dołożone."""
    enable_mpfb()
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    macros = {'gender': gender, 'age': age, 'muscle': muscle, 'weight': weight, 'proportions': proportions,
              'height': height, 'cupsize': 0.5, 'firmness': 0.5,
              'race': {'asian': 0.0, 'caucasian': 1.0, 'african': 0.0}}
    body = HumanService.create_human(macro_detail_dict=macros)
    arm = HumanService.add_builtin_rig(body, rig)
    eyes = None
    mhclo = os.path.join(ASSETS, 'eyes', 'low-poly', 'low-poly.mhclo')
    if os.path.exists(mhclo):
        try:
            eyes = HumanService.add_mhclo_asset(mhclo, body, asset_type='Eyes', subdiv_levels=0, material_type='NONE')
        except Exception as e:  # oczy są ozdobą; bez nich model i tak powstaje
            print('oczy:', e)
    # zapieczenie kształtu i usunięcie pomocniczych brył (maska „body”)
    for ob in [body] + ([eyes] if eyes else []):
        bpy.context.view_layer.objects.active = ob
        if ob.data.shape_keys:
            ob.shape_key_add(name='mix', from_mix=True)
            keys = ob.data.shape_keys.key_blocks
            for k in list(keys)[:-1]:
                ob.shape_key_remove(k)
            ob.shape_key_remove(ob.data.shape_keys.key_blocks[0])
    for m in list(body.modifiers):
        if m.type == 'MASK':
            with bpy.context.temp_override(object=body):
                bpy.ops.object.modifier_apply(modifier=m.name)
    for m in list(body.modifiers):
        if m.type == 'SUBSURF':
            body.modifiers.remove(m)
    body.name = 'body'
    if eyes:
        eyes.name = 'eyes'
        for m in list(eyes.modifiers):
            if m.type == 'SUBSURF':
                eyes.modifiers.remove(m)
    arm.name = 'rig'
    return body, arm, eyes


class Body:
    """Pomocnik do wybierania stref ciała: dominująca kość wierzchołka, punkty kości, promień przez BVH."""

    def __init__(self, body, arm):
        self.ob, self.arm = body, arm
        me = body.data
        self.co = [v.co.copy() for v in me.vertices]
        self.no = [v.normal.copy() for v in me.vertices]
        names = {g.index: g.name for g in body.vertex_groups}
        bones = {b.name for b in arm.data.bones}
        self.dom: list[str] = []
        self.w: list[dict[str, float]] = []
        for v in me.vertices:
            ws = {names[g.group]: g.weight for g in v.groups if names[g.group] in bones and g.weight > 0}
            self.w.append(ws)
            self.dom.append(max(ws, key=ws.get) if ws else '')
        self.groups = {}
        for g in body.vertex_groups:
            if g.name in ('scalp', 'lips', 'ears', 'fingernails', 'toenails', 'genitals', 'nipple'):
                s = set()
                for v in me.vertices:
                    for gg in v.groups:
                        if gg.group == g.index and gg.weight > 0.5:
                            s.add(v.index)
                self.groups[g.name] = s
        bm = bmesh.new()
        bm.from_mesh(me)
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()

    def head(self, bone: str) -> Vector:
        return self.arm.data.bones[bone].head_local.copy()

    def tail(self, bone: str) -> Vector:
        return self.arm.data.bones[bone].tail_local.copy()

    def along(self, i: int, bone: str) -> float:
        """Położenie wierzchołka wzdłuż kości: 0 przy stawie, 1 przy końcu"""
        a, b = self.head(bone), self.tail(bone)
        d = b - a
        return (self.co[i] - a).dot(d) / d.length_squared

    def radius_at(self, center: Vector, direction: Vector, far=0.5) -> float:
        """Odległość od `center` do skóry w kierunku `direction` (promień od zewnątrz do środka)"""
        d = direction.normalized()
        hit = self.bvh.ray_cast(center + d * far, -d, far)
        return far - hit[3] if hit[0] is not None else 0.0


SIDES = ('Left', 'Right')
TORSO = {'LowerBack', 'Spine', 'Spine1'}


def side_bones(*names):
    return {s + n for s in SIDES for n in names}


# ───────────────────────────── powłoki na ciele ─────────────────────────────

def shell(B: Body, name: str, pick, offset: float, thick: float, mat, relax: int = 4, smooth: int = 1,
          grow: float = 0.0, flat: bool = False):
    """Powłoka z wybranych ścian ciała (`pick(i) -> bool` dla wierzchołka), odsunięta o `offset` wzdłuż normalnych,
    z grubością `thick` (bryła zamknięta), wygładzona na brzegu. `grow` dodaje odsunięcie rosnące ku dołowi (fartuchy)."""
    me = B.ob.data
    sel = [pick(i) for i in range(len(me.vertices))]
    bm = bmesh.new()
    idx = {}
    for p in me.polygons:
        if all(sel[v] for v in p.vertices):
            pv = list(p.vertices)
            if max((B.co[a] - B.co[b]).length for a, b in zip(pv, pv[1:] + pv[:1])) > 0.1:
                continue  # ściana-łącznik siatki MPFB (np. między dłońmi), nie powierzchnia ciała
            vs = []
            for v in p.vertices:
                if v not in idx:
                    idx[v] = bm.verts.new(B.co[v] + B.no[v] * offset)
                vs.append(idx[v])
            try:
                bm.faces.new(vs)
            except ValueError:
                pass
    if not bm.faces:
        bm.free()
        raise ValueError(f'pusta powłoka {name}')
    # tylko największa zwarta część (odcina pojedyncze ścianki na brzegu wyboru)
    bm.faces.ensure_lookup_table()
    seen, parts = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        stack, part = [f], []
        seen.add(f)
        while stack:
            g = stack.pop()
            part.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        stack.append(h)
        parts.append(part)
    parts.sort(key=len, reverse=True)
    keep = set(parts[0])
    if len(parts) > 1 and len(parts[1]) > 0.35 * len(parts[0]):  # dwie podobne części (np. lewa i prawa ręka)
        keep |= set(parts[1])
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # brzeg: wygładzenie wzdłuż brzegu (ząbki po siatce ciała znikają)
    for _ in range(relax):
        border = [v for v in bm.verts if v.is_boundary]
        new = {}
        for v in border:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                new[v] = v.co * 0.4 + (nb[0].co + nb[1].co) * 0.3
        for v, c in new.items():
            v.co = c
    if grow:
        zs = [v.co.z for v in bm.verts]
        top = max(zs)
        bm.normal_update()
        for v in bm.verts:
            v.co += v.normal * grow * (top - v.co.z)
    for _ in range(smooth):
        bmesh.ops.smooth_vert(bm, verts=list(bm.verts), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    m = bpy.data.meshes.new(name)
    bm.to_mesh(m)
    bm.free()
    ob = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(ob)
    if thick:
        s = ob.modifiers.new('grubość', 'SOLIDIFY')
        s.thickness = thick
        s.offset = 1.0
        s.use_even_offset = False  # równe odsunięcie robi kolce na czubkach palców i stóp
        s.use_quality_normals = True
        s.use_rim = True
        apply_mods(ob)
    finish(ob, mat, flat)
    return ob


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        with bpy.context.temp_override(object=ob):
            bpy.ops.object.modifier_apply(modifier=m.name)


def finish(ob, mat, flat=False):
    for p in ob.data.polygons:
        p.use_smooth = not flat
    ob.data.materials.clear()
    if mat:
        ob.data.materials.append(mat)


def mesh_from(name, verts, faces, mat=None, flat=False):
    m = bpy.data.meshes.new(name)
    m.from_pydata([tuple(v) for v in verts], [], faces)
    m.update()
    ob = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(ob)
    finish(ob, mat, flat)
    return ob


def tube(name, rings, mat=None, cap=True, flat=False):
    """Bryła z pierścieni (lista list punktów o tej samej długości), zamknięta denkami"""
    n = len(rings[0])
    verts = [p for r in rings for p in r]
    faces = []
    for j in range(len(rings) - 1):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    if cap:
        faces.append(tuple(range(n))[::-1])
        faces.append(tuple(range((len(rings) - 1) * n, len(rings) * n)))
    return mesh_from(name, verts, faces, mat, flat)


def box(name, center, size, mat=None, rot=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES')
    m = bpy.data.meshes.new(name)
    bm.to_mesh(m)
    bm.free()
    ob = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(ob)
    if rot:
        ob.rotation_euler = rot
    ob.location = center
    bake_transform(ob)
    finish(ob, mat, flat=True)
    return ob


def sphere(name, center, r, mat=None, scale=(1, 1, 1), seg=8, rings=6):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(center)
    m = bpy.data.meshes.new(name)
    bm.to_mesh(m)
    bm.free()
    ob = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(ob)
    finish(ob, mat)
    return ob


def hull(name, pts, grow, mat, sole=None):
    """Gładka bryła wokół punktów (otoczka wypukła, powiększona o `grow`, wygładzona); `sole` = płaska podeszwa na tej wysokości"""
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=list(bm.verts))
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    for _ in range(3):
        bmesh.ops.smooth_vert(bm, verts=list(bm.verts), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * grow
        if sole is not None and v.co.z < sole:
            v.co.z = sole
    m = bpy.data.meshes.new(name)
    bm.to_mesh(m)
    bm.free()
    ob = bpy.data.objects.new(name, m)
    bpy.context.scene.collection.objects.link(ob)
    finish(ob, mat)
    return ob


def bake_transform(ob):
    ob.data.transform(ob.matrix_basis)
    ob.matrix_basis = Matrix()


def join(objs, name):
    objs = [o for o in objs if o]
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def rivets_along(name, B: Body, pts, r, mat, lift=0.0):
    """Nity: małe kopułki w podanych punktach skóry powłoki (punkty już na powierzchni)"""
    parts = [sphere(f'{name}{i}', p + n * lift, r, mat, scale=(1, 1, 1), seg=6, rings=4) for i, (p, n) in enumerate(pts)]
    return join(parts, name) if parts else None


def surface_points(ob, pick, step: int = 1):
    """Punkty i normalne wierzchołków powłoki spełniające `pick(co)`, co `step`-ty"""
    out = []
    for i, v in enumerate(ob.data.vertices):
        if pick(v.co) and i % step == 0:
            out.append((v.co.copy(), v.normal.copy()))
    return out


# ───────────────────────────── materiały do pieczenia ─────────────────────────────

def material(name, color, rough=0.7, metal=0.0, noise=0.15, noise_scale=40.0, bump=0.3, bump_scale=120.0,
             dark=(0.0, 0.0, 0.0), wear=0.0, pattern=None):
    """Materiał proceduralny (kolor z plamami szumu, wypukłość drobnej faktury). Pieczony do tekstur gry.
    `pattern`: 'weave' (tkanina), 'grain' (skóra), 'scratch' (żelazo), 'hair' (włosy), None."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N = nt.nodes
    L = nt.links
    bsdf = N['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    tc = N.new('ShaderNodeTexCoord')
    # plamy koloru
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = noise_scale / 10
    nz.inputs['Detail'].default_value = 6
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*[c * (1 - noise) + d * noise for c, d in zip(color, dark)], 1)
    ramp.color_ramp.elements[1].color = (*[min(1, c * (1 + noise * 0.6)) for c in color], 1)
    L.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    col_out = ramp.outputs['Color']
    if wear:
        # przetarcia na wypukłościach (krawędzie) jaśniejsze
        geo = N.new('ShaderNodeNewGeometry')
        wr = N.new('ShaderNodeValToRGB')
        wr.color_ramp.elements[0].position = 0.53
        wr.color_ramp.elements[1].position = 0.62
        L.new(geo.outputs['Pointiness'], wr.inputs['Fac'])
        k = N.new('ShaderNodeMath')
        k.operation = 'MULTIPLY'
        L.new(wr.outputs['Color'], k.inputs[0])
        k.inputs[1].default_value = wear * 0.7
        mix = N.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MIX'
        L.new(k.outputs[0], mix.inputs['Factor'])
        L.new(col_out, mix.inputs['A'])
        mix.inputs['B'].default_value = (*[min(1, c * 1.7 + 0.03) for c in color], 1)
        col_out = mix.outputs['Result']
    L.new(col_out, bsdf.inputs['Base Color'])
    # faktura
    h = None
    if pattern == 'weave':
        w = N.new('ShaderNodeTexWave')
        w.wave_type = 'BANDS'
        w.inputs['Scale'].default_value = bump_scale
        w2 = N.new('ShaderNodeTexWave')
        w2.wave_type = 'BANDS'
        w2.bands_direction = 'Y'
        w2.inputs['Scale'].default_value = bump_scale
        L.new(tc.outputs['Object'], w.inputs['Vector'])
        L.new(tc.outputs['Object'], w2.inputs['Vector'])
        mx = N.new('ShaderNodeMath')
        mx.operation = 'MULTIPLY'
        L.new(w.outputs['Fac'], mx.inputs[0])
        L.new(w2.outputs['Fac'], mx.inputs[1])
        h = mx.outputs[0]
    elif pattern in ('grain', 'scratch', 'hair'):
        t = N.new('ShaderNodeTexVoronoi' if pattern == 'grain' else 'ShaderNodeTexNoise')
        t.inputs['Scale'].default_value = bump_scale
        if pattern == 'hair':
            mp = N.new('ShaderNodeMapping')
            mp.inputs['Scale'].default_value = (1, 1, 14)
            L.new(tc.outputs['Object'], mp.inputs['Vector'])
            L.new(mp.outputs['Vector'], t.inputs['Vector'])
        elif pattern == 'scratch':
            mp = N.new('ShaderNodeMapping')
            mp.inputs['Scale'].default_value = (1, 18, 1)
            mp.inputs['Rotation'].default_value = (0.4, 0.8, 0.2)
            L.new(tc.outputs['Object'], mp.inputs['Vector'])
            L.new(mp.outputs['Vector'], t.inputs['Vector'])
        else:
            L.new(tc.outputs['Object'], t.inputs['Vector'])
        h = t.outputs[0] if pattern != 'grain' else t.outputs['Distance']
    if h is not None and bump:
        b = N.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        b.inputs['Distance'].default_value = 0.002
        L.new(h, b.inputs['Height'])
        L.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    m['metal'] = metal
    m['rough'] = rough
    return m


# ───────────────────────────── podgląd ─────────────────────────────

def preview(objs, path, views=((0, 0), (90, 0), (180, 0), (35, 15)), size=640, focus=None, samples=24, ortho=True, height=None):
    """Render Cycles z kilku stron (obrót wokół z w stopniach, nachylenie), sklejony w jeden obraz."""
    sc = bpy.context.scene
    hide = [o for o in sc.objects if o.type == 'MESH' and o not in objs]
    for o in hide:
        o.hide_render = True
    for o in objs:
        o.hide_render = False
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    mid = focus or (lo + hi) / 2
    H = height or (hi.z - lo.z) * 1.12
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    sc.cycles.use_denoising = True
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.film_transparent = False
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.16, 0.16, 0.17, 1)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    cam = bpy.data.objects.get('_cam') or bpy.data.objects.new('_cam', bpy.data.cameras.new('_cam'))
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    cam.data.ortho_scale = H
    cam.data.lens = 70
    for nm, en, rot in (('_key', 3.2, (50, 0, 35)), ('_fill', 1.0, (65, 0, -150)), ('_rim', 2.0, (110, 0, 180))):
        L = bpy.data.objects.get(nm)
        if not L:
            L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN'))
            sc.collection.objects.link(L)
        L.data.energy = en
        L.rotation_euler = tuple(math.radians(a) for a in rot)
    tiles = []
    base = os.path.splitext(path)[0]
    for k, (az, el) in enumerate(views):
        a, e = math.radians(az), math.radians(el)
        d = 8.0
        dirv = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        cam.location = mid + dirv * d
        cam.rotation_euler = (-dirv).to_track_quat('-Z', 'Y').to_euler()
        f = f'{base}_{k}.png'
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        tiles.append(f)
    for o in hide:
        o.hide_render = False
    _sheet(tiles, path)
    return path


def _sheet(files, out, cols=None):
    imgs = [bpy.data.images.load(f) for f in files]
    w, h = imgs[0].size
    cols = cols or len(imgs)
    rows = (len(imgs) + cols - 1) // cols
    big = [0.0] * (w * cols * h * rows * 4)
    for k, im in enumerate(imgs):
        px = list(im.pixels)
        cx, cy = k % cols, rows - 1 - k // cols
        for y in range(h):
            row = px[y * w * 4:(y + 1) * w * 4]
            o = ((cy * h + y) * w * cols + cx * w) * 4
            big[o:o + w * 4] = row
    img = bpy.data.images.new('_sheet', w * cols, h * rows)
    img.pixels = big
    img.filepath_raw = out
    img.file_format = 'PNG'
    img.save()
    for im in imgs:
        bpy.data.images.remove(im)
    bpy.data.images.remove(img)
    for f in files:
        os.remove(f)


# ───────────────────────────── siatka gry i pieczenie ─────────────────────────────

def select(objs, active=None):
    bpy.context.view_layer.update()  # po usunięciu obiektów lista warstwy bywa nieaktualna (puste wpisy)
    for o in bpy.context.view_layer.objects:
        if o:
            o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def copy(ob, name):
    c = ob.copy()
    c.data = ob.data.copy()
    c.name = name
    for m in list(c.modifiers):
        c.modifiers.remove(m)
    c.parent = None
    c.matrix_world = ob.matrix_world
    bpy.context.scene.collection.objects.link(c)
    for g in list(c.vertex_groups):
        c.vertex_groups.remove(g)
    return c


def tris(ob) -> int:
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def decimate_to(ob, target: int):
    n = tris(ob)
    if n > target:
        d = ob.modifiers.new('mniej', 'DECIMATE')
        d.decimate_type = 'COLLAPSE'
        d.ratio = target / n
        d.use_collapse_triangulate = True
        apply_mods(ob)
    return ob


def remesh_core(objs, voxel: float, target: int, name='rdzeń'):
    """Bryły przylegające do ciała → jedna zamknięta powłoka (remesh wokselowy), uproszczona do `target` trójkątów"""
    cs = [copy(o, o.name + '_k') for o in objs]
    core = join(cs, name)
    r = core.modifiers.new('woksel', 'REMESH')
    r.mode = 'VOXEL'
    r.voxel_size = voxel
    r.adaptivity = 0.0
    apply_mods(core)
    s = core.modifiers.new('gładko', 'SMOOTH')
    s.factor = 0.5
    s.iterations = 2
    apply_mods(core)
    decimate_to(core, target)
    return core


def low_parts(objs, budget: dict):
    """Osobne cienkie części (płyty, fartuchy, pochwa) uproszczone każda do swojego limitu trójkątów"""
    out = []
    for o in objs:
        c = copy(o, o.name + '_k')
        t = budget.get(o.name)
        if t is None:
            for k, v in budget.items():
                if o.name.startswith(k):
                    t = v
        if t:
            decimate_to(c, t)
        out.append(c)
    return out


def skin_low(low, body, arm, rigid=None, hips_blend=None):
    """Wagi kości przeniesione z ciała (najbliższa ściana). `rigid`: {obiekt-część: kość} — część sztywno na kości.
    `hips_blend`: lista (zakres wierzchołków lub obiekt-część, z_góra, z_dół) — wagi płynnie z bioder w nogi (fartuchy)."""
    select([low])
    for g in list(low.vertex_groups):
        low.vertex_groups.remove(g)
    for b in arm.data.bones:
        low.vertex_groups.new(name=b.name)
    dt = low.modifiers.new('wagi', 'DATA_TRANSFER')
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    apply_mods(low)
    return low


def normalize_weights(ob, limit=4):
    select([ob])
    with bpy.context.temp_override(object=ob):
        bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=limit)
        bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
        bpy.ops.object.vertex_group_clean(group_select_mode='ALL', limit=0.01)
        bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)


def set_weights(ob, verts, weights: dict):
    """Nadpisuje wagi wierzchołków `verts` (indeksy) na podane {kość: waga}"""
    gi = {g.name: g for g in ob.vertex_groups}
    for g in ob.vertex_groups:
        g.remove(list(verts))
    for name, w in weights.items():
        if w > 0:
            gi[name].add(list(verts), w, 'REPLACE')


def unwrap(ob, margin=0.003):
    select([ob])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.6, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(margin=margin, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')


def _bake_img(name, size, color=(0.5, 0.5, 0.5, 1), non_color=False):
    img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    img.generated_color = color
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def bake(low, hi_objs, out_dir, name, size=1024, extrusion=0.02, ray=0.05, samples=16):
    """Pieczenie z wersji szczegółowej na siatkę gry: kolor (z cieniem w zagłębieniach), mapa normalnych,
    chropowatość i metal. Zapisuje {name}_c.png, _n.png, _orm.png (R = cień, G = chropowatość, B = metal)."""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.render.bake.use_selected_to_active = True
    sc.render.bake.cage_extrusion = extrusion
    sc.render.bake.max_ray_distance = ray
    sc.render.bake.margin = 6
    mat = bpy.data.materials.new(name + '_bake')
    mat.use_nodes = True
    low.data.materials.clear()
    low.data.materials.append(mat)
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    mat.node_tree.nodes.active = tex
    for o in hi_objs:
        o.hide_render = False
    select(hi_objs + [low], low)
    res = {}

    def run(kind, img, **kw):
        tex.image = img
        bpy.ops.object.bake(type=kind, **kw)
        return img

    nrm = run('NORMAL', _bake_img(name + '_n', size, (0.5, 0.5, 1, 1), True))
    ao = run('AO', _bake_img(name + '_ao', size, (1, 1, 1, 1), True))
    rough = run('ROUGHNESS', _bake_img(name + '_r', size, (0.7, 0.7, 0.7, 1), True))
    # kolor i metal: chwilowo emisja = kolor bazowy / metaliczność każdego materiału
    # (pieczenie DIFFUSE daje czarne żelazo, bo metal nie ma koloru rozproszonego)
    mats = []
    for o in hi_objs:
        for m in o.data.materials:
            if m and m not in mats and m.node_tree.nodes.get('Principled BSDF'):
                mats.append(m)

    def emit_bake(img, socket):
        saved = []
        for m in mats:
            nt = m.node_tree
            b = nt.nodes['Principled BSDF']
            out = nt.nodes['Material Output']
            em = nt.nodes.new('ShaderNodeEmission')
            src = b.inputs[socket]
            if src.links:
                nt.links.new(src.links[0].from_socket, em.inputs['Color'])
            else:
                v = src.default_value
                em.inputs['Color'].default_value = (v, v, v, 1) if isinstance(v, float) else tuple(v)
            old = out.inputs['Surface'].links[0].from_socket
            nt.links.new(em.outputs[0], out.inputs['Surface'])
            saved.append((m, old, em))
        run('EMIT', img)
        for m, old, em in saved:
            m.node_tree.links.new(old, m.node_tree.nodes['Material Output'].inputs['Surface'])
            m.node_tree.nodes.remove(em)
        return img
    col = emit_bake(_bake_img(name + '_c', size), 'Base Color')
    metal = emit_bake(_bake_img(name + '_m', size, (0, 0, 0, 1), True), 'Metallic')
    # złożenie: kolor × cień, ORM (numpy, bo pętla po milionie pikseli w Pythonie trwa minutę)
    import numpy as np
    W = size * size * 4

    def px(img):
        arr = np.empty(W, dtype=np.float32)
        img.pixels.foreach_get(arr)
        return arr.reshape(-1, 4)
    c, a, r, mt = px(col), px(ao), px(rough), px(metal)
    c[:, :3] *= (0.45 + 0.55 * a[:, :1])
    col.pixels.foreach_set(c.ravel())
    orm = _bake_img(name + '_orm', size, (1, 1, 1, 1), True)
    o = np.stack([a[:, 0], r[:, 0], mt[:, 0], np.ones(len(a), np.float32)], 1)
    orm.pixels.foreach_set(o.ravel())
    paths = {}
    for img, key in ((col, 'c'), (nrm, 'n'), (orm, 'orm')):
        p = os.path.join(out_dir, f'{name}_{key}.png')
        img.filepath_raw = p
        img.file_format = 'PNG'
        img.save()
        paths[key] = p
    # materiał gry na siatce: tekstury z pieczenia
    final = bpy.data.materials.new(name)
    final.use_nodes = True
    N, L = final.node_tree.nodes, final.node_tree.links
    bs = N['Principled BSDF']
    tc = N.new('ShaderNodeTexImage')
    tc.image = col
    L.new(tc.outputs['Color'], bs.inputs['Base Color'])
    tn = N.new('ShaderNodeTexImage')
    tn.image = nrm
    nm = N.new('ShaderNodeNormalMap')
    L.new(tn.outputs['Color'], nm.inputs['Color'])
    L.new(nm.outputs['Normal'], bs.inputs['Normal'])
    to = N.new('ShaderNodeTexImage')
    to.image = orm
    sep = N.new('ShaderNodeSeparateColor')
    L.new(to.outputs['Color'], sep.inputs['Color'])
    L.new(sep.outputs['Green'], bs.inputs['Roughness'])
    L.new(sep.outputs['Blue'], bs.inputs['Metallic'])
    low.data.materials.clear()
    low.data.materials.append(final)
    return paths


# ───────────────────────────── ruch z nagrań (BVH) ─────────────────────────────

def load_bvh(path, name):
    """Nagranie CMU jako szkielet z animacją (120 kl./s, pierwsza klatka to T-poza)"""
    before = set(bpy.data.objects)
    bpy.ops.import_anim.bvh(filepath=path, global_scale=1.0, rotate_mode='NATIVE', update_scene_fps=False,
                            update_scene_duration=False, use_fps_scale=False)
    src = [o for o in bpy.data.objects if o not in before][0]
    src.name = name
    return src


def _world_pose(arm):
    return {pb.name: arm.matrix_world @ pb.matrix for pb in arm.pose.bones}


def _facing(arm, mats):
    """Kierunek patrzenia szkieletu w płaszczyźnie ziemi (z bioder i ud)"""
    l, r = mats['LeftUpLeg'].translation, mats['RightUpLeg'].translation
    side = Vector((l.x - r.x, l.y - r.y, 0)).normalized()
    return side.cross(Vector((0, 0, 1))).normalized()  # lewa w +x → przód w -y


def sample_bvh(src, frames):
    """Pozy świata kości źródła w podanych klatkach (lista słowników nazwa → macierz)"""
    sc = bpy.context.scene
    out = []
    for f in frames:
        sc.frame_set(int(f), subframe=f - int(f))
        out.append(_world_pose(src))
    return out


KEEP_REST = {'LHipJoint', 'RHipJoint'}  # łączniki biodro–udo: u nas inna długość i kąt, zostają jak w spoczynku


def retarget(src, tgt, start, end, name, fps=30, in_place=True, loop=False, blend=0.25, face=None):
    """Przeniesienie ruchu klatek [start, end] nagrania (120 kl./s) ze szkieletu `src` na `tgt` jako akcja `name`.

    Dla każdej kości: obrót względem T-pozy nagrania (D = P · T⁻¹), obrócony do naszego kierunku patrzenia (Q),
    nałożony na naszą kość ustawioną jak w T-pozie (spoczynek obrócony tak, by kość wskazywała jak w nagraniu —
    u nas ręce w spoczynku są opuszczone, w nagraniu rozłożone). `in_place`: biodra bez przesuwu w poziomie
    (postać przesuwa symulacja gry). `loop`: końcówka płynnie wraca do początku (chód, spoczynek)."""
    T = sample_bvh(src, [1])[0]
    tw = {b.name: tgt.matrix_world @ b.matrix_local for b in tgt.data.bones}
    Q = _facing(src, T).rotation_difference(Vector((0, -1, 0)))
    order = []

    def walk(b):
        order.append(b)
        for c in b.children:
            walk(c)
    for b in tgt.data.bones:
        if b.parent is None:
            walk(b)
    # nasza kość w pozie odpowiadającej T-pozie nagrania
    restT = {}
    for b in order:
        if b.name in T and b.name not in KEEP_REST:
            ds = Q @ (T[b.name].to_3x3() @ Vector((0, 1, 0)))
            dt = tw[b.name].to_3x3() @ Vector((0, 1, 0))
            restT[b.name] = dt.normalized().rotation_difference(ds.normalized()) @ tw[b.name].to_quaternion()
    n = max(2, int(round((end - start) / 120 * fps)) + 1)
    poses = sample_bvh(src, [start + (end - start) * i / (n - 1) for i in range(n)])
    # kierunek odcinka: średni kierunek patrzenia bioder w tych klatkach (nagranie bywa obrócone względem T-pozy)
    avg = Vector((0, 0, 0))
    for P in poses:
        avg += _facing(src, P)
    Qc = avg.normalized().rotation_difference(Vector((0, -1, 0))) if face is None else Quaternion((0, 0, 1), math.radians(face)) @ avg.normalized().rotation_difference(Vector((0, -1, 0)))
    k = tw['Hips'].translation.z / T['Hips'].translation.z
    base = poses[0]['Hips'].translation.copy()
    act = bpy.data.actions.new(name)
    tgt.animation_data_create()
    tgt.animation_data.action = act
    Qi = Q.inverted()
    for fi, P in enumerate(poses):
        M = {}
        for b in order:
            rest = tw[b.name]
            if b.name in restT:
                D = Qc @ (P[b.name].to_quaternion() @ T[b.name].to_quaternion().inverted()) @ Qi
                rot = D @ restT[b.name]
            else:  # kość bez odpowiednika w nagraniu: trzyma się rodzica jak w spoczynku
                par = b.parent
                rot = M[par.name].to_quaternion() @ (tw[par.name].to_quaternion().inverted() @ rest.to_quaternion())
            if b.parent is None:
                d = Qc @ (P['Hips'].translation - base)
                h = Vector((0 if in_place else d.x, 0 if in_place else d.y, (P['Hips'].translation.z - T['Hips'].translation.z)))
                loc = rest.translation + h * k
            else:
                loc = (M[b.parent.name] @ (tw[b.parent.name].inverted() @ rest)).translation
            M[b.name] = Matrix.Translation(loc) @ rot.to_matrix().to_4x4()
        for b in order:
            pb = tgt.pose.bones[b.name]
            rest = tw[b.name]
            if b.parent:
                basis = (tw[b.parent.name].inverted() @ rest).inverted() @ M[b.parent.name].inverted() @ M[b.name]
            else:
                basis = rest.inverted() @ M[b.name]
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = basis.to_quaternion()
            pb.keyframe_insert('rotation_quaternion', frame=fi + 1, group=b.name)
            if b.parent is None:
                pb.location = basis.translation
                pb.keyframe_insert('location', frame=fi + 1, group=b.name)
    _fix_quat_flips(act)
    if loop:
        _close_loop(act, n, max(2, int(n * blend)))
    act.use_fake_user = True
    return act


def _curves(act):
    """Krzywe akcji (Blender 5: kanały w warstwach i taśmach akcji, starsze: act.fcurves)"""
    if hasattr(act, 'fcurves') and act.fcurves:
        return list(act.fcurves)
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def _fix_quat_flips(act):
    by = {}
    for fc in _curves(act):
        if fc.data_path.endswith('rotation_quaternion'):
            by.setdefault(fc.data_path, [None] * 4)[fc.array_index] = fc
    for fcs in by.values():
        if None in fcs:
            continue
        n = len(fcs[0].keyframe_points)
        prev = None
        for i in range(n):
            q = Quaternion([fc.keyframe_points[i].co[1] for fc in fcs])
            if prev is not None and prev.dot(q) < 0:
                q = -q
                for j, fc in enumerate(fcs):
                    fc.keyframe_points[i].co[1] = q[j]
            prev = q


def _close_loop(act, n, k):
    """Ostatnie `k` klatek przechodzi płynnie w pierwszą; ostatnia = pierwsza (pętla bez szarpnięcia)"""
    for fc in _curves(act):
        kp = fc.keyframe_points
        first = kp[0].co[1]
        for j in range(k):
            i = n - k + j
            t = (j + 1) / k
            t = t * t * (3 - 2 * t)
            kp[i].co[1] = kp[i].co[1] * (1 - t) + first * t
        fc.update()


def best_loop(src, start, end, min_len, max_len, travel=0.0, bones=('LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftArm', 'RightArm')):
    """Szuka w nagraniu odcinka [a, b] o długości z zakresu, którego koniec najbardziej przypomina początek (pętla)"""
    step = 4
    fr = list(range(start, end + 1, step))
    P = sample_bvh(src, fr)
    def key(p):
        return [c for b in bones for c in p[b].to_quaternion()]
    K = [key(p) for p in P]
    best = None
    for i in range(len(fr)):
        for j in range(i + 1, len(fr)):
            L = fr[j] - fr[i]
            if L < min_len or L > max_len:
                continue
            if travel:
                d = P[j]['Hips'].translation - P[i]['Hips'].translation
                if Vector((d.x, d.y)).length < travel:
                    continue
            d = sum(min((x - y) ** 2, (x + y) ** 2) for x, y in zip(K[i], K[j]))
            if best is None or d < best[0]:
                best = (d, fr[i], fr[j])
    return best[1], best[2]


def clip_range(src):
    fc = _curves(src.animation_data.action)
    lo, hi = fc[0].range()
    return int(lo), int(hi)


def peak_speed(src, bone, start, end, step=2):
    """Klatka największej prędkości kości (np. dłoni przy ciosie)"""
    fr = list(range(start, end, step))
    P = sample_bvh(src, fr)
    best, bf = -1, start
    for i in range(1, len(P)):
        v = (P[i][bone].translation - P[i - 1][bone].translation).length
        if v > best:
            best, bf = v, fr[i]
    return bf


def fall_range(src, start, end, step=4):
    """Upadek: od chwili, gdy biodra zaczynają opadać, do chwili, gdy leżą nieruchomo"""
    fr = list(range(start, end, step))
    P = sample_bvh(src, fr)
    z = [p['Hips'].translation.z for p in P]
    top = max(z[:len(z) // 2])
    low = min(z)
    i0 = next(i for i in range(len(z)) if z[i] < top - 0.15 * (top - low))
    i1 = next(i for i in range(i0, len(z)) if z[i] < low + 0.08 * (top - low))
    return fr[max(0, i0 - 8)], min(end, fr[i1] + 120)


def anim_sheet(objs, arm, act, out, n=6, view=(90, 0), size=260, height=2.1):
    """Kilka klatek animacji obok siebie (do obejrzenia ruchu)"""
    arm.animation_data.action = act
    lo, hi = _curves(act)[0].range()
    files = []
    for k in range(n):
        f = round(lo + (hi - lo) * k / (n - 1))
        bpy.context.scene.frame_set(f)
        p = f'{os.path.splitext(out)[0]}_{k}f.png'
        preview(objs, p, views=(view,), size=size, samples=8, height=height)
        files.append(p)
    _sheet(files, out)
    return out


def append_pose(act, pose_act, frames, hips_shift=Vector((0, 0, 0)), ease='EASE_IN'):
    """Dokleja na końcu akcji `act` ostatnią pozę z `pose_act` po `frames` klatkach (np. leżenie po upadku).
    Ruch do niej z przyspieszeniem jak przy spadaniu; biodra przesunięte o `hips_shift` względem końca `act`."""
    src = {(fc.data_path, fc.array_index): fc for fc in _curves(pose_act)}
    for fc in _curves(act):
        kp = fc.keyframe_points
        last = kp[-1]
        f0 = last.co[0]
        other = src.get((fc.data_path, fc.array_index))
        if other is None:
            continue
        v = other.keyframe_points[-1].co[1]
        if fc.data_path.endswith('location') and 'Hips' in fc.data_path:
            v = last.co[1] + hips_shift[fc.array_index] if fc.array_index < 2 else v
        last.interpolation = 'SINE'
        last.easing = ease
        kp.insert(f0 + frames, v)
        kp.insert(f0 + frames + 12, v)
        fc.update()
    _fix_quat_flips(act)


def add_rotation(act, bone, quat):
    """Stały dodatkowy obrót kości w całej akcji (np. zaciśnięta pięść na rękojeści)"""
    path = f'pose.bones["{bone}"].rotation_quaternion'
    fcs = [None] * 4
    for fc in _curves(act):
        if fc.data_path == path:
            fcs[fc.array_index] = fc
    if None in fcs:
        return
    for i in range(len(fcs[0].keyframe_points)):
        q = Quaternion([fc.keyframe_points[i].co[1] for fc in fcs]) @ quat
        for j, fc in enumerate(fcs):
            fc.keyframe_points[i].co[1] = q[j]
    for fc in fcs:
        fc.update()


def export_glb(path, mesh, arm, extras=(), actions=()):
    """Plik gry: siatka ze skórą, szkielet, wszystkie akcje (jako osobne animacje), rekwizyty przypięte do kości"""
    for a in actions:
        a.use_fake_user = True
    # każda akcja jako ścieżka NLA, żeby eksporter zapisał wszystkie
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = None
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for a in actions:
        tr = ad.nla_tracks.new()
        tr.name = a.name
        st = tr.strips.new(a.name, 1, a)
        st.name = a.name
    select([mesh, arm, *extras], arm)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
        export_def_bones=False, export_force_sampling=True, export_frame_step=1,
        export_image_format='JPEG', export_jpeg_quality=88, export_apply=False, export_yup=True,
        export_tangents=False, export_morph=False, export_extras=True, export_cameras=False, export_lights=False,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False)
    return path


def team_mask(low, team_objs, other_objs, name='team'):
    """Kolor wierzchołków: 1 tam, gdzie najbliższa powierzchnia wersji szczegółowej należy do części w barwach
    drużyny (gra miesza tam kolor pana), 0 gdzie indziej"""
    def tree(objs):
        bm = bmesh.new()
        for o in objs:
            t = bmesh.new()
            t.from_mesh(o.data)
            t.transform(o.matrix_world)
            m = bpy.data.meshes.new('_t')
            t.to_mesh(m)
            t.free()
            bm.from_mesh(m)
            bpy.data.meshes.remove(m)
        tr = BVHTree.FromBMesh(bm)
        bm.free()
        return tr
    ta, tb = tree(team_objs), tree(other_objs)
    attr = low.data.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(low.data.vertices):
        pa = ta.find_nearest(v.co)
        pb = tb.find_nearest(v.co)
        da = pa[3] if pa[0] is not None else 9
        db = pb[3] if pb[0] is not None else 9
        k = 1.0 if da < db - 0.002 else 0.0
        attr.data[i].color = (k, k, k, 1.0)
    low.data.color_attributes.active_color = attr
    return attr


def split_attr(ob, attr, name):
    """Odcina ściany z atrybutem `attr` = 1 do nowego obiektu `name` (UV, materiał i wagi zostają)"""
    new = ob.copy()
    new.data = ob.data.copy()
    new.name = name
    bpy.context.scene.collection.objects.link(new)
    for target, keep in ((ob, 0), (new, 1)):
        bm = bmesh.new()
        bm.from_mesh(target.data)
        layer = bm.faces.layers.int.get(attr)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[layer] != keep], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(target.data)
        bm.free()
        target.data.attributes.remove(target.data.attributes[attr])
    return new
