"""Saper — inżynier wojskowy w klimacie Gothica: gruby, przeszywany skórzany kaftan nabijany ćwiekami, pod nim wełniana
koszula w barwach pana (rękawy i kołnierz), ciężki skórzany fartuch do kolan, skórzany kaptur z krótką pelerynką na
barki, karwasze i grube rękawice, skórzane portki z naszytymi nakolannikami, wysokie buty z wywiniętą cholewą.
U pasa młotek, przecinak i sakwa, przy lewym biodrze żelazny łom na rzemieniu, na prawym barku zwój liny.
Kilof (w dłoni przy robocie, na plecach w drodze) dokłada gra z puli narzędzi chłopów — dlatego kotwice są jak u chłopa.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/sapper.py  →  src/render/models/sapper.json
Kotwice jak u chłopa (narzędzia w dłoni): biodro (±0,052; 0,235), bark (±0,135; 0,45), dłoń 0,185 pod barkiem.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, evaluated, hexrgb, keep_faces, lathe, reset, skin, sphere  # noqa: E402

reset()
import bmesh as _bm  # noqa: E402
from mathutils import Matrix as _M  # noqa: E402
from body import Head, finish, smooth  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
LEATHER, LEATHER_DK, LEATHER_LT = hexrgb(0x5a3c24), hexrgb(0x352417), hexrgb(0x7a5634)
BOOT, GLOVE, STUD, IRON, IRON_DK = hexrgb(0x241a13), hexrgb(0x3a2a1c), hexrgb(0x9a9890), hexrgb(0x6e7178), hexrgb(0x46484e)
ROPE, WOOD = hexrgb(0x8f7a52), hexrgb(0x6a4a2c)

HIP = (0.052, 0.235, 0.0)
SHOULDER = (0.135, 0.45, 0.0)
HAND = (0.0, -0.185, 0.004)


def noise3(x, y, z):
    return (math.sin(x * 129.898 + y * 782.33 + z * 377.19) * 43758.5453) % 1.0


def lining(bm, dist=0.0025):
    """Spodnia warstwa (gra nie rysuje tylnych ścian): kopia z odwróconymi ścianami, cofnięta o włos do środka"""
    back = bm.copy()
    back.normal_update()
    for v in back.verts:
        v.co -= v.normal * dist
    _bm.ops.reverse_faces(back, faces=back.faces[:])
    return back


def quilt(base, step=0.022, k=0.18):
    """Przeszywana skóra: poziome przeszycia co `step` i drobne przetarcia"""
    def col(x, y, z):
        seam = abs((y / step) % 1 - 0.5) < 0.07
        f = 0.82 + (noise3(x, y, z) - 0.5) * 0.14 + 0.06 * math.sin(math.atan2(x, z) * 7)
        return tuple(c * (f * (1 - k) if seam else f) for c in base)
    return col


def band(name, r_top, r_bot, y_top, y_bot, seg=16, depth=1.0, phi0=0.0, phi=2 * math.pi):
    return lathe(name, [(r_bot, y_bot), (r_top, y_top)], seg=seg, depth=depth, phi0=phi0, phi=phi, subsurf=0)


def moved(bm, rot=None, at=(0, 0, 0)):
    """Obrót i przesunięcie w układzie gry (x w prawo, y w górę, z w przód); bmesh trzyma współrzędne Blendera (x, -z, y)"""
    axes = {'X': ('X', 1), 'Y': ('Z', 1), 'Z': ('Y', -1)}
    if rot:
        for ang, axis in rot:
            ax, sg = axes[axis]
            _bm.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=_M.Rotation(ang * sg, 3, ax))
    _bm.ops.translate(bm, verts=bm.verts, vec=(at[0], -at[2], at[1]))
    return bm


# ================= NOGA (środek obrotu w biodrze) =================
# skórzane portki, wpuszczone w wysokie buty z wywiniętą cholewą
leg = skin('leg', [(0, 0.01, 0), (0, -0.04, 0.005), (0, -0.08, 0.008), (0, -0.115, 0.008), (0, -0.135, 0.004)],
           [(0, 1), (1, 2), (2, 3), (3, 4)],
           [(0.05, 0.05), (0.049, 0.05), (0.045, 0.046), (0.041, 0.042), (0.037, 0.038)], subsurf=2)
leg_m = Mesh(evaluated(leg), lambda x, y, z: tuple(c * (0.85 + (noise3(x, y, z) - 0.5) * 0.12 + 0.05 * math.sin(math.atan2(x, z) * 5 + y * 30)) for c in LEATHER_DK), 'leather')
# naszyty nakolannik z grubej skóry (z przodu, na kolanie)
kp = sphere('kneepad', (0.0, -0.085, 0.034), (0.034, 0.03, 0.016), seg=12, rings=8)
kpb = evaluated(kp)
keep_faces(kpb, lambda x, y, z: z > 0.026)
kneepad_m = Mesh(kpb, lambda x, y, z: tuple(c * (0.7 if abs(math.hypot(x, y + 0.085) - 0.026) < 0.003 else 1.0) for c in LEATHER), 'leather')
boot = skin('boot', [(0, -0.115, 0), (0, -0.17, 0), (0, -0.212, 0.0), (0, -0.218, 0.058)], [(0, 1), (1, 2), (2, 3)],
            [(0.043, 0.043), (0.04, 0.04), (0.041, 0.028), (0.033, 0.02)], subsurf=2)
boot_m = Mesh(evaluated(boot), lambda x, y, z: tuple(c * (0.6 if y < -0.228 else 1.0) for c in BOOT), 'leather')
cuff = lathe('cuff', [(0.044, -0.13), (0.05, -0.12), (0.052, -0.1), (0.047, -0.096)], seg=16, subsurf=0)
cuff_b = evaluated(cuff)
cuff_b_lin = lining(cuff_b)
cuff_m = Mesh(cuff_b, tuple(c * 1.15 for c in BOOT), 'leather')
cuff_in_m = Mesh(cuff_b_lin, tuple(c * 0.6 for c in BOOT), 'leather')
bstrap = band('bootstrap', 0.0415, 0.0415, -0.155, -0.163)
bstrap_m = Mesh(evaluated(bstrap), LEATHER_LT, 'leather')
bbuckle = sphere('bootbuckle', (0.038, -0.159, 0.012), (0.006, 0.007, 0.004), seg=6, rings=4)
bbuckle_m = Mesh(evaluated(bbuckle), IRON, 'metal')

# ================= RĘKA (środek obrotu w barku) =================
# wełniany rękaw koszuli w barwach pana (od barku do łokcia widać spod kaftana), niżej karwasz i gruba rękawica
arm = lathe('arm', [(0.001, 0.034), (0.024, 0.03), (0.036, 0.01), (0.036, -0.02), (0.034, -0.06), (0.031, -0.095), (0.029, -0.11)], seg=16, subsurf=0)
arm_m = Mesh(evaluated(arm), lambda x, y, z: (0.82 + 0.08 * math.sin(y * 70 + math.atan2(x, z) * 3) + (noise3(x, y, z) - 0.5) * 0.08,) * 3, 'cloth', dyn='tunic')
# skórzany naramiennik kaftana (krótki rękaw, zachodzi na bark)
spaul = lathe('spaul', [(0.039, -0.045), (0.04, -0.025), (0.039, 0.0), (0.031, 0.022), (0.018, 0.033)], seg=16, depth=1.0, subsurf=0)
spaul_b = evaluated(spaul)
spaul_b_lin = lining(spaul_b)
spaul_m = Mesh(spaul_b, quilt(LEATHER, 0.018), 'leather')
spaul_in_m = Mesh(spaul_b_lin, tuple(c * 0.5 for c in LEATHER), 'leather')
brace = band('brace', 0.033, 0.027, -0.1, -0.158)
brace_m = Mesh(evaluated(brace), quilt(LEATHER_LT, 0.014, 0.25), 'leather')
glove = skin('glove', [(0, -0.152, 0.002), (0, -0.19, 0.005), (0, -0.21, 0.008)], [(0, 1), (1, 2)],
             [(0.026, 0.024), (0.027, 0.019), (0.021, 0.015)], subsurf=1)
glove_m = Mesh(evaluated(glove), GLOVE, 'leather')
gcuff = lathe('gcuff', [(0.03, -0.165), (0.034, -0.155), (0.034, -0.14), (0.03, -0.135)], seg=14, subsurf=0)
gcuff_b = evaluated(gcuff)
gcuff_b_lin = lining(gcuff_b)
gcuff_m = Mesh(gcuff_b, tuple(c * 1.2 for c in GLOVE), 'leather')
gcuff_in_m = Mesh(gcuff_b_lin, tuple(c * 0.6 for c in GLOVE), 'leather')

# ================= TUŁÓW =================
# kaftan z grubej, przeszywanej skóry: szeroki w barkach, do bioder, sznurowany z przodu, nabijany ćwiekami
torso = lathe('jerkin', [(0.094, 0.205), (0.098, 0.24), (0.092, 0.29), (0.1, 0.36), (0.108, 0.41), (0.104, 0.446), (0.084, 0.47), (0.056, 0.486), (0.036, 0.492)],
              seg=30, depth=0.76, subsurf=0)
tb = evaluated(torso)
tb_lin = lining(tb)
torso_m = Mesh(tb, quilt(LEATHER, 0.024), 'leather')
torso_in_m = Mesh(tb_lin, tuple(c * 0.45 for c in LEATHER), 'leather')
# rozcięcie z przodu: ciemny pas i sznurowanie na krzyż
lace_pts, lace_edges = [], []
for i in range(6):
    y = 0.44 - i * 0.034
    r = 0.104 if y > 0.36 else 0.098
    z = r * 0.76 + 0.004
    lace_pts += [(-0.012, y, z), (0.012, y - 0.017, z)]
    lace_edges.append((len(lace_pts) - 2, len(lace_pts) - 1))
laces = skin('laces', lace_pts, lace_edges, [(0.0028, 0.0022)] * len(lace_pts), subsurf=0)
laces_m = Mesh(evaluated(laces), hexrgb(0x2a1c12), 'leather')
# kołnierz koszuli w barwach pana spod kaftana
collar = lathe('collar', [(0.05, 0.49), (0.046, 0.505), (0.038, 0.512)], seg=18, subsurf=0)
collar_b = evaluated(collar)
collar_b_lin = lining(collar_b)
collar_m = Mesh(collar_b, (0.8,) * 3, 'cloth', dyn='tunic')
collar_in_m = Mesh(collar_b_lin, (0.4,) * 3, 'cloth', dyn='tunic')
# ćwieki na piersi i plecach w rzędach
studs = []
for row, y in enumerate((0.42, 0.385, 0.35, 0.315)):
    r = 0.104 if y > 0.36 else 0.1
    for k in range(10):
        a = (k + 0.5 * row) * 2 * math.pi / 10
        if abs(math.sin(a)) < 0.2 and math.cos(a) > 0:
            continue  # rozcięcie z przodu
        x, z = math.sin(a) * r, math.cos(a) * r * 0.76
        st = sphere(f'stud{row}{k}', (x * 1.03, y, z * 1.03), 0.0042, seg=6, rings=4)
        studs.append(Mesh(evaluated(st), STUD, 'metal'))
# ciężki skórzany fartuch z przodu: od pasa do kolan, lekko odstaje, z obszytym brzegiem
apron = lathe('apron', [(0.106, 0.165), (0.102, 0.2), (0.1, 0.235), (0.1, 0.265)], seg=10, depth=0.8, phi0=-0.7, phi=1.4, subsurf=0)
ab = evaluated(apron)
ab_lin = lining(ab)
apron_m = Mesh(ab, lambda x, y, z: tuple(c * (0.62 if y < 0.175 else 0.92 + (noise3(x, y, z) - 0.5) * 0.16 - 0.08 * (abs(x) > 0.07)) for c in LEATHER), 'leather')
apron_in_m = Mesh(ab_lin, tuple(c * 0.5 for c in LEATHER_LT), 'leather')
# biodra pod fartuchem (portki)
hips = lathe('hips', [(0.078, 0.25), (0.086, 0.215), (0.09, 0.19)], seg=20, depth=0.8, subsurf=0)
hips_m = Mesh(evaluated(hips), LEATHER_DK, 'leather')
# szeroki pas z żelazną klamrą
belt = lathe('belt', [(0.101, 0.262), (0.105, 0.268), (0.105, 0.292), (0.101, 0.298)], seg=24, depth=0.78, subsurf=0)
belt_m = Mesh(evaluated(belt), hexrgb(0x22170f), 'leather')
buckle = lathe('buckle', [(0.012, 0.272), (0.014, 0.276), (0.014, 0.288), (0.012, 0.292)], seg=4, depth=0.35, subsurf=0)
bkb = evaluated(buckle)
moved(bkb, at=(0, 0, 0.081))
buckle_m = Mesh(bkb, IRON, 'metal')
# sakwa na prawym biodrze
pouch = sphere('pouch', (0.086, 0.245, 0.03), (0.024, 0.03, 0.019), seg=10, rings=6)
pouch_m = Mesh(evaluated(pouch), LEATHER, 'leather')
# młotek za pasem (lewe biodro z przodu): trzonek i żelazny obuch
hm_handle = lathe('hammerh', [(0.006, 0.0), (0.007, 0.06), (0.006, 0.12)], seg=6, subsurf=0)
hh = evaluated(hm_handle)
moved(hh, rot=[(0.18, 'Z')], at=(-0.082, 0.2, 0.055))
hammer_h_m = Mesh(hh, WOOD, 'wood')
hm_head = sphere('hammerhead', (0.0, 0.0, 0.0), (0.024, 0.011, 0.011), seg=8, rings=4)
hmb = evaluated(hm_head)
moved(hmb, rot=[(0.18, 'Z')], at=(-0.093, 0.318, 0.055))
hammer_m = Mesh(hmb, IRON_DK, 'metal')
# przecinak w skórzanej pętli obok młotka
chisel = lathe('chisel', [(0.0, -0.005), (0.004, 0.0), (0.005, 0.07), (0.006, 0.075), (0.0, 0.078)], seg=6, subsurf=0)
chb = evaluated(chisel)
moved(chb, rot=[(-0.1, 'Z')], at=(-0.06, 0.23, 0.076))
chisel_m = Mesh(chb, IRON, 'metal')
# żelazny łom przy lewym boku: długi pręt z zagiętym, rozpłaszczonym pazurem na dole, wisi w pętli pasa
bar = skin('crowbar', [(0.0, 0.3, 0.0), (0.0, 0.135, 0.0), (0.0, 0.112, 0.01), (0.0, 0.104, 0.026)], [(0, 1), (1, 2), (2, 3)],
           [(0.0065, 0.0065), (0.0065, 0.0065), (0.006, 0.005), (0.009, 0.0035)], subsurf=0)
barb = evaluated(bar)
moved(barb, rot=[(0.06, 'Z')], at=(-0.108, 0.02, -0.02))
crowbar_m = Mesh(barb, lambda x, y, z: tuple(c * (0.75 + 0.3 * noise3(x, y, z)) for c in IRON_DK), 'metal')
loop = band('barloop', 0.012, 0.012, 0.268, 0.258, seg=10)
lpb = evaluated(loop)
moved(lpb, at=(-0.11, 0.0, -0.02))
loop_m = Mesh(lpb, LEATHER_LT, 'leather')
# zwój liny przez prawy bark, ukośnie na piersi i plecach
rope_pts, rope_edges = [], []
N = 28
for i in range(N + 1):
    a = 2 * math.pi * i / N
    # elipsa w płaszczyźnie od prawego barku do lewego biodra, owinięta wokół tułowia
    u = math.cos(a)
    v = math.sin(a)
    x = 0.015 + 0.08 * u
    y = 0.37 + 0.1 * u
    rr = 0.083 + 0.01 * u
    rope_pts.append((x, y, rr * v))
    if i:
        rope_edges.append((i - 1, i))
rope = skin('rope', rope_pts, rope_edges, [(0.0075, 0.0075)] * len(rope_pts), subsurf=1)
rope_m = Mesh(evaluated(rope), lambda x, y, z: tuple(c * (0.75 + 0.25 * abs(math.sin((x + y + z) * 260))) for c in ROPE), 'cloth')

# ================= GŁOWA: skórzany kaptur z krótką pelerynką =================
head = Head((0.0, 0.546, 0.004), (0.054, 0.065, 0.058), seg=32, rings=24)
neck = lathe('neck', [(0.027, 0.47), (0.027, 0.5), (0.029, 0.52)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
beard = head.shell('beard', 1.07, head.beard_mask())


def face_hole(x, y, z, w=0.7, h=0.64):
    return smooth(0.15, 0.4, z) * smooth(-0.05, 0.1, h - abs(y + 0.08)) * smooth(-0.05, 0.1, w - abs(x))


hood = head.shell('hood', 1.17, lambda x, y, z: 1 - face_hole(x, y, z) if y > -0.85 else 0, dyn=None, mat='leather',
                  shade=lambda x, y, z: tuple(c * ((0.95 if z > 0.3 else 0.82) + (noise3(x, y, z) - 0.5) * 0.12) for c in LEATHER))
cape = lathe('cape', [(0.138, 0.39), (0.132, 0.42), (0.11, 0.452), (0.078, 0.482), (0.052, 0.505)], seg=20, depth=0.86, subsurf=1)
cape_b = evaluated(cape)
# postrzępiony dół pelerynki (zęby skóry)
keep_faces(cape_b, lambda x, y, z: not (y < 0.398 and (math.atan2(x, z) * 7) % 2 < 0.7))
cape_b_lin = lining(cape_b)
cape_m = Mesh(cape_b, lambda x, y, z: tuple(c * (0.7 if y < 0.405 else 0.9 + (noise3(x, y, z) - 0.5) * 0.12) for c in LEATHER), 'leather')
cape_in_m = Mesh(cape_b_lin, tuple(c * 0.45 for c in LEATHER), 'leather')

static = [torso_m, torso_in_m, laces_m, collar_m, collar_in_m, *studs, apron_m, apron_in_m, hips_m, belt_m, buckle_m, pouch_m,
          hammer_h_m, hammer_m, chisel_m, crowbar_m, loop_m, rope_m,
          head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(), beard, hood, cape_m, cape_in_m]
finish('sapper', static, [leg_m, kneepad_m, boot_m, cuff_m, cuff_in_m, bstrap_m, bbuckle_m],
       [arm_m, spaul_m, spaul_in_m, brace_m, glove_m, gcuff_m, gcuff_in_m], HIP, SHOULDER, HAND)
