# Postacie ze szkieletem (MPFB + nagrania ruchu CMU)

Ciało z generatora MPFB (następca MakeHumana, CC0) z gotowym szkieletem `cmu_mb`, ubiór i zbroja jako powłoki
dopasowane do sylwetki, wersja szczegółowa wypalana w tekstury (kolor z cieniem, mapa normalnych, chropowatość i metal)
na prostą siatkę gry (~3000 trójkątów), ruch z bazy CMU przeniesiony na nasz szkielet. Wynik: `public/chars/<nazwa>.glb`,
w grze `SkinnedFigures` (`src/render/skinned.ts`) — klatki animacji zapieczone w teksturę kości, setki postaci
w jednym wywołaniu rysowania.

Przygotowanie (raz):

    uv venv -p 3.13 ~/bl && uv pip install -p ~/bl/bin/python bpy==5.2.2
    git clone --depth 1 https://github.com/makehumancommunity/mpfb2 ~/mpfb2
    mkdir -p ~/.config/blender/5.2/extensions/user_default && cp -r ~/mpfb2/src/mpfb ~/.config/blender/5.2/extensions/user_default/mpfb
    # zasoby do .assets/ (poza repo): oczy MakeHumana i nagrania CMU (wybrane pliki BVH)
    git clone --depth 1 --filter=blob:none --no-checkout https://github.com/makehumancommunity/makehuman /tmp/mh
    git -C /tmp/mh checkout HEAD -- makehuman/data/eyes && mkdir -p .assets/eyes && cp -r /tmp/mh/makehuman/data/eyes/* .assets/eyes/
    git clone --depth 1 --filter=blob:none --no-checkout https://github.com/una-dinosauria/cmu-mocap /tmp/cmu
    for f in 07/07_01 82/82_08 79/79_01 78/78_22 90/90_16; do d=${f%/*}; git -C /tmp/cmu checkout HEAD -- data/0$d/${f#*/}.bvh 2>/dev/null || git -C /tmp/cmu checkout HEAD -- data/$d/${f#*/}.bvh; done
    mkdir -p .assets/mocap && cp /tmp/cmu/data/*/*.bvh .assets/mocap/

Budowa strażnika (ok. 3,5 min, podgląd i klatki animacji z `--sheets`):

    ~/bl/bin/python -I tools/models/chars/guard.py [--preview] [--sheets] [--out katalog]

Animacje strażnika: `idle` (82_08), `walk` (07_01), `attack` (79_01, zamach zza głowy), `death` (78_22 + leżenie z 90_16).
