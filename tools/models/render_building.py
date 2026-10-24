"""Podgląd budynku z JSON-a (Cycles, CPU): python tools/models/render_building.py keep out.png [yaw] [dist] [h] [grupy]
grupy: np. base,shell (widok z zewnątrz) albo base,interior,floor (wnętrze bez dachów)."""
import base64, json, math, os, struct, sys
import bpy

name, out = sys.argv[1], sys.argv[2]
yaw = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
dist = float(sys.argv[4]) if len(sys.argv) > 4 else 22
hh = float(sys.argv[5]) if len(sys.argv) > 5 else 14
groups = (sys.argv[6] if len(sys.argv) > 6 else 'base,shell').split(',')
d = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'render', 'models', f'{name}.json')))
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
COL = {'needle': 0x3c7a3a, 'turf': 0x5f7a3a, 'leaf': 0x5c9a3c, 'leafLight': 0x7fb548, 'orchardGrass': 0x86b54a, 'appleGreen': 0xa9c23f, 'wattle': 0x9a7a4a, 'rock': 0xb3ae9f, 'cut': 0xe6dfcf, 'wheat': 0xd9b84a, 'ash': 0x4a4540, 'thatchDark': 0xa9862f, 'roadStone': 0xf4f0e8, 'ore': 0xb0623a, 'magicOre': 0x3a3cc8, 'caveWater': 0x1d2c33, 'crust': 0xe2b06a, 'cutDark': 0xc9c1ae, 'rope': 0xb89a64, 'bark': 0x7a5a3a, 'rockDark': 0x8d877a, 'basket': 0xb08a4e, 'soil': 0x86633d, 'water': 0x1b3a40, 'hide': 0x7a5a3e, 'hideDark': 0x58402c, 'canvas': 0xd8cba6, 'canvasDark': 0x9a8f78, 'window': 0xb08a5a, 'castlePlain': 0xd6c49a, 'roofTile': 0x8a3a26, 'robeRed': 0x6a1a14, 'robeBlue': 0x24406e, 'ember': 0xff8a2a, 'castle': 0xc9bb9a, 'castleDark': 0xa89a7a, 'slate': 0x6a6d74, 'woodDark': 0x5e4329, 'wood': 0x85603a, 'plank': 0xd9b27a, 'roadWood': 0xc49a6a,
       'pathCobble': 0x9e968a, 'stone': 0xcfc7b3, 'stoneDark': 0xa39b88, 'dark': 0x1c1611, 'iron': 0x4a4038, 'gold': 0xe9c145, 'flag': 0xb02020,
       'plaster': 0xf0e4c4, 'thatch': 0xd1ad4c, 'hay': 0xe0c466, 'ember': 0xff8a2a, 'bread': 0xa8652c, 'apple': 0xd0281f, 'fish': 0x9cc3d6, 'white': 0xf1ead8, 'sack': 0xbfa77c}
q = d['q']
for g in groups:
    for m in d.get(g, []):
        raw = base64.b64decode(m['pos']); ao = base64.b64decode(m['ao'])
        n = len(raw) // 6
        P = [struct.unpack_from('<3h', raw, i * 6) for i in range(n)]
        verts = [(x / q, -z / q, y / q) for x, y, z in P]
        faces = [(i, i + 1, i + 2) for i in range(0, n, 3)]
        me = bpy.data.meshes.new('m'); me.from_pydata(verts, [], faces)
        ca = me.color_attributes.new('c', 'FLOAT_COLOR', 'CORNER')
        h = COL.get(m['mat'], 0xff00ff); base = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
        base = [c ** 2.2 for c in base]
        for li, loop in enumerate(me.loops):
            k = ao[loop.vertex_index] / 255
            ca.data[li].color = (base[0] * k, base[1] * k, base[2] * k, 1)
        ob = bpy.data.objects.new('o', me); bpy.context.scene.collection.objects.link(ob)
        mat = bpy.data.materials.new('mat'); mat.use_nodes = True
        bsdf = mat.node_tree.nodes['Principled BSDF']
        attr = mat.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name = 'c'
        mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.9
        if m['mat'] == 'ember': bsdf.inputs['Emission Strength'].default_value = 3; mat.node_tree.links.new(attr.outputs['Color'], bsdf.inputs['Emission Color'])
        # jak w grze: tylne strony ścian niewidoczne (inaczej podwójne szczyty dachu wychodzą czarne)
        nt = mat.node_tree; mout = nt.nodes['Material Output']
        geo = nt.nodes.new('ShaderNodeNewGeometry'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(geo.outputs['Backfacing'], mix.inputs['Fac']); nt.links.new(bsdf.outputs['BSDF'], mix.inputs[1]); nt.links.new(tr.outputs['BSDF'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], mout.inputs['Surface'])
        me.materials.append(mat)
sc = bpy.context.scene
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'; sc.cycles.transparent_max_bounces = 32; sc.cycles.max_bounces = 16
sc.render.resolution_x, sc.render.resolution_y = 900, 700
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (0.8, 0.2, 0.9); sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.42, 0.3, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.7; sc.world = w
sc.camera = cam; cam.data.lens = 35
# kamera od frontu (brama w +z gry = -y Blendera) i z boku o kąt yaw
cam.location = (math.sin(yaw) * dist, -math.cos(yaw) * dist, hh)
direction = -cam.location.normalized() if hasattr(cam.location, 'normalized') else None
from mathutils import Vector
look = Vector((0, 0, 0.8)) - cam.location
cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('ok', out)
