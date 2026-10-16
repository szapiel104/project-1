# Progresja gracza — żeby chciało się wracać

Plik dla wszystkich czatów tej gry. Zapisany 16.10.2026 na prośbę Michała. To plan na wiele partii, nie jedna partia.
Kierunek: z samej strategii robi się strategia z elementami RPG i MMO — gracz ma swojego **pana na zamku** (postać),
który rośnie z każdą bitwą, zdobywa poziomy, rozwija umiejętności, a z czasem trafia na lepszych przeciwników i większe
wyzwania. Każda partia z listy na dole ma być małą, wdrażalną zmianą; zrobione partie oznaczamy datą.

## Co już jest (16.10.2026)

- Konta w Supabase: logowanie, unikalny nick, awatar (`profiles`), znajomi (`friends`).
- Wyniki meczów przez sieć (`results`: wygrana/przegrana, tryb, minuty) i widok `ranking` (wygrane, przegrane, mecze).
- **Uwaga:** wynik zapisuje dziś sam klient (polityka „każdy zapisuje swój wynik”), więc da się go podrobić. Zanim
  za wyniki zaczną wpadać poziomy i nagrody, zapis musi przejść przez funkcję na serwerze (partia 2).
- Plan etapów (`docs/plan.md`, rozdział 9 i etap 8) zakładał już monety, ulepszenia i ranking Elo — ten plik go rozwija.

## Filary

### 1. Postać: pan na zamku
- Każde konto ma jedną postać: imię (nick), herb (barwy, godło), tytuł, poziom, doświadczenie.
- Postać widać w grze: chorągwie i herb na zamku, pan chodzący po dziedzińcu ma wyższy tytuł = bogatszy strój.
- Tytuły co kilka poziomów (przykład): Giermek → Rycerz → Kasztelan → Wojewoda → Książę → Król. Tytuł widać przy nicku
  w pokoju, rankingu i czacie.

### 2. Doświadczenie (PD) i poziomy
- PD za każdy rozegrany mecz — **także przegrany** (przegrana uczy; gracz, który przegrywa, też ma się rozwijać,
  tylko wolniej). Przykładowe źródła w jednym meczu:
  - udział w meczu (stała kwota, liczona od czasu gry, z limitem, żeby nie opłacało się ciągnąć meczu),
  - wygrana (duża premia), przegrana (mała premia za wytrwałość),
  - wybici wrogowie, zburzone budynki wroga, przetrwane napady i zimy, największa populacja, zbudowane budynki,
  - mecz przez sieć z ludźmi daje najwięcej, z botami mniej, a mecze z samymi botami mają dzienny limit PD.
- Krzywa poziomów rosnąca łagodnie (np. PD na poziom = 100 · poziom^1,5), żeby pierwsze poziomy szły szybko,
  a wysokie wymagały wielu meczów.
- Po meczu ekran podsumowania: skąd PD (lista z liczbami), pasek poziomu, który się napełnia, nowy poziom z fanfarą.

### 3. Rozwój postaci (drzewko umiejętności)
- Każdy poziom daje punkt umiejętności. Punkty wydaje się w drzewkach, np.:
  - **Gospodarz:** szybsza praca drwali i kamieniarzy, większy spichlerz, mniej opału zimą, więcej złota z podatków.
  - **Wódz:** tańsze szkolenie, szybszy marsz, łucznicy strzelają odrobinę dalej, ranni szybciej się leczą.
  - **Budowniczy:** tańsze mury, szybsza budowa, wytrzymalsze bramy i wieże, odbudowa ruin taniej.
  - **Pan ludu:** wyższa popularność na start, więcej osadników przy ognisku, karczma mocniej poprawia nastroje.
- Premie małe i z twardym limitem (łącznie najwyżej kilkanaście procent na dowolną cechę) — decyduje gra, nie poziom.
- Możliwość darmowego przestawienia punktów raz na jakiś czas (albo za walutę).
- Dane drzewek w `src/data/` (jak budynki), symulacja czyta premie gracza na starcie meczu i wszyscy gracze w meczu
  dostają te same dane (lockstep — premie muszą być częścią stanu meczu, nie liczone osobno u każdego).

### 4. Nagrody na start i odblokowania
- Wyższy poziom = trochę więcej surowców na start (z limitem), dodatkowe odblokowania: nowe rodzaje budynków
  i jednostek dostępne od poziomu X, ozdoby zamku (flagi, posągi, ogród), wygląd jednostek.
- W meczach rankingowych premie startowe są wyrównane albo wyłączone (tryb „równe szanse”); w zwykłych i z botami
  działają w pełni.

### 5. Dobór przeciwników i wyzwania
- Ranking (Elo albo Glicko) osobno dla 1v1 i drużyn. Szybki mecz dobiera ludzi o podobnym rankingu i poziomie,
  po czasie oczekiwania dokłada boty.
