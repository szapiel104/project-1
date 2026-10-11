# Dziennik zmian

## 0.2.9 — chaty i dłuższa praca (2026-10-11)

- Co trzy dostawy chłop idzie do najbliższej chaty odpocząć; chata odsłania wtedy izbę ze stołem i łóżkiem
- Cięcie desek, mielenie i pieczenie trwają dłużej, żeby było je widać
- Tempo gry pod klawiszami + i −

## 0.2.8 — wnętrze młyna (2026-10-11)

- Gdy młynarz miele, młyn odsłania wnętrze: kamienie młyńskie i worki z mąką, skrzydła kręcą się dalej

## 0.2.7 — zapis gry (2026-10-11)

- Gra zapisuje się sama w przeglądarce co 5 sekund i przy zamykaniu karty; po odświeżeniu wraca stan sprzed odświeżenia
- „Nowa gra” w zakładce Mapa zaczyna od zera
- Zapis z niezgodnej wersji gry jest pomijany

## 0.2.6 — sterowanie na górnym pasku (2026-10-11)

- Przyciski minus i plus na górze: tempo gry (pauza, 1×, 2×, 3×, 5×), podatki i racje żywności

## 0.2.5 — widać, kto pracuje (2026-10-11)

- Drwal niesie kłodę z lasu do chaty, tam tnie ją na deski i dopiero deski odnosi do składu
- Rolnik i sadownik chodzą po polu i schylają się przy pracy
- Gdy piekarz albo drwal pracuje w środku, budynek odsłania wnętrze: piec z żarem, stół z bochenkami, kozioł z kłodą
- Pasek budowy zajmuje jeden niski rząd

## 0.2.4 — życie w osadzie (2026-10-11)

- Skrzydła młyna kręcą się, a z komina piekarni leci dym, gdy ktoś tam pracuje
- Drwal niesie kłodę na ramieniu zamiast klocka
- Skład zapełnia się przed twierdzą, więc każda dostawa jest od razu widoczna

## 0.2.3 — dolne menu budowy (2026-10-11)

- Pasek budowy na dole ekranu z kategoriami: Osada, Żywność, Przemysł
- Karty budynków z obrazkiem renderowanym z tego samego modelu, który staje na mapie
- Dwór, Mapa i Sterowanie jako wysuwane panele nad paskiem

## 0.2.2 — pojemność składów (2026-10-11)

- Składy i spichlerze mają limit: twierdza 250 surowców i 120 żywności, skład +200, spichlerz +150
- Gdy brakuje miejsca, chłopi czekają z towarem przy składzie, więc trzeba dobudowywać
- W składzie widać skrzynie, których przybywa w miarę zapełniania, w kolorach surowców
- Pasek u góry pokazuje zapełnienie składu i spichlerza

## 0.2.1 — poprawki po etapie 2 (2026-10-11)

- Podgląd budowli przy wybieraniu miejsca (półprzezroczysty model nad działką, czerwony gdy nie da się budować)
- Popularność pokazywana ze skalą, np. 75 / 100
- Balans żywności: pełne racje to 6 jednostek na 8 chłopów miesięcznie, sad daje 8 jabłek
- Plik `docs/pomysly.md` na nowe pomysły i braki do zrobienia później

## 0.2.0 — etap 2: gospodarka (2026-10-11)

- Budowanie na siatce: 10 budynków do postawienia (chata, skład, spichlerz, drwal, kamieniołom, kopalnia, sad, farma, młyn, piekarnia), rozbiórka ze zwrotem połowy kosztu
- Chłopi z wyszukiwaniem drogi: sami biorą pracę, chodzą do lasu i złóż, noszą surowce do składu
- Łańcuch zboże → mąka → chleb, jabłka jako prosta żywność
- Ludność, racje żywności, podatki i popularność rozliczane co miesiąc gry
- Większe mapy z pasmem gór na krańcach, mgłą i blokadą kamery
- Mapa w adresie strony (`#tryb/ziarno`), tempo gry: pauza, 1×, 3×

## 0.1.0 — etap 1: fundament (2026-10-11)

- Projekt Vite + TypeScript (strict) + Three.js, podział na warstwy `sim` / `data` / `render` / `ui`
- Deterministyczny generator map z ziarna, symetryczny dla drużyn, tryby 1v1, 2v2 i 4v4
- Scena 3D low‑poly: teren, woda, lasy, kamień, żelazo, twierdze startowe
- Kamera strategiczna: klawiatura, mysz i dotyk
- Testy symulacji (w tym determinizm po 10 000 ticków)
- Automatyczne testy, build i wdrożenie na GitHub Pages
