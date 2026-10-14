# Project‑1 — zasady pracy

- Rozmowa i teksty po polsku. Michał wdraża i ocenia wygląd sam; pracujemy małymi partiami, push na main = wdrożenie (GitHub Pages).
- Gra tylko na komputery (telefony zablokowane w src/boot.ts).

## Testy — zawsze w tej kolejności, możliwie tanio
1. `npx tsc --noEmit`, `npx vitest run`, `npm run build` — logikę gry sprawdzamy testami bez przeglądarki (tests/*.test.ts).
2. Przeglądarka tylko gdy trzeba zobaczyć wygląd albo klikanie:
   - Chrome Michała przez rozszerzenie Claude in Chrome (prawdziwa karta graficzna, zrzuty w sekundy): otwórz `https://szapiel104.github.io/project-1/?test=1` w nowej karcie (`&hd=1` = pełna grafika, nadal bez ruszania zapisu), steruj przez `window.__test` (`give`, `build`, `train`, `run`, `look`, `at`, `state`). Zrzuty w skali 0.5–0.6. Tryb testowy nie rusza zapisu gracza.
   - **Pusta scena: `?test=1&pusta=1`** — płaska łąka bez lasów, wody, botów, wilków i napadów, tylko twierdze. Stawiasz tylko to, co testujesz, i kamera nie wpada w drzewa ani mury. Pomocniki w `window.__test`:
     - `home()` — pole przed bramą twierdzy (punkt odniesienia);
     - `place('house', x, y, rot?)` — gotowy budynek od ręki (null, gdy zajęte);
     - `hour(20.5)` — godzina na zegarze;
     - `peasants(n)` — chłopi;
     - `wolf(x, y)` — wilk;
     - `at(x, y, dist)` — kamera;
     - `run(ticks)` — przewinięcie symulacji.
     Przykład: `const h=__test.home(); __test.place('house',h.x-1,h.y+6); __test.hour(10); __test.at(h.x,h.y+8,7)`.
   - **Nowy albo zmieniony model budynku sprawdzaj na pustej scenie, nie w zwykłej grze:** `?test=1&pusta=1&model=tavern` (opcjonalnie `&rot=1`, `&widok=ground-front`) od razu stawia gotowy, zbudowany model na łące przed twierdzą, w południe, z kamerą od frontu (strona z drzwiami). Obchód: `__test.view(nazwa)` — `front`, `right`, `back`, `left`, `top`, `near`, `door`, `ground-front`, `ground-right`, `ground-back`, `ground-left` (z ziemi, oczami chłopa). Inny model bez przeładowania: `__test.model('house', rot?, widok?)` (poprzedni znika). Na pustej scenie budynki stoją od razu, bez pokazu budowy.
   - Bez Chrome: Playwright + `?test=1` (start ~1,5 s), najlepiej z `&pusta=1`. Pełna grafika w Playwright jest bardzo wolna — unikać.
   - Pojedynczy model: `podglad.html?id=house` na serwerze deweloperskim Vite.
3. Modele z Blendera (tools/models): po każdej zmianie budynku `sh tools/models/inspect.sh keep /tmp/keep.png` — arkusz ok. 25 zdjęć (dookoła, z lotu ptaka, od dołu, z ziemi oczami chłopa, przekrój, z oczu człowieka w salach i na murach), z ukrytymi tylnymi ścianami jak w grze, więc odwrócone dachy i dziury widać od razu. Obejrzeć arkusz przed wdrożeniem; widoki z oczu człowieka dopisuje się w skrypcie budynku (klucz `views`).
   - Zawsze sprawdzić budynek też z oczu chłopa (spacer): z ziemi dookoła, od dołu pod okapem i z boku — dach, szczyty i ściany nie mogą znikać ani prześwitywać, także gdy ktoś pracuje w środku (gra zdejmuje wtedy dach w widoku z góry, w spacerze dach ma zostać). Arkusz z inspect.sh ma do tego widoki „z ziemi” i „przy szczycie”. Połacie dachów robić `gable()`/`slope()` z building.py — mają spód, więc okap widać też od dołu.
4. Wydajność: w grze F3 pokazuje okno wydajności; w Chrome `window.__perf()` zwraca FPS, czasy symulacji/rysowania i liczniki.
5. Nie robić serii zrzutów „na wszelki wypadek”; jeden zrzut na zmianę wyglądu wystarczy.

## Pomysły
- Lista kolejnych partii jest w `docs/pomysly.md`. Gdy Michał pyta „co dalej”, podpowiadaj z niej (i dopisuj tam nowe pomysły, zdejmuj zrobione).
