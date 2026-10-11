# Project‑1

Przeglądarkowa strategia czasu rzeczywistego w stylu Twierdzy: zamki, gospodarka, bitwy 1v1, 2v2 i 4v4. Nazwa robocza.

Gra: https://szapiel104.github.io/project-1/

## Uruchomienie

```
npm install
npm run dev      # wersja deweloperska
npm test         # testy symulacji
npm run build    # build produkcyjny do dist/
```

Każde wypchnięcie do `main` uruchamia testy, build i wdrożenie na GitHub Pages.

## Struktura

```
src/sim/      czysta, deterministyczna symulacja (bez grafiki, DOM i sieci)
src/data/     definicje: teren, mapy, drużyny (później budynki, jednostki, ulepszenia)
src/render/   scena 3D, kamera, proceduralne modele
src/ui/       interfejs
src/net/      multiplayer (od etapu 5)
src/backend/  Supabase: konta, profil, wyniki (od etapu 4)
src/i18n/     teksty
supabase/     migracje SQL i Edge Functions
docs/         decyzje, limity, plan
```

Zasada: nowa treść (tryb, budynek, jednostka) to wpis w `src/data/`, a nie zmiana w silniku.

Plan etapów: `docs/plan.md`. Decyzje: `docs/decyzje.md`.
