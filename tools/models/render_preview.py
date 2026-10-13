"""Podgląd modelu postaci z JSON-a (Cycles, CPU): python tools/models/render_preview.py guard out.png"""
import base64, json, math, os, struct, sys
import bpy
from mathutils import Vector

name, out = sys.argv[1], sys.argv[2]
d = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', f'{name}.json')))
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
DYN = {'skin': (0.85, 0.66, 0.5), 'hair': (0.25, 0.17, 0.11), 'tunic': (0.75, 0.15, 0.12)}
def unpack(m, off, arm=0.0):
    raw = lambda k: base64.b64decode(m[k])
    pos = [struct.unpack_from('<3f', raw('pos'), i * 12) for i in range(len(raw('pos')) // 12)]
    col = [struct.unpack_from('<3B', raw('col'), i * 3) for i in range(len(pos))]
    idx = [struct.unpack_from('<3H', raw('idx'), i * 6) for i in range(len(raw('idx')) // 6)]
    verts = []
    for x, y, z in pos:
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
for m in d['static']:
    if m['show'] == 'beard' and False: continue
    unpack(m, (0, 0, 0))
for sx in (-1, 1):
    for m in d['leg']: unpack(m, (sx * d['hip'][0], d['hip'][1], d['hip'][2]))
    for m in d['arm']: unpack(m, (sx * d['shoulder'][0], d['shoulder'][1], d['shoulder'][2]), arm=-0.25 if sx > 0 else 0.1)
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
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('ok', out)
