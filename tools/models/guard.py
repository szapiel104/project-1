"""Strażnik miejski jak strażnik Starego Obozu z Gothica: ogolona głowa z bródką, ciemny skórzany kołnierz-pelerynka
na barkach i czerwona chusta pod szyją, czerwony kaftan z kolczugą na piersi, rzemienie, warstwowe naramienniki
z ciemnej stali, stalowe płyty na ramionach, nabijane ćwiekami karwasze, szeroki pas z klamrą i sakwą, kolczuga pod
połami kaftana, płyty na udach, nakolanniki, nagolenniki przewiązane rzemieniem i ciężkie buty.
Z bliska dużo detalu (płyty, ćwieki, ogniwa, rzemienie), z daleka wersja uproszczona liczy się sama (finish).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/guard.py  →  src/render/models/guard.json
Kotwice bez zmian (miecz w dłoni, chód): biodro (±0,055; 0,30), bark (±0,112; 0,478), dłoń 0,245 pod barkiem.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, evaluated, hexrgb, keep_faces, lathe, reset, skin, sphere  # noqa: E402

reset()
import bmesh as _bm  # noqa: E402
from mathutils import Matrix as _M  # noqa: E402
from body import Head, finish, pack, smooth  # noqa: E402

RED, RED_DK, DARK, LEATHER, BOOT, GLOVE = hexrgb(0x8e2a1c), hexrgb(0x5a1a12), hexrgb(0x2e2420), hexrgb(0x5a3a24), hexrgb(0x241a14), hexrgb(0x33241a)
STEEL, STEEL_DK, BRASS, MAIL, WHITE = hexrgb(0x8c929c), hexrgb(0x5a5f68), hexrgb(0xa8843c), hexrgb(0x7a7c80), (1.0, 1.0, 1.0)
COWL, SCARF, STUD = hexrgb(0x3a2e28), hexrgb(0xa02418), hexrgb(0xb0b2b6)

HIP = (0.055, 0.30, 0.0)
SHOULDER = (0.112, 0.478, 0.0)
HAND = (0.0, -0.245, 0.012)


def noise(x, y, z):
    return (math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1.0


def mail(x, y, z, base=MAIL):
    """Kolczuga: drobna kratka ogniw (jasne krawędzie, ciemne dziurki) w kolorach wierzchołków"""
    a = math.atan2(x, z) * 30
    k = 0.65 + 0.35 * abs(math.sin(a)) * abs(math.sin(y * 260))
    return tuple(c * k for c in base)


def plate_shade(base, y0, step):
    """Płyty nachodzące na siebie: każda jaśniejsza u dołu krawędzi, ciemniejsza pod następną"""
    return lambda x, y, z: tuple(c * (0.7 + 0.45 * (((y - y0) % step) / step)) for c in base)


def band(name, r_top, r_bot, y_top, y_bot, seg=14, depth=0.8, phi0=0.0, phi=2 * math.pi):
    return lathe(name, [(r_bot, y_bot), (r_top, y_top)], seg=seg, depth=depth, phi0=phi0, phi=phi, subsurf=0)


# ================= NOGA (środek obrotu w biodrze) =================
leg = skin('leg', [(0, 0, 0), (0, -0.07, 0.006), (0, -0.145, 0.009), (0, -0.2, -0.004), (0, -0.262, 0.0), (0, -0.287, 0.012), (0, -0.292, 0.07)],
           [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
           [(0.05, 0.05), (0.045, 0.046), (0.033, 0.034), (0.036, 0.037), (0.028, 0.029), (0.033, 0.022), (0.029, 0.015)], subsurf=1)
def leg_col(x, y, z):
    if y < -0.205:
        return tuple(c * (0.75 if y > -0.218 else 1.0) for c in BOOT)   # wywinięta cholewa ciemniej
    return DARK
leg_m = Mesh(evaluated(leg), leg_col, 'leather')
# płyta na udzie (z przodu), nakolannik i nagolennik z rzemieniami
cuisse = band('cuisse', 0.053, 0.045, -0.02, -0.12, phi0=-1.1, phi=2.2, depth=1.0)
cuisse_m = Mesh(evaluated(cuisse), plate_shade(STEEL_DK, -0.12, 0.033), 'metal')
knee = sphere('knee', (0.0, -0.142, 0.03), (0.03, 0.026, 0.018), seg=10, rings=6)
kb = evaluated(knee)
keep_faces(kb, lambda x, y, z: z > 0.022)
knee_m = Mesh(kb, STEEL, 'metal')
greave = band('greave', 0.041, 0.034, -0.165, -0.212, phi0=-1.0, phi=2.0, depth=1.0)
greave_m = Mesh(evaluated(greave), plate_shade(STEEL_DK, -0.212, 0.016), 'metal')
straps = []
for k, y in enumerate((-0.17, -0.19)):
    st = band(f'strap{k}', 0.04, 0.04, y + 0.004, y - 0.004, seg=12, depth=1.0)
    straps.append(Mesh(evaluated(st), LEATHER, 'leather'))

# ================= RĘKA (środek obrotu w barku) =================
arm = skin('arm', [(0, 0, 0), (0, -0.06, 0), (0, -0.118, 0.002), (0, -0.17, 0.006), (0, -0.214, 0.008), (0, -0.238, 0.012), (0, -0.262, 0.016)],
           [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (5, 6)],
           [(0.037, 0.037), (0.034, 0.035), (0.027, 0.028), (0.029, 0.027), (0.022, 0.02), (0.026, 0.016), (0.021, 0.013)], subsurf=1)
arm_m = Mesh(evaluated(arm), lambda x, y, z: RED if y > -0.12 else GLOVE, 'leather')
# płyty na ramieniu (trzy zachodzące paski)
rere = []
for k in range(3):
    y0 = -0.035 - k * 0.026
    p = band(f'rere{k}', 0.04 - k * 0.0015, 0.037 - k * 0.0015, y0, y0 - 0.03, seg=14, depth=1.0)
    rere.append(Mesh(evaluated(p), lambda x, y, z, y0=y0: tuple(c * (0.75 + 0.4 * (y0 - y) / 0.03) for c in STEEL_DK), 'metal'))
# karwasz z czerwono-brązowej skóry nabijany ćwiekami
brace = band('brace', 0.032, 0.026, -0.125, -0.215, seg=14, depth=1.0)
brace_m = Mesh(evaluated(brace), lambda x, y, z: tuple(c * (0.85 + 0.15 * noise(x * 40, y * 40, z * 40)) for c in hexrgb(0x5a2418)), 'leather')
studs = []
for row, y in enumerate((-0.14, -0.165, -0.19)):
    for k in range(6):
        a = 2 * math.pi * (k + row * 0.5) / 6
        r = 0.032 - (y + 0.125) * 0.066
        st = sphere(f'stud{row}{k}', (math.sin(a) * r, y, math.cos(a) * r), 0.0045, seg=6, rings=4)
        studs.append(Mesh(evaluated(st), STUD, 'metal'))

# ================= TUŁÓW =================
torso = skin('torso', [(0, 0.3, 0), (0, 0.355, 0), (0, 0.42, 0.005), (0, 0.472, 0), (0, 0.5, 0), (-0.082, 0.482, 0), (0.082, 0.482, 0)],
             [(0, 1), (1, 2), (2, 3), (3, 4), (3, 5), (3, 6)],
             [(0.076, 0.056), (0.069, 0.051), (0.087, 0.061), (0.086, 0.055), (0.034, 0.032), (0.04, 0.038), (0.04, 0.038)], subsurf=1)
torso_m = Mesh(evaluated(torso), lambda x, y, z: RED if abs(x) > 0.035 or z < 0 else RED_DK, 'cloth')
# kolczuga na środku piersi (pod rozchylonym kaftanem), sznurowana rzemieniem na krzyż
mailc = lathe('mailchest', [(0.072, 0.35), (0.082, 0.39), (0.09, 0.43), (0.082, 0.468)], seg=10, depth=0.74, phi0=-0.42, phi=0.84, subsurf=0)
mailc_m = Mesh(evaluated(mailc), mail, 'mail')
laces = []
for k in range(4):
    y = 0.37 + k * 0.024
    for sx in (-1, 1):
        lc = skin(f'lace{k}{sx}', [(sx * 0.03, y, 0.064 + (y - 0.35) * 0.18), (-sx * 0.03, y + 0.022, 0.066 + (y - 0.33) * 0.18)], [(0, 1)], [(0.0028, 0.0028)] * 2, subsurf=0)
        laces.append(Mesh(evaluated(lc), LEATHER, 'leather'))
# poły kaftana z przodu i z tyłu, pod nimi kolczuga do pół uda
skirt = lathe('skirt', [(0.074, 0.335), (0.084, 0.3), (0.096, 0.24), (0.106, 0.18)], seg=20, depth=0.78, subsurf=0)
sb = evaluated(skirt)
keep_faces(sb, lambda x, y, z: abs(math.atan2(x, z)) < 0.75 or abs(math.atan2(x, z)) > math.pi - 0.75)
skirt_m = Mesh(sb, lambda x, y, z: tuple(c * (0.65 if y < 0.195 else 0.95 + 0.05 * math.sin(math.atan2(x, z) * 8)) for c in RED), 'cloth')
mailskirt = lathe('mailskirt', [(0.07, 0.33), (0.08, 0.3), (0.092, 0.24), (0.1, 0.2)], seg=20, depth=0.76, subsurf=0)
mailskirt_m = Mesh(evaluated(mailskirt), mail, 'mail')
# płyty na biodrach (po dwie z każdej strony, nad kolczugą)
tassets = []
for sx in (-1, 1):
    for k in range(2):
        y0 = 0.31 - k * 0.032
        t = lathe(f'tasset{sx}{k}', [(0.088 + k * 0.006, y0 - 0.04), (0.084 + k * 0.006, y0)], seg=6, depth=0.82,
                  phi0=sx * math.pi / 2 - 0.55, phi=1.1, subsurf=0)
        tassets.append(Mesh(evaluated(t), lambda x, y, z, y0=y0: tuple(c * (0.7 + 0.45 * (y0 - y) / 0.04) for c in STEEL_DK), 'metal'))
# szeroki pas z dużą klamrą i sakwą
belt = lathe('belt', [(0.079, 0.322), (0.083, 0.328), (0.083, 0.352), (0.079, 0.358)], seg=20, depth=0.78, subsurf=0)
belt_m = Mesh(evaluated(belt), LEATHER, 'leather')
buckle = sphere('buckle', (0.0, 0.34, 0.066), (0.02, 0.016, 0.006), seg=8, rings=4)
buckle_m = Mesh(evaluated(buckle), BRASS, 'metal')
pouch = sphere('pouch', (0.07, 0.315, 0.04), (0.022, 0.026, 0.016), seg=10, rings=6)
pouch_m = Mesh(evaluated(pouch), hexrgb(0x3e2a1c), 'leather')
# pochwa miecza u lewego biodra
sheath = lathe('sheath', [(0.011, 0.13), (0.013, 0.155), (0.013, 0.315), (0.016, 0.325)], seg=6, depth=0.55, subsurf=0)
sh = evaluated(sheath)
_bm.ops.rotate(sh, verts=sh.verts, cent=(0, 0, 0.325), matrix=_M.Rotation(-0.35, 3, 'Y'))
_bm.ops.translate(sh, verts=sh.verts, vec=(-0.09, 0.012, 0))
sheath_m = Mesh(sh, hexrgb(0x1f1611), 'leather')
# szarfa w barwach pana przez pierś (kolor nadaje gra) — po niej poznać, czyj to strażnik
sash = lathe('sash', [(0.1, -0.012), (0.103, 0.0), (0.1, 0.012)], seg=20, depth=0.78, subsurf=0)
sa = evaluated(sash)
_bm.ops.rotate(sa, verts=sa.verts, cent=(0, 0, 0), matrix=_M.Rotation(0.62, 3, 'Y'))
_bm.ops.translate(sa, verts=sa.verts, vec=(0, 0, 0.405))
sash_m = Mesh(sa, WHITE, 'cloth', dyn='tunic')

# ================= NARAMIENNIKI: trzy warstwy wypukłych płyt z ciemnej stali =================
paul = []
for sx in (-1, 1):
    for i, (cy, r, dx) in enumerate(((0.503, (0.058, 0.032, 0.058), 0.094), (0.482, (0.056, 0.026, 0.056), 0.104), (0.462, (0.052, 0.022, 0.052), 0.112))):
        p = sphere(f'paul{sx}{i}', (sx * dx, cy, 0.0), r, seg=16, rings=10)
        b = evaluated(p)
        keep_faces(b, lambda x, y, z, cy=cy: y > cy + 1e-5)
        paul.append(Mesh(b, lambda x, y, z, i=i: tuple(c * (0.85 + 0.15 * i) for c in (STEEL_DK if i < 2 else STEEL)), 'metal'))
    # nity na wierzchniej płycie
    for k in range(3):
        a = (k - 1) * 0.6
        rv = sphere(f'rivet{sx}{k}', (sx * (0.094 + math.sin(a) * 0.035), 0.528, math.cos(a) * 0.035), 0.004, seg=6, rings=4)
        paul.append(Mesh(evaluated(rv), STUD, 'metal'))

# ================= SZYJA: czerwona chusta i ciemna pelerynka z kapturem zsuniętym na barki =================
scarf = lathe('scarf', [(0.04, 0.49), (0.045, 0.505), (0.04, 0.522), (0.032, 0.53)], seg=14, depth=0.9, subsurf=0)
scarf_m = Mesh(evaluated(scarf), lambda x, y, z: tuple(c * (0.8 + 0.2 * math.sin(math.atan2(x, z) * 5 + y * 90)) for c in SCARF), 'cloth')
cowl = lathe('cowl', [(0.125, 0.468), (0.118, 0.49), (0.1, 0.51), (0.072, 0.528), (0.05, 0.54)], seg=22, depth=0.82, subsurf=1)
cowl_m = Mesh(evaluated(cowl), lambda x, y, z: tuple(c * (0.6 if y < 0.476 else 0.85 + 0.15 * math.sin(math.atan2(x, z) * 7)) for c in COWL), 'leather')

# ================= GŁOWA: ogolona, z bródką =================
head = Head((0.0, 0.584, 0.004), (0.046, 0.058, 0.05), seg=32, rings=24)
neck = lathe('neck', [(0.024, 0.5), (0.025, 0.535), (0.026, 0.55)], seg=12, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
# krótko ostrzyżony wianek na potylicy i skroniach (czubek łysy)
hair = head.shell('hair', 1.025, lambda x, y, z: smooth(0.0, 0.2, 0.05 - y) * smooth(0.0, 0.25, 0.35 - z) * smooth(-0.62, -0.42, y))
beard = head.shell('beard', 1.07, head.beard_mask(), show='beard')

static = [torso_m, mailc_m, *laces, skirt_m, mailskirt_m, *tassets, *paul, belt_m, buckle_m, pouch_m, sheath_m, sash_m,
          scarf_m, cowl_m, head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(), hair, beard]
import sword as _sword  # noqa: E402
_extra = {'sword': [pack(m) for m in _sword.build(False)], 'swordFar': [pack(m) for m in _sword.build(True)]}
finish('guard', static, [leg_m, cuisse_m, knee_m, greave_m, *straps], [arm_m, *rere, brace_m, *studs], HIP, SHOULDER, HAND, extra=_extra)
