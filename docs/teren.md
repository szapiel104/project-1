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
- [x] 0.88.0 **Rzeka nie zawsze środkiem** (Michał 11:50): odmiany wody na mapie — bez rzeki (same jeziora), dwie rzeki po
  bokach (odbite symetrycznie, każda bliżej jednej drużyny), rzeka łukiem przez róg, rozlewisko. Razem z pustynią (generator 10).
- [x] 0.88.0 **Pełna pustynia** (dalej: palmy i pustynne krzewy z paczek, wybór w pokoju sieciowym) (Michał 11:33: „brakuje mi kompletnych pustyń”): piąta kraina — cała mapa w piachu i
  wydmach, kamieniste płaskowyże, oazy z wodą i zielenią przy jeziorkach, prawie bez lasu (drewno z oaz), gorąco i susza.
  Do zrobienia: piasek jako główna warstwa ziemi (bez trawy), wydmy w rzeźbie, roślinność pustynna z paczek (palmy,
  suche krzewy), mniej wody, zasady drewna dla botów i gracza (żeby gra była grywalna).
- [x] 0.89.0 **Modele skał i głazów** (0 A.D.: 23 kształty, zdjęciowa skała) — dalej: skałki na łąkach z tych modeli, palmy na pustynię.
- [ ] (stare) **Modele skał i głazów** z prawdziwych skanów (paczki CC0/CC-BY z GitHuba, np. 0 A.D. jak trzciny) — kilka
  kształtów: głaz, płyta, ściana skalna, rumosz; dopiero z nimi wracają skałki i ładne urwiska.

## Zaległe — robimy po WebGPU
- [x] 0.94.2: krawędź mapy bez kwadratu — teren za planszą z tych samych szumów (terrainSampler), las tylko tam, gdzie generator daje las.
- [x] 0.94.0: roślinność pustyni z 0 A.D. (palmy w oazach jako las, uschnięte palmy, krzewy, suche trawy). (Michał 3.11.2026, 12:56: „najpierw WebGPU, potem to, co da efekty”)
- [ ] **Pustynia: palmy, suche krzewy, przesuszone trawy** z 0 A.D. (repozytorium github.com/0ad/0ad, CC BY-SA 3.0):
  palmy `meshes/gaia/palm_date_new_{1..6}.dae` (tekstury `palm_date_new_1/2.png` + `_norm`), uschnięte `palm_dead_{1..5}`
  (`palm_dead.png`), krzewy `bush_dese_a_{1,2}` (`bush_dese_a.dds`, suche `bush_dese_dry_{a,b,c}.dds`),
  `wrld_plant_bush_dry{1..3}` (`wrld_plant_bush_dry_a.dds`), `plant_desert_0{1,2}` (`bush_desert_{a..d}.dds`), trawy
  `grass_large_2_tall` (`grass_steppe.png`), `grass_la_tall_{a,b}` (`grass_field_dry_a.dds`), `cross_large_{short,tall}`
  (`grass_field_dry_b.dds`). Palmy jako `TreeKind` (pień = trójkąty o pełnej masce tekstury, korona = reszta; z daleka
  cały model), na pustyni zamiast drzew lasu (oazy, gaje przy zamkach, drzewka leśniczego). Kaktusów w 0 A.D. nie ma
  (rośliny z Ameryk) — jeśli Michał dalej chce, szukać paczki CC0 w tym samym, nie bajkowym stylu.
- [ ] **Krawędź mapy bez kwadratu** (Michał 12:48): góry, las, piach i trawa mają płynąć dalej za granicę gry — generator
  nie może patrzeć, gdzie kończy się plansza. Pomysł (generator 11): masywy gór z szumu w całym świecie (nie pas przy
  krawędzi), przy każdym zamku gwarantowany masyw na kopalnię w zasięgu; teren za mapą liczony tymi samymi szumami co
  plansza (las w plamach, góry, piach), a nie ściana puszczy i osobne pasma.
- [ ] **Większa mapa 1 na 1** (np. 240 pól zamiast 192) — tylko od nowego generatora (stare zapisy na starym rozmiarze).
- [ ] Trawa i krzewy z powrotem (gęste, z paczek), gęstsza siatka całego terenu przy kamerze, więcej warstw ziemi
  (po WebGPU — tablica tekstur).

## Uwagi do sprawdzenia
- Wydajność: płaskowyże nie dokładają trójkątów (ta sama siatka planszy), skałki to pola gór; śnieg to jedna pula punktów.
- Boty: krainy nie zmieniają zasad, ale skałki i urwiska zabierają miejsce — bot szuka miejsc jak dotąd (placement).
