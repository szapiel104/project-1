# Decyzje architektoniczne

## Etap 1

- **Trzy warstwy.** `sim/` nie importuje nic z `render/`, `ui/`, `net/` ani z Three.js. Renderer i interfejs tylko czytają stan i wysyłają komendy.
- **Determinizm.** Symulacja używa wyłącznie liczb całkowitych, własnego generatora (`sim/rng.ts`, mulberry32) i szumu w stałym przecinku. `Math.random` wolno wołać tylko poza `sim/` (np. losowanie nazwy mapy w interfejsie).
- **Symetria map.** Mapa jest symetryczna środkowo (obrót o 180°): druga połowa to odbicie pierwszej, więc drużyny mają identyczny teren i surowce. Sprawdza to test.
- **Tryby jako dane.** Rozmiar mapy i pozycje startowe trybów 1v1, 2v2, 4v4 leżą w `data/maps.ts`.
- **Skrót stanu.** `stateHash` (FNV‑1a) z ticka, stanu generatora i mapy. Będzie rozszerzany o każdy nowy element stanu; to podstawa wykrywania rozjazdu w multiplayerze.
- **Modele.** `render/models.ts` to fabryka z interfejsem `ModelFactory`. Podmiana na glTF = nowa implementacja fabryki.
- **Ścieżki względne** (`base: './'` w Vite), żeby ten sam build działał na GitHub Pages, Cloudflare Pages i własnej domenie.
- **Krok symulacji:** 10 ticków na sekundę (`TICKS_PER_SECOND`).
- **Brak licencji** w repo celowo: kod jest publiczny do wglądu, ale bez prawa do użycia.
