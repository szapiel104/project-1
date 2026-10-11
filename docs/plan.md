# Prompt: przeglądarkowa strategia multiplayer w stylu Twierdzy

Plan projektu. Repo: szapiel104/project-1, Supabase: https://psccakqdinwqloozdsyf.supabase.co. Etapy 1 i 2 są zrobione (patrz CHANGELOG.md).

Zasada pracy: małe partie. Jedna rzecz, wdrożenie pod link, opinia, dopiero potem następna. Po zmianie wystarczą szybkie testy (`npm test`) i kompilacja; wygląd i rozgrywkę sprawdza Michał w grze.

---

## 1. Cel

Zbuduj przeglądarkową grę strategiczną czasu rzeczywistego w stylu Twierdzy (Stronghold): budowa zamku, gospodarka, proste ludziki, bitwy między graczami. Gra od początku jest multiplayer: konta, lobby, mecze 1v1, 2v2 i 4v4, boty, ranking oraz monety za wygrane, wydawane na trwałe ulepszenia.

Priorytet numer jeden to architektura, w której dokładanie treści (budynek, jednostka, ulepszenie, mapa) oznacza nowy wpis w pliku danych, a nie zmiany w silniku.

Pracuj etapami z sekcji 12. Po każdym etapie gra ma działać pod publicznym linkiem. Nie zaczynaj kolejnego etapu, dopóki poprzedni nie spełnia kryteriów.

## 2. Dane wejściowe

- Repozytorium GitHub: [adres repo]
- Supabase, adres projektu: [URL]
- Supabase, klucz publiczny (anon): [klucz]
- Robocza nazwa gry: [nazwa]

Klucza serwisowego Supabase nigdy nie umieszczaj w kodzie klienta ani w repo.

## 3. Ograniczenia

- Wszystko na darmowych planach: GitHub (repo + GitHub Pages) i Supabase (baza, logowanie, Realtime, Edge Functions). Żadnego własnego serwera.
- Zanim oprzesz się na limicie darmowego planu (liczba wiadomości Realtime, połączeń, wywołań funkcji), sprawdź go w aktualnej dokumentacji i zapisz w `docs/limity.md`.
- Hosting ma dać się przenieść na Cloudflare Pages z własną domeną bez zmian w kodzie (ścieżki względne, konfiguracja w zmiennych środowiskowych).
- Język gry i interfejsu: polski. Teksty w plikach tłumaczeń, nie w kodzie.

## 4. Technologia

- TypeScript w trybie strict, Vite, Three.js.
- Grafika 3D low-poly, kamera z góry pod kątem jak w klasycznej izometrii, z obrotem i zoomem.
- Wszystkie modele generowane kodem z prostych brył (mury, wieże, chaty, drzewa, ludziki). Żadnych zewnętrznych plików modeli na tym etapie. Generator modeli za wspólnym interfejsem, żeby później podmienić go na pliki glTF.
- Testy: Vitest dla symulacji.
- GitHub Actions: testy + build + wdrożenie na GitHub Pages przy każdym pushu do `main`.

## 5. Architektura

Trzy warstwy, zależności tylko w dół:

1. `sim/` czysta symulacja gry. Zero importów z Three.js, DOM i sieci. Wejście: lista komend graczy na dany tick. Wyjście: nowy stan.
2. `render/`, `ui/`, `net/` czytają stan symulacji i wysyłają komendy. Nigdy nie zmieniają stanu bezpośrednio.
3. `data/` definicje budynków, jednostek, surowców, ulepszeń i map jako typowane pliki danych.

Struktura katalogów:

```
src/
  sim/        stan, tick, systemy (gospodarka, budowa, ruch, walka, AI botów)
  data/       budynki, jednostki, surowce, ulepszenia, mapy
  render/     scena, kamera, proceduralne modele, animacje
  ui/         menu, lobby, HUD, sklep ulepszeń
  net/        transport, lockstep, lobby, matchmaking
  backend/    klient Supabase, konta, profil, zapis wyników
  i18n/       teksty
supabase/
  migrations/ pliki SQL
  functions/  Edge Functions
docs/         decyzje architektoniczne, limity, instrukcja wdrożenia
```

