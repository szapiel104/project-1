"""Wspólne klocki domów z szachulca (chata, stodoła): ściany z otworami, okna z okiennicami, belki na licu,
przeszkody i prostokąty do chodzenia dla spacerowicza. Karczma ma swoje kopie tych samych funkcji (tavern.py).

    from timber import Timber
    t = Timber(b, T=0.08)
    t.wall_x('base', 'plaster', z, x0, x1, y0, y1, [(u0, u1, v0, v1), ...])
"""
import math


class Timber:
    def __init__(self, b, T=0.08):
        self.b, self.T = b, T
        self.windows, self.solid, self.open = [], [], []

    # ---------- przeszkody dla spacerowicza ----------
    def block(self, x0, x1, z0, z1, y0=0.0, y1=9.0):
        self.solid.append([round(min(x0, x1), 3), round(max(x0, x1), 3), round(min(z0, z1), 3), round(max(z0, z1), 3), round(y0, 3), round(y1, 3)])

    def boxs(self, group, mat, w, h, d, x, y, z, rot=0.0, **kw):
        """Pudło, które jest też przeszkodą (stół, skrzynia)"""
        self.b.box(group, mat, w, h, d, x, y, z, rot, **kw)
        c, s = abs(math.cos(rot)), abs(math.sin(rot))
        ww, dd = w * c + d * s, w * s + d * c
        self.block(x - ww / 2, x + ww / 2, z - dd / 2, z + dd / 2, y - 0.05, y + h)

    # ---------- ściany z otworami ----------
    def wall_x(self, group, mat, z, x0, x1, y0, y1, holes, depth=None):
        """Ściana wzdłuż x w płaszczyźnie z, z otworami (u0, u1, v0, v1) w układzie (x, y)"""
        d = depth or self.T
        xs = sorted({x0, x1, *[h[0] for h in holes], *[h[1] for h in holes]})
        for a, c in zip(xs, xs[1:]):
            hs = [h for h in holes if h[0] <= a and h[1] >= c]
            if not hs:
                self.b.box(group, mat, c - a, y1 - y0, d, (a + c) / 2, y0, z)
                continue
            _, _, v0, v1 = hs[0]
            if v0 > y0: self.b.box(group, mat, c - a, v0 - y0, d, (a + c) / 2, y0, z)
            if v1 < y1: self.b.box(group, mat, c - a, y1 - v1, d, (a + c) / 2, v1, z)

    def wall_z(self, group, mat, x, z0, z1, y0, y1, holes, depth=None):
        d = depth or self.T
        zs = sorted({z0, z1, *[h[0] for h in holes], *[h[1] for h in holes]})
        for a, c in zip(zs, zs[1:]):
            hs = [h for h in holes if h[0] <= a and h[1] >= c]
            if not hs:
                self.b.box(group, mat, d, y1 - y0, c - a, x, y0, (a + c) / 2)
                continue
            _, _, v0, v1 = hs[0]
            if v0 > y0: self.b.box(group, mat, d, v0 - y0, c - a, x, y0, (a + c) / 2)
            if v1 < y1: self.b.box(group, mat, d, y1 - v1, c - a, x, v1, (a + c) / 2)

    def window(self, group, x, y0, y1, z, w, nx, nz, shutters=True):
        """Okno w ścianie (środek x/z, normalna nx/nz na zewnątrz): rama, szpros, parapet, okiennice; szybę dokłada gra"""
        b, T, h = self.b, self.T, y1 - y0
        if nz:
            zz = z + nz * T / 2
            b.box(group, 'woodDark', w + 0.05, 0.03, 0.05, x, y0 - 0.03, zz)
            b.box(group, 'woodDark', w + 0.04, 0.03, 0.03, x, y1, zz)
            b.box(group, 'woodDark', 0.02, h, 0.02, x, y0, zz - nz * 0.03)
            b.box(group, 'woodDark', w, 0.02, 0.02, x, y0 + h / 2, zz - nz * 0.03)
            self.windows.append([round(x, 3), round(y0 + h / 2, 3), round(z, 3), 0, nz, round(w, 3), round(h, 3), group])
            if shutters:
                for side in (-1, 1):
                    b.box(group, 'wood', w / 2, h + 0.02, 0.02, x + side * (w / 2 + w / 4 + 0.01), y0 - 0.01, zz + nz * 0.04, side * nz * 0.5)
        else:
            xx = x + nx * T / 2
            b.box(group, 'woodDark', 0.05, 0.03, w + 0.05, xx, y0 - 0.03, z)
            b.box(group, 'woodDark', 0.03, 0.03, w + 0.04, xx, y1, z)
            b.box(group, 'woodDark', 0.02, h, 0.02, xx - nx * 0.03, y0, z)
            b.box(group, 'woodDark', 0.02, 0.02, w, xx - nx * 0.03, y0 + h / 2, z)
            self.windows.append([round(x, 3), round(y0 + h / 2, 3), round(z, 3), nx, 0, round(w, 3), round(h, 3), group])
            if shutters:
                for side in (-1, 1):
                    b.box(group, 'wood', 0.02, h + 0.02, w / 2, xx + nx * 0.04, y0 - 0.01, z + side * (w / 2 + w / 4 + 0.01), -side * nx * 0.5)

    # ---------- szachulec na licu ----------
    def frame_x(self, group, z, x0, x1, y0, y1, posts, braces=True, out=1):
        b, T = self.b, self.T
        zz = z + out * (T / 2 + 0.008)
        for x in posts:
            b.box(group, 'woodDark', 0.06, y1 - y0, 0.025, x, y0, zz)
        b.box(group, 'woodDark', x1 - x0, 0.05, 0.025, (x0 + x1) / 2, y0, zz)
        b.box(group, 'woodDark', x1 - x0, 0.05, 0.025, (x0 + x1) / 2, y1 - 0.05, zz)
        if braces:
            for a, c in zip(posts, posts[1:]):
                if c - a < 0.45:
                    continue
                ln = math.hypot(c - a, y1 - y0 - 0.1)
                ang = math.atan2(y1 - y0 - 0.1, c - a)
                b.box(group, 'woodDark', 0.04, ln, 0.022, a + 0.03, y0 + 0.05, zz, roll=-(math.pi / 2 - ang))

    def frame_z(self, group, x, z0, z1, y0, y1, posts, out=1):
        b, T = self.b, self.T
        xx = x + out * (T / 2 + 0.008)
        for z in posts:
            b.box(group, 'woodDark', 0.025, y1 - y0, 0.06, xx, y0, z)
        b.box(group, 'woodDark', 0.025, 0.05, z1 - z0, xx, y0, (z0 + z1) / 2)
        b.box(group, 'woodDark', 0.025, 0.05, z1 - z0, xx, y1 - 0.05, (z0 + z1) / 2)

    def gable_end(self, group, mat, x, z0, z1, y, rise, out=1):
        """Trójkątny szczyt w płaszczyźnie x (dach wzdłuż x) z belką pionową pośrodku"""
        b, zm = self.b, (z0 + z1) / 2
        b.poly(group, mat, [(x, y, z0), (x, y, z1), (x, y + rise, zm)], away=(x - out, y + rise / 3, zm))
        xx = x + out * 0.012
        b.box(group, 'woodDark', 0.025, rise - 0.05, 0.05, xx, y, zm)
