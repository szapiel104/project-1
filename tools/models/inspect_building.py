"""Szybki „obchód” budynku bez przeglądarki: kilkanaście zdjęć naraz na jednym arkuszu.

    /tmp/bpyenv/bin/python tools/models/inspect_building.py keep /tmp/keep_sheet.png

Renderuje silnikiem Workbench (sekundy, bez szumu) z ukrywaniem tylnych ścian — tak jak gra rysuje tylko
przednią stronę ściany. Odwrócony dach, dziura w baszcie albo ściana „od środka” od razu widać jako prześwit.
Widoki: dookoła z góry, z lotu ptaka, od dołu, przekrój bez dachów, a w zamku także z oczu człowieka
(brama, dziedziniec, sale, schody, mury, izba baszty). Kolory materiałów przybliżone (bez tekstur gry).
"""
import base64, json, math, os, struct, sys
import bpy
from mathutils import Vector

name, out = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
d = json.load(open(os.path.join(ROOT, 'src', 'render', 'models', f'{name}.json')))
COL = {'leaf': 0x5c9a3c, 'leafLight': 0x7fb548, 'orchardGrass': 0x86b54a, 'appleGreen': 0xa9c23f, 'wattle': 0x9a7a4a, 'rock': 0xb3ae9f, 'cut': 0xe6dfcf, 'wheat': 0xd9b84a, 'ash': 0x4a4540, 'castle': 0xc9bb9a, 'castleDark': 0xa89a7a, 'slate': 0x6a6d74, 'woodDark': 0x5e4329, 'wood': 0x85603a, 'plank': 0xd9b27a, 'roadWood': 0xc49a6a,
       'pathCobble': 0x9e968a, 'stone': 0xcfc7b3, 'stoneDark': 0xa39b88, 'dark': 0x1c1611, 'iron': 0x4a4038, 'gold': 0xe9c145, 'flag': 0xb02020,
       'plaster': 0xf0e4c4, 'thatch': 0xd1ad4c, 'thatchDark': 0xa9862f, 'roadStone': 0xf4f0e8, 'hay': 0xe0c466, 'ember': 0xff8a2a, 'bread': 0xa8652c, 'apple': 0xd0281f, 'fish': 0x9cc3d6, 'white': 0xf1ead8, 'sack': 0xbfa77c, 'ore': 0xb0623a, 'magicOre': 0x86b4e0, 'crust': 0xe2b06a, 'cutDark': 0xc9c1ae, 'rope': 0xb89a64, 'bark': 0x7a5a3a, 'rockDark': 0x8d877a, 'basket': 0xb08a4e, 'soil': 0x86633d}
q = d['q']
objs = {}
# inne grupy (krata zamku, taran: wóz i belka) pokazujemy razem z 'base'
EXTRA = [k for k, v in d.items() if isinstance(v, list) and v and isinstance(v[0], dict) and 'pos' in v[0] and k not in ('base', 'shell', 'interior', 'floor', 'ceiling', 'leafL', 'leafR')]
for g in ('base', 'shell', 'interior', 'floor', 'ceiling', 'leafL', 'leafR'):
    objs[g] = []
    for m in d.get(g, []) + ([x for k in EXTRA for x in d[k]] if g == 'base' else []):
        raw = base64.b64decode(m['pos']); ao = base64.b64decode(m['ao'])
        n = len(raw) // 6
        P = [struct.unpack_from('<3h', raw, i * 6) for i in range(n)]
        me = bpy.data.meshes.new('m')
        me.from_pydata([(x / q, -z / q, y / q) for x, y, z in P], [], [(i, i + 1, i + 2) for i in range(0, n, 3)])
        ca = me.color_attributes.new('c', 'BYTE_COLOR', 'CORNER')
        h = COL.get(m['mat'], 0xff00ff)
        base = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
        for li, loop in enumerate(me.loops):
            k = ao[loop.vertex_index] / 255
            ca.data[li].color = (base[0] * k, base[1] * k, base[2] * k, 1)
        ob = bpy.data.objects.new(g, me)
        bpy.context.scene.collection.objects.link(ob)
        objs[g].append(ob)
