#!/usr/bin/env python3
"""
Import nagrań z gry 0 A.D. (Wildfire Games, CC BY-SA 3.0) do public/sounds/0ad/ (27.10.2026).

Źródło: folder z plikami wyciągniętymi z repozytorium https://github.com/0ad/0ad
(binaries/data/mods/public/audio/...), nazwy spłaszczone: ścieżka z „/” zamienionymi na „__”.
Przykład pobrania (bez ściągania całego repo):
  git clone --depth 1 --filter=blob:none --sparse https://github.com/0ad/0ad
  git -C 0ad show HEAD:binaries/data/mods/public/audio/<ścieżka> > raw/<ścieżka z __>

Obróbka każdego pojedynczego dźwięku (strzał, cios, krok…):
  - mono 44,1 kHz, filtr dolnoprzepustowy usuwający dudnienie poniżej 40 Hz,
  - wycięta cisza na początku (dźwięk startuje od razu, więc trafienie zgrywa się z obrazem)
    i długi, cichy ogon na końcu (krótkie wybrzmienie, bez ucięcia — 25 ms wyciszenia),
  - wyrównana głośność: najgłośniejsze 50 ms każdego nagrania na tym samym poziomie (-16 dBFS),
    szczyt nie wyżej niż -1 dBFS. Właściwą głośność danego rodzaju ustala dopiero silnik (src/audio/bank.ts).
Tła w pętli (deszcz, ogień, gwar targu) zostają stereo, bez przycinania, z miękkim wejściem i wyjściem.

Wynik: public/sounds/0ad/<nazwa>.ogg i src/audio/bank.gen.ts (lista wariantów każdej grupy).
Uruchomienie: python3 tools/audio/import_0ad.py <folder_raw>
"""
import os, re, subprocess, sys, json
import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'sounds', '0ad')

def load(p, ch=1):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', str(ch), '-ar', str(SR), '-af', 'highpass=f=40', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    return x.reshape(-1, ch) if ch > 1 else x

