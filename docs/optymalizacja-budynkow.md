# Optymalizacja rysowania budynków (plan na kilka dni, Michał 10.11.2026)

## Skąd to się wzięło

Pomiar na dużym zapisie Michała (pustynia, pełna wioska, Ultra, oddalony widok, 10.11.2026), chowanie całych grup:

| schowane / wyłączone | FPS przed → po |
|---|---|
| budynki | 47 → 95 |
| woda (z odbiciem) | 59 → 92 |
| cienie | 54 → 94 |
| postacie | 39 → 56 (szum) |
| drzewa, roślinność pustyni, graty, mury, teren | bez różnicy |
| wszystkie wnętrza | ok. 1,5 ms klatki |

Gra stoi na **procesorze** (ok. 17 ms klatki, z tego ~10 ms to przygotowanie poleceń dla karty). Budynki są rysowane
w paczkach po materiale (`src/render/buildingBatch.ts`, THREE.BatchedMesh), ale na WebGPU three.js wysyła **osobne
polecenie dla każdej sztuki** w paczce — a budynki rysują się trzy razy: obraz, cień słońca, odbicie w wodzie.
Ok. 1400 poleceń w oddalonym widoku.

Cel: zlepić nieruchome części budynków w gotowe bryły **na kawałek mapy i materiał** (jedno polecenie na materiał
w kawałku zamiast jednego na każdą chatę). To, co się rusza albo chowa (dach, skrzydła wrót, ogień, ludzie, zapasy),
zostaje po staremu.

## Jak mierzyć (zawsze tak samo)

`npx vite` u Michała (uruchom.bat) → `http://localhost:5173/?perf=1` → Kontynuuj (jego zapis) → w konsoli
`await __bench()` (kamera nad twierdzą, oddalona, 5 s). Okno Chrome na wierzchu (przykryte = Chrome dławi grę).
Porównywać tylko wyniki z tego samego okna i zapisu. Dodatkowo `await __ab(null, 'budynki')` = ile zostało do wzięcia.

Wynik wpisać pod partią (data, fps / med / wywołania / trójkąty).

## Partie

- [x] **0. Wnętrza bez cienia i odbicia** (10.11.2026) — części wnętrz w osobnych paczkach (`add(..., inner)`),
  `castShadow = false`, `noReflect`. W obrazie zawsze. Zysk mały (szacunek 1–2 ms).
- [x] **1. Stały pomiar** (10.11.2026) — `__bench()` i ten plan.
- [ ] **2. Wnętrza zlepione na kawałek mapy.** Najprostsze: nie mają dalekiej wersji, nie chowają się, nie ruszają.
  Moduł `src/render/chunkMerge.ts`: kawałek 16×16 pól × materiał → jedna siatka (bryły przemnożone przez macierz
  budynku i sklejone). Przeliczenie kawałka tylko, gdy zmieni się lista budynków w nim (postawiony, zburzony, ruina,
  plac budowy) — z opóźnieniem do następnej klatki i w kawałkach po jednym na klatkę. W `syncMatBatches` części wnętrz
  zlepionych budynków nie idą już do paczek. Sprawdzić: kliknięcie, spacer w izbie, budowa i burzenie (bez mrugania).
- [ ] **3. Korpus budynku (grupa `base` w korzeniu) zlepiony, z dalekimi wersjami na poziom kawałka.** Cały kawałek ma
  jeden poziom szczegółów (od odległości środka kawałka); zlepione wersje na poziom liczone raz i trzymane w pamięci.
  Budynek uszkodzony / płonący / zaznaczony — wypada z kawałka do paczek.
- [ ] **4. Mury i dach (`shell`, `roof`, `chimney`) zlepione** — budynek z otwartym dachem (kliknięty, pracujący
  oglądany z góry) wypada z kawałka do paczek na czas otwarcia; kawałek przelicza się w tle, bez przycięcia.
- [ ] **5. Cienie i odbicie** korzystają z kawałków (kawałek poza mapą cieni / bez wody w odbiciu nie idzie do karty).
- [ ] **6. Sprzątanie:** pomiar końcowy, porównanie z punktem wyjścia, wpis do „Co nowego”.

## Ryzyka (z historii)

- 8.11.2026: powiększanie BatchedMesh w miejscu mieszało części budynków (wiatrak w zamku) — w kawałkach zawsze nowa
  siatka zamiast podmiany buforów.
- 10.11.2026: chowanie wnętrz wg odległości dawało mruganie przy podlatywaniu — wnętrza mają zostać widoczne zawsze.
- Kawałek przeliczany w każdej klatce (np. przez animację dachu) zabije FPS — wszystko, co się zmienia, idzie do paczek.