## 6. Multiplayer: deterministyczny lockstep

Bez własnego serwera gry, więc model taki jak w klasycznych RTS-ach:

- Każdy klient uruchamia tę samą symulację. Przez sieć idą wyłącznie komendy graczy, nigdy stan.
- Stały krok symulacji (np. 10 ticków na sekundę), komendy wykonywane z opóźnieniem kilku ticków, render interpoluje między tickami.
- Pełny determinizm w `sim/`: arytmetyka na liczbach całkowitych lub stałoprzecinkowa, własny generator losowy z ziarnem meczu, żadnego `Math.random`, `Date.now`, funkcji trygonometrycznych z `Math` ani zależności od kolejności iteracji po obiektach.
- Co kilkadziesiąt ticków klienci porównują skrót stanu. Rozjazd (desync) kończy mecz bez nagród i zapisuje log do diagnozy.
- Transport za interfejsem `Transport`. Pierwsza implementacja: kanały Supabase Realtime (broadcast). Druga możliwa później: WebRTC albo własny serwer, bez zmian w `sim/`.
- Rozłączenie gracza: pauza z limitem czasu, potem jego zamek przejmuje bot.
- Boty działają wewnątrz symulacji, deterministycznie, więc mogą uzupełniać składy w meczach sieciowych.
- Powtórki: zapis ziarna i listy komend wystarcza do odtworzenia meczu.

Test obowiązkowy: ten sam zestaw komend uruchomiony dwa razy daje identyczny skrót stanu po 10 000 ticków.

## 7. Rozgrywka

**Mapa:** siatka pól, teren, las, kamień, żelazo, pozycje startowe symetryczne dla drużyn. Mapy generowane z ziarna plus kilka ręcznie opisanych w `data/`.

**Gospodarka:** drewno, kamień, żelazo, żywność, złoto. Budynki produkcyjne (drwal, kamieniołom, kopalnia, farma, młyn, piekarnia), magazyn, spichlerz. Chłopi fizycznie przenoszą surowce.

**Ludność:** popularność zależna od racji żywności, podatków i przeludnienia. Popularność steruje napływem lub odpływem ludzi.

**Zamek:** twierdza główna, mury i wieże przeciągane po siatce, bramy, schody na mury.

**Wojsko:** koszary i zbrojownia, na start łucznik, włócznik, zbrojny, taran. Zaznaczanie ramką, grupy, rozkazy ruchu i ataku, wyszukiwanie ścieżek po siatce z uwzględnieniem murów.

**Zwycięstwo:** zniszczenie twierdzy głównej wszystkich przeciwników z drużyny przeciwnej.

**Tryby:** 1v1, 2v2, 4v4. Ustawienia meczu: mapa, surowce startowe, czas pokoju przed walką, poziom botów.

## 8. Lobby i dobieranie graczy

- Tworzenie własnego pokoju (publiczny lub z kodem), lista pokoi, dołączanie, wybór drużyny, gotowość, start przez gospodarza.
- Szybki mecz: kolejka dobierająca graczy o zbliżonym rankingu, po przekroczeniu czasu oczekiwania uzupełnienie botami.
- Mecz z samymi botami dostępny zawsze.

## 9. Postęp gracza

- Monety za mecze: więcej za wygraną, mniej za przegraną, najmniej za mecze z samymi botami, z dziennym limitem dla botów.
- Ulepszenia kupowane w menu, zdefiniowane w `data/` jako drzewka: jednostki, mury i wieże, budynki gospodarcze.
- Ranking w systemie Elo, osobny dla każdego trybu.
- Balans: ulepszenia dają małe, ograniczone premie (łącznie najwyżej kilkanaście procent), a dobieranie uwzględnia ranking i poziom ulepszeń. Nowy gracz nie może trafiać na przeciwnika nie do pokonania.

## 10. Backend w Supabase

