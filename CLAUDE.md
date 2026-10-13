# Project‑1 — zasady pracy

- Rozmowa i teksty po polsku. Michał wdraża i ocenia wygląd sam; pracujemy małymi partiami, push na main = wdrożenie (GitHub Pages).
- Gra tylko na komputery (telefony zablokowane w src/boot.ts).

## Testy — zawsze w tej kolejności, możliwie tanio
1. `npx tsc --noEmit`, `npx vitest run`, `npm run build` — logikę gry sprawdzamy testami bez przeglądarki (tests/*.test.ts).
2. Przeglądarka tylko gdy trzeba zobaczyć wygląd albo klikanie:
   - Chrome Michała przez rozszerzenie Claude in Chrome (prawdziwa karta graficzna, zrzuty w sekundy): otwórz `https://szapiel104.github.io/project-1/?test=1` w nowej karcie (`&hd=1` = pełna grafika, nadal bez ruszania zapisu), steruj przez `window.__test` (`give`, `build`, `train`, `run`, `look`, `state`). Zrzuty w skali 0.5–0.6. Tryb testowy nie rusza zapisu gracza.
   - Bez Chrome: Playwright + `?test=1` (start ~1,5 s). Pełna grafika w Playwright jest bardzo wolna — unikać.
   - Pojedynczy model: `podglad.html?id=house` na serwerze deweloperskim Vite.
3. Wydajność: w grze F3 pokazuje okno wydajności; w Chrome `window.__perf()` zwraca FPS, czasy symulacji/rysowania i liczniki.
4. Nie robić serii zrzutów „na wszelki wypadek”; jeden zrzut na zmianę wyglądu wystarczy.

## Pomysły
- Lista kolejnych partii jest w `docs/pomysly.md`. Gdy Michał pyta „co dalej”, podpowiadaj z niej (i dopisuj tam nowe pomysły, zdejmuj zrobione).
