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
