# Zasoby zewnętrzne (dźwięki i modele)

Nagrania w `public/sounds/` pochodzą z darmowych zestawów startowych Kenneya (kenney.nl), wydanych na licencji MIT:

- placement-a…d, removal-a…d, rotate, toggle, ambience — [Starter Kit City Builder](https://github.com/KenneyNL/starter-kit-city-builder) (MIT, © Kenney)
- break, walking — [Starter Kit 3D Platformer](https://github.com/KenneyNL/starter-kit-3d-platformer) (MIT, © Kenney)

Licencja MIT pozwala używać ich także komercyjnie; wymaga zachowania informacji o prawach autorskich (ten plik).
Gdy nagranie się nie wczyta, gra odtwarza zastępczy dźwięk syntezowany (src/audio/sfx.ts).

## Modele

- Budynki: KayKit Medieval Hexagon Pack 1.0 (Kay Lousberg, CC0) — public/models/kaykit, licencja w public/models/kaykit/LICENSE.txt. Na razie chata, chata drwala, kopalnia i młyn; reszta z kodu.

## Dźwięki świata (CC0, bez wymogu podpisu)

Pobrane z indeksu [open-game-sfx-index](https://github.com/Mcamento8/open-game-sfx-index), który przechowuje paczki CC0:
- chop, creak-1…3, coins — Kenney „RPG Audio” (CC0)
- mine-0…2, smith-0…2, plank-0…2, hit-0…2 — Kenney „Impact Sounds” (CC0)
- swing-0…2, clang-0…1, wolf (warknięcie z pogłosem) — „RPG Sound Pack”, artisticdude, OpenGameArt (CC0)
Wiatr, deszcz, wrony i wycie wilków są syntezowane w src/audio/sfx.ts.

## Głosy ludzi (CC0, bez wymogu podpisu)

Z repozytorium gry [C-Dogs SDL](https://github.com/cxong/cdogs-sdl) (`sounds/chars`), które zebrało je z Freesound — w grze tylko nagrania na CC0:
- scream-0…4 — „human male scream multi”, [JohnsonBrandEditing](https://freesound.org/people/JohnsonBrandEditing/sounds/173944/) (CC0): krzyk uciekającego chłopa i poległego
- alert-0 — „Huh? - Vocal”, [davdud101](https://freesound.org/people/davdud101/sounds/150505/) (CC0); alert-1 — „Huh_male.wav”, [Adam_N](https://freesound.org/people/Adam_N/sounds/166129/) (CC0): odważny chłop na widok wroga
- Zmiany: mono 32 kHz, wyrównana głośność, krótsze wybrzmienie.

## Muzyka (CC0, bez wymogu podpisu) — `public/music/`
Pobrane przez Michała z OpenGameArt, przekonwertowane do OGG i wyrównane głośnościowo:
- kings-feast.ogg — „Medieval: King's Feast”, RandomMind — https://opengameart.org/content/medieval-kings-feast (menu, dzień)
- minstrel-dance.ogg — „Medieval: Minstrel Dance”, RandomMind — https://opengameart.org/node/92393 (dzień)
- old-tower-inn.ogg — „Medieval: The Old Tower Inn”, RandomMind — https://opengameart.org/content/medieval-the-old-tower-inn (noc, menu)
- battle.ogg — „Medieval Battle”, RandomMind — https://opengameart.org/content/medieval-battle (bitwa)
- peasantry.ogg — „Peasant Theme”, nihilocrat — https://opengameart.org/content/peasant-theme (dzień)
Gdy pliku brak albo nastrój nie ma utworu, gra składa muzykę sama (src/audio/sfx.ts).