for o in list(bpy.data.objects):
    if o.type == 'CAMERA' or o.type == 'LIGHT' or (o.name not in [x.name for v in objs.values() for x in v] and o.type == 'MESH'):
        bpy.data.objects.remove(o, do_unlink=True)

sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'
sh.color_type = 'VERTEX'
sh.show_backface_culling = True
sh.show_shadows = True
sh.shadow_intensity = 0.45
sh.show_cavity = True
sh.background_type = 'VIEWPORT'
sh.background_color = (0.45, 0.6, 0.8)
sc.display.light_direction = (0.5, -0.4, 0.75)
W, Hh = 520, 330
sc.render.resolution_x, sc.render.resolution_y = W, Hh
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam

def show(groups):
    for g, lst in objs.items():
        for o in lst:
            o.hide_render = g not in groups

def shot(path, eye, target, groups, lens=24):
    """eye/target w układzie gry (x, y w górę, z w przód) → Blender (x, -z, y)"""
    show(groups)
    e = Vector((eye[0], -eye[2], eye[1])); t = Vector((target[0], -target[2], target[1]))
    cam.location = e
    cam.rotation_euler = (t - e).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

OUT, IN, ROOM = ('base', 'shell', 'leafL', 'leafR'), ('base', 'interior', 'floor'), ('base', 'interior', 'floor', 'ceiling')
views = []
# odległość kamery z rozmiaru budynku
xs = []
for m in d.get('base', []):
    raw = base64.b64decode(m['pos'])
    xs += [abs(v) / q for v in struct.unpack_from(f'<{len(raw) // 2}h', raw)[::3]]
R = max(4.0, max(xs, default=2) * (2.3 if max(xs, default=2) > 4 else 3.0))
for i in range(8):  # dookoła
    a = i * math.pi / 4
    views.append((f'dookoła {i * 45}°', (math.sin(a) * R, R * 0.55, math.cos(a) * R), (0, 0.8, 0), OUT, 28))
views.append(('z lotu ptaka', (0.01, R * 1.5, 0.01), (0, 0, 0), OUT, 24))
views.append(('przekrój bez dachów', (R * 0.35, R * 1.1, R * 0.55), (0, 0, 0), IN, 24))
views.append(('od dołu: narożnik', (-R * 0.55, 0.3, R * 0.55), (-R * 0.38, R * 0.18, R * 0.38), OUT, 20))
views.append(('od dołu: przód', (0, 0.25, R * 0.63), (0, R * 0.1, R * 0.4), OUT, 20))
# z oczu chłopa dookoła (spacer): z ziemi, patrząc w górę pod okap — dach i szczyty nie mogą prześwitywać
for i in range(4):
    a = math.pi / 4 + i * math.pi / 2
    views.append((f'z ziemi {45 + i * 90}°', (math.sin(a) * R * 0.42, 0.46, math.cos(a) * R * 0.42), (0, R * 0.22, 0), OUT, 18))
# z boku przy szczycie, na wysokości okapu: połać po drugiej stronie kalenicy i jej okap widać od spodu
for i in range(4):
    a = math.pi / 4 + i * math.pi / 2
    views.append((f'przy szczycie {45 + i * 90}°', (math.sin(a) * R * 0.3, R * 0.2, math.cos(a) * R * 0.38), (-math.sin(a) * R * 0.05, R * 0.27, 0), OUT, 20))
# widoki z oczu człowieka zapisuje skrypt budynku w modelu (klucz 'views'), np. keep.py
for label, eye, tgt, groups, lens in d.get('views', []):
    views.append((label, tuple(eye), tuple(tgt), tuple(groups), lens))
tmp = '/tmp/_inspect'
os.makedirs(tmp, exist_ok=True)
paths = []
for i, (label, eye, tgt, groups, lens) in enumerate(views):
    p = f'{tmp}/{i:02d}.png'
    shot(p, eye, tgt, groups, lens)
    paths.append((p, label))
json.dump(paths, open(f'{tmp}/list.json', 'w'))
print('ok', len(paths))
