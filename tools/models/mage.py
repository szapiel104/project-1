"""Mag osady — własny projekt w surowym, średniowiecznym klimacie gry, w dwóch odmianach:
  fire  — mag ognia: szata w kolorze zaschniętej krwi, płaszcz z kapturem w ciemnej czerwieni, obrąbki w kolorze żaru,
          ogolona głowa i krótka siwa broda, na piersi mosiężna tarcza słońca.
  water — mag wody: szata w kolorze głębokiego granatu, płaszcz z kapturem w odcieniu nocnego jeziora, srebrzystoniebieskie
          obrąbki, włosy i broda (barwa z gry), na piersi srebrny pierścień z niebieskim kamieniem.
Wspólne: szata do ziemi z fałdami (nogi pod nią tylko jako trzewiki), szerokie rękawy rozszerzone przy dłoniach,
płaszcz z opuszczonym kapturem na barkach rozchylony z przodu, pas z plecionego sznura w barwach pana (frędzle z przodu).
Bez kostura: magię rzucają z gołych dłoni (ogień / woda w dłoniach dokłada gra jako efekt).

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/mage.py fire|water  →  src/render/models/mage_<odmiana>.json
Kotwice jak u pana zamku: biodro (±0,045; 0,2), bark (±0,118; 0,445), dłoń 0,18 pod barkiem.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, evaluated, hexrgb, keep_faces, lathe, reset, skin, sphere  # noqa: E402

KIND = sys.argv[1] if len(sys.argv) > 1 else 'fire'
FIRE = KIND == 'fire'
reset()
import bmesh as _bm  # noqa: E402
from body import Head, finish, smooth  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
if FIRE:
    ROBE, ROBE_DK, MANTLE, TRIM, TRIM2 = hexrgb(0x4a1210), hexrgb(0x240907), hexrgb(0x6a1a14), hexrgb(0xc9772a), hexrgb(0x2e140c)
    BADGE = hexrgb(0xb08a3e)
else:
    ROBE, ROBE_DK, MANTLE, TRIM, TRIM2 = hexrgb(0x1b2a4e), hexrgb(0x0c1428), hexrgb(0x24406e), hexrgb(0x9fb8cf), hexrgb(0x12203c)
    BADGE = hexrgb(0xb8bec6)
SHOE = hexrgb(0x2a1e15)

HIP = (0.045, 0.2, 0.0)
SHOULDER = (0.118, 0.445, 0.0)
HAND = (0.0, -0.18, 0.004)


def noise3(x, y, z):
    return (math.sin(x * 129.898 + y * 782.33 + z * 377.19) * 43758.5453) % 1.0


def lining(bm, dist=0.0025):
    back = bm.copy()
    back.normal_update()
    for v in back.verts:
        v.co -= v.normal * dist
    _bm.ops.reverse_faces(back, faces=back.faces[:])
    return back


def folds(bm, n, amp, top):
    """Pionowe fałdy szaty: promień faluje wokół osi, mocniej ku dołowi"""
    for v in bm.verts:
        x, y, z = v.co.x, v.co.z, -v.co.y
        if math.hypot(x, z) < 1e-4:
            continue
        a = math.atan2(x, z)
        k = 1 + amp * math.sin(a * n + 0.7 * math.sin(a * 3)) * smooth(top, 0.03, y)
        v.co.x, v.co.y = x * k, -(z * k)
    return bm


def cloth(base, k=0.12, n=11):
    def col(x, y, z):
        a = math.atan2(x, z)
        f = 0.86 + 0.1 * math.sin(a * n + 0.7 * math.sin(a * 3)) + (noise3(x, y, z) - 0.5) * k
        return tuple(c * f for c in base)
    return col


# ---------- noga: pod szatą tylko trzewik ----------
leg = skin('mleg', [(0, 0, 0), (0, -0.11, 0.004), (0, -0.19, 0.0)], [(0, 1), (1, 2)], [(0.034, 0.034), (0.028, 0.029), (0.025, 0.025)], subsurf=1)
leg_m = Mesh(evaluated(leg), (0.25, 0.2, 0.17), 'cloth')
shoe = skin('mshoe', [(0, -0.18, 0), (0, -0.214, 0.0), (0, -0.218, 0.052)], [(0, 1), (1, 2)], [(0.03, 0.03), (0.03, 0.02), (0.022, 0.013)], subsurf=1)
shoe_m = Mesh(evaluated(shoe), lambda x, y, z: tuple(c * (0.75 if y < -0.228 else 1) for c in SHOE), 'leather')

# ---------- ręka: szeroki rękaw rozszerzony przy dłoni, obrąbek, dłoń ----------
# rękaw z łokciem: ramię (bark–łokieć) obraca się w barku, przedramię z rozszerzonym rękawem, mankietem i dłonią — w łokciu
# (gra: 'fore' / 'foreFar' i 'elbow', jak u łucznika). Kula łokcia w kolorze szaty zakrywa styk przy zgięciu.
ELBOW = -0.082
upper = lathe('marm', [(0.001, 0.034), (0.025, 0.03), (0.036, 0.01), (0.036, -0.03), (0.038, -0.07), (0.034, -0.088), (0.02, -0.096)], seg=16, subsurf=0)
arm_m = Mesh(evaluated(upper), cloth(ROBE, 0.1, 6), 'cloth')
elbow_ball = sphere('melbow', (0.0, ELBOW, 0.0), (0.035, 0.03, 0.035), seg=14, rings=10)
elbow_m = Mesh(evaluated(elbow_ball), cloth(ROBE, 0.1, 6), 'cloth')
lower = lathe('mfore', [(0.03, -0.07), (0.038, -0.08), (0.04, -0.1), (0.046, -0.13), (0.052, -0.158), (0.05, -0.162)], seg=16, subsurf=0)
ab = evaluated(lower)
ab_lin = lining(ab)
fore_m = Mesh(ab, cloth(ROBE, 0.1, 6), 'cloth')
fore_in_m = Mesh(ab_lin, tuple(c * 0.4 for c in ROBE_DK), 'cloth')
cuff = lathe('mcuff', [(0.049, -0.138), (0.054, -0.142), (0.055, -0.16), (0.051, -0.165)], seg=16, subsurf=0)
cuff_m = Mesh(evaluated(cuff), lambda x, y, z: tuple(c * (0.85 + 0.15 * abs(math.sin(math.atan2(x, z) * 10))) for c in TRIM), 'cloth')
wrist = skin('mwrist', [(0, -0.12, 0.0), (0, -0.172, 0.003)], [(0, 1)], [(0.016, 0.016), (0.014, 0.012)], subsurf=1)
wrist_m = Mesh(evaluated(wrist), WHITE, 'skin', dyn='skin')
# dłoń z palcami: płaska śródręcz (wnętrzem do uda), cztery osobne palce w dwóch członach lekko zgięte, kciuk z przodu.
# Ta sama siatka idzie na obie ręce, więc dłoń jest symetryczna w osi x (palce rozłożone w przód–tył). Każdy palec to
# osobna bryła, żeby się nie zlewały w łapę; dłoń wysunięta spod rękawa (nadgarstek widać).
HY = -0.014  # o tyle niżej niż kotwica dłoni u chłopa — spod szerokiego rękawa


def hand_meshes():
    out = []
    def part(name, p, r, sub=1):
        ob = skin(name, [(x, y + HY, z) for x, y, z in p], [(i, i + 1) for i in range(len(p) - 1)], r, subsurf=sub)
        out.append(Mesh(evaluated(ob), hand_col, 'skin', dyn='skin'))
    part('mpalm', [(0, -0.156, 0.003), (0, -0.17, 0.004), (0, -0.184, 0.004)], [(0.0085, 0.0155), (0.0082, 0.0175), (0.0075, 0.0165)])
    for k, (dz, ln, r) in enumerate(((0.0105, 0.029, 0.0036), (0.0035, 0.032, 0.0038), (-0.0035, 0.03, 0.0036), (-0.0105, 0.024, 0.0032))):
        part(f'mfinger{k}', [(0, -0.182, 0.004 + dz), (0, -0.182 - ln * 0.55, 0.004 + dz * 1.08 + 0.002), (0, -0.182 - ln, 0.004 + dz * 1.12 + 0.006)],
             [(r, r), (r * 0.9, r * 0.88), (r * 0.72, r * 0.7)])
    part('mthumb', [(0, -0.162, 0.014), (0, -0.174, 0.022), (0, -0.186, 0.027)], [(0.0052, 0.0052), (0.0045, 0.0045), (0.0036, 0.0036)])
    return out


def hand_col(x, y, z):
    # stawy palców odrobinę ciemniej, opuszki jaśniej
    yy = y - HY
    k = 0.93 + 0.07 * math.cos((yy + 0.182) * 200) if yy < -0.184 else 0.95
    if yy < -0.208:
        k = 1.04
    return (k, k * 0.97, k * 0.95)


hand_ms = hand_meshes()

# ---------- szata do ziemi z fałdami i obrąbkiem ----------
robe = lathe('mrobe', [(0.0, 0.004), (0.15, 0.004), (0.154, 0.03), (0.142, 0.1), (0.124, 0.18), (0.106, 0.25), (0.096, 0.3), (0.092, 0.33),
                       (0.098, 0.38), (0.106, 0.42), (0.103, 0.448), (0.08, 0.472), (0.05, 0.488), (0.032, 0.494)], seg=40, depth=0.8, subsurf=0)
rb = folds(evaluated(robe), 13, 0.055, 0.32)


def robe_col(x, y, z):
    if y < 0.045:  # obrąbek: dwa paski haftu w kolorze odmiany
        band = 0.012 < y < 0.022 or 0.03 < y < 0.036
        return tuple(c * (0.9 + 0.1 * math.sin(math.atan2(x, z) * 60)) for c in (TRIM if band else TRIM2))
    return cloth(ROBE, 0.12, 13)(x, y, z)


robe_m = Mesh(rb, robe_col, 'cloth')
# pas z plecionego sznura w barwach pana, węzeł i dwa frędzle z przodu
cord = lathe('mcord', [(0.097, 0.298), (0.101, 0.302), (0.101, 0.312), (0.097, 0.316)], seg=28, depth=0.8, subsurf=0)
cord_m = Mesh(evaluated(cord), lambda x, y, z: (0.75 + 0.25 * abs(math.sin((x + z) * 320 + y * 900)),) * 3, 'cloth', dyn='tunic')
knot = sphere('mknot', (0.03, 0.305, 0.083), (0.012, 0.011, 0.008), seg=8, rings=6)
knot_m = Mesh(evaluated(knot), (0.8,) * 3, 'cloth', dyn='tunic')
tassels = []
for i, dx in enumerate((0.022, 0.04)):
    t = skin(f'mtass{i}', [(dx, 0.3, 0.085), (dx + 0.004, 0.24, 0.09), (dx + 0.006, 0.205, 0.088)], [(0, 1), (1, 2)],
             [(0.0045, 0.0045), (0.0045, 0.0045), (0.009, 0.009)], subsurf=1)
    tassels.append(Mesh(evaluated(t), (0.8,) * 3, 'cloth', dyn='tunic'))

# ---------- płaszcz z opuszczonym kapturem, rozchylony z przodu ----------
mantle = lathe('mmantle', [(0.13, 0.14), (0.128, 0.2), (0.12, 0.3), (0.115, 0.38), (0.118, 0.42), (0.114, 0.448), (0.092, 0.472), (0.064, 0.488)],
               seg=30, depth=0.86, phi0=0.62, phi=2 * math.pi - 1.24, subsurf=0)
mb = folds(evaluated(mantle), 9, 0.05, 0.36)
mb_lin = lining(mb, 0.003)


def mantle_col(x, y, z):
    edge = y < 0.155 or abs(abs(math.atan2(x, z)) - 0.62) < 0.08
    return tuple(c * (0.9 + 0.1 * math.sin(math.atan2(x, z) * 40)) for c in TRIM) if edge else cloth(MANTLE, 0.12, 9)(x, y, z)


mantle_m = Mesh(mb, mantle_col, 'cloth')
mantle_in_m = Mesh(mb_lin, tuple(c * 0.55 for c in ROBE_DK), 'cloth')
# opuszczony kaptur: zwinięty wał na karku i barkach
hood = lathe('mhood', [(0.086, 0.452), (0.1, 0.468), (0.098, 0.49), (0.08, 0.508), (0.062, 0.514)], seg=24, depth=0.9,
             phi0=0.9, phi=2 * math.pi - 1.8, subsurf=1)
hb = evaluated(hood)
hb_lin = lining(hb)
hood_m = Mesh(hb, cloth(MANTLE, 0.14, 7), 'cloth')
hood_in_m = Mesh(hb_lin, tuple(c * 0.5 for c in ROBE_DK), 'cloth')
# kaptur zwisa na plecach: worek tkaniny
sack = sphere('mhoodsack', (0.0, 0.43, -0.105), (0.06, 0.07, 0.03), seg=14, rings=10)
sb = evaluated(sack)
keep_faces(sb, lambda x, y, z: z < -0.095)
sb_lin = lining(sb)
sack_m = Mesh(sb, cloth(MANTLE, 0.14, 5), 'cloth')
sack_in_m = Mesh(sb_lin, tuple(c * 0.45 for c in ROBE_DK), 'cloth')

# ---------- znak na piersi na łańcuszku ----------
chain_pts = [(math.sin(a) * 0.06, 0.462 - 0.06 * (1 - math.cos(a)) * 0.9, math.cos(a) * 0.052 + 0.02) for a in [(-0.9 + 1.8 * k / 10) for k in range(11)]]
chain = skin('mchain', chain_pts, [(k, k + 1) for k in range(10)], [(0.0022, 0.0022)] * 11, subsurf=0)
chain_m = Mesh(evaluated(chain), BADGE, 'metal')
badge = []
if FIRE:
    # tarcza słońca: dysk z ośmioma promieniami
    disk = lathe('msun', [(0.0001, -0.003), (0.016, -0.003), (0.018, 0.0), (0.016, 0.003), (0.0001, 0.004)], seg=20, subsurf=0)
    db = evaluated(disk)
    from mathutils import Matrix as _M  # noqa: E402
    _bm.ops.rotate(db, verts=db.verts, cent=(0, 0, 0), matrix=_M.Rotation(math.pi / 2, 3, 'X'))
    _bm.ops.translate(db, verts=db.verts, vec=(0, -0.088, 0.398))
    badge.append(Mesh(db, lambda x, y, z: tuple(c * (1.15 if math.hypot(x, y - 0.398) < 0.008 else 0.9) for c in BADGE), 'metal'))
    for k in range(8):
        a = 2 * math.pi * k / 8
        r = skin(f'mray{k}', [(math.sin(a) * 0.017, 0.398 + math.cos(a) * 0.017, 0.088), (math.sin(a) * 0.028, 0.398 + math.cos(a) * 0.028, 0.087)],
                 [(0, 1)], [(0.0035, 0.0018), (0.0008, 0.0008)], subsurf=0)
        badge.append(Mesh(evaluated(r), BADGE, 'metal'))
else:
    # srebrny pierścień z niebieskim kamieniem w środku
    ring = lathe('mring', [(0.011, -0.003), (0.019, -0.003), (0.021, 0.0), (0.019, 0.003), (0.011, 0.003), (0.01, 0.0)], seg=22, subsurf=0)
    rgb = evaluated(ring)
    from mathutils import Matrix as _M  # noqa: E402
    _bm.ops.rotate(rgb, verts=rgb.verts, cent=(0, 0, 0), matrix=_M.Rotation(math.pi / 2, 3, 'X'))
    _bm.ops.translate(rgb, verts=rgb.verts, vec=(0, -0.088, 0.398))
    badge.append(Mesh(rgb, BADGE, 'metal'))
    badge.append(Mesh(evaluated(sphere('mstone', (0.0, 0.398, 0.09), (0.009, 0.009, 0.005), seg=10, rings=6)), hexrgb(0x2f74c0), 'metal'))

# ---------- głowa ----------
# twarz rzeźbiona mocniej niż u chłopów (mag ma być rozpoznawalny z bliska): wyraźny łuk brwiowy, głębsze oczodoły,
# prosty mocny nos ze skrzydełkami, kości policzkowe i zapadnięte policzki, wargi, broda i linia żuchwy.
import body as _body  # noqa: E402
_soft_face = _body.face


def mage_face(x, y, z, strong=1.0):
    x, y, z = _soft_face(x, y, z, strong)
    u, v = math.atan2(x, z), y
    front = max(0.0, z)
    bump = _body.bump
    k = 1.0
    k += 0.088 * bump(u, v, 0, 0.2, 0.42, 0.06) * front            # łuk brwiowy
    for su in (-0.37, 0.37):
        k -= 0.080 * bump(u, v, su, 0.04, 0.12, 0.08) * front        # głębsze oczodoły
        k += 0.072 * bump(u, v, su * 1.45, -0.12, 0.12, 0.1) * front  # kości policzkowe
        k -= 0.056 * bump(u, v, su * 1.3, -0.42, 0.13, 0.12) * front  # zapadnięte policzki
        k += 0.040 * bump(u, v, su * 0.4, -0.33, 0.05, 0.04) * front  # skrzydełka nosa
        k += 0.032 * bump(u, v, su * 1.6, -0.66, 0.15, 0.1)            # linia żuchwy
    k += 0.192 * bump(u, v, 0, -0.12, 0.055, 0.15) * front            # grzbiet nosa (mocniejszy)
    k += 0.096 * bump(u, v, 0, -0.29, 0.06, 0.05) * front             # czubek nosa
    k += 0.035 * bump(u, v, 0, -0.47, 0.17, 0.025) * front           # górna warga
    k -= 0.032 * bump(u, v, 0, -0.515, 0.16, 0.018) * front           # szpara ust
    k += 0.032 * bump(u, v, 0, -0.56, 0.13, 0.03) * front             # dolna warga
    k += 0.056 * bump(u, v, 0, -0.8, 0.2, 0.08) * front              # broda
    return x * k, y, z * k


_body.face = mage_face
head = Head((0.0, 0.548, 0.004), (0.054, 0.065, 0.058), seg=56, rings=44)


def face_col(x, y, z):
    # bruzdy i zmarszczki w kolorze skóry: czoło, kurze łapki, bruzdy nosowo-wargowe, cień pod łukiem brwiowym, usta
    ux, uy, uz = head.unit(x, y, z)
    k = 1.0
    if uz > 0.2:
        k -= 0.12 * math.exp(-((uy - 0.42) % 0.09 - 0.045) ** 2 / 0.00015) * smooth(0.3, 0.55, uy) * (abs(ux) < 0.45)
        k -= 0.18 * math.exp(-((uy - 0.13) / 0.05) ** 2) * math.exp(-((abs(ux) - 0.36) / 0.16) ** 2)
        k -= 0.14 * math.exp(-((abs(ux) - (0.2 + 0.25 * (-0.3 - uy))) / 0.03) ** 2) * (-0.62 < uy < -0.3)
        k -= 0.1 * math.exp(-((abs(ux) - 0.62) / 0.05) ** 2) * math.exp(-((uy - 0.05) / 0.12) ** 2)
        k -= 0.35 * math.exp(-((uy + 0.515) / 0.022) ** 2) * math.exp(-(ux / 0.16) ** 2)
        k += 0.06 * math.exp(-((uy + 0.47) / 0.03) ** 2) * math.exp(-(ux / 0.15) ** 2) - 0.04
    return (k, k * 0.96, k * 0.94)


head.skin.col = [face_col(*p) for p in head.skin.pos]


def mage_eyes():
    """Oko: białko w kształcie migdała wpuszczone w oczodół, ciemna tęczówka, nad nim powieka w kolorze skóry"""
    out = []
    R = head.R
    for sx in (-1, 1):
        x, y, z = head.point(sx * 0.35, 0.05)
        wb = sphere(f'mwhite{sx}', (x, y, z - R[2] * 0.06), (R[0] * 0.15, R[1] * 0.07, R[2] * 0.07), seg=12, rings=8)
        out.append(Mesh(evaluated(wb), (0.86, 0.83, 0.78), 'skin'))
        ix, iy, iz = head.point(sx * 0.33, 0.045)
        ir = sphere(f'miris{sx}', (ix, iy, iz - R[2] * 0.02), (R[0] * 0.065, R[1] * 0.06, R[2] * 0.04), seg=10, rings=6)
        out.append(Mesh(evaluated(ir), (0.16, 0.11, 0.08) if FIRE else (0.2, 0.28, 0.36), 'leather'))
        lx, ly, lz = head.point(sx * 0.35, 0.12)
        lid = sphere(f'mlid{sx}', (lx, ly, lz - R[2] * 0.03), (R[0] * 0.17, R[1] * 0.045, R[2] * 0.06), seg=12, rings=8)
        lb = evaluated(lid)
        keep_faces(lb, lambda px, py, pz: py > ly - R[1] * 0.01)
        out.append(Mesh(lb, (0.9, 0.86, 0.84), 'skin', dyn='skin'))
    return out
neck = lathe('mneck', [(0.027, 0.47), (0.027, 0.5), (0.029, 0.52)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), WHITE, 'skin', dyn='skin')
if FIRE:
    # ogolona głowa, krótka siwa broda przy szczęce
    GREY = (0.62, 0.6, 0.57)
    beard = head.shell('mbeard', 1.06, head.beard_mask(), dyn=None, shade=lambda x, y, z: tuple(c * (0.85 + 0.2 * noise3(x * 5, y * 5, z * 5)) for c in GREY))
    hairs = [beard]
    brows = head.brows(dyn=None)
else:
    hair = head.shell('mhair', 1.08, lambda x, y, z: smooth(0.0, 0.12, y - (0.05 + 0.55 * z)) * smooth(-0.9, -0.3, y + 0.3 * (1 - z)))
    beard = head.shell('mbeard', 1.1, head.beard_mask())
    hairs = [hair, beard]
    brows = head.brows()

static = [robe_m, cord_m, knot_m, *tassels, mantle_m, mantle_in_m, hood_m, hood_in_m, sack_m, sack_in_m, chain_m, *badge,
          head.skin, neck_m, *head.ears(1.3), *mage_eyes(), *brows, *hairs]


# przedramię: cień w zagłębieniach w pozie spoczynkowej (z całym ciałem), potem współrzędne względem łokcia
from body import decimated, groups, fixed_cloth, pack, thicken  # noqa: E402
from common import bake_ao  # noqa: E402
fore = [fore_m, fore_in_m, cuff_m, wrist_m, *hand_ms]
arms = [arm_m, elbow_m]
occ = [(m, (0, 0, 0)) for m in static] + [(m, (sx * SHOULDER[0], SHOULDER[1], SHOULDER[2])) for sx in (-1, 1) for m in fore + arms]
bake_ao(occ, sample=[(m, (SHOULDER[0], SHOULDER[1], SHOULDER[2])) for m in fore])
for m in fore:
    if m.mat in ('metal', 'mail', 'skin'):
        thicken(m)
    m.pos = [(x, y - ELBOW, z) for x, y, z in m.pos]
near = groups(fore, fixed_cloth)
far = [decimated(m, 0.22) for m in groups(fore, lambda m: 'leather' if m.dyn is None else m.mat)]
# kula czaru w prawej dłoni (gra rysuje ją świecącą tylko przy czarowaniu): środek przy wnętrzu dłoni, względem łokcia
ORB = [-0.02, -0.207 + HY - ELBOW, 0.022]
finish(f'mage_{KIND}', static, [leg_m, shoe_m], arms, HIP, SHOULDER, HAND,
       extra={'elbow': [0.0, ELBOW, 0.0], 'fore': [pack(m) for m in near], 'foreFar': [pack(m) for m in far], 'orb': ORB})