- Logowanie: e-mail z hasłem, reset hasła, unikalny nick.
- Tabele (minimum): `profiles`, `player_upgrades`, `rooms`, `room_players`, `matches`, `match_players`, `match_queue`, `coin_ledger`.
- Row Level Security na każdej tabeli. Gracz czyta tylko swoje dane prywatne, ranking i pokoje są publiczne do odczytu.
- Monety, ranking i ulepszenia zmienia wyłącznie Edge Function, nigdy klient. Funkcja `report_match_result` przyjmuje wynik i końcowy skrót stanu od każdego gracza i przyznaje nagrody tylko przy zgodności zgłoszeń. Zakup ulepszenia też przez funkcję, z walidacją kosztu.
- Każda zmiana monet jako wpis w `coin_ledger` (historia, a nie samo saldo). To przygotowanie pod przyszłe mikropłatności.
- Schemat tylko przez pliki w `supabase/migrations/`, nigdy ręcznie w panelu.

## 11. Interfejs

- Ekrany: logowanie i rejestracja, menu główne, profil, ulepszenia, lista pokoi, pokój, szybki mecz, HUD w grze, podsumowanie meczu, ranking.
- Styl z charakterem: średniowieczny, pergamin, drewno, heraldyka, wyrazista typografia. Bez generycznych gradientów, zaokrąglonych kart z ikonkami i pustych liczników.
- Menu obsługiwane klawiaturą, widoczny fokus, kontrast tekstu co najmniej 4,5:1, cele dotykowe co najmniej 44 px, `prefers-reduced-motion`, brak przewijania w bok na 390, 768, 1024 i 1440 px.
- Sterowanie w meczu: mysz i klawiatura. Dotyk na tablecie jako etap późniejszy, ale warstwa wejścia ma to umożliwiać.

## 12. Etapy

1. **Fundament:** repo, Vite, testy, wdrożenie na GitHub Pages, pusta scena z kamerą i mapą z ziarna.
2. **Gospodarka:** budowanie na siatce, chłopi, surowce, popularność. Kryterium: da się rozwinąć osadę od zera.
3. **Menu główne i ekran ładowania (ważne):** po wejściu w link pasek ładowania, potem menu w klimacie Twierdzy: Graj (wybór trybu i mapy), Ustawienia (dźwięk, grafika, sterowanie), Jak grać. Kolejne etapy dokładają do tego samego menu konto, ulepszenia, ranking i lobby. Gra nie startuje już od razu na mapie.
4. **Wojsko i boty:** jednostki, walka, mury, bot przeciwnik. Kryterium: pełny mecz offline z botem od startu do zwycięstwa, test determinizmu przechodzi.
5. **Konta:** rejestracja, logowanie, profil, migracje, RLS.
6. **Multiplayer 1v1:** pokoje, lockstep przez Realtime, wykrywanie desynchronizacji, rozłączenia.
7. **Drużyny:** 2v2 i 4v4, uzupełnianie botami. Pomiar liczby wiadomości względem limitu z `docs/limity.md`.
8. **Postęp:** poziomy graczy, monety, ulepszenia, ranking, szybki mecz z dobieraniem.
9. **Szlif:** dźwięk, samouczek, powtórki, balans.

Mikropłatności i reklamy są poza zakresem. Nie implementuj ich, ale nie blokuj: waluta w rejestrze po stronie serwera, sklep sterowany danymi.

## 13. Zasady pracy

- Małe commity z opisem po polsku, po każdym etapie tag i wpis w `CHANGELOG.md`.
- Każdy system symulacji ma testy. Test determinizmu uruchamia się w CI.
- Decyzje architektoniczne zapisuj krótko w `docs/decyzje.md`.
- Gdy coś jest niejednoznaczne i tanie do zmiany, wybierz rozsądnie i odnotuj. Gdy drogie do zmiany, zapytaj przed implementacją.
- Na koniec każdego etapu podaj: co działa, link do gry, co świadomie pominięto, co sprawdzić ręcznie.
