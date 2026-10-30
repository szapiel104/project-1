import type { ChangeEntry } from './changelogTypes';
export const CHANGES_A: ChangeEntry[] = [
  {
    v: '0.68.5', date: '2026-10-30',
    pl: [
      'Zapasy na start mieszczą się w spichlerzu z zapasem miejsca, więc robotnicy nie stoją od pierwszej minuty.',
      'Kopalnia daje mniej z jednego kursu: kamień 10 → 7, żelazo 7 → 5, ruda 6 → 4.',
      'Przy stawianiu koksownika na wieży jej dach na chwilę znika, żeby było widać kosz na pomoście.',
    ],
    en: [
      'Starting supplies now fit in the granary with room to spare, so workers no longer idle from the first minute.',
      'Mines yield less per trip: stone 10 → 7, iron 7 → 5, ore 6 → 4.',
      'When placing a brazier on a tower, its roof hides for a moment so you can see the basket on the platform.',
    ],
  },
  {
    v: '0.68.4', date: '2026-10-30',
    pl: [
      'Po materiał na budowę i drogę robotnicy idą do składu, w którym ten surowiec naprawdę leży, a nie do bliższego, pustego.',
      'Przy planowaniu muru i palisady podpowiedź mówi, czemu pole jest czerwone (głaz, wróg, zamknięci ludzie).',
      'Drewniana wieża wbudowana w kamienny mur nie ma już krzywej drabiny do ziemi; wchodzi się z korony muru.',
      'W spichlerzu i składzie każdy towar ma swoje miejsce na stosach, więc mięso znowu widać.',
    ],
    en: [
      'Builders now fetch materials from the store that actually holds them, not the nearest empty one.',
      'When planning walls and palisades, the tooltip explains why a tile is red: a boulder, the enemy, or people being shut in.',
      'A wooden tower set into a stone wall loses its crooked ground ladder; you climb in from the wall walk.',
      'Every good gets its own spot on the granary and store piles, so meat is visible again.',
    ],
  },
  {
    v: '0.68.3', date: '2026-10-30',
    pl: ['Drewniana wieża postawiona na końcu muru nie stoi już na kamiennym bloku.'],
    en: ['A wooden tower placed at the end of a wall no longer sits on a stone block.'],
  },
  {
    v: '0.68.2', date: '2026-10-30',
    pl: [
      'Pracownik płonącego budynku rzuca robotę, gasi pożar jako pierwszy i potem wraca do pracy.',
      'Bez studni ludzie noszą wodę do gaszenia z jeziora albo rzeki (do 40 pól od pożaru).',
      'Mur w budowie nie ma już brązowych hałd ziemi na każdym polu.',
      'Koszt na kartach budowy: każdy surowiec na własnej tabliczce, czerwony, gdy cię nie stać.',
    ],
    en: [
      'The worker of a burning building drops everything, leads the bucket crew and returns to work afterwards.',
      'Without a well, the bucket crew fetches water from a lake or river up to 40 tiles from the fire.',
      'Walls under construction no longer have brown mounds of earth on every tile.',
      'Build cards show each cost on its own plate, turning red when you can’t afford it.',
    ],
  },
  {
    v: '0.68.1', date: '2026-10-30',
    pl: ['Nocą w grupie pochodnię niesie jeden chłop, a reszta idzie w jej świetle.'],
    en: ['At night, one peasant carries the torch for a group and the rest walk in its light.'],
  },
  {
    v: '0.68.0', date: '2026-10-30',
    pl: [
      'Głazy na łąkach blokują budowę i drogi. Z cechem inżynierów rozbijesz je za 10 rudy i dostaniesz 8 kamienia.',
      'Chłopi najpierw zajmują wolne chaty, a dopiero potem śpią w zamku.',
      'Koszt na kartach budowy jest większy i czytelniejszy.',
      'Chlew chowa dach po kliknięciu, a świnia ma ogonek tam, gdzie trzeba.',
    ],
    en: [
      'Boulders on the meadows now block buildings and roads. With an engineers’ guild you can break one for 10 ore and get 8 stone.',
      'Peasants move into free cottages first and only then sleep in the keep.',
      'Costs on build cards are larger and easier to read.',
      'The pigsty hides its roof when clicked, and the pig’s tail is back where it belongs.',
    ],
  },
  {
    v: '0.67.17', date: '2026-10-30',
    pl: [
      'Strażnik miejski nocą trzyma pochodnię w ręce, zamiast mieć ją wiszącą obok w powietrzu.',
      'W spacerze pochodnia nie wchodzi w ziemię, gdy patrzysz w dół.',
    ],
    en: [
      'The town guard now holds his torch in hand at night instead of it floating beside him.',
      'In walk mode your torch no longer sinks into the ground when you look down.',
    ],
  },
  {
    v: '0.67.16', date: '2026-10-30',
    pl: [
      'Łącznik kamiennego muru z wieżą ma ostrą teksturę zamiast rozmazanej.',
      'Mur na zboczu schodzi płynną pochylnią zamiast schodkami.',
      'Drabina w narożniku muru rysuje się raz, a nie podwójnie.',
    ],
    en: [
      'The joint between a stone wall and a tower has a crisp texture instead of a smeared one.',
      'Walls on slopes now follow a smooth incline rather than little steps.',
      'A ladder in a wall corner is drawn once, not twice.',
    ],
  },
  {
    v: '0.67.15', date: '2026-10-30',
    pl: ['Mag Płomienia trzyma w dłoni migoczący ogień zamiast świecącej kuli.'],
    en: ['The Flame Mage now holds a flickering flame in his hand rather than a glowing orb.'],
  },
  {
    v: '0.67.14', date: '2026-10-30',
    pl: [
      'Liczby obrażeń i leczenia pojawiają się prosto nad głową i lecą w górę, a nie nadlatują z boku.',
      'Wokół leczonego krążą dwie świetliste kulki w kolorze maga.',
      'Zniknął róg wojenny przy ostrzeżeniu o wrogu, bo brzmiał jak podmuch wiatru.',
    ],
    en: [
      'Damage and healing numbers now appear right above the head and rise straight up, not drift in from the side.',
      'Two small glowing motes circle anyone a mage is healing, in that mage’s colours.',
      'The war horn on enemy warnings is gone, as it sounded like a gust of wind.',
    ],
  },
  {
    v: '0.67.13', date: '2026-10-30',
    pl: [
      'Z ustawień zniknęła rozdzielczość 1,5×, która na szerokich monitorach mocno obciążała kartę. Najwyżej jest teraz 1,25×.',
    ],
    en: [
      'The 1.5× resolution option is gone, as it overloaded graphics cards on wide monitors. The maximum is now 1.25×.',
    ],
  },
  {
    v: '0.67.12', date: '2026-10-30',
    pl: [
      'Jednego rannego leczy najwyżej jeden mag, reszta zajmuje się kolejnymi.',
      'Zabity czarem wody leży zamrożony, a nie spalony.',
      'Mag pali ciała z ogniem w uniesionych dłoniach, bez latających kul.',
      'Krótsze wczytywanie dużych osad: budynki i mury przygotowują się wcześniej, bez przycięcia na starcie.',
    ],
    en: [
      'Only one mage heals a given wounded soldier; the others tend to the next.',
      'Anyone slain by water magic lies frozen, not burnt.',
      'Mages now burn bodies with fire raised in their hands, with no flying orbs.',
      'Large settlements load faster: buildings and walls are prepared earlier, so there’s no stutter at the start.',
    ],
  },
  {
    v: '0.67.11', date: '2026-10-30',
    pl: [
      'Magowie leczą sojuszników poza walką: 2 zdrowia na sekundę, po jednym rannym, do 4 pól obok.',
      'Palenie ciał wygląda lepiej: ciało płonie, czernieje i rozsypuje się w popiół (6 s).',
    ],
    en: [
      'Mages heal allies out of combat: 2 health per second, one wounded at a time, within 4 tiles.',
      'Burning bodies looks better: the corpse catches fire, blackens and crumbles to ash over 6 seconds.',
    ],
  },
  {
    v: '0.67.10', date: '2026-10-30',
    pl: ['Stawianie budynku nie przycina już gry na sekundę czy dwie.'],
    en: ['Placing a building no longer freezes the game for a second or two.'],
  },
  {
    v: '0.67.9', date: '2026-10-30',
    pl: ['Mniej przycięć przy pierwszym stawianiu nowego rodzaju budynku.'],
    en: ['Fewer stutters the first time you place a new kind of building.'],
  },
  {
    v: '0.67.8', date: '2026-10-30',
    pl: [
      'Mag Płomienia ma przełącznik „Palenie ciał”: sam pali ciała do 12 pól, gdy nie ma wroga w pobliżu.',
      'W ustawieniach grafiki „Trawa” to teraz „Szczegóły w oddali”, bo właśnie za to odpowiada.',
    ],
    en: [
      'The Flame Mage gains a “Burn bodies” toggle: with no enemy near, he cremates bodies up to 12 tiles away.',
      'The “Grass” graphics option is now called “Distant detail”, which is what it actually controls.',
    ],
  },
  {
    v: '0.67.7', date: '2026-10-30',
    pl: [
      'Trafiony strzałą albo czarem rusza na strzelca razem z bezczynnymi towarzyszami, zamiast stać i ginąć.',
      'Zabici ogniem leżą zwęgleni.',
      'Polegli magowie leżą każdy w swoim miejscu.',
      'Panel wojska przy jednym rodzaju jednostek pokazuje jej nazwę i liczbę.',
    ],
    en: [
      'Units struck by arrows or spells now charge the shooter with idle comrades nearby instead of standing and dying.',
      'Those killed by fire lie charred.',
      'Fallen mages each lie where they fell.',
      'With one unit type selected, the army panel shows its name and count.',
    ],
  },
  {
    v: '0.67.6', date: '2026-10-30',
    pl: [
      'Po aktualizacji gra nie zamarza na 2–3 s przy wczytywaniu: miniatury budynków rysują się w tle już w trakcie gry.',
      'Głazy bez czarnych trójkątów na bokach.',
    ],
    en: [
      'After an update the game no longer freezes for 2–3 s while loading; building thumbnails are drawn in the background during play.',
      'Boulders no longer show black triangles on their sides.',
    ],
  },
  {
    v: '0.67.5', date: '2026-10-30',
    pl: [
      'Wczytywanie jest dużo krótsze i przeglądarka już przy nim nie zamarza (wcześniej nawet ok. 10 s).',
    ],
    en: [
      'Loading is much quicker and no longer locks up the browser (previously for up to about 10 seconds).',
    ],
  },
  {
    v: '0.67.4', date: '2026-10-30',
    pl: ['Głazy na łąkach stoją na ziemi, a nie wiszą nad nią, i są mniej kanciaste.'],
    en: ['Meadow boulders now rest on the ground rather than hovering, and look less blocky.'],
  },
  {
    v: '0.67.3', date: '2026-10-30',
    pl: ['Liczby obrażeń trzymają się trafionego i nie płyną razem z kamerą.'],
    en: ['Damage numbers stay pinned to whoever was hit instead of sliding with the camera.'],
  },
  {
    v: '0.67.2', date: '2026-10-30',
    pl: ['Ikony czarów magów są równej wielkości i narysowane od nowa, a wielki czar wyróżnia złota ramka.'],
    en: ['Mage spell icons are now the same size and freshly drawn, with a gold frame marking the great spell.'],
  },
  {
    v: '0.67.1', date: '2026-10-30',
    pl: [
      'Pasek czarów maga jak w RPG: zwykły i wielki czar z odliczaniem odnowienia i złotą ramką, gdy są gotowe.',
      'Przy kilku magach widać, ilu ma czar gotowy, a dymek podaje obrażenia i czas odnowienia.',
    ],
    en: [
      'An RPG-style spell bar for mages: basic and great spells with a cooldown sweep and a gold frame when ready.',
      'With several mages selected you see how many are ready, and the tooltip lists damage and cooldown.',
    ],
  },
  {
    v: '0.67.0', date: '2026-10-30',
    pl: [
      'Tarcza nie zatrzymuje czarów, a strzały z przodu osłabia już tylko o 1/3.',
      'Łucznik: cios 7 → 9, strzał co 2 s i dużo celniej z daleka.',
      'Mag ognia: kula 26 → 36 z odpryskiem na sąsiadów. Mag wody: 15 → 26.',
      'Zbrojny: zdrowie 120, cios 15, zbroja 30%; walczący nie gonią bez końca uciekających rannych.',
    ],
    en: [
      'Shields no longer stop spells and only reduce frontal arrows by a third.',
      'Archer: damage 7 → 9, a shot every 2 s, and far better aim at long range.',
      'Fire mage: fireball 26 → 36 with splash on neighbours. Water mage: 15 → 26.',
      'Man-at-arms: 120 health, 15 damage, 30% armour; melee fighters no longer chase fleeing wounded forever.',
    ],
  },
  {
    v: '0.66.1', date: '2026-10-29',
    pl: ['Chlew słabszy: 3 mięsa co 180 ticków, wystarcza na ok. 4–5 osób.'],
    en: ['The pigsty is weaker: 3 meat every 180 ticks, enough for about 4–5 people.'],
  },
  {
    v: '0.66.0', date: '2026-10-29',
    pl: [
      'Nowy budynek: chlew (35 drewna). Świniopas tuczy świnie i odnosi do spichlerza mięso.',
      'Mięso to nowe jedzenie: syci jak ryba, a w spichlerzu i u tragarzy widać szynkę, boczek i kiełbasę.',
      'Różnorodne jedzenie podnosi popularność: +1 za każdy kolejny rodzaj, najwyżej +3.',
      'Bot też stawia chlew.',
    ],
    en: [
      'New building: the pigsty (35 wood). The swineherd fattens pigs and brings meat to the granary.',
      'Meat is a new food as filling as fish; you’ll see ham, bacon and sausages in the granary and on carriers.',
      'A varied diet raises popularity: +1 for each extra kind of food, up to +3.',
      'The AI lords build pigsties too.',
    ],
  },
  {
    v: '0.65.28', date: '2026-10-29',
    pl: [
      'Rannych widać po plamach krwi na ubraniu, im ciężej ranny, tym więcej.',
      'Po ciosie ostrze miecza i grot włóczni są przez ok. 40 s zakrwawione.',
    ],
    en: [
      'The wounded now show bloodstains on their clothes, more as their health drops.',
      'After a blow, sword blades and spear tips stay bloodied for about 40 seconds.',
    ],
  },
  {
    v: '0.65.27', date: '2026-10-29',
    pl: ['Łucznik nosi zielony, leśny kaptur, a barwy pana zostały na przeszywanicy.'],
    en: ['Archers now wear a green woodland hood, with their lord’s colours kept on the gambeson.'],
  },
  {
    v: '0.65.26', date: '2026-10-29',
    pl: [
      'Deszcz ognia nie zlewa się w białą plamę, widać pojedyncze kule, iskry i dym.',
      'Fala po uderzeniu czaru nie chowa się pod ziemię na zboczu.',
    ],
    en: [
      'Rain of Fire no longer blurs into a white blob; you can see each fireball, sparks and smoke.',
      'The shockwave of a spell no longer sinks into hillsides.',
    ],
  },
  {
    v: '0.65.25', date: '2026-10-29',
    pl: ['Trzy nowe odmiany głazów polnych, ciemniejsze i matowe, z porostami.'],
    en: ['Three new kinds of field boulder: darker, matt and speckled with lichen.'],
  },
  {
    v: '0.65.24', date: '2026-10-29',
    pl: [
      'Wielki czar magów jest mocniejszy: promień 2 pól, ogień 2,2 raza silniejszy od zwykłej kuli.',
      'Deszcz ognia pali dwa razy dłużej, lodowy krąg spowalnia ok. 26 s, a po czarze mag odpoczywa minutę.',
    ],
    en: [
      'The mages’ great spell is stronger: 2-tile radius, fire hitting 2.2× harder than a normal fireball.',
      'Rain of Fire burns twice as long, the ice ring slows for about 26 s, and the mage then rests for a minute.',
    ],
  },
  {
    v: '0.65.23', date: '2026-10-29',
    pl: [
      'Towar w magazynach i spichlerzach leży warstwami jeden na drugim, bez szpar.',
      'Namiot polowy: drobniej tkane płótno i można do niego wejść w spacerze.',
    ],
    en: [
      'Goods in stores and granaries now stack neatly on top of each other, with no gaps.',
      'Field tent: finer canvas weave, and you can walk inside it in walk mode.',
    ],
  },
  {
    v: '0.65.22', date: '2026-10-29',
    pl: [
      'Strażników kopalni (dwóch) ma tylko barak, który obsługuje kopalnię, więc kilka baraków nie daje już darmowej armii.',
      'Okno baraku pokazuje, ilu strażników mu przysługuje.',
    ],
    en: [
      'Only the barracks actually serving a mine gets its two mine guards, so extra barracks no longer mean a free army.',
      'The barracks window shows how many guards it’s entitled to.',
    ],
  },
  {
    v: '0.65.21', date: '2026-10-29',
    pl: [
      'Nowe strzały, o połowę krótsze, z żelaznym grotem i lotkami z piór.',
      'Z kołczanu łucznika wystają prawdziwe strzały z lotkami.',
    ],
    en: [
      'New arrows, half the old length, with iron heads and feather fletching.',
      'Proper fletched arrows now poke out of the archer’s quiver.',
    ],
  },
  {
    v: '0.65.20', date: '2026-10-29',
    pl: ['Drzewa sadzone przez leśniczego stoją w ziemi, a nie na niej.'],
    en: ['Trees planted by foresters now sit in the ground rather than on top of it.'],
  },
  {
    v: '0.65.19', date: '2026-10-29',
    pl: ['Czytelniejsza czcionka w oknach, podpowiedziach i menu, zwłaszcza przy małych napisach.'],
    en: ['A clearer font in windows, tooltips and menus, especially at small sizes.'],
  },
  {
    v: '0.65.18', date: '2026-10-29',
    pl: [
      'Rudery nie mają już wokół siebie prostokąta ubitej ziemi.',
      'Na dziedzińcu zamku i przy koszarach stoją okrągłe słomiane kukły do ćwiczeń.',
    ],
    en: [
      'Hovels no longer sit on a rectangle of bare earth.',
      'Round straw training dummies now stand in the castle yard and by the barracks.',
    ],
  },
  {
    v: '0.65.17', date: '2026-10-29',
    pl: [
      'Płomienie w kopalni mają pod sobą prawdziwe pochodnie w uchwytach.',
      'Ściany przejazdu kamiennej bramy już nie migają.',
    ],
    en: [
      'Flames in the mine now burn on proper torches in iron brackets.',
      'The passage walls of the stone gatehouse no longer flicker.',
    ],
  },
  {
    v: '0.65.16', date: '2026-10-29',
    pl: ['Pochodnia w spacerze płonie całą głowicą, a nie wąskim płomykiem.'],
    en: ['Your torch in walk mode now burns across the whole head, not just a thin flicker at the tip.'],
  },
  {
    v: '0.65.15', date: '2026-10-29',
    pl: ['Pasek wczytywania meczu nie skacze w miejscu i idzie tylko do przodu, a wejście do gry jest krótsze.'],
    en: ['The match loading bar no longer jumps back and forth, only moves forward, and you get into the game sooner.'],
  },
  {
    v: '0.65.14', date: '2026-10-29',
    pl: ['Ekran wczytywania nie wspomina już o trawie, której i tak nie ma.'],
    en: ['The loading screen no longer mentions grass that isn’t there.'],
  },
  {
    v: '0.65.13', date: '2026-10-29',
    pl: ['Ludzie idący tą samą drogą nie wchodzą jeden w drugiego.'],
    en: ['People walking the same road no longer pass through each other.'],
  },
  {
    v: '0.65.12', date: '2026-10-29',
    pl: [
      'Krawężniki brukowanej drogi są niższe i z drobniejszych kamieni.',
      'Ognisko w obozowisku to nierówna kupka popiołu z żarzącymi się węglami.',
    ],
    en: [
      'Cobbled road kerbs are lower and made of smaller stones.',
      'The camp fire is now an uneven heap of ash with glowing embers.',
    ],
  },
  {
    v: '0.65.11', date: '2026-10-29',
    pl: [
      'Magowie bez wroga w zasięgu biorą się za najbliższy wrogi budynek, zamiast stać bezczynnie.',
      'Wejście na wieżę jest płynne, a w kamiennej wieży żołnierz wychodzi z klatki schodowej.',
    ],
    en: [
      'With no foes in sight, mages now attack the nearest enemy building instead of standing idle.',
      'Climbing onto towers is smooth, and in stone towers soldiers emerge from the stairwell.',
    ],
  },
  {
    v: '0.65.10', date: '2026-10-29',
    pl: ['Wilki zostawiają na śniegu ślady łap.'],
    en: ['Wolves leave paw prints in the snow.'],
  },
  {
    v: '0.65.9', date: '2026-10-29',
    pl: [
      'Na mrozie ludziom leci para z ust.',
      'Zimą rybak łowi o połowę mniej, a skryba ostrzega o tym przed zimą.',
      'Chłopi i wilki też krwawią, gdy są ranni.',
    ],
    en: [
      'In freezing weather you can see people’s breath.',
      'In winter the fisherman catches half as much, and the scribe warns you beforehand.',
      'Peasants and wolves now bleed when wounded, too.',
    ],
  },
  {
    v: '0.65.8', date: '2026-10-29',
    pl: ['Strażnicy miejscy poza walką sami się goją: 1 zdrowia co 2 s, na swoim posterunku.'],
    en: ['Town guards heal out of combat: 1 health every 2 s, right at their post.'],
  },
  {
    v: '0.65.7', date: '2026-10-29',
    pl: [
      'Przy trafieniu pryska krew, tym więcej, im mocniejszy cios.',
      'Ciężko ranny żołnierz gubi krople krwi, idąc.',
    ],
    en: [
      'Blood sprays on every hit, more for heavier blows.',
      'Badly wounded soldiers leave a trail of blood drops as they walk.',
    ],
  },
  {
    v: '0.65.6', date: '2026-10-29',
    pl: ['Boczne wejścia do kamiennych wież mają prawdziwe okute drzwi zamiast czarnego prostokąta.'],
    en: ['Side entrances to stone towers now have proper iron-bound doors instead of a black rectangle.'],
  },
  {
    v: '0.65.5', date: '2026-10-29',
    pl: [
      'Łącznik muru z wieżą jest z kamienia, a nie czarny; na każdy bok wieży przypada jedno wejście.',
      'Żołnierze wchodzący na wieżę nie doskakują już na swoje miejsce.',
      'Ognisko w obozowisku ma trójnóg z kociołkiem nad ogniem.',
    ],
    en: [
      'The wall-to-tower joint is now stone rather than black, with one entrance per tower side.',
      'Soldiers climbing a tower no longer hop into place.',
      'The camp fire has a tripod with a cauldron hanging over it.',
    ],
  },
  {
    v: '0.65.4', date: '2026-10-28',
    pl: [
      'Nowa jednostka: drabiniarz (drabina szturmowa + 6 rudy). Przystawia drabiny do wrogiego muru, po których wchodzi całe wojsko.',
      'Po przystawieniu biegnie po następną drabinę do zamku albo namiotu polowego.',
      'Bot szkoli drabiniarzy, gdy masz kamienny mur.',
    ],
    en: [
      'New unit: the ladderman (siege ladder + 6 ore). He props ladders against enemy walls for your whole army to climb.',
      'Once a ladder is up, he runs back to the keep or field tent for another.',
      'The AI trains laddermen when you have stone walls.',
    ],
  },
  {
    v: '0.65.3', date: '2026-10-28',
    pl: ['Wyraźnie płynniejsza gra w lesistych okolicach: o 43% mniej do narysowania w każdej klatce.'],
    en: ['Noticeably smoother play around woodland: 43% less to draw every frame.'],
  },
  {
    v: '0.65.2', date: '2026-10-28',
    pl: ['Strzały wbite w ściany znikają razem z budynkiem, a nie wiszą w powietrzu.'],
    en: ['Arrows stuck in walls now vanish with the building rather than hanging in mid-air.'],
  },
  {
    v: '0.65.1', date: '2026-10-28',
    pl: [
      'Nowy budynek: warsztat cieśli (40 drewna). Z 3 drewna robi drabinę szturmową i odnosi ją do zbrojowni.',
      'Wejście drabiną na wrogi mur zużywa drabinę ze zbrojowni; bez drabin trzeba szukać innej drogi.',
      'Bot też stawia warsztat cieśli.',
    ],
    en: [
      'New building: the carpenter’s workshop (40 wood). It turns 3 wood into a siege ladder for the armoury.',
      'Scaling an enemy wall now uses up a ladder from the armoury; without one, find another way in.',
      'The AI builds carpenter’s workshops too.',
    ],
  },
  {
    v: '0.65.0', date: '2026-10-28',
    pl: [
      'Drabiny oblężnicze jak w Twierdzy: żołnierze przystawiają je do kamiennego muru, a obrońcy mogą je zepchnąć.',
      'Gdy front wieży jest zasłonięty, pojawia się drugie wejście z innej strony.',
      'Z korony muru na pomost drewnianej wieży prowadzi krótka drabina.',
    ],
    en: [
      'Siege ladders, Stronghold-style: soldiers prop them against stone walls, and defenders can push them away.',
      'If a tower’s front is blocked, a second entrance appears on another side.',
      'A short ladder now leads from the wall walk up to a wooden tower’s platform.',
    ],
  },
  {
    v: '0.64.11', date: '2026-10-28',
    pl: [
      'Po bitwie strzały zostają wbite w ziemię, ściany i polegli, a znikają po 90 s.',
      'Na krzyżach leśnych grobów siadają kruki.',
    ],
    en: [
      'After battle, arrows remain stuck in the ground, walls and the fallen, fading after 90 seconds.',
      'Ravens now perch on the crosses of woodland graves.',
    ],
  },
  {
    v: '0.64.10', date: '2026-10-28',
    pl: [
      'Plama krwi kładzie się na zboczu, zamiast chować się w ziemi.',
      'Ślady butów widać tylko na prawdziwym śniegu, nie na wiosennej trawie.',
    ],
    en: [
      'Bloodstains now follow the slope instead of disappearing into it.',
      'Footprints only appear in proper snow, not on spring grass.',
    ],
  },
  {
    v: '0.64.9', date: '2026-10-28',
    pl: ['Mniej krwi pod poległymi: mniejsza, ciemniejsza plama.'],
    en: ['Less blood under the fallen: a smaller, darker pool.'],
  },
  {
    v: '0.64.8', date: '2026-10-28',
    pl: [
      'Mur kamienny dochodzi do kamiennej wieży bez szpary, a w ścianie wieży jest wejście.',
      'Z muru na pomost wieży żołnierz przechodzi schodami w środku.',
    ],
    en: [
      'Stone walls now meet stone towers with no gap, and the tower has a doorway at wall height.',
      'Soldiers go from the wall walk to the tower platform by the stairs inside.',
    ],
  },
  {
    v: '0.64.7', date: '2026-10-28',
    pl: [
      'Kępy trawy są na razie wyłączone, łąka zostaje z teksturą.',
      'Lobby gry sieciowej wczytuje się bez skakania okna.',
    ],
    en: [
      'Grass tufts are switched off for now; the meadow keeps its ground texture.',
      'The multiplayer lobby now loads without the window jumping about.',
    ],
  },
  {
    v: '0.64.6', date: '2026-10-28',
    pl: [
      'Żołnierze wspinają się po drabinach, a w kamiennych wieżach chodzą schodami.',
      'Wróg, który wedrze się do osady, może wejść na wieżę i ściąć łuczników.',
      'Nowa wieża sama obraca wejście na wolną stronę, gdy z przodu stoi mur.',
      'Łatwiej kliknąć wieżę i mur: prawy klik wysyła wojsko na górę.',
    ],
    en: [
      'Soldiers now climb ladders, and use the stairs inside stone towers.',
      'An enemy who breaks into your settlement can climb a tower and cut down the archers.',
      'A new tower turns its entrance to a free side if a wall blocks the front.',
      'Towers and walls are easier to click: a right click sends troops up top.',
    ],
  },
  {
    v: '0.64.5', date: '2026-10-28',
    pl: [
      'Krew pod poległym to nieregularna plama, która rozlewa się przez ok. 20 s i z czasem ciemnieje.',
    ],
    en: [
      'Blood beneath the fallen is now an irregular pool that spreads over about 20 seconds and darkens with time.',
    ],
  },
  {
    v: '0.64.4', date: '2026-10-28',
    pl: [
      'Im większa wieża, tym dalej strzela łucznik: od 10 pól z czatowni do 17 z wielkiej baszty.',
      'Z wieży widać tak daleko, jak z niej się strzela.',
    ],
    en: [
      'The bigger the tower, the further archers shoot: from 10 tiles on a lookout to 17 on a great tower.',
      'Archers on a tower can now see as far as they can shoot.',
    ],
  },
  {
    v: '0.64.3', date: '2026-10-28',
    pl: [
      'Poduszki w komnacie pana leżą jak należy.',
      'Ciała poległych nie leżą bez końca, po ok. 10 minutach znikają.',
    ],
    en: [
      'The pillows in the lord’s chamber are now arranged properly.',
      'Bodies no longer lie about forever; they decay after about 10 minutes.',
    ],
  },
  {
    v: '0.64.2', date: '2026-10-28',
    pl: [
      'Rudery mają porządne wejście ze zwiniętą skórą, bez prześwitującego nieba w szparach.',
      'Ognisko przed namiotem to kupka popiołu z polanami ułożonymi w gwiazdę.',
    ],
    en: [
      'Hovels get a proper doorway with a rolled-up hide, and no more sky showing through the gaps.',
      'The fire outside the tent is now a heap of ash with logs laid in a star.',
    ],
  },
];
