# Magazyny — logika (od 0.52.0, 27.10.2026)

Zasada Michała: magazyny to „piękna gra” — prawdziwa logistyka, nic nie znika w powietrzu, a gracz zawsze widzi,
co się dzieje (nad magazynem, w oknie magazynu i u skryby). Przy tym ma to nie obciążać gry w przeglądarce.

## Rodzaje i pojemność

| Magazyn | Co trzyma | Ile | Magazynierów |
|---|---|---|---|
| Skład | drewno, kamień, żelazo, piwo | 200 | 1 |
| Stodoła | jak skład (250) + zboże: pszenica i mąka (200) | 250 + 200 | 2 |
| Spichlerz | jabłka, chleb, ryby | 400 | 1 |
| Duży spichlerz | jak spichlerz | 1200 | 2 |
| Zbrojownia | włócznie, łuki, miecze, kolczugi | 60 | 1 |

Zapasy gracza są jedną sumą (`PlayerState.res`, `storeCapacity`, `storeRoom` w `sim/state.ts`) — z niej korzysta cała gra.
Od 0.52.1 każdy magazyn wie też, co leży w nim samym (`Building.stock`, `sim/systems/stock.ts`):
- towar wnoszony przez drzwi trafia do tego magazynu, ile się w nim zmieści; robotnik idzie do magazynu, w którym jest
  miejsce na jego towar (a gdy wszystkie pełne — do najbliższego i zostawia towar pod drzwiami);
- po surowiec (młyn, piekarnia…) idzie się do magazynu, w którym on leży, i stamtąd go ubywa;
- resztę zmian sumy (zjedzone racje, zapłata za budynek, łup, wozy, rozkradzione w buncie) wyrównuje `syncStock` w każdym
  kroku: ubytek z magazynów, w których leży najwięcej, przybytek do magazynów z miejscem po kolei;
- okno magazynu pokazuje zawartość tego jednego budynku, a pod nią sumę ze wszystkich magazynów tego rodzaju;
  stosy w modelu magazynu też rosną z jego własnej zawartości.
Ruda (waluta) nie leży w magazynach — trafia do skarbca w twierdzy.

## Pełny magazyn

1. Robotnik dochodzi z towarem do magazynu i oddaje tyle, ile się zmieści.
2. Reszta zostaje **pod drzwiami** jako stos (`Pile` w `GameState.piles`): ten sam towar pod tym samym magazynem
   trafia na jeden stos. Stos leży naprawdę — widać go (render/piles.ts) i jest w zapisie gry.
3. Warsztat dostaje `stall` (towar, na który czeka). Robotnik wraca i **czeka w warsztacie** (`Phase.Stalled`):
   nie robi kolejnego towaru i nie nosi następnych ładunków.
4. Co 20 ticków sprawdza, czy zwolniło się miejsce (`stalledStep`). Gdy tak:
   - jeśli pod magazynami leży jeszcze jego towar, a jest wolny magazynier — czeka, aż magazynier go wniesie;
   - jeśli wolnego magazyniera nie ma — sam idzie po stos i wnosi go (`Phase.ToPile`);
   - gdy stosów już nie ma — wraca do zwykłej pracy.
5. Bez żadnego magazynu danego rodzaju towar zostaje na ziemi tam, gdzie robotnik stał; nowy magazyn go przejmie.

Miejsce liczone jest razem z tym, co już jest w drodze (`roomLeft`): stosy, po które ktoś idzie, i ładunki niesione do
magazynów — żeby na jedno wolne miejsce nie poszło trzech ludzi.

## Magazynierzy

- Obsada stała: mały magazyn 1, duży 2 (`keepers` w `data/buildings.ts`).
- Najniższy priorytet: magazynierem zostaje tylko ktoś, kto stoi bezczynnie przy ognisku.
- **Rezerwa rąk do pracy** (`spareKeeper`): warsztat bez pracownika, koszary (rekrut), straż, straż kopalni i budowa
  biorą wolnego magazyniera, gdy przy ognisku nikogo nie ma. Dlatego magazynierzy liczą się do miejsc przy ognisku
  (`idleCount`) i odchodzą z osady jak bezrobotni — inaczej każdy magazyn ściągałby nowych ludzi za darmo.
- Rozdzielanie (`storageSystem`, co 10 ticków, tylko gdy leży jakiś stos): najstarszy stos pierwszy, na każdy stos
  **jeden** człowiek (`Pile.claim`) — najpierw magazynier z magazynu, pod którym stos leży, potem najbliższy.
  Magazyny „rozmawiają ze sobą”: jedna lista stosów i jedno rozdzielanie dla wszystkich magazynów gracza.
- Tragarz, który rzucił zadanie (wieczór, choroba, śmierć), zwalnia stos dla następnego.
- W wolnej chwili magazynier wynosi gruz z rozbiórek (najwyżej jeden magazynier na rozbiórkę, `rubble.ts`).
- Wieczorem i w nocy magazynierzy mają fajrant jak wszyscy.

## Co widzi gracz

- **Na mapie:** stosy ułożone wzdłuż ściany po obu stronach wejścia (paleta z workami, koszami, beczkami; deski w sztaplu
  z przekładkami) i znak nad magazynem: tarcza ze skrzynią i czerwonym wykrzyknikiem. Robotnik czeka w warsztacie
  (siedzi w środku albo stoi na skraju pola).
- **Okno magazynu** (`ui/storePanel.ts`): magazynierzy i co robią, towar pod drzwiami, towar pod innymi magazynami,
  które warsztaty czekają na miejsce i co z tym zrobić.
- **Okno warsztatu:** „Pełny skład — deski leżą pod drzwiami magazynu, a pracownik czeka…”.
- **Skryba** (`ui/storeNotes.ts`): jedna wiadomość na każde zapełnienie (kto stoi, co leży, co postawić, przycisk
  „Pokaż”) i jedna, gdy magazyn znów ma miejsce. Wszystko trafia też do kroniki skryby.
- **Bot** stawia kolejny skład, stodołę albo zbrojownię, gdy jego warsztaty czekają (pełny spichlerz to dużo jedzenia — tego nie rusza).

## Wydajność

- Bez stosów: `storageSystem` kończy się na sprawdzeniu długości listy; renderer też nic nie robi.
- Czekający robotnik sprawdza miejsce co 20 ticków, a nie w każdym kroku.
- Stos na mapie to jedna siatka z grupami materiałów (2–3 wywołania rysowania), geometria wspólna dla stosów o tym samym
  towarze i wielkości, przebudowa tylko przy zmianie wielkości.
- Do zrobienia, gdyby przy 4 na 4 było widać koszt: `roomLeft` przechodzi po wszystkich chłopach gracza — można trzymać
  licznik ładunków w drodze na gracza (patrz `docs/pomysly.md`, „Płynność”).
