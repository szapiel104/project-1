"""Podgląd modelu postaci z JSON-a (Cycles, CPU): python tools/models/render_preview.py guard out.png"""
import base64, json, math, os, struct, sys
import bpy
from mathutils import Vector

name, out = sys.argv[1], sys.argv[2]
d = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', f'{name}.json')))
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
DYN = {'skin': (0.85, 0.66, 0.5), 'hair': (0.25, 0.17, 0.11), 'tunic': (0.62, 0.22, 0.16), 'trousers': (0.32, 0.25, 0.17), 'hat': (0.3, 0.42, 0.2)}
# SHOW=straw,beardP — które warianty wyglądu pokazać (bez SHOW: wszystkie)
SHOW = os.environ.get('SHOW')
SHOWN = None if SHOW is None else set(SHOW.split(','))
ok = lambda m: m['show'] is None or SHOWN is None or m['show'] in SHOWN
def unpack(m, off, arm=0.0, sub=None):
    raw = lambda k: base64.b64decode(m[k])
    pos = [struct.unpack_from('<3f', raw('pos'), i * 12) for i in range(len(raw('pos')) // 12)]
    col = [struct.unpack_from('<3B', raw('col'), i * 3) for i in range(len(pos))]
    idx = [struct.unpack_from('<3H', raw('idx'), i * 6) for i in range(len(raw('idx')) // 6)]
    verts = []
    for x, y, z in pos:
        if sub:  # broń w dłoni: najpierw obrót w chwycie, potem przesunięcie do dłoni (układ ręki)
            (hx, hy, hz), a = sub
            y, z = y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)
            x, y, z = x + hx, y + hy, z + hz
        if arm:  # obrót ręki wokół barku (oś x)
            y, z = y * math.cos(arm) - z * math.sin(arm), y * math.sin(arm) + z * math.cos(arm)
        x, y, z = x + off[0], y + off[1], z + off[2]
        verts.append((x, -z, y))
    me = bpy.data.meshes.new('m'); me.from_pydata(verts, [], idx)
    for p in me.polygons: p.use_smooth = True
    ca = me.color_attributes.new('c', 'FLOAT_COLOR', 'POINT')
    tint = DYN.get(m['dyn'], (1, 1, 1))
    for i, c in enumerate(col): ca.data[i].color = (c[0] / 255 * tint[0], c[1] / 255 * tint[1], c[2] / 255 * tint[2], 1)
    ob = bpy.data.objects.new('o', me); bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('mat'); mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    attr = mat.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'c'
    mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = 0.5 if m['mat'] == 'metal' else 0
    bsdf.inputs['Roughness'].default_value = 0.45 if m['mat'] == 'metal' else 0.85
    me.materials.append(mat)
if 'hindLeg' in d:  # wilk: łapy w barkach i biodrach, kita u nasady
    for m in d['body']: unpack(m, (0, 0, 0))
    for k, (x, y, z) in enumerate([(-0.048, 0.35, 0.12), (0.048, 0.35, 0.12), (-0.05, 0.36, -0.19), (0.05, 0.36, -0.19)]):
        for m in d['leg' if k < 2 else 'hindLeg']: unpack(m, (x, y, z))
    for m in d['tail']: unpack(m, (0, 0.385, -0.25), arm=-1.2)
    d['static'], d['leg'], d['arm'] = [], [], []
elif 'leg' not in d:
    for m in d['body']: unpack(m, (0, 0, 0))
    d['static'], d['leg'], d['arm'], d['hip'], d['shoulder'] = [], [], [], [0, 0, 0], [0, 0, 0]
for m in d['static']:
    if not ok(m): continue
    unpack(m, (0, 0, 0))
for sx in (-1, 1):
    lg = float(os.environ['LEGS']) if os.environ.get('LEGS') else 0.0  # LEGS = kąt nóg (siad: −1,45)
    for m in filter(ok, d['leg']): unpack(m, (sx * d['hip'][0], d['hip'][1], d['hip'][2]), arm=lg)
    pa = float(os.environ['POSE'].split(',')[0]) if os.environ.get('POSE') else -0.25
    la = float(os.environ['LARM']) if os.environ.get('LARM') else 0.1  # LARM = kąt lewej ręki (łucznik: ręka z łukiem)
    for m in filter(ok, d['arm']): unpack(m, (sx * d['shoulder'][0], d['shoulder'][1], d['shoulder'][2]), arm=pa if sx > 0 else la)
# broń w prawej dłoni (miecz strażnika, topór zbója); STRIKE=1 — zamach znad głowy jak w grze
STRIKE = os.environ.get('STRIKE') == '1'
for key, rest, up, arm_rest, arm_up in (('sword', -0.55, -0.9, -0.15, -2.2), ('axe', -0.55, -0.75, -0.1, -2.4)):
    if key in d:
        for m in d[key]:
            pose = os.environ.get('POSE')  # POSE="ręka,broń" — dowolna faza ciosu (kąty jak w grze)
            a, w = (float(v) for v in pose.split(',')) if pose else ((arm_up, up) if STRIKE else (arm_rest, rest))
            unpack(m, (d['shoulder'][0], d['shoulder'][1], d['shoulder'][2]), arm=a, sub=(d['hand'], w))
# włócznik: włócznię składa gra w kodzie (src/render/peasants.ts) — tu ta sama bryła i oś obrotu, SPEAR="kąt,wysunięcie"
if os.environ.get('SPEAR'):
    import bmesh as _bmesh
    from mathutils import Matrix as _Mx
    ang, push = (float(v) for v in os.environ['SPEAR'].split(','))
    bm = _bmesh.new()
    def _cyl(r0, r1, length, y0, seg=8):
        ring = lambda r, y: [bm.verts.new((math.sin(2 * math.pi * k / seg) * r, 0, 0)) for k in range(0)]
    # w walce włócznia leży w dłoni: oś obrotu = dłoń po obrocie ręki (POSE), wysunięcie wzdłuż przodu
    arm_a = float(os.environ['POSE'].split(',')[0]) if os.environ.get('POSE') else -0.25
    hx, hy, hz = d['hand']
    piv = Vector((d['shoulder'][0] + hx, d['shoulder'][1] + hy * math.cos(arm_a) - hz * math.sin(arm_a), d['shoulder'][2] + hy * math.sin(arm_a) + hz * math.cos(arm_a) + push))
    def seg_mesh(r0, r1, ya, yb, col):
        me = bpy.data.meshes.new('sp'); n = 8; vs = []; fs = []
        for k in range(n):
            a = 2 * math.pi * k / n
            for r, yy in ((r0, ya), (r1, yb)):
                y, z = yy * math.cos(ang), yy * math.sin(ang)
                p = piv + Vector((math.sin(a) * r, y - 0, 0)) + Vector((0, 0, z)) + Vector((0, math.cos(a) * r * -math.sin(ang), math.cos(a) * r * math.cos(ang)))
                vs.append((p.x, -p.z, p.y))
        for k in range(n):
            a0, b0, a1, b1 = 2 * k, 2 * k + 1, 2 * ((k + 1) % n), 2 * ((k + 1) % n) + 1
            fs.append((a0, a1, b1, b0))
        me.from_pydata(vs, [], fs)
        ob = bpy.data.objects.new('sp', me); bpy.context.scene.collection.objects.link(ob)
        mt = bpy.data.materials.new('spm'); mt.use_nodes = True; mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*col, 1); me.materials.append(mt)
    seg_mesh(0.0105, 0.009, -0.3, 0.54, (0.27, 0.19, 0.11))
    seg_mesh(0.012, 0.0001, 0.56, 0.715, (0.6, 0.62, 0.65))
# łuk łucznika (składany w grze w kodzie): pionowy łuk w lewej dłoni, cięciwa po stronie łucznika
if os.environ.get('LARM') and name == 'archer':
    la = float(os.environ['LARM']); hx, hy, hz = d['hand']; S = d['shoulder']
    c, s_ = math.cos(la), math.sin(la)
    hp = Vector((-S[0] + hx, S[1] + hy * c - hz * s_, S[2] + hy * s_ + hz * c))
    pts = []
    chord, sag = 0.58, 0.07
    for k in range(17):
        t = k / 16 - 0.5
        pts.append(hp + Vector((0, t * chord, sag * (1 - (2 * t) ** 2) + 0.0)))
    me = bpy.data.meshes.new('bow'); vs = []; fs = []
    for i, p in enumerate(pts):
        for dx, dz in ((0.008, 0), (-0.008, 0), (0, 0.008)):
            q = p + Vector((dx, 0, dz)); vs.append((q.x, -q.z, q.y))
    for i in range(len(pts) - 1):
        for j in range(3):
            a, b = i * 3 + j, i * 3 + (j + 1) % 3
            fs.append((a, b, b + 3, a + 3))
    me.from_pydata(vs, [], fs)
    ob = bpy.data.objects.new('bow', me); bpy.context.scene.collection.objects.link(ob)
    mt = bpy.data.materials.new('bowm'); mt.use_nodes = True; mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.12, 0.06, 1); me.materials.append(mt)
# BODY="przechył,przewrót,obniżenie" — cała postać obrócona jak ciało poległego w grze (oś x: na plecy/twarz, oś z: na bok)
if os.environ.get('BODY'):
    bx, bz, by = (float(v) for v in os.environ['BODY'].split(','))
    from mathutils import Matrix as _MM
    M = _MM.Translation((0, 0, by + 0.06)) @ _MM.Rotation(bx, 4, 'X') @ _MM.Rotation(-bz, 4, 'Y')
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH':
            o.data.transform(M)
sc = bpy.context.scene
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
views = [(0.0, 0.0), (0.9, 0.0)]
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
sc.render.resolution_x, sc.render.resolution_y = 420, 520
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (0.9, 0.2, 0.6); sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.25, 0.27, 0.3, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8; sc.world = w
sc.camera = cam
cam.data.lens = 85
yaw = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
r = float(sys.argv[4]) if len(sys.argv) > 4 else 2.6
h = float(sys.argv[5]) if len(sys.argv) > 5 else 0.34
cam.location = (math.sin(yaw) * r, -math.cos(yaw) * r, h + r * 0.1)
cam.rotation_euler = (math.radians(84.3), 0, yaw)
if os.environ.get('CAMDOWN'):  # CAMDOWN=stopnie — kamera z góry pod kątem (jak w grze), patrzy na punkt (0, h) przy ziemi
    dn = math.radians(float(os.environ['CAMDOWN']))
    cam.location = (math.sin(yaw) * r * math.cos(dn), -math.cos(yaw) * r * math.cos(dn), h + r * math.sin(dn))
    cam.rotation_euler = (math.pi / 2 - dn, 0, yaw)
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('ok', out)
