# Teren — plan „ładniej niż Twierdza 4” (Michał 3.11.2026)

Michał pokazał zrzuty z Twierdzy 4 (zielone płaskowyże z urwiskami, gęste lasy i krzaki, jasne słońce, śnieżyca nad
palisadą, gęsty dym nad płonącą wsią) i porównał z naszą grą: teren płaski i jednakowy, ciemno i szaro, śnieg nie
pada, dym brzydki. Cel: teren różny na każdej mapie (łąki, wyżyna ze skałami, step/pustynia, północ), ładny i dalej wydajny.
Pod zamkami zawsze równy plac.

Zasady (z CLAUDE.md): mapa liczy się z ziarna, na liczbach całkowitych i symetrycznie (gra przez sieć, równe szanse);
nowy wygląd mapy = nowy numer generatora (`MAP_GEN`), stare zapisy dostają dawną mapę. Shader ziemi ma limit
16 tekstur — krainy barwimy przez kolory wierzchołków i istniejące warstwy (piasek, skała, żwir, wydeptanie).

## Biblioteki — co sprawdziłem
- Gotowe generatory (np. `TerrainGenerator` w przykładach three.js — tylko WebGPU/TSL, Project Caldera — Python)
  nie pasują: nasza mapa musi wychodzić identycznie u każdego gracza (liczby całkowite) i symetrycznie.
- Bierzemy z nich techniki, nie kod: zawinięcie współrzędnych szumem (domain warping), szum grzbietowy (ridged),
  progi wysokości (tarasy/płaskowyże) i łagodzenie stoków. `simplex-noise` (już w projekcie) zostaje do samego wyglądu.

## Punkty (po kolei, każdy osobno na produkcję)
1. [x] Plan (ten plik).
2. [x] **Generator 8 — krainy** (3.11.2026, 0.82.0): każda mapa dostaje krainę z ziarna — *Łęgi* (łąki, lasy, jeziora),
   *Wyżyna* (płaskowyże z urwiskami, skałki, mniej wody), *Step* (suche trawy, piach, rzadkie gaje, oczka wodne),
   *Północ* (gęsta tajga, chłodniej — dłużej leży śnieg). Mapa jest wyraźnie inna, ale zawsze z lasem przy zamku.
3. [x] **Płaskowyże i urwiska** (0.82.0): tarasy terenu z progami skalnymi nie do przejścia i z podjazdami
   (łagodne zbocza), skałki na łąkach. Wszystko symetryczne, z każdego zamku da się dojść do każdego.
4. [x] **Wygląd krain na ziemi** (0.82.0): step żółtawy z łatami piachu i gołej ziemi, wyżyna z kamieniami i żwirem,
   północ chłodniejsza; skała na każdym stromym zboczu.
5. [x] **Padający śnieg** (0.82.0): przy mrozie zamiast deszczu sypią płatki, w zimie także drobne śnieżyce.
6. [x] **Dym** (0.82.0): kłęby z nieregularną fakturą, obracające się, nad pożarem gęste i podświetlone od dołu
   na pomarańczowo-czerwono, czarniejące wyżej; kominy jaśniejsze i miękkie.
7. [x] **Światło dnia** (0.82.0): mniej szaro, cieplejsze słońce i żywsze barwy za dnia (noc i deszcz jak dotąd).
8. [ ] Roślinność wg krainy: gęstość krzaków i kamieni (step: kępy krzewów i głazy, wyżyna: rumowiska pod
   urwiskami, północ: same świerki i jodły), więcej podszytu na skraju lasu.
9. [x] Wybór krainy w „Nowej grze” (0.87, pergamin, zapis pamięta krainę). [ ] Zostaje: wybór w pokoju gry przez sieć.
10. [ ] Nowe modele kamieni i krzaków z gotowych paczek (CC0, z GitHuba — strony z teksturami są z czatu
    zablokowane), oryginalne trójkąty i tekstury.
11. [ ] Kwiaty i plamy innej trawy na łąkach (dziś wyłączone), kępy przy kamieniach i u stóp drzew.
12. [ ] Kopalnia przy skałkach i urwiskach na płaskowyżach (dziś stawia się przy górach na krańcach; sprawdzić model
    przy niższej skale).
13. [ ] Erozja: żleby na zboczach urwisk i stożki usypiskowe u ich stóp (tylko wygląd).

## Uwagi Michała po 0.84.0 (3.11.2026, 11:25) — do zrobienia w pierwszej kolejności
- [x] 0.84.1: skałki wyglądały tragicznie (kopie jednego kamienia „grzyba” na białym kopcu) — wyłączone od generatora 9,
  trzy odmiany głazów zamiast jednego modelu, skała ciemniejsza; step bez pomarańczowych „bunkrów” z piachu.
- [ ] **Zbocza i urwiska: tekstury rozciągnięte.** Siatka terenu ma jeden wierzchołek na pole (ok. 3 m) — za mało na
  urwisko. Potrzebne: gęstsza siatka przy skale (4×4 na pole) z drobnym szumem skały, rzut z trzech stron (triplanar)
  dla WSZYSTKICH warstw ziemi na stromym, a nie tylko dla skały.
- [ ] **Góry: pojedyncze, dziwne iglice zamiast pasma.** Masywy przy krańcach łączyć w ciągłe pasma (szum grzbietowy
  w dużej skali, wygładzanie pojedynczych pól gór), bez samotnych szpikulców.
- [ ] **Morze za mapą „popsute”** (płaska beżowa tafla w oddali, zwłaszcza na stepie) — sprawdzić wodę za mapą i mgłę.
- [x] 0.85.0: góry rosną od podnóża (bez iglic), skała w gęstej, wyrzeźbionej siatce (`render/rockmesh.ts`); 0.85.1 faktura skały bez smug.
- [x] 0.85.2: mgła na granicy mapy bez prostej linii (Michał 11:50).
- [ ] **Rzeka nie zawsze środkiem** (Michał 11:50): odmiany wody na mapie — bez rzeki (same jeziora), dwie rzeki po
  bokach (odbite symetrycznie, każda bliżej jednej drużyny), rzeka łukiem przez róg, rozlewisko. Razem z pustynią (generator 10).
- [ ] **Pełna pustynia** (Michał 11:33: „brakuje mi kompletnych pustyń”): piąta kraina — cała mapa w piachu i
  wydmach, kamieniste płaskowyże, oazy z wodą i zielenią przy jeziorkach, prawie bez lasu (drewno z oaz), gorąco i susza.
  Do zrobienia: piasek jako główna warstwa ziemi (bez trawy), wydmy w rzeźbie, roślinność pustynna z paczek (palmy,
  suche krzewy), mniej wody, zasady drewna dla botów i gracza (żeby gra była grywalna).
- [ ] **Modele skał i głazów** z prawdziwych skanów (paczki CC0/CC-BY z GitHuba, np. 0 A.D. jak trzciny) — kilka
  kształtów: głaz, płyta, ściana skalna, rumosz; dopiero z nimi wracają skałki i ładne urwiska.

## Uwagi do sprawdzenia
- Wydajność: płaskowyże nie dokładają trójkątów (ta sama siatka planszy), skałki to pola gór; śnieg to jedna pula punktów.
- Boty: krainy nie zmieniają zasad, ale skałki i urwiska zabierają miejsce — bot szuka miejsc jak dotąd (placement).