- Boty rosną z graczem: im wyższy poziom, tym trudniejsze boty w meczach z botami (i więcej PD za wygraną).
- Wyzwania: „pokonaj trudnego bota bez murów”, „przetrwaj 3 zimy”, „wygraj w 20 minut” — dodatkowe PD i ozdoby.
- Później: sezony z ligami (brąz, srebro, złoto…), nagroda za miejsce na koniec sezonu.

### 6. Statystyki i osiągnięcia
- Profil postaci: bitwy wygrane i przegrane, wybici wrogowie, stracone wojsko, zburzone zamki, najdłuższy mecz,
  ulubiony tryb, przetrwane zimy, zbudowane budynki.
- Osiągnięcia (odznaki) za kamienie milowe — widoczne w profilu, część daje ozdoby albo tytuły.

### 7. Waluta i sklep (później)
- Waluta za mecze (robocza nazwa: dukaty). Każda zmiana jako wpis w rejestrze (`coin_ledger`), nie samo saldo.
- Wydatki: przestawienie punktów umiejętności, ozdoby zamku, herby, wygląd jednostek. Bez kupowania przewagi w walce.
- Pod przyszłe mikropłatności (zgodnie z planem: nie implementujemy płatności, ale nie blokujemy).

### 8. Świat (MMO, daleka przyszłość)
- Mapa świata z ziemiami graczy; mecze jako bitwy o prowincje; sojusze/rody kilku graczy, wspólne wojny sezonowe.
- Do tego wracamy dopiero, gdy filary 1–6 działają i gracze wracają do gry.

## Zasady (dla każdej partii)
- **Postęp liczy i zapisuje serwer**, nie przeglądarka: Edge Function przyjmuje zgłoszenie wyniku i statystyk od graczy
  meczu (z końcowym skrótem stanu), porównuje zgłoszenia i dopiero wtedy przyznaje PD i nagrody. Klient tylko czyta.
- Mecze offline z samymi botami da się podrobić — dlatego dają mało PD, z dziennym limitem.
- Premie z poziomu i umiejętności: małe, z limitem, jawne (gracz widzi w meczu, kto ma jakie premie).
- Schemat bazy tylko przez pliki w `supabase/migrations/`; zmiany w Supabase Michała dopiero po pokazaniu i jego zgodzie;
  z kluczy wyłącznie publiczny (anon), nigdy klucz serwisowy.
- Teksty po polsku, naturalne; ekrany w stylu menu gry (skóra, złote żyłki, Cinzel), dostępne z klawiatury.

## Partie (kolejność; każdy czat bierze następną nieoznaczoną)

1. **Postać w profilu:** tabela postaci (poziom, PD, tytuł, herb: barwy i godło), ekran „Mój ród” w menu (podgląd
   herbu, poziom, pasek PD, tytuł), tytuł przy nicku w pokoju i rankingu. Bez przyznawania PD — same dane i wygląd.
2. **Bezpieczny wynik meczu:** Edge Function `report_match_result` (zgodność zgłoszeń, skrót stanu), wyniki i ranking
   tylko przez nią; zamknięcie zapisu `results` z klienta.
3. **PD za mecz:** statystyki meczu liczone w symulacji (wybici, zburzone, przetrwane zimy, budynki…), PD przyznawane
   na serwerze, ekran podsumowania meczu z rozpisaną listą i paskiem poziomu.
4. **Statystyki i osiągnięcia** w profilu (pierwsze 10–15 odznak).
5. **Drzewko umiejętności:** dane w `src/data/`, ekran wydawania punktów, premie w symulacji jako część stanu meczu
   (test determinizmu), limity.
6. **Premie startowe i odblokowania** zależne od poziomu; tryb „równe szanse” w meczach rankingowych.
7. **Ranking Elo/Glicko** i szybki mecz z dobieraniem po rankingu; boty rosnące z poziomem gracza.
8. **Wyzwania** (codzienne i stałe) z nagrodami.
9. **Waluta i rejestr** (`coin_ledger`), przestawianie punktów, ozdoby zamku i herby za walutę.
10. **Sezony i ligi.**
11. **Świat i rody** (MMO) — osobny plan, gdy 1–10 będzie gotowe.

## Pytania do Michała (do ustalenia przy kolejnych partiach)
- Nazwa waluty i tytułów (proponowane wyżej to robocze).
- Czy premie z umiejętności mają działać w meczach rankingowych, czy tylko poza nimi?
- Ile PD za przegraną względem wygranej (proponuję ok. 1/3)?
- Czy herb ma być wybierany z gotowych elementów (tarcza, barwy, godło), czy rysowany?
