"""Zbój z puszczy w klimacie Gothica: bez pana i bez barw. Brudna, połatana lniana koszula, na niej kamizela z owczej
skóry wełną do środka (kudłate brzegi), na barkach wyliniała wilcza skóra z łbem przewieszonym przez ramię, wełniany
kaptur z postrzępionym brzegiem, gęsta broda. Portki z grubego sukna, łydki owinięte onucami i krzyżowo przewiązane
rzemieniem, niskie skórzane ciżmy. Pas ze sznura i rzemienia, sakwa, nóż w pochwie. Lewy karwasz skórzany, dłonie gołe.
W prawej dłoni topór z brodą (osobna siatka 'axe' / 'axeFar', kotwica jak miecz strażnika). Bez tarczy.

Uruchomienie (z katalogu repo):  /tmp/bpyenv/bin/python tools/models/bandit.py  →  src/render/models/bandit.json
Kotwice jak u chłopa: biodro (±0,052; 0,235), bark (±0,135; 0,45), dłoń 0,185 pod barkiem.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import Mesh, bake_ao, evaluated, hexrgb, keep_faces, lathe, reset, skin, sphere  # noqa: E402

reset()
import bmesh as _bm  # noqa: E402
from mathutils import Matrix as _M  # noqa: E402
from body import Head, finish, pack, smooth  # noqa: E402
from sword import _tri, sweep, turned  # noqa: E402

WHITE = (1.0, 1.0, 1.0)
LINEN, LINEN_DK = hexrgb(0x9c8458), hexrgb(0x5f4a30)
WOOL, WOOL_DK = hexrgb(0x4c3624), hexrgb(0x33261a)
SHEEP, SHEEP_IN = hexrgb(0x7a5432), hexrgb(0xa08664)
WOLF, WOLF_DK, WOLF_LT = hexrgb(0x5e544a), hexrgb(0x2e2924), hexrgb(0x93877a)
LEATHER, LEATHER_DK = hexrgb(0x4e3522), hexrgb(0x2c1e14)
ROPE, IRON, IRON_DK = hexrgb(0x7d6a48), hexrgb(0x6c6f74), hexrgb(0x3e4045)

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


def moved(bm, rot=None, at=(0, 0, 0)):
    """Obrót i przesunięcie w układzie gry (x w prawo, y w górę, z w przód); bmesh trzyma współrzędne Blendera (x, -z, y)"""
    axes = {'X': ('X', 1), 'Y': ('Z', 1), 'Z': ('Y', -1)}
    if rot:
        for ang, axis in rot:
            ax, sg = axes[axis]
            _bm.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=_M.Rotation(ang * sg, 3, ax))
    _bm.ops.translate(bm, verts=bm.verts, vec=(at[0], -at[2], at[1]))
    return bm


def grime(base, k=0.16, dirt_below=None):
    """Brud i wytarcia: plamy szumu, ciemniej ku dołowi (błoto)"""
    def col(x, y, z):
        f = 0.84 + (noise3(x, y, z) - 0.5) * k + 0.04 * math.sin(math.atan2(x, z) * 5 + y * 40)
        if dirt_below is not None and y < dirt_below:
            f *= 0.72 + 0.28 * max(0.0, 1 - (dirt_below - y) / 0.05)
        return tuple(c * f for c in base)
    return col


def shag(base, tips, k=0.3):
    """Sierść: pasma wzdłuż (w pionie) i jaśniejsze końce włosa"""
    def col(x, y, z):
        a = math.atan2(x, z)
        streak = 0.5 + 0.5 * math.sin(a * 46 + noise3(x, 0, z) * 6)
        f = 0.78 + (noise3(x, y, z) - 0.5) * k + 0.14 * streak
        t = max(0.0, min(1.0, noise3(x * 3, y * 3, z * 3) * 1.4 - 0.4))
        return tuple((c * (1 - t) + tc * t) * f for c, tc in zip(base, tips))
    return col


def ragged(bm, y_edge, teeth=9, depth=0.02, phase=0.0):
    """Postrzępiony dolny brzeg: wycina ząbki pod linią y_edge"""
    keep_faces(bm, lambda x, y, z: not (y < y_edge and ((math.atan2(x, z) * teeth + phase) % 2) < (0.55 + 0.4 * noise3(round(math.atan2(x, z) * teeth), 1, 2)) * min(1.0, (y_edge - y) / depth * 1.6)))


# ================= NOGA (środek obrotu w biodrze) =================
# portki z grubego, brudnego sukna — szersze nad kolanem
leg = skin('leg', [(0, 0.01, 0), (0, -0.045, 0.004), (0, -0.085, 0.008), (0, -0.115, 0.006)],
           [(0, 1), (1, 2), (2, 3)], [(0.05, 0.05), (0.05, 0.05), (0.044, 0.045), (0.038, 0.04)], subsurf=2)
leg_m = Mesh(evaluated(leg), grime(WOOL, 0.18, dirt_below=-0.06), 'cloth')
# łata na kolanie (ciemniejsze sukno, naszyta, wystaje ponad nogawkę)
patch = sphere('patch', (0.012, -0.082, 0.04), (0.022, 0.024, 0.012), seg=10, rings=6)
pb = evaluated(patch)
keep_faces(pb, lambda x, y, z: z > 0.035)
patch_m = Mesh(pb, grime(LINEN_DK, 0.2), 'cloth')
# onuce: łydka owinięta pasami płótna, kolejne zwoje lekko grubsze
wraps = []
for i in range(7):
    y0 = -0.1 - i * 0.0155
    r = 0.04 - i * 0.001
    w = lathe(f'wrap{i}', [(r - 0.0005, y0 - 0.0155), (r + 0.0009, y0 - 0.011), (r + 0.0011, y0 - 0.004), (r, y0)], seg=18, subsurf=0)
    wraps.append(Mesh(evaluated(w), grime(LINEN, 0.22, dirt_below=-0.17), 'cloth'))
# rzemień krzyżowo po onucach (dwa skośne pasy z przodu i z tyłu)
xp, xe = [], []
for i in range(5):
    y = -0.105 - i * 0.022
    r = 0.044 - i * 0.0012
    a = (0.9 if i % 2 == 0 else -0.9)
    xp.append((math.sin(a) * r, y, math.cos(a) * r))
    if i:
        xe.append((i - 1, i))
for i in range(5):
    y = -0.105 - i * 0.022
    r = 0.044 - i * 0.0012
    a = math.pi + (0.9 if i % 2 == 0 else -0.9)
    xp.append((math.sin(a) * r, y, math.cos(a) * r))
    if i:
        xe.append((5 + i - 1, 5 + i))
thong = skin('thong', xp, xe, [(0.0028, 0.002)] * len(xp), subsurf=0)
thong_m = Mesh(evaluated(thong), LEATHER_DK, 'leather')
# niskie ciżmy z miękkiej skóry, czubek lekko zadarty
shoe = skin('shoe', [(0, -0.2, -0.004), (0, -0.214, 0.012), (0, -0.218, 0.05), (0, -0.212, 0.064)], [(0, 1), (1, 2), (2, 3)],
            [(0.039, 0.03), (0.04, 0.026), (0.034, 0.02), (0.022, 0.012)], subsurf=2)
shoe_m = Mesh(evaluated(shoe), grime(LEATHER, 0.2, dirt_below=-0.215), 'leather')

# ================= RĘKA (środek obrotu w barku) =================
# rękaw lnianej koszuli, podwinięty pod łokciem; niżej goła ręka
arm = lathe('arm', [(0.001, 0.034), (0.025, 0.03), (0.037, 0.01), (0.037, -0.025), (0.035, -0.06), (0.033, -0.08)], seg=16, subsurf=0)
arm_m = Mesh(evaluated(arm), grime(LINEN, 0.2), 'cloth')
roll = lathe('roll', [(0.033, -0.092), (0.038, -0.088), (0.039, -0.078), (0.035, -0.072)], seg=16, subsurf=0)
roll_m = Mesh(evaluated(roll), grime(LINEN_DK, 0.15), 'cloth')
fore = skin('fore', [(0, -0.08, 0.0), (0, -0.12, 0.003), (0, -0.155, 0.004)], [(0, 1), (1, 2)],
            [(0.029, 0.028), (0.025, 0.024), (0.021, 0.019)], subsurf=1)
fore_m = Mesh(evaluated(fore), lambda x, y, z: (0.78 + (noise3(x, y, z) - 0.5) * 0.14,) * 3, 'skin', dyn='skin')
# skórzany karwasz na przedramieniu, ściągnięty rzemieniem
brace = lathe('brace', [(0.024, -0.152), (0.028, -0.146), (0.029, -0.11), (0.028, -0.102)], seg=14, subsurf=0)
brace_b = evaluated(brace)
brace_m = Mesh(brace_b, grime(LEATHER, 0.22), 'leather')
bstr = lathe('bstrap', [(0.0295, -0.132), (0.031, -0.13), (0.031, -0.124), (0.0295, -0.122)], seg=14, subsurf=0)
bstr_m = Mesh(evaluated(bstr), LEATHER_DK, 'leather')
hand = skin('hand', [(0, -0.152, 0.002), (0, -0.185, 0.006), (0, -0.204, 0.008)], [(0, 1), (1, 2)],
            [(0.022, 0.02), (0.024, 0.016), (0.018, 0.013)], subsurf=1)
hand_m = Mesh(evaluated(hand), lambda x, y, z: (0.72 + (noise3(x, y, z) - 0.5) * 0.16,) * 3, 'skin', dyn='skin')

# ================= TUŁÓW =================
# lniana koszula do pół uda, brudna i przetarta
shirt = lathe('shirt', [(0.088, 0.17), (0.094, 0.2), (0.09, 0.25), (0.096, 0.33), (0.104, 0.4), (0.1, 0.44), (0.08, 0.468), (0.055, 0.485), (0.036, 0.49)],
              seg=28, depth=0.76, subsurf=0)
sb = evaluated(shirt)
ragged(sb, 0.185, teeth=11, depth=0.015)
sb_lin = lining(sb)
shirt_m = Mesh(sb, grime(LINEN, 0.2, dirt_below=0.2), 'cloth')
shirt_in_m = Mesh(sb_lin, tuple(c * 0.45 for c in LINEN), 'cloth')
# rozcięcie pod szyją, luźno zasznurowane
neckcut = skin('neckcut', [(0.0, 0.485, 0.074), (0.0, 0.44, 0.08)], [(0, 1)], [(0.006, 0.002), (0.003, 0.0015)], subsurf=0)
neckcut_m = Mesh(evaluated(neckcut), LINEN_DK, 'cloth')
# kamizela z owczej skóry: otwarta z przodu, do bioder, wełna wywinięta na brzegach
vest = lathe('vest', [(0.1, 0.22), (0.102, 0.26), (0.104, 0.33), (0.112, 0.4), (0.108, 0.44), (0.088, 0.466), (0.062, 0.482)],
             seg=28, depth=0.78, phi0=0.42, phi=2 * math.pi - 0.84, subsurf=0)
vb = evaluated(vest)
ragged(vb, 0.235, teeth=13, depth=0.014, phase=0.5)
vb_lin = lining(vb, 0.003)
vest_m = Mesh(vb, grime(SHEEP, 0.24), 'leather')
vest_in_m = Mesh(vb_lin, shag(SHEEP_IN, (0.85, 0.8, 0.7), 0.25), 'cloth')
# biodra: portki pod koszulą
hips = lathe('hips', [(0.078, 0.25), (0.086, 0.215), (0.09, 0.19)], seg=20, depth=0.8, subsurf=0)
hips_m = Mesh(evaluated(hips), grime(WOOL, 0.18), 'cloth')
# pas: rzemień przewiązany sznurem, końce sznura zwisają z przodu
belt = lathe('belt', [(0.103, 0.255), (0.107, 0.26), (0.107, 0.28), (0.103, 0.285)], seg=24, depth=0.78, subsurf=0)
belt_m = Mesh(evaluated(belt), grime(LEATHER_DK, 0.2), 'leather')
cord = lathe('cord', [(0.106, 0.286), (0.109, 0.289), (0.109, 0.295), (0.106, 0.298)], seg=24, depth=0.79, subsurf=0)
cord_m = Mesh(evaluated(cord), lambda x, y, z: tuple(c * (0.75 + 0.25 * abs(math.sin((x + z) * 300))) for c in ROPE), 'cloth')
ends = skin('cordends', [(0.03, 0.29, 0.088), (0.034, 0.25, 0.09), (0.036, 0.215, 0.088), (0.042, 0.29, 0.086), (0.05, 0.255, 0.087)],
            [(0, 1), (1, 2), (3, 4)], [(0.004, 0.004)] * 5, subsurf=1)
ends_m = Mesh(evaluated(ends), ROPE, 'cloth')
knot = sphere('knot', (0.036, 0.291, 0.087), (0.008, 0.007, 0.006), seg=8, rings=5)
knot_m = Mesh(evaluated(knot), ROPE, 'cloth')
# sakwa na lewym biodrze i nóż w pochwie na prawym
pouch = sphere('pouch', (-0.088, 0.24, 0.028), (0.024, 0.028, 0.018), seg=10, rings=6)
pouch_m = Mesh(evaluated(pouch), grime(LEATHER, 0.25), 'leather')
sheath = skin('sheath', [(0.098, 0.27, 0.02), (0.104, 0.2, 0.026)], [(0, 1)], [(0.011, 0.005), (0.006, 0.004)], subsurf=0)
sheath_m = Mesh(evaluated(sheath), LEATHER_DK, 'leather')
kh = turned([(0.0045, 0.0), (0.0055, 0.01), (0.005, 0.034), (0.0065, 0.04), (0.001, 0.044)], 6)
moved(kh, rot=[(0.08, 'Z')], at=(0.097, 0.27, 0.02))
knife_m = _tri(Mesh(kh, hexrgb(0x5a3e24), 'wood'))

# ================= WILCZA SKÓRA NA BARKACH =================
# skóra zarzucona na plecy i barki, z przodu krótsza; brzeg kudłaty
pelt = lathe('pelt', [(0.13, 0.36), (0.135, 0.39), (0.128, 0.42), (0.108, 0.452), (0.08, 0.476), (0.058, 0.492)], seg=24, depth=0.84,
             phi0=math.pi * 0.55, phi=math.pi * 0.9 + 0.9, subsurf=1)
plb = evaluated(pelt)
ragged(plb, 0.39, teeth=10, depth=0.03, phase=0.3)
plb_lin = lining(plb, 0.003)
pelt_m = Mesh(plb, shag(WOLF, WOLF_LT, 0.34), 'cloth')
pelt_in_m = Mesh(plb_lin, grime(hexrgb(0x6e5a44), 0.2), 'leather')
# na grzbiecie pręga ciemniejszej sierści (jak u wilka), lekko uniesiona nad skórą
ridge = skin('ridge', [(0.0, 0.48, -0.06), (0.0, 0.44, -0.095), (0.0, 0.4, -0.112), (0.0, 0.36, -0.116)], [(0, 1), (1, 2), (2, 3)],
             [(0.016, 0.006), (0.02, 0.007), (0.018, 0.007), (0.012, 0.005)], subsurf=1)
ridge_m = Mesh(evaluated(ridge), shag(WOLF_DK, WOLF, 0.3), 'cloth')
# łeb wilka na lewym barku, pyskiem do przodu nad piersią: czaszka, długi pysk z czarnym nosem, sterczące uszy,
# ciemne oczodoły (wyprawiona skóra, bez oczu) i dolna szczęka lekko opadnięta — ma być czytelny jako wilk także z wysokości kamery
WX, WY, WZ = -0.112, 0.492, 0.022
skull = sphere('wolfhead', (WX, WY, WZ), (0.044, 0.03, 0.05), seg=18, rings=12)
skull_m = Mesh(evaluated(skull), shag(WOLF, hexrgb(0x77695c), 0.3), 'cloth')
# czoło jaśniejsze, pręga przez środek czaszki ciemniejsza
brow = sphere('wolfbrow', (WX, WY + 0.016, WZ + 0.018), (0.03, 0.016, 0.032), seg=12, rings=8)
brow_m = Mesh(evaluated(brow), shag(WOLF_DK, WOLF, 0.25), 'cloth')
snout = skin('snout', [(WX, WY - 0.004, WZ + 0.038), (WX - 0.002, WY - 0.012, WZ + 0.08), (WX - 0.003, WY - 0.02, WZ + 0.112)], [(0, 1), (1, 2)],
             [(0.024, 0.02), (0.017, 0.013), (0.011, 0.009)], subsurf=1)
snout_m = Mesh(evaluated(snout), shag(WOLF, hexrgb(0x77695c), 0.25), 'cloth')
jaw = skin('jaw', [(WX, WY - 0.026, WZ + 0.04), (WX - 0.002, WY - 0.036, WZ + 0.08), (WX - 0.003, WY - 0.044, WZ + 0.1)], [(0, 1), (1, 2)],
           [(0.016, 0.008), (0.012, 0.006), (0.008, 0.004)], subsurf=1)
jaw_m = Mesh(evaluated(jaw), shag(WOLF_LT, (0.75, 0.7, 0.62), 0.2), 'cloth')
# kły w szczelinie pyska
fangs = []
for sx in (-1, 1):
    f = skin(f'fang{sx}', [(WX + sx * 0.007, WY - 0.026, WZ + 0.098), (WX + sx * 0.007, WY - 0.037, WZ + 0.1)], [(0, 1)], [(0.0028, 0.0028), (0.0006, 0.0006)], subsurf=0)
    fangs.append(Mesh(evaluated(f), hexrgb(0xd8cfb8), 'skin'))
nose = sphere('wnose', (WX - 0.003, WY - 0.016, WZ + 0.121), (0.009, 0.007, 0.007), seg=10, rings=6)
nose_m = Mesh(evaluated(nose), hexrgb(0x141110), 'leather')
sockets = []
for sx in (-1, 1):
    e = sphere(f'wsock{sx}', (WX + sx * 0.022, WY + 0.008, WZ + 0.042), (0.008, 0.005, 0.006), seg=8, rings=5)
    sockets.append(Mesh(evaluated(e), hexrgb(0x16120f), 'leather'))
ears = []
for sx in (-1, 1):
    e = skin(f'wear{sx}', [(WX + sx * 0.026, WY + 0.022, WZ - 0.004), (WX + sx * 0.032, WY + 0.05, WZ - 0.014)], [(0, 1)], [(0.014, 0.005), (0.0015, 0.0015)], subsurf=0)
    ears.append(Mesh(evaluated(e), shag(WOLF_DK, WOLF, 0.2), 'cloth'))
# ================= GŁOWA: wełniany kaptur, gęsta broda =================
head = Head((0.0, 0.546, 0.004), (0.054, 0.065, 0.058), seg=36, rings=28, strong=1.3)
# ogorzała, brudna twarz: ciemniej pod oczami i na policzkach, smugi brudu (kolor skóry i tak dobiera gra, to tylko cień)
def _dirt(x, y, z):
    ux, uy, uz = head.unit(x, y, z)
    k = 0.8 + (noise3(x * 2, y * 2, z * 2) - 0.5) * 0.16
    k -= 0.14 * math.exp(-((uy + 0.02) / 0.09) ** 2) * math.exp(-((abs(ux) - 0.34) / 0.14) ** 2) * (uz > 0.5)  # sińce pod oczami
    k -= 0.08 * smooth(0.1, 0.5, abs(ux)) * smooth(-0.6, -0.2, -uy)  # policzki w cieniu zarostu
    return (k, k * 0.95, k * 0.9)
head.skin.col = [_dirt(*p) for p in head.skin.pos]
neck = lathe('neck', [(0.027, 0.47), (0.027, 0.5), (0.029, 0.52)], seg=10, subsurf=0)
neck_m = Mesh(evaluated(neck), (0.72, 0.68, 0.64), 'skin', dyn='skin')


def beard_mask(x, y, z):
    """Gęsta, skołtuniona broda: od kości policzkowych w dół, z wąsem nad ustami; odsłonięte tylko oczy, nos i czoło"""
    below = smooth(0.0, 0.14, -0.14 - y)
    front = smooth(-0.55, -0.15, z)
    nose = (1 - smooth(0.1, 0.18, abs(x))) * smooth(-0.36, -0.28, y)
    return below * front * (1 - nose)


def beard_shade(x, y, z):
    # pasma włosa w dół, kołtuny, jaśniejsze końce na brodzie
    a = math.atan2(x, z)
    st = 0.5 + 0.5 * math.sin(a * 38 + noise3(x, 0, z) * 5)
    k = 0.62 + 0.22 * st + (noise3(x * 4, y * 4, z * 4) - 0.5) * 0.2 + 0.12 * smooth(-0.6, -1.0, y)
    return (k, k, k)


beard = head.shell('beard', 1.24, beard_mask, shade=beard_shade)
# broda opada niżej niż podbródek: druga warstwa pod szczęką, wydłużona w dół
chin = sphere('beardchin', (0.0, 0.497, 0.03), (0.04, 0.03, 0.03), seg=16, rings=10)
cb = evaluated(chin)
keep_faces(cb, lambda x, y, z: z > -0.01)
chin_m = Mesh(cb, lambda x, y, z: (0.58 + 0.25 * (0.5 + 0.5 * math.sin(math.atan2(x, z) * 30)) + (noise3(x, y, z) - 0.5) * 0.15,) * 3, 'cloth', dyn='hair')
hair = head.shell('hair', 1.04, lambda x, y, z: smooth(0.1, 0.35, 0.5 - z) * smooth(-0.3, 0.0, y + 0.1))


def face_hole(x, y, z, w=0.76, h=0.74):
    return smooth(0.1, 0.35, z) * smooth(-0.05, 0.1, h - abs(y + 0.12)) * smooth(-0.05, 0.1, w - abs(x))


hood = head.shell('hood', 1.3, lambda x, y, z: 1 - face_hole(x, y, z) if y > -0.88 else 0, dyn=None, mat='cloth',
                  shade=lambda x, y, z: tuple(c * ((0.9 if z > 0.3 else 0.78) + (noise3(x, y, z) - 0.5) * 0.18) for c in WOOL_DK))
# kołnierz kaptura opadający na barki, z postrzępionym brzegiem
cowl = lathe('cowl', [(0.1, 0.45), (0.094, 0.47), (0.08, 0.49), (0.06, 0.51), (0.048, 0.522)], seg=20, depth=0.86, subsurf=1)
cwb = evaluated(cowl)
ragged(cwb, 0.462, teeth=8, depth=0.012, phase=1.1)
cwb_lin = lining(cwb)
cowl_m = Mesh(cwb, grime(WOOL_DK, 0.2), 'cloth')
cowl_in_m = Mesh(cwb_lin, tuple(c * 0.5 for c in WOOL_DK), 'cloth')

static = [shirt_m, shirt_in_m, neckcut_m, vest_m, vest_in_m, hips_m, belt_m, cord_m, ends_m, knot_m, pouch_m, sheath_m, knife_m,
          pelt_m, pelt_in_m, ridge_m, skull_m, brow_m, snout_m, jaw_m, *fangs, nose_m, *sockets, *ears,
          head.skin, neck_m, *head.ears(), *head.eyes(), *head.brows(), beard, chin_m, hair, hood, cowl_m, cowl_in_m]


# ================= TOPÓR (w dłoni; początek układu w chwycie, drzewce w dół jak klinga miecza) =================
def axe(far=False):
    parts = []
    seg = 5 if far else 8
    # drzewce z jesionu: lekko wygięte, grubsze przy obuchu, z owijką rzemienia w chwycie
    path = [(0.0, 0.05, 0.0), (0.0, 0.0, 0.0), (0.0, -0.08, 0.003), (0.0, -0.17, 0.006), (0.0, -0.25, 0.004), (0.0, -0.3, 0.0)]
    parts.append(Mesh(sweep(path, [0.0075, 0.0078, 0.0076, 0.0078, 0.0085, 0.009], seg, flat=0.8),
                      lambda x, y, z: tuple(c * (0.8 + 0.2 * abs(math.sin(y * 210 + x * 40))) for c in hexrgb(0x6a4c30)), 'wood'))
    grip = [(0.0082, -0.03)]
    n = 2 if far else 6
    for k in range(n + 1):
        y = -0.028 + 0.06 * k / n
        grip += [(0.0088, y), (0.0094 if k < n else 0.0088, y + 0.004)]
    grip.append((0.0082, 0.04))
    parts.append(Mesh(turned(grip, seg), hexrgb(0x2e1f14), 'leather'))
    # żelazna głowica z brodą: profil w płaszczyźnie y–z (ostrze w −z, czyli w stronę ciosu), grubość w x
    prof = [(-0.008, -0.255), (-0.03, -0.248), (-0.058, -0.236), (-0.072, -0.244), (-0.078, -0.262), (-0.076, -0.29), (-0.066, -0.316),
            (-0.05, -0.32), (-0.03, -0.302), (-0.012, -0.29), (0.012, -0.288), (0.016, -0.272), (0.012, -0.256)]
    bm = _bm.new()
    th = lambda z: 0.0016 + 0.0062 * max(0.0, min(1.0, (z + 0.07) / 0.07))  # klin: cienki przy ostrzu, gruby przy oku
    top = [bm.verts.new((th(z), -z, y)) for z, y in prof]
    bot = [bm.verts.new((-th(z), -z, y)) for z, y in prof]
    k = len(prof)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((top[i], top[j], bot[j], bot[i]))
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    _bm.ops.recalc_face_normals(bm, faces=bm.faces)
    parts.append(Mesh(bm, lambda x, y, z: tuple(c * (0.7 + 0.45 * min(1.0, max(0.0, (-z - 0.06) / 0.018)) + (noise3(x, y, z) - 0.5) * 0.12) for c in IRON), 'metal'))
    if not far:
        # klin w oku obucha (wystaje nad drzewce) i dwa nity
        parts.append(Mesh(turned([(0.0001, -0.248), (0.006, -0.25), (0.0072, -0.256), (0.0001, -0.258)], 6, depth=0.6), IRON_DK, 'metal'))
    for m in parts:
        _tri(m)
        # topór jednoręczny: krótszy niż miecz strażnika, żeby w spoczynku nie szorował obuchem po ziemi
        m.pos = [(x, y * 0.8, z) for x, y, z in m.pos]
    bake_ao([(m, (0, 0, 0)) for m in parts], reach=0.02)
    out = []
    for mat in ('wood', 'leather', 'metal'):
        ms = [m for m in parts if m.mat == mat]
        if not ms:
            continue
        m0 = ms[0]
        for m in ms[1:]:
            b = len(m0.pos)
            m0.pos += m.pos; m0.nrm += m.nrm; m0.col += m.col
            m0.idx += [tuple(b + i for i in f) for f in m.idx]
        out.append(m0)
    return out


_extra = {'axe': [pack(m) for m in axe(False)], 'axeFar': [pack(m) for m in axe(True)]}
finish('bandit', static, [leg_m, patch_m, *wraps, thong_m, shoe_m],
       [arm_m, roll_m, fore_m, brace_m, bstr_m, hand_m], HIP, SHOULDER, HAND, extra=_extra)
