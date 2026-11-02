"""Generator tekstur kamienia i łupka do zamku (Michał 2.11.2026: „nie czuć kamienia, tekstura 2D, jasna, płaska”).

Wzór: mury z Twierdzy 3 / Krzyżowca 2 — nieregularne ciosy różnej wielkości w warstwach, wypukłe lica z zaokrąglonymi
krawędziami, głębokie, ciemne fugi, każdy kamień trochę innej jasności, drobna faktura skały na licu.
Dachy: łupek w zachodzących na siebie rzędach, każda płytka z nieregularnym dolnym brzegiem i cieniem pod spodem.

Wynik jak reszta zdjęciowych tekstur gry: kolor w odcieniach szarości (barwę nadaje materiał, kolor wierzchołków)
plus mapa normalnych OpenGL (Y w górę). Tekstury są bezszwowe (wszystko liczone z zawijaniem).

Uruchomienie z katalogu repo:
  python3 tools/textures/gen_stone.py            # oba
  python3 tools/textures/gen_stone.py ashlar     # tylko kamień
Potem KTX2: node tools/textures/ktx2.mjs public/textures/cc0/ashlar.jpg public/textures/cc0/ashlar_n.jpg ...
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

N = 2048
OUT = 'public/textures/cc0/'
rng = np.random.default_rng(1102)


def periodic_noise(n, scale, seed):
    """Bezszwowy szum: biały szum przefiltrowany w dziedzinie Fouriera (z natury okresowy), znormalizowany do 0..1"""
    r = np.random.default_rng(seed)
    w = r.standard_normal((n, n))
    f = np.fft.fft2(w)
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    k = np.sqrt(kx * kx + ky * ky)
    filt = np.exp(-(k * scale) ** 2)
    out = np.real(np.fft.ifft2(f * filt))
    out -= out.min()
    out /= out.max()
    return out


def fbm(n, base, seed, octaves=5):
    acc = np.zeros((n, n))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        acc += amp * periodic_noise(n, base / (2 ** o), seed + o)
        tot += amp
        amp *= 0.5
    return acc / tot


def normal_map(height, strength):
    """Mapa normalnych OpenGL z wysokości (zawijanie na brzegach)"""
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(height)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / ln, ny / ln, nz / ln], -1) * 0.5 + 0.5
    return (np.clip(rgb, 0, 1) * 255).astype(np.uint8)


def wrap_dist(mask):
    """Odległość od brzegu kamienia z zawijaniem (pole 3×3, środek)"""
    big = np.tile(mask, (3, 3))
    d = ndimage.distance_transform_edt(big)
    return d[N:2 * N, N:2 * N]


def photo(name):
    """Szare zdjęcie skały z gry (1024, bezszwowe) jako drobna faktura lica: 0..1, średnio ok. 1"""
    im = np.asarray(Image.open(OUT + name + '.jpg').convert('L')).astype(np.float64) / 255
    return im / im.mean()


def ashlar():
    # warstwy (wysokości sumują się do N), w każdej kamienie różnej długości (sumują się do N)
    labels = np.zeros((N, N), np.int32)
    y = 0
    rows = []
    while y < N:
        h = int(rng.integers(150, 250))
        if N - y < 260:
            h = N - y
        rows.append((y, h))
        y += h
    sid = 1
    for (y0, h) in rows:
        x = int(rng.integers(0, 200))  # przesunięcie spoin względem poprzedniej warstwy
        widths = []
        tot = 0
        while tot < N:
            w = int(rng.integers(int(h * 1.1), int(h * 2.6)))
            if N - tot < h * 1.2:
                w = N - tot
            widths.append(w)
            tot += w
        for w in widths:
            xs = (np.arange(x, x + w) % N)
            labels[y0:y0 + h][:, xs] = sid
            sid += 1
            x += w
    # nieregularne krawędzie: przesunięcie etykiet szumem (jak ciosy z nierówno obrobionymi bokami)
    jx = (fbm(N, 40, 11, 4) - 0.5) * 46
    jy = (fbm(N, 40, 23, 4) - 0.5) * 46
    yy, xx = np.mgrid[0:N, 0:N]
    lab = labels[((yy + jy).astype(int)) % N, ((xx + jx).astype(int)) % N]
    # fuga: piksele na granicy kamieni; odległość od fugi daje wypukłe lico z zaokrągloną krawędzią
    edge = np.zeros((N, N), bool)
    for sh in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        edge |= lab != np.roll(lab, sh, (0, 1))
    mortar_w = 4
    inside = ~ndimage.binary_dilation(np.tile(edge, (3, 3)), iterations=mortar_w)[N:2 * N, N:2 * N]
    d = wrap_dist(inside)
    bevel = 1 - np.exp(-d / 11.0)                    # zaokrąglenie krawędzi lica (ok. 30 px)
    # na każdym kamieniu: lekko wypukłe, nierówne lico (szum per kamień) + odpryski na krawędziach
    rough = fbm(N, 90, 31, 5)
    fine = fbm(N, 6, 47, 3)
    chips = np.clip((fbm(N, 25, 59, 4) - 0.62) * 4, 0, 1) * (1 - np.clip(d / 40, 0, 1))
    height = bevel * (0.7 + 0.3 * rough) + fine * 0.08 - chips * 0.35
    height[~inside] = 0.0
    mortar_tex = fbm(N, 8, 71, 3)
    height = np.where(inside, height, 0.04 * mortar_tex)
    # jasność każdego kamienia losowa (0,62..1), wewnątrz faktura skały i plamy
    nlab = lab.max() + 1
    tone = rng.uniform(0.62, 1.0, nlab)
    warm = rng.uniform(-0.05, 0.05, nlab)
    base = tone[lab]
    stain = fbm(N, 160, 83, 4)
    # faktura z prawdziwego zdjęcia skały, przesunięta inaczej na każdym kamieniu (bez powtarzającego się wzoru)
    rock = photo('rock')
    R = rock.shape[0]
    offx = rng.integers(0, R, nlab)
    offy = rng.integers(0, R, nlab)
    det = rock[(yy + offy[lab]) % R, (xx + offx[lab]) % R]
    det = 1 + (det - 1) * 1.6
    col = base * det * (0.8 + 0.2 * rough) * (0.82 + 0.18 * stain)
    height = height + (det - 1) * 0.12 * (height > 0)
    # krawędzie lica trochę jaśniejsze (wytarte), zagłębienia i fugi ciemne (AO z rozmytej wysokości)
    ao = ndimage.gaussian_filter(height, 9, mode='wrap')
    col *= 0.55 + 0.45 * np.clip(height * 1.4 + 0.1, 0, 1)
    col *= 0.75 + 0.25 * np.clip(ao * 2, 0, 1)
    col = np.where(inside, col, 0.1 + 0.1 * mortar_tex)
    col = np.clip(col, 0, 1)
    gray = (col * 255).astype(np.uint8)
    Image.fromarray(gray).convert('RGB').save(OUT + 'ashlar.jpg', quality=90)
    Image.fromarray(normal_map(height, 7.0)).save(OUT + 'ashlar_n.jpg', quality=92)
    hh = ndimage.gaussian_filter(height, 1.0, mode='wrap')
    hh = (hh - hh.min()) / (hh.max() - hh.min())
    Image.fromarray((hh * 255).astype(np.uint8)).save(OUT + 'ashlar_h.jpg', quality=92)  # głębia (parallax.ts)
    print('ashlar', N, 'stones', nlab, 'mean', round(float(col.mean()), 3))


def slate():
    """Łupek: rzędy płytek, każdy rząd zachodzi na poprzedni; dolny brzeg płytki nierówny, pod nim cień"""
    row_h = 128                           # 16 rzędów na teksturę
    rows = N // row_h
    height = np.zeros((N, N))
    col = np.zeros((N, N))
    yy, xx = np.mgrid[0:N, 0:N]
    wob = (fbm(N, 30, 101, 4) - 0.5)
    tile_noise = fbm(N, 7, 113, 3)
    big = fbm(N, 200, 127, 3)
    rock = photo('rock')
    R = rock.shape[0]
    for r in list(range(rows - 1, -1, -1)) + [rows - 1]:
        y0 = r * row_h
        again = r == rows - 1 and height[(y0 + row_h + 5) % N].any() and col[y0 + 5].any()
        x = int(rng.integers(0, 120))
        widths = []
        tot = 0
        while tot < N:
            w = int(rng.integers(70, 130))
            if N - tot < 100:
                w = N - tot
            widths.append(w)
            tot += w
        for w in widths:
            xs = (np.arange(x, x + w) % N)
            t = rng.uniform(0.55, 1.0)
            # płytka zajmuje rząd i zwisa nad następnym; jej dolny brzeg (y od 0 w górze rzędu do row_h) z szumem
            ys = np.arange(y0, y0 + row_h + 24) % N
            sub_y = (np.arange(row_h + 24))[:, None]
            bottom = row_h + 10 + wob[ys][:, xs] * 22
            # zaokrąglone dolne rogi
            u = (np.arange(w) - (w - 1) / 2) / (w / 2)
            corner = (np.abs(u) ** 6) * 26
            mask = sub_y < (bottom - corner[None, :])
            # wysokość: płytka narasta od góry (pod poprzednią) ku dolnemu brzegowi
            hgt = 0.35 + 0.65 * (sub_y / (row_h + 24))
            gap = np.zeros(w, bool)
            gap[:3] = True                         # szczelina między płytkami w rzędzie
            m2 = mask & ~gap[None, :]
            if again:
                m2 = m2 & (sub_y >= row_h)
            block_h = height[np.ix_(ys, xs)]
            block_c = col[np.ix_(ys, xs)]
            block_h = np.where(m2, hgt + tile_noise[np.ix_(ys, xs)] * 0.06 + r * 0.0, block_h)
            det = rock[np.ix_((ys * 3 + int(rng.integers(0, R))) % R, (xs * 3 + int(rng.integers(0, R))) % R)]
            shade = 0.55 + 0.45 * (sub_y / (row_h + 24))      # góra płytki w cieniu poprzedniego rzędu
            block_c = np.where(m2, t * (1 + (det - 1) * 0.7) * shade * (0.85 + 0.15 * big[np.ix_(ys, xs)]), block_c)
            height[np.ix_(ys, xs)] = block_h
            col[np.ix_(ys, xs)] = block_c
            x += w
    # cień pod dolnym brzegiem każdej płytki (spadek wysokości z rzędu na rząd) + ciemne szczeliny
    ao = ndimage.gaussian_filter(height, 6, mode='wrap')
    col = col * (0.6 + 0.4 * np.clip(height, 0, 1)) * (0.8 + 0.2 * np.clip(ao * 1.5, 0, 1))
    col = np.where(col <= 0.01, 0.12, col)
    col = np.clip(col, 0, 1)
    Image.fromarray((col * 255).astype(np.uint8)).convert('RGB').save(OUT + 'slate.jpg', quality=90)
    Image.fromarray(normal_map(ndimage.gaussian_filter(height, 1.2, mode='wrap'), 6.0)).save(OUT + 'slate_n.jpg', quality=92)
    hh = ndimage.gaussian_filter(height, 1.0, mode='wrap')
    hh = (hh - hh.min()) / (hh.max() - hh.min())
    Image.fromarray((hh * 255).astype(np.uint8)).save(OUT + 'slate_h.jpg', quality=92)
    print('slate', N, 'mean', round(float(col.mean()), 3))


def aniso_noise(n, sx, sy, seed):
    """Bezszwowy szum wydłużony: sx, sy — skale w poprzek i wzdłuż (źdźbła: wąskie w x, długie w y)"""
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.standard_normal((n, n)))
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    out = np.real(np.fft.ifft2(f * np.exp(-(kx * sx) ** 2 - (ky * sy) ** 2)))
    out -= out.min()
    return out / out.max()


def thatch():
    """Strzecha (Michał 2.11.2026: „strzecha nie wygląda dobrze”): nie jednolita słoma, tylko warstwy pęczków jak na
    prawdziwym dachu — każdy rząd zwisa nad następnym, dolny brzeg strzępiasty i w cieniu, w rzędzie widać osobne
    wiązki (jaśniejsze i ciemniejsze), źdźbła wzdłuż spadku dachu (pion tekstury) i lekko pochylone."""
    row_h = 256                                   # 8 warstw na teksturę
    rows = N // row_h
    yy, xx = np.mgrid[0:N, 0:N]
    straw = aniso_noise(N, 1.6, 60, 301) ** 1.6          # pojedyncze źdźbła
    straw2 = aniso_noise(N, 3.0, 90, 302)
    clump = aniso_noise(N, 40, 300, 303)          # wiązki
    rag = aniso_noise(N, 5.0, 8, 304)             # strzępiasty brzeg
    big = fbm(N, 260, 305, 3)                     # plamy wyblaknięcia i mchu
    height = np.zeros((N, N))
    col = np.zeros((N, N))
    for k, r in enumerate(list(range(rows - 1, -1, -1)) + [rows - 1]):   # od dołu: wyższa warstwa przykrywa niższą
        y0 = r * row_h
        sub = (yy - y0) % N                       # 0 u góry warstwy
        # dolny brzeg warstwy: nierówny i postrzępiony, zwisa ok. 40 px nad następną
        edge = row_h + 40 + (rag - 0.5) * 70 + (clump - 0.5) * 50
        inside = (sub < edge) & (sub >= 0)
        t = sub / edge
        h = 0.25 + 0.75 * t                       # warstwa narasta ku dolnemu brzegowi
        layer = inside & (sub >= row_h) if k == rows else inside   # na koniec zwis ostatniej warstwy na pierwszą
        height = np.where(layer, h + (straw - 0.5) * 0.12, height)
        c = (0.3 + 0.7 * straw) * (0.65 + 0.5 * clump) * (0.75 + 0.25 * straw2)
        c = c * (0.3 + 0.7 * np.clip(t * 1.5, 0, 1) ** 0.8)         # góra warstwy w cieniu poprzedniej
        col = np.where(layer, c, col)
    # cień pod zwisającym brzegiem (spadek wysokości), plamy wieku
    ao = ndimage.gaussian_filter(height, (10, 3), mode='wrap')
    col = col * (0.7 + 0.3 * np.clip(1 - (ao - height) * 4, 0, 1))
    col = col * (0.8 + 0.3 * big)
    col = col / col.mean() * 0.7
    col = np.clip(col, 0, 1)
    Image.fromarray((col * 255).astype(np.uint8)).save(OUT + 'thatch.jpg', quality=90)
    Image.fromarray(normal_map(ndimage.gaussian_filter(height, 1.0, mode='wrap'), 5.0)).save(OUT + 'thatch_n.jpg', quality=92)
    hh = ndimage.gaussian_filter(height, 1.0, mode='wrap')
    hh = (hh - hh.min()) / (hh.max() - hh.min())
    Image.fromarray((hh * 255).astype(np.uint8)).save(OUT + 'thatch_h.jpg', quality=92)
    print('thatch', N, 'mean', round(float(col.mean()), 3))


if __name__ == '__main__':
    which = sys.argv[1:] or ['ashlar', 'slate']
    if 'ashlar' in which:
        ashlar()
    if 'slate' in which:
        slate()
    if 'thatch' in which:
        thatch()
