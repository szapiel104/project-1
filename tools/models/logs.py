"""Okrągłe bale i żerdzie między dwoma dowolnymi punktami (zamknięte walce z przekrojami na końcach)
oraz linowe oploty na złączach. Wspólne dla wieży strażniczej, studni i cechu inżynierów.

    from logs import log, lash
    log(b, 'base', 'bark', (x0, y0, z0), (x1, y1, z1), r=0.05)
"""
import math

from mathutils import Vector


def _frame(p0, p1):
    a, c = Vector(p0), Vector(p1)
    ax = c - a
    L = ax.length
    ax.normalize()
    up = Vector((0, 1, 0)) if abs(ax.y) < 0.9 else Vector((1, 0, 0))
    u = ax.cross(up).normalized()
    v = ax.cross(u).normalized()
    return a, c, ax, u, v, L


def log(b, group, mat, p0, p1, r=0.05, r1=None, seg=7, ends='wood', twist=0.0):
    """Bal od p0 do p1 o promieniu r (r1 = promień przy p1, domyślnie r); końce z jaśniejszego przekroju `ends`"""
    r1 = r if r1 is None else r1
    a, c, ax, u, v, L = _frame(p0, p1)
    ang = [twist + 2 * math.pi * k / seg for k in range(seg)]
    lo = [a + (u * math.cos(t) + v * math.sin(t)) * r for t in ang]
    hi = [c + (u * math.cos(t) + v * math.sin(t)) * r1 for t in ang]
    mid = (a + c) / 2
    for k in range(seg):
        k2 = (k + 1) % seg
        b.poly(group, mat, [lo[k], lo[k2], hi[k2], hi[k]], away=mid)
    b.poly(group, ends or mat, lo, away=a + ax)
    b.poly(group, ends or mat, hi, away=c - ax)


def stake(b, group, mat, x, z, y0, h, r=0.05, tip=0.09, seg=7, lean=(0.0, 0.0)):
    """Pionowy zaostrzony pal: walec od y0 na wysokość h, u góry stożek o wysokości tip (lean przesuwa wierzch)"""
    top = (x + lean[0], y0 + h, z + lean[1])
    log(b, group, mat, (x, y0, z), top, r=r, seg=seg, ends=mat)
    ring = [(top[0] + math.cos(2 * math.pi * k / seg) * r, top[1], top[2] + math.sin(2 * math.pi * k / seg) * r) for k in range(seg)]
    apex = (top[0] + lean[0] * 0.2, top[1] + tip, top[2] + lean[1] * 0.2)
    for k in range(seg):
        b.poly(group, mat, [ring[k], ring[(k + 1) % seg], apex], away=(top[0], top[1] + tip * 0.3, top[2]))


def lash(b, group, p, axis, r=0.06, w=0.035, seg=8, mat='rope'):
    """Linowy oplot na złączu: krótki, nieco grubszy pierścień wokół punktu p wzdłuż osi `axis` (wektor)"""
    ax = Vector(axis).normalized()
    pc = Vector(p)
    log(b, group, mat, pc - ax * (w / 2), pc + ax * (w / 2), r=r, seg=seg, ends=mat)
