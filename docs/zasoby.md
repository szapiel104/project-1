# Zasoby zewnętrzne (dźwięki i modele)

Nagrania w `public/sounds/` pochodzą z darmowych zestawów startowych Kenneya (kenney.nl), wydanych na licencji MIT:

- placement-a…d, removal-a…d, rotate, toggle, ambience — [Starter Kit City Builder](https://github.com/KenneyNL/starter-kit-city-builder) (MIT, © Kenney)
- break, walking — [Starter Kit 3D Platformer](https://github.com/KenneyNL/starter-kit-3d-platformer) (MIT, © Kenney)

Licencja MIT pozwala używać ich także komercyjnie; wymaga zachowania informacji o prawach autorskich (ten plik).
Gdy nagranie się nie wczyta, gra odtwarza zastępczy dźwięk syntezowany (src/audio/sfx.ts).

## Modele

- Kruk: „Raven” z OpenGameArt (https://opengameart.org/content/raven-0, CC0) — plik źródłowy tools/models/src/raven.blend, przeróbka do gry tools/models/crow_import.py (poza stojąca, 8 klatek lotu, tekstura przyciemniona do kruczej czerni → public/textures/crow.png).

- Budynki: KayKit Medieval Hexagon Pack 1.0 (Kay Lousberg, CC0) — wyłączone 12.10.2026 (styl zbyt bajkowy), pliki usunięte z gry; wszystkie budynki są nasze, z Blendera.

## Dźwięki świata (CC0, bez wymogu podpisu)

Pobrane z indeksu [open-game-sfx-index](https://github.com/Mcamento8/open-game-sfx-index), który przechowuje paczki CC0:
- chop, creak-1…3, coins — Kenney „RPG Audio” (CC0)
- mine-0…2, smith-0…2, plank-0…2, hit-0…2 — Kenney „Impact Sounds” (CC0)
- swing-0…2, clang-0…1, wolf (warknięcie z pogłosem) — „RPG Sound Pack”, artisticdude, OpenGameArt (CC0)
Wiatr, deszcz, wrony i wycie wilków są syntezowane w src/audio/sfx.ts.

## Odgłosy natury i wsi (16.10.2026)

Z gry [0 A.D.](https://play0ad.com) — © Wildfire Games (https://www.wildfiregames.com/), licencja
[CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/) (plik licencji: `public/sounds/LICENSE-0ad.txt`).
Przerobione na mono 32 kHz, z wyrównaną głośnością; przerobione pliki udostępniamy na tej samej licencji CC BY-SA 3.0.
- day-0…3 — śpiew ptaków za dnia (`audio/ambient/dayscape/day_temperate_11…14`)
- farm-0…1 — odgłosy gospodarstwa (`audio/ambient/building/amb_farm_10…11`)
- hen-0…3 — gdakanie kur (`audio/actor/fauna/animal/chicken_10…13`)
- horn — róg alarmu przed atakiem (`audio/interface/alarm/alarmattackcity_1`)
- thunder-0…1 — grzmot w burzy (`audio/ambient/weather/thunder_10…11`)

Z Freesound przez paczkę dźwięków [CDDA-Soundpacks](https://github.com/Fris0uman/CDDA-Soundpacks) (CC-Sounds), tylko nagrania CC0:
- night-0 — „clear night”, [rsn267](https://freesound.org/people/rsn267/sounds/275595/) (CC0): świerszcze nocą
- night-1 — „cloudy night”, [beambot](https://freesound.org/people/beambot/sounds/259987/) (CC0)
- bell — „church bells”, [Nox_Sound](https://freesound.org/people/Nox_Sound/sounds/563885/) (CC0): dzwon w południe
Puszczyk i dźwięki zastępcze (gdy nagranie się nie wczyta) dalej są syntezowane.

## Odgłosy świata z 0 A.D. (27.10.2026) — `public/sounds/0ad/`

Gra **0 A.D.** © Wildfire Games (https://www.wildfiregames.com/, repozytorium https://github.com/0ad/0ad,
`binaries/data/mods/public/audio/`), licencja [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/)
(plik licencji obok nagrań: `public/sounds/0ad/LICENSE.txt`). Przerobione skryptem `tools/audio/import_0ad.py`:
mono 44,1 kHz, wycięta cisza na początku i cichy ogon, wyrównana głośność; tła (deszcz, ogień, gwar) stereo, 45 s.
Przerobione pliki udostępniamy na tej samej licencji CC BY-SA 3.0. Lista wariantów: `src/audio/bank.gen.ts`.
- hammer, saw, chisel — budowa (`resource/construction/con_wood`, `con_saw`, `con_stone`)
- axe, treefall — drwal (`resource/lumbering/lumber_tree`, `lumber_treeexpire`)
- pick, metal — kilof w skałę i rudę, kuźnia (`resource/mining/mine_stone`, `mine_metal`)
- bow, arrowfly — cięciwa i świst strzały (`attack/weapon/bow_attack`, `arrowfly`)
- arrowDirt, arrowWood, arrowStone, arrowMetal, flesh — trafienia (`attack/impact/arrow_*`, `fleshimp`, `fleshstab`)
- swordSwing, spear, swordHit, shieldWood, shieldMetal — walka wręcz (`attack/weapon/sword_attack`, `spear_attack`, `swordhit`, `attack/impact/shield_*`)
- deathMale, deathFemale — krzyk umierającego (`actor/human/death`)
- talkMale, talkFemale, shoutMale — głosy i okrzyki ludzi (`voice/latin`, `greek`, `persian`, `napatan/civ`)
- dog, pig, cow, sheep, horse — zwierzęta (`voice/global/civ_dog_bark`, `actor/fauna/animal`)
- collapse, gateOpen, gateClose — zawalenie budynku i brama (`attack/destruction`, `actor/gate`)
- rain, fire, crowd — tła: deszcz, trzask ognia, gwar osady (`ambient/weather/rain`, `attack/fire/c_*`, `ambient/building/amb_trade`)

Jak brzmią w miksie (głośność, zasięg, rozrzut wysokości, limity naraz): `src/audio/bank.ts`; silnik przestrzenny: `src/audio/engine.ts`.

## Głosy ludzi (CC0, bez wymogu podpisu)

Z repozytorium gry [C-Dogs SDL](https://github.com/cxong/cdogs-sdl) (`sounds/chars`), które zebrało je z Freesound — w grze tylko nagrania na CC0:
- scream-0…4 — „human male scream multi”, [JohnsonBrandEditing](https://freesound.org/people/JohnsonBrandEditing/sounds/173944/) (CC0): krzyk uciekającego chłopa i poległego
- alert-0 — „Huh? - Vocal”, [davdud101](https://freesound.org/people/davdud101/sounds/150505/) (CC0); alert-1 — „Huh_male.wav”, [Adam_N](https://freesound.org/people/Adam_N/sounds/166129/) (CC0): odważny chłop na widok wroga
- Zmiany: mono 32 kHz, wyrównana głośność, krótsze wybrzmienie.
- torch — „JM_FX_Fireball 01”, [Julien Matthey](http://freesound.org/people/Julien%20Matthey/sounds/105016/) (CC0), z C-Dogs SDL (`sounds/fireball.wav`): buchnięcie płomienia przy zapalaniu pochodni w ręce; mono 32 kHz, przycięte wysokie tony, wyciszenie na końcu

## Muzyka (CC0, bez wymogu podpisu) — `public/music/`
Pobrane przez Michała z OpenGameArt, przekonwertowane do OGG i wyrównane głośnościowo:
- kings-feast.ogg — „Medieval: King's Feast”, RandomMind — https://opengameart.org/content/medieval-kings-feast (menu, dzień)
- minstrel-dance.ogg — „Medieval: Minstrel Dance”, RandomMind — https://opengameart.org/node/92393 (dzień)
- old-tower-inn.ogg — „Medieval: The Old Tower Inn”, RandomMind — https://opengameart.org/content/medieval-the-old-tower-inn (noc, menu)
- battle.ogg — „Medieval Battle”, RandomMind — https://opengameart.org/content/medieval-battle (bitwa)
- medievals5.ogg — „Medievals 5”, Tozan — https://opengameart.org/content/medievals-5 (noc)
- peasantry.ogg — „Peasant Theme”, nihilocrat — https://opengameart.org/content/peasant-theme (dzień)
Gdy pliku brak albo nastrój nie ma utworu, gra składa muzykę sama (src/audio/sfx.ts).

## Kroki (CC0, bez wymogu podpisu)

Z indeksu [open-game-sfx-index](https://github.com/Mcamento8/open-game-sfx-index):
- step-stone-0…4, step-dirt-0…4, step-wood-0…4 — Kenney „Impact Sounds” (footstep_concrete, footstep_grass, footstep_wood) (CC0)
- step-stone-5, step-gravel-0, step-mud-0 — Kenney „OGA Footsteps” (stone01, gravel, mud02; nagrania TinyWorlds) (CC0)
- Zmiany: mono 32 kHz, przycięte do jednego kroku, wyrównana głośność.
