"""Strażnik (straż w stylu Starego Obozu): barczysty mężczyzna po trzydziestce, krótkie włosy i broda,
wełniany kaftan, skórzany napierśnik z żelaznymi płytami i nitami, naramienniki z trzech płyt, pas z klamrą,
skórzane fartuchy na udach, karwasze, rękawice, buty z cholewami, miecz w pochwie przy lewym biodrze.

Uruchomienie: python tools/models/chars/guard.py [--preview plik.png] [--out plik.glb]
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charlib as C  # noqa: E402
from mathutils import Vector  # noqa: E402


def build():
    C.reset()
    body, arm, eyes = C.make_body(gender=1.0, age=0.62, muscle=0.78, weight=0.6, height=0.58, proportions=0.65)
    B = C.Body(body, arm)

    M = dict(
        skin=C.material('skóra', (0.52, 0.32, 0.23), rough=0.6, noise=0.12, dark=(0.45, 0.22, 0.18), bump=0.08, pattern='grain', bump_scale=400),
        hair=C.material('włosy', (0.06, 0.045, 0.035), rough=0.8, noise=0.3, pattern='hair', bump=0.6, bump_scale=60),
        wool=C.material('wełna', (0.05, 0.04, 0.034), rough=0.95, noise=0.25, dark=(0.1, 0.03, 0.02), pattern='weave', bump=0.35, bump_scale=260),
        trousers=C.material('spodnie', (0.055, 0.045, 0.035), rough=0.95, noise=0.25, pattern='weave', bump=0.3, bump_scale=240),
        leather=C.material('skóra wyprawiona', (0.16, 0.045, 0.026), rough=0.75, noise=0.35, dark=(0.08, 0.04, 0.02), pattern='grain', bump=0.25, bump_scale=90, wear=0.35),
        darkleather=C.material('ciemna skóra', (0.04, 0.026, 0.017), rough=0.7, noise=0.3, pattern='grain', bump=0.25, bump_scale=110, wear=0.25),
        iron=C.material('żelazo', (0.2, 0.2, 0.21), rough=0.45, metal=1.0, noise=0.35, dark=(0.12, 0.10, 0.09), pattern='scratch', bump=0.15, bump_scale=200, wear=0.6),
        brass=C.material('mosiądz', (0.55, 0.40, 0.18), rough=0.4, metal=1.0, noise=0.2),
        eye=C.material('oko', (0.85, 0.82, 0.78), rough=0.2, noise=0.0, bump=0),
    )
    C.finish(body, M['skin'])
    if eyes:
        C.finish(eyes, M['eye'])

    hips, crotch = B.head('LeftUpLeg'), None
    crotch_z = hips.z - 0.06
    neck_z = B.head('Neck').z
    knee_z = B.head('LeftLeg').z
    ankle_z = B.head('LeftFoot').z
    belt_z = crotch_z + 0.16
    sh = B.head('LeftArm')
    torso_y = B.head('Spine1').y
    legs = C.side_bones('UpLeg', 'Leg', 'Foot', 'ToeBase', 'HipJoint') if False else {s + n for s in C.SIDES for n in ('UpLeg', 'Leg', 'Foot', 'ToeBase')} | {'LHipJoint', 'RHipJoint'}
    arms_up = C.side_bones('Arm', 'Shoulder')
    fore = C.side_bones('ForeArm')
    hands = {s + n for s in C.SIDES for n in ('Hand', 'FingerBase', 'HandFinger1')} | {'LThumb', 'RThumb'}
    feet = C.side_bones('Foot', 'ToeBase')
    dom, co = B.dom, B.co

    def fore_part(i, lo, hi):
        if dom[i] not in fore:
            return False
        t = B.along(i, dom[i])
        return lo <= t <= hi

    parts = []
    # kaftan: tułów, ramiona, przedramiona do nadgarstka; z dołu do połowy uda (dół zakryją fartuchy)
    parts.append(C.shell(B, 'kaftan', lambda i: (
        (dom[i] in C.TORSO | arms_up | {'Hips'} and co[i].z > crotch_z - 0.01)
        or (dom[i] == 'Neck' and co[i].z < neck_z + 0.035)
        or fore_part(i, -0.3, 0.93)), 0.007, 0.004, M['wool'], relax=6))
    # spodnie
    parts.append(C.shell(B, 'spodnie', lambda i: ((dom[i] in legs or (dom[i] == 'Hips' and co[i].z <= crotch_z + 0.1)) and co[i].z > ankle_z + 0.02),
                         0.003, 0.002, M['trousers']))
    # buty z cholewą do pół łydki, z wywiniętym brzegiem
    # buty: cholewa po łydce, stopa jako gładka bryła (otoczka wypukła stopy), bez odcisku palców
    parts.append(C.shell(B, 'cholewa', lambda i: dom[i] in C.side_bones('Leg') and ankle_z - 0.01 < co[i].z < knee_z - 0.13,
                         0.012, 0.004, M['darkleather'], relax=6, smooth=2))
    for s_ in C.SIDES:
        pts = [co[i] for i in range(len(co)) if dom[i] in {s_ + 'Foot', s_ + 'ToeBase'} or (dom[i] == s_ + 'Leg' and co[i].z < ankle_z + 0.04)]
        parts.append(C.hull(f'but {s_}', pts, 0.012, M['darkleather'], sole=0.0))
    parts.append(C.shell(B, 'cholewy', lambda i: (dom[i] in C.side_bones('Leg') and knee_z - 0.19 < co[i].z < knee_z - 0.11),
                         0.022, 0.006, M['darkleather'], relax=6, smooth=2))
    # rękawice
    parts.append(C.shell(B, 'rękawice', lambda i: dom[i] in hands or fore_part(i, 0.9, 1.2), 0.0035, 0.002, M['darkleather'], relax=3, smooth=1))
    # karwasze
    parts.append(C.shell(B, 'karwasze', lambda i: fore_part(i, 0.38, 0.9), 0.016, 0.006, M['leather'], relax=6, smooth=2))
    # skórzany napierśnik (przód i plecy, otwory na ręce)
    cuirass = C.shell(B, 'napierśnik', lambda i: (dom[i] in C.TORSO | {'Hips'} and belt_z - 0.03 < co[i].z < neck_z - 0.045
                                                    and abs(co[i].x) < sh.x - 0.035), 0.022, 0.008, M['leather'], relax=8, smooth=2)
    parts.append(cuirass)
    # żelazna płyta na piersi i na plecach
    parts.append(C.shell(B, 'płyta', lambda i: (dom[i] in C.TORSO and belt_z + 0.14 < co[i].z < neck_z - 0.08
                                                 and abs(co[i].x) < 0.12 and co[i].y < torso_y), 0.034, 0.004, M['iron'], relax=8, smooth=3))
    # naramienniki: trzy zachodzące na siebie płyty nad barkiem
    for s, sx in (('Left', 1), ('Right', -1)):
        j = B.head(s + 'Arm')
        for k, (r, off) in enumerate(((0.15, 0.055), (0.125, 0.045), (0.10, 0.036))):
            dz = -0.035 * k

            def pick(i, j=j, r=r, dz=dz, sx=sx):
                d = co[i] - j
                return (dom[i] in C.side_bones('Arm', 'Shoulder') | C.TORSO and (co[i].x * sx) > j.x * sx - 0.07
                        and d.length < r and co[i].z > j.z - 0.07 + dz)
            parts.append(C.shell(B, f'naramiennik {s} {k}', pick, off, 0.004, M['iron'], relax=8, smooth=3))
    # pas z klamrą
    belt = C.shell(B, 'pas', lambda i: (dom[i] in C.TORSO | {'Hips'} and belt_z - 0.022 < co[i].z < belt_z + 0.022),
                   0.034, 0.008, M['darkleather'], relax=4, smooth=1)
    parts.append(belt)
    front = min((v.co for v in belt.data.vertices), key=lambda c: c.y)
    parts.append(C.box('klamra', (0, front.y - 0.006, belt_z), (0.055, 0.012, 0.05), M['brass'], bevel=0.004))
    # fartuchy: cztery skórzane płaty od pasa do połowy uda
    rings = []
    center = Vector((0, B.head('Hips').y, 0))
    flaps = []
    for a0 in (-35, 55, 145, 235):
        ring_pts = []
        for zt in (0.0, 0.5, 1.0):
            z = belt_z - 0.02 - zt * (belt_z - knee_z - 0.16)
            row = []
            for a in [a0 + t * 70 / 5 for t in range(6)]:
                d = Vector((math.sin(math.radians(a)), -math.cos(math.radians(a)), 0))
                r = max(B.radius_at(Vector((0, center.y, z)), d), 0.12) + 0.04 + 0.03 * zt
                row.append(Vector((0, center.y, z)) + d * r)
            ring_pts.append(row)
        # płat z grubością: przednia i tylna ściana
        n = len(ring_pts[0])
        verts, faces = [], []
        for row in ring_pts:
            for p in row:
                verts.append(p)
        for row in ring_pts:
            for p in row:
                verts.append(p - (p - Vector((0, center.y, p.z))).normalized() * 0.006)
        off = len(ring_pts) * n
        for j in range(len(ring_pts) - 1):
            for i in range(n - 1):
                a, b = j * n + i, j * n + i + 1
                faces.append((a, a + n, b + n, b))
                faces.append((off + a, off + b, off + b + n, off + a + n))
        for j in range(len(ring_pts) - 1):  # boki
            for i in (0, n - 1):
                a, b = j * n + i, (j + 1) * n + i
                faces.append((a, off + a, off + b, b) if i == 0 else (a, b, off + b, off + a))
        for i in range(n - 1):  # dół i góra
            a = (len(ring_pts) - 1) * n + i
            faces.append((a, a + 1, off + a + 1, off + a))
            faces.append((i, off + i, off + i + 1, i + 1))
        flaps.append(C.mesh_from(f'fartuch {a0}', verts, faces, M['leather']))
    parts += flaps
    # włosy (krótkie, po skórze głowy) i broda
    scalp = B.groups.get('scalp', set())
    if scalp:
        parts.append(C.shell(B, 'włosy', lambda i: i in scalp, 0.007, 0.006, M['hair'], relax=6, smooth=2))
    lips = B.groups.get('lips', set())
    if lips:
        lz = sum(co[i].z for i in lips) / len(lips)
        hy = B.head('Head').y
        head_lo = B.head('Head').z - 0.07
        parts.append(C.shell(B, 'broda', lambda i: (dom[i] in {'Head', 'Neck1'} and co[i].y < hy - 0.035 and head_lo < co[i].z < lz + 0.01
                                                    and i not in lips), 0.005, 0.004, M['hair'], relax=6, smooth=2))
    # nity na krawędziach napierśnika
    rv = C.surface_points(cuirass, lambda c: abs(c.z - (belt_z + 0.05)) < 0.006, step=3)
    if rv:
        parts.append(C.rivets_along('nity', B, rv[::2], 0.006, M['iron'], lift=0.003))
    # pusta pochwa przy lewym biodrze (miecz strażnik trzyma w dłoni)
    hip = B.head('LeftUpLeg')
    sx = max(v.co.x for v in belt.data.vertices) + 0.02
    sheath = []
    for k in range(9):
        t = k / 8
        z = belt_z - 0.02 - t * 0.74
        c = Vector((sx + 0.01, hip.y + 0.04 + t * 0.24, z))
        w, d = 0.028 * (1 - 0.5 * t) + 0.006, 0.012
        sheath.append([c + Vector((0, -w, 0)), c + Vector((d, 0, 0)), c + Vector((0, w, 0)), c + Vector((-d, 0, 0))])
    parts.append(C.tube('pochwa', sheath, M['darkleather']))
    top = sheath[0][0] * 0.5 + sheath[0][2] * 0.5
    parts.append(C.box('okucie', top + Vector((0, 0, -0.02)), (0.034, 0.075, 0.03), M['iron'], bevel=0.003))
    parts += sword(B, M)
    return dict(body=body, eyes=eyes, arm=arm, parts=parts, M=M, B=B)


def grip_frame(B):
    """Chwyt prawej dłoni w spoczynku, z budowy dłoni: f = kierunek palców, blade = oś rękojeści (od małego palca
    ku kciukowi; klinga wychodzi z przeciwnej strony, spod małego palca), p = wnętrze dłoni (ku niemu zginają się palce). Zwraca (środek, blade, f, p)."""
    f = (B.tail('RightFingerBase') - B.head('RightFingerBase')).normalized()
    th = (B.tail('RThumb') - B.head('RThumb')).normalized()
    # klinga z dołu pięści (od strony małego palca): w nagraniach CMU tak wychodzi naturalny chód z opuszczonym
    # mieczem i cios znad głowy zakończony klingą w dół; od strony kciuka miecz sterczał w górę
    blade = -(th - f * th.dot(f)).normalized()
    f1 = (B.tail('RightHandFinger1') - B.head('RightHandFinger1')).normalized()
    p = f1 - f
    p = (p - f * p.dot(f) - blade * p.dot(blade)).normalized()
    center = B.head('RightFingerBase') + p * 0.022 + f * 0.012
    return center, blade, f, p


def sword(B, M):
    """Miecz w prawej dłoni: klinga z grzbietem (przekrój romb), jelec, owinięta rękojeść, głowica"""
    c, ax, f, p = grip_frame(B)
    d = p  # ostrze tnie w stronę wnętrza dłoni (jak przy cięciu z góry)
    side = ax.cross(d).normalized()  # płaz klingi
    out = []
    def at(u, v, w):  # u wzdłuż klingi, v w płaz, w ku krawędzi
        return c + ax * u + side * v + d * w
    rings = []
    for k in range(10):
        u = 0.07 + k / 9 * 0.82
        wd = 0.024 * (1 - 0.35 * k / 9) if k < 9 else 0.002
        th = 0.0045 * (1 - 0.4 * k / 9)
        u = u + (0.04 if k == 9 else 0)
        rings.append([at(u, 0, wd), at(u, th, 0), at(u, 0, -wd), at(u, -th, 0)])
    out.append(C.tube('miecz klinga', rings, M['iron'], flat=False))
    out.append(C.tube('miecz jelec', [[at(0.055, 0.012 * sv, 0.11 * sw) for sv, sw in ((1, 1), (1, -1), (-1, -1), (-1, 1))],
                                       [at(0.075, 0.012 * sv, 0.11 * sw) for sv, sw in ((1, 1), (1, -1), (-1, -1), (-1, 1))]], M['iron']))
    out.append(C.tube('miecz rękojeść', [[at(u, 0.016 * math.cos(a), 0.016 * math.sin(a)) for a in (0, 1.57, 3.14, 4.71)] for u in (-0.075, 0.055)], M['darkleather']))
    out.append(C.sphere('miecz głowica', at(-0.095, 0, 0), 0.024, M['iron'], scale=(1, 1, 1)))
    return out


CORE = ('body', 'eyes', 'kaftan', 'spodnie', 'cholewa', 'but', 'cholewy', 'rękawice', 'karwasze', 'napierśnik', 'pas', 'włosy', 'broda')
SKIP = ('nity',)  # tylko w pieczeniu (nity widać w mapie normalnych)
BUDGET = {'płyta': 70, 'naramiennik': 56, 'fartuch': 40, 'okucie': 12, 'pochwa': 40, 'miecz klinga': 40, 'miecz jelec': 12,
          'miecz rękojeść': 8, 'miecz głowica': 24, 'klamra': 12}
RIGID = {'klamra': 'Hips', 'pochwa': 'Hips', 'okucie': 'Hips', 'miecz': 'RightHand'}
TEAM = ('pas',)  # w barwach pana: maska drużyny w kolorze wierzchołków


def low(g, out_dir, core_tris=2300, tex=1024):
    """Siatka gry: rdzeń z remeshu + osobne płyty, wagi kości, rozkład UV i pieczenie tekstur z wersji szczegółowej"""
    hi = [g['body']] + ([g['eyes']] if g['eyes'] else []) + g['parts']
    core_src = [o for o in hi if o.name.split(' ')[0] in CORE]
    rest = [o for o in hi if o not in core_src and not o.name.startswith(SKIP)]
    core = C.remesh_core(core_src, 0.008, core_tris)
    pieces = C.low_parts(rest, BUDGET)
    B = g['B']
    belt_z = B.head('LeftUpLeg').z - 0.06 + 0.16
    for ob in [core] + pieces:
        C.skin_low(ob, g['body'], g['arm'])
        name = ob.name[:-2]
        bone = next((b for k, b in RIGID.items() if name.startswith(k)), None)
        if bone:
            C.set_weights(ob, range(len(ob.data.vertices)), {bone: 1.0})
        elif name.startswith('fartuch'):
            # fartuch wisi z pasa: u góry biodra, niżej coraz bardziej udo (inaczej rozrywa go krok)
            zs = [v.co.z for v in ob.data.vertices]
            bot = min(zs)
            gi = {gr.index: gr.name for gr in ob.vertex_groups}
            for v in ob.data.vertices:
                t = max(0.0, min(1.0, (belt_z - v.co.z) / (belt_z - bot)))
                legw = {gi[x.group]: x.weight for x in v.groups if x.weight > 0}
                tot = sum(legw.values()) or 1
                new = {k: w / tot * 0.55 * t for k, w in legw.items()}
                new['Hips'] = new.get('Hips', 0) + 1 - 0.55 * t
                C.set_weights(ob, [v.index], new)
    lowm = C.join([core] + pieces, 'strażnik')
    C.normalize_weights(lowm)
    C.team_mask(lowm, [o for o in hi if o.name.startswith(TEAM)], [o for o in hi if not o.name.startswith(TEAM)])
    C.unwrap(lowm)
    paths = C.bake(lowm, hi, out_dir, 'guard', size=tex)
    for o in hi:
        o.hide_render = True
    print('trójkąty gry:', C.tris(lowm))
    return lowm, paths


def fist(arm, B):
    """Zaciśnięta prawa pięść: palce obrócone wokół osi rękojeści ku wnętrzu dłoni"""
    from mathutils import Quaternion
    c, blade, f, p = grip_frame(B)
    out = {}
    for name, ang in (('RightFingerBase', 85), ('RightHandFinger1', 80), ('RThumb', 30)):
        b = arm.data.bones.get(name)
        if not b:
            continue
        ml = b.matrix_local.to_3x3()
        dirw = ml @ Vector((0, 1, 0))
        sg = max((1, -1), key=lambda k: (Quaternion(blade, math.radians(ang * k)) @ dirw).dot(p))
        qw = Quaternion(blade, math.radians(ang * sg))
        out[name] = (ml.inverted() @ qw.to_matrix() @ ml).to_quaternion()
    return out


def animate(g):
    """Ruch z nagrań CMU: spoczynek, chód, cios (zamach zza głowy) i śmierć (osunięcie na kolana, upadek na twarz)"""
    arm = g['arm']
    acts = []
    def src(clip):
        return C.load_bvh(os.path.join(C.ASSETS, 'mocap', clip + '.bvh'), 'nagranie ' + clip)
    s = src('82_08')
    a, b = C.best_loop(s, 20, 900, 200, 360)
    acts.append(C.retarget(s, arm, a, b, 'idle', loop=True))
    s = src('07_01')
    a, b = C.best_loop(s, 2, C.clip_range(s)[1], 110, 170, travel=0.9 * 17.43 / 0.97)
    acts.append(C.retarget(s, arm, a, b, 'walk', loop=True))
    s = src('79_01')
    pk = C.peak_speed(s, 'RightHand', 200, C.clip_range(s)[1] - 100)
    acts.append(C.retarget(s, arm, pk - 75, pk + 70, 'attack'))
    s = src('78_22')
    a, b = C.fall_range(s, 2, C.clip_range(s)[1])
    death = C.retarget(s, arm, a, b - 60, 'death', in_place=False)
    s2 = src('90_16')
    lo, hi = C.clip_range(s2)
    lie = C.retarget(s2, arm, hi - 8, hi, '_lie', in_place=True)
    C.append_pose(death, lie, 16, hips_shift=Vector((0, -0.35, 0)))
    acts.append(death)
    bpy.data.actions.remove(lie)
    F = fist(arm, g['B'])
    for act in acts:
        for bone, q in F.items():
            C.add_rotation(act, bone, q)
    for o in [o for o in bpy.data.objects if o.name.startswith('nagranie')]:
        bpy.data.objects.remove(o, do_unlink=True)
    return acts


def bind(mesh, arm):
    mesh.parent = arm
    m = mesh.modifiers.new('szkielet', 'ARMATURE')
    m.object = arm
    return mesh


if __name__ == '__main__':
    import bpy
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = args[args.index('--out') + 1] if '--out' in args else os.path.join(C.HERE, '..', '..', '..', 'public', 'chars')
    os.makedirs(out_dir, exist_ok=True)
    g = build()
    if '--preview' in args:
        objs = [g['body']] + ([g['eyes']] if g['eyes'] else []) + g['parts']
        C.preview(objs, os.path.join(out_dir, 'guard_hi.png'), views=((0, 0), (40, 8), (90, 0), (180, 0)), size=560)
    lm, paths = low(g, out_dir)
    C.preview([lm], os.path.join(out_dir, 'guard_low.png'), views=((0, 0), (40, 8), (90, 0), (180, 0)), size=560)
    acts = animate(g)
    bind(lm, g['arm'])
    for o in [g['body'], g['eyes']] + g['parts']:
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    if '--sheets' in args:
        for act, view in zip(acts, ((0, 0), (90, 0), (60, 0), (90, 0))):
            C.anim_sheet([lm], g['arm'], act, os.path.join(out_dir, f'guard_{act.name}.png'), view=view, height=2.3)
    C.export_glb(os.path.join(out_dir, 'guard.glb'), lm, g['arm'], actions=acts)
    print('gotowe:', os.path.join(out_dir, 'guard.glb'), 'trójkąty:', C.tris(lm), 'animacje:', [a.name for a in acts])