def save(x, path, q=4):
    ch = 1 if x.ndim == 1 else x.shape[1]
    subprocess.run(['ffmpeg', '-v', 'quiet', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', '-c:a', 'libvorbis', '-q:a', str(q), path], input=x.astype(np.float32).tobytes(), check=True)

def env_db(x, w=441):
    m = x if x.ndim == 1 else x.mean(1)
    n = max(1, len(m) // w)
    e = np.sqrt((m[:n * w].reshape(n, w) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(e)

def one_shot(x, tail_db=-48, max_len=None):
    """Przycięcie ciszy z przodu i cichego ogona, wyrównanie głośności."""
    db = env_db(x)  # okna po 10 ms
    top = db.max()
    on = np.where(db > top - 36)[0]
    if not len(on): return None
    start = max(0, on[0] * 441 - 220)  # 5 ms zapasu przed uderzeniem
    loud = np.where(db > top + tail_db + 12)[0]  # koniec: ostatnie okno głośniejsze niż szczyt-36 dB
    end = min(len(x), (loud[-1] + 6) * 441)
    if max_len: end = min(end, start + int(max_len * SR))
    y = x[start:end].copy()
    f = min(len(y) // 4, int(0.025 * SR))
    if f > 0: y[-f:] *= np.linspace(1, 0, f) ** 2
    y[:32] *= np.linspace(0, 1, 32)
    # głośność: najgłośniejsze 50 ms na -16 dBFS, szczyt najwyżej -1 dBFS
    w = int(0.05 * SR)
    if len(y) > w:
        c = np.cumsum(np.concatenate([[0], y.astype(np.float64) ** 2]))
        rms = np.sqrt((c[w:] - c[:-w]).max() / w)
    else:
        rms = np.sqrt((y ** 2).mean())
    g = 10 ** (-16 / 20) / max(rms, 1e-6)
    g = min(g, 10 ** (-1 / 20) / max(np.abs(y).max(), 1e-6))
    return y * g

def bed(x, level_db=-20):
    """Tło w pętli: stereo, wyrównane do średniej głośności, z miękkim wejściem i wyjściem (silnik je przenika)."""
    x = x[:int(45 * SR)]  # 45 s wystarczy na pętlę (silnik przenika kolejne warianty), mniej do pobrania
    rms = np.sqrt((x ** 2).mean())
    y = x * (10 ** (level_db / 20) / max(rms, 1e-6))
    pk = np.abs(y).max()
    if pk > 0.89: y *= 0.89 / pk
    f = int(1.0 * SR)
    ramp = np.linspace(0, 1, f) ** 0.5
    y[:f] *= ramp[:, None]; y[-f:] *= ramp[::-1, None]
    return y

# grupa → (wzorzec nazwy pliku źródłowego, rodzaj obróbki, najdłuższy czas w s)
GROUPS = {
    # budowa: młotek w drewno, piła, dłuto w kamień
    'hammer': (r'construction__con_wood_\d+', 'shot', 0.6),
    'saw': (r'construction__con_saw_\d+', 'shot', 1.2),
    'chisel': (r'construction__con_stone_\d+', 'shot', 0.6),
    # drwal: siekiera w pień, padające drzewo
    'axe': (r'lumbering__lumber_tree_(0\d|1\d|2[0-2])\.', 'shot', 1.0),
    'treefall': (r'lumbering__lumber_treeexpire_\d+', 'shot', 3.4),
    # kopalnia i kuźnia: kilof w skałę, uderzenia w rudę/metal
    'pick': (r'mining__mine_stone_\d+', 'shot', 0.9),
    'metal': (r'mining__mine_metal_\d+', 'shot', 0.9),
    # łucznik: naciąg i puszczenie cięciwy, świst strzały, trafienia w różne podłoża
    'bow': (r'weapon__bow_attack_\d+', 'shot', 0.9),
    'arrowfly': (r'weapon__arrowfly_\d+', 'shot', 0.8),
    'arrowDirt': (r'impact__arrow_dirt_\d+', 'shot', 0.6),
    'arrowWood': (r'impact__arrow_wood_\d+', 'shot', 0.6),
    'arrowStone': (r'impact__arrow_stone_\d+', 'shot', 0.6),
    'arrowMetal': (r'impact__arrow_metal_\d+', 'shot', 0.6),
    'flesh': (r'impact__flesh(imp|stab)_\d+', 'shot', 0.7),
    # walka wręcz: zamach mieczem/włócznią, szczęk ostrzy, uderzenia w tarczę
    'swordSwing': (r'weapon__sword_attack_\d+', 'shot', 0.9),
    'spear': (r'weapon__spear_attack_\d+', 'shot', 0.9),
    'swordHit': (r'weapon__swordhit_\d+[ab]?\.', 'shot', 0.8),
    'shieldWood': (r'impact__shield_wood_\d+', 'shot', 0.6),
    'shieldMetal': (r'impact__shield_metal_\d+', 'shot', 0.6),
    # śmierć: krzyk mężczyzny i kobiety
    'deathMale': (r'death__male_death_\d+', 'shot', 1.8),
    'deathFemale': (r'death__female_death_\d+', 'shot', 1.8),
    # głosy ludzi: gadanie (powitanie, „co tam?”, praca) i okrzyki (do ataku, odwrót)
    'talkMale': (r'civ_male_(hello|what_is_it|my_lord|walk|gather_together|yes|Asyouwish|Imcoming|work_land|build|repair|herd|fish|hunt|heal|garrison)', 'shot', 1.4),
    'talkFemale': (r'civ_female_(hello|what_is_it|my_lord|walk|gather_together|work_land|build|repair|herd|fish|hunt|heal|garrison)', 'shot', 1.4),
    'shoutMale': (r'civ_male_(attack|fight|go_out_against|march|retreat)', 'shot', 1.6),
    # zwierzęta
    'dog': (r'civ_dog_bark', 'shot', 1.0),
    'pig': (r'animal__pig_(10|12|squeal_move)', 'shot', 1.3),
    'cow': (r'animal__cattle_\d+', 'shot', 2.4),
    'sheep': (r'animal__sheep_\d+', 'shot', 1.2),
    'horse': (r'animal__horse_idle\d', 'shot', 1.8),
    # zdarzenia
    'collapse': (r'destruction__building_collapse_large_\d+', 'shot', 6.5),
    'gateOpen': (r'gate__stonegate_open_\d+', 'shot', 5.8),
    'gateClose': (r'gate__stonegate_close_\d+', 'shot', 5.8),
    # tła w pętli (stereo)
    'rain': (r'weather__rain_\d+', 'bed', None),
    'fire': (r'fire__c_\d+', 'bed', None),
    'crowd': (r'building__amb_trade_1\d', 'bed', None),
}

def main():
    raw = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    files = sorted(os.listdir(raw))
    bank = {}
    for key, (pat, kind, mx) in GROUPS.items():
        src = [f for f in files if re.search(pat, f) and f.endswith('.ogg')]
        names = []
        for i, f in enumerate(src):
            name = f'{key}-{i:02d}'
            path = os.path.join(raw, f)
            if kind == 'bed':
                y = bed(load(path, 2))
                save(y, os.path.join(OUT, name + '.ogg'), 3)
            else:
                y = one_shot(load(path), max_len=mx)
                if y is None or len(y) < SR * 0.04: continue
                save(y, os.path.join(OUT, name + '.ogg'), 4)
            names.append(name)
        bank[key] = names
        print(f'{key:12s} {len(names):3d} plików')
    ts = ['/** Wygenerowane przez tools/audio/import_0ad.py — nie edytować ręcznie. Nagrania 0 A.D. (Wildfire Games, CC BY-SA 3.0) w public/sounds/0ad/. */',
          'export const BANK_0AD = ' + json.dumps(bank, indent=2).replace('"', "'") + ' as const;',
          'export type Group0ad = keyof typeof BANK_0AD;', '']
    with open(os.path.join(ROOT, 'src', 'audio', 'bank.gen.ts'), 'w') as fh: fh.write('\n'.join(ts))

if __name__ == '__main__':
    main()
