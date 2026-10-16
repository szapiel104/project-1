/**
 * Odzywki ludzi w osadzie: krótko, szorstko, po chłopsku, w duchu Gothica. Klucz = sytuacja albo zajęcie
 * (id budynku z data/buildings.ts). Dobiera je main.ts (lineFor / sayGuard / chatter).
 */
export const SAY: Record<string, string[]> = {
  // --- bez zajęcia i przy zwykłej robocie ---
  idle: [
    'Czego?', 'Roboty by się znalazło jakiej…', 'Siedzę i czekam. Jak każdy.', 'Panie, daj jaką robotę.', 'Zimno przy tym ognisku.',
    'Ręce mam, siły mam, roboty nie mam.', 'Słyszałem, że u drwala potrzebują ludzi.', 'Patrzę, jak inni robią. Też zajęcie.',
    'Jak nie ma roboty, to i grosza nie ma.', 'Postaw, panie, warsztat, a ja już się nim zajmę.', 'Nudno. Choć wilka by kto przegonił.',
  ],
  work: [
    'Robię, robię.', 'Nie przeszkadzaj, panie.', 'Robota sama się nie zrobi.', 'Ano, pracuje się.', 'Znowu ja?',
    'Od rana na nogach.', 'Jeszcze trochę i przerwa.', 'Pot leje się po plecach, a dzień długi.', 'Robota jak robota.',
    'Byle do wieczora.', 'Pan patrzy, to się staram.',
  ],
  // --- zajęcia (id budynku) ---
  woodcutter: [
    'Drzewa nie zetną się same.', 'Siekiera tępa jak wójt.', 'Las daleko, nogi bolą.', 'Uwaga, leci!', 'Sosna twarda, ale pęknie.',
    'Wiórów pełno w portkach.', 'W lesie coś łazi, słyszałem.', 'Jeszcze jeden pień i niosę do chaty.',
  ],
  quarry: [
    'Kamień i kamień. Całe życie.', 'Plecy mi pękną od tego.', 'Kopacz ma tylko kilof i zmęczone ręce.', 'Jeszcze jeden blok i zapiję.',
    'Pył w gardle jak piach.', 'Mury z tego kamienia postoją sto lat.', 'Raz źle trafić i palce w drzazgach.',
  ],
  mine: [
    'Ciemno tam jak w grobie.', 'Ruda sama nie wyjdzie.', 'Kopacz kopie, pan się bogaci.', 'Tylko żeby strop nie siadł.',
    'Żyła dobra, czerwona jak krew.', 'Pochodnia gaśnie, a ja dalej kuję.', 'Z tej rudy będzie żelazo na włócznie.',
  ],
  farm: [
    'Byle deszcz nie zbił zboża.', 'Ziemia dobra, tylko ręce bolą.', 'Pszenica rośnie, jak się jej nie przeszkadza.',
    'Wrony znowu w zbożu.', 'Kosa ostra, łan długi.', 'Bez chłopa w polu nie ma chleba w zamku.',
  ],
  orchard: [
    'Jabłka w tym roku jak pięść.', 'Robaki w połowie, ale jeść można.', 'Nie rwij zielonych, bo brzuch rozboli.',
    'Pszczoły dziś złe jak osy.', 'Drabina skrzypi, a ja wyżej nie wejdę.',
  ],
  fisher: [
    'Dziś nie biorą.', 'Woda zimna jak serce poborcy.', 'Szczupak urwał mi żyłkę, łajdak.', 'Cicho, bo wypłoszysz.',
    'Ryba lubi spokój. Jak ja.', 'Sieć dziurawa, ale coś złapie.',
  ],
  mill: [
    'Wiatr dobry, kamień mieli.', 'Mąka w nosie, mąka w uszach.', 'Bez młyna nie ma piekarza.', 'Skrzydła stanęły? Nie, kręcą.',
    'Worek za workiem, cały dzień.',
  ],
  bakery: [
    'Chleb prosto z pieca! Nie ruszaj, gorący.', 'Ciasto rośnie, ja nie.', 'Piec trzeba podsycić.', 'Pachnie, co? A jeść nie dam.',
    'Mąki mało, młynarz się guzdrze.',
  ],
  brewery: [
    'Chmiel dobry, piwo będzie mocne.', 'Kadź pełna, a ja trzeźwy. Wstyd.', 'Spróbować trzeba, żeby wiedzieć.',
    'Bez piwa chłopi by się dawno rozeszli.', 'Słód pachnie jak chleb, tylko lepiej.',
  ],
  tavern: [
    'Kto nie płaci, ten nie pije.', 'Ława wolna, siadaj.', 'Beczka prawie pusta, nieście drugą.', 'Wieczorem będzie tu tłoczno.',
    'Nie bić się przy szynkwasie!', 'Piwo dziś dobre, sam próbowałem.',
  ],
  fletcher: [
    'Strzała prosta jak sznurek.', 'Lotki z gęsiego pióra, najlepsze.', 'Łuk z cisu, cięciwa z jelita.', 'Łucznik bez strzał to pastuch.',
  ],
  poleturner: [
    'Drzewce równe, grot ostry.', 'Włócznia długa, wróg daleko.', 'Jeszcze ze trzy i odnoszę do zbrojowni.', 'Jesion najlepszy na drzewce.',
  ],
  engineers: [
    'Taran nie zbuduje się sam.', 'Liczymy, mierzymy, potem tniemy.', 'Ten mur padnie, zobaczysz.', 'Belka krzywa? To nie ja.',
  ],
  stockpile: [
    'Deski do desek, kamień do kamienia.', 'Kto tu tak naskładał?', 'Liczę, liczę, ciągle się nie zgadza.', 'Miejsca coraz mniej.',
  ],
  granary: [
    'Szczury znowu w zbożu.', 'Spichlerz pełny, głowa spokojna.', 'Na zimę starczy? Musi starczyć.', 'Suche, nie zawilgnie.',
  ],
  barn: ['Siano pod dach, zanim spadnie deszcz.', 'Stodoła duża, a i tak ciasno.'],
  cemetery: [
    'Każdy tu kiedyś trafi.', 'Kopię dół i nie gadam.', 'Niech mu ziemia lekką będzie.', 'Cicho tu. Lubię ciszę.',
  ],
  well: ['Woda czysta, zimna jak lód.', 'Wiadro, korba, wiadro, korba…'],
  // --- przy budowie i noszeniu ---
  build: [
    'Stuk, stuk, i stoi.', 'Kto to projektował, ten nie nosił belek.', 'Jeszcze jedna belka i fajrant.', 'Podaj młotek!',
    'Krzywo? Z daleka nie widać.', 'Jak się zawali, to nie moja wina.', 'Fundament pod linkę, reszta na oko.',
  ],
  carry: [
    'Ciężkie to cholerstwo.', 'Niosę, niosę.', 'Z drogi!', 'Uważaj, bo upuszczę!', 'Ramię mi odpadnie.', 'Jeszcze kawałek do składu.',
  ],
  // --- nastroje i sytuacje ---
  hungry: [
    'Głodno w osadzie, panie.', 'Brzuch mi do krzyża przyrasta.', 'Z pustym brzuchem nie popracuję.', 'Dzieci płaczą z głodu.',
    'Chleba by choć kromkę.', 'W spichlerzu wiatr hula.',
  ],
  angry: [
    'Podatki nas wykończą.', 'Inni pany lepiej płacą.', 'Jeszcze trochę i pójdę stąd.', 'Pan w zamku tłusty, a my chudzi.',
    'Gadają, że w sąsiedniej osadzie lepiej.', 'Długo tego nie zniesiemy.',
  ],
  night: [
    'Wilki dziś wyją, słyszysz?', 'Po ciemku lepiej nie łazić za palisadę.', 'Spać by się chciało.', 'Ciemno, choć oko wykol.',
    'Księżyc jasny, wilki śmiałe.', 'Pochodnia by się przydała.',
  ],
  wolves: ['Wilki! Ratujcie!', 'Bierz kij, idą!', 'Matko Boska, wilki!', 'Do chat, szybko!', 'Straż! Wilki pod osadą!'],
  wolvesNight: ['Słyszysz? Wyją za palisadą.', 'Nocą wilki podchodzą pod same chaty.', 'Drzwi zaryglować, wilki krążą.'],
  cold: [
    'Ale ziąb! Trzeba napalić w piecu.', 'Ręce mi grabieją, idę rozpalić ogień.', 'Mróz trzyma, drewna by więcej.',
    'Zimno jak w psiarni. Dorzuć do pieca!', 'Woda w wiadrze zamarzła.', 'Kto ma suche drwa? W chacie zimno.',
  ],
  coldNight: ['Napalę w piecu, bo do rana zamarzniemy.', 'Drzwi zamknąć, ogień podsycić i spać.', 'Pod dwiema derkami i dalej zimno.'],
  hot: ['Skwar nie do wytrzymania.', 'Wody! Gardło mam jak pieprz.', 'W taki upał to tylko w cieniu siedzieć.', 'Słońce praży, pot leje się strumieniem.'],
  rain: ['Leje i leje.', 'Błoto po kolana.', 'Przemokłem do kości.', 'Deszcz dobry dla zboża, zły dla mnie.', 'Pod dach by się schować.'],
  morning: [
    'Kur zapiał, trzeba wstawać.', 'Świt, a ja już na nogach.', 'Mgła rano gęsta jak mleko.', 'Nowy dzień, stara robota.',
    'Rosa na trawie, zimno w nogi.',
  ],
  evening: [
    'Do karczmy, chłopy!', 'Fajrant. Nareszcie.', 'Posiedzimy przy ogniu.', 'Nogi mi odpadają od tej roboty.', 'Kto stawia piwo?',
    'Opowiem wam, jak raz wilka gołymi rękami…', 'Słońce zachodzi, a my jeszcze żywi.',
  ],
  sleep: ['Ziew… pora do wyra.', 'Starczy na dziś.', 'Idę spać, jutro znowu harówka.', 'Dobranoc, panie.', 'Słoma czeka.'],
  sleeping: ['Chrrr…', 'Mmm… jeszcze chwilkę…', 'Chrrr… pchiii…', 'Mmm… piwa… jeszcze…'],
  outside: ['Ziemia twarda, a dachu ani śladu.', 'Na słomie pod gołym niebem, jak pies.', 'Postaw, panie, chatę, bo tu zimno.'],
  crowded: ['Ośmiu w jednej chacie, jak śledzie w beczce.', 'Kto chrapie, ten śpi na dworze!', 'Ciasno, panie, chat by trzeba więcej.'],
  taxHigh: [
    'Poborca znowu był. Zostawił mi guzik.', 'Pan zdziera z nas skórę.', 'Za te podatki to by się zamek złocił.', 'Płać i płać, a z czego żyć?',
    'Ostatni grosz oddałem.',
  ],
  bribe: ['Pan złotem sypie, niech mu Bóg da zdrowie!', 'Takiego pana to ze świecą szukać.', 'Złoto od pana? Postawię kolejkę!'],
  noTax: ['Podatków nie ma, to i żyć się chce.', 'Pan dobry, nic nie zdziera.'],
  fire: ['Pali się! Wody!', 'Ogień! Dawaj wiadra!', 'Spłonie wszystko, ratujcie!', 'Do studni, biegiem!', 'Dach się sypie, z drogi!'],
  enemy: [
    'Wojsko idzie! Nie nasze!', 'Chowaj się, chłopie, bo nadziana na włócznię nie pożyjesz!', 'Wróg pod osadą!',
    'Do zamku, wszyscy!', 'Niech straż coś zrobi!',
  ],
  dry: ['Karczma sucha jak pustynia. Piwa nie ma.', 'Bez piwa to i wieczór nie wieczór.', 'Browar stoi, a gardło schnie.'],
  good: [
    'Dobrze się tu żyje, nie powiem.', 'Brzuch pełny, dach nad głową. Czego chcieć więcej?', 'Niech pan żyje sto lat!',
    'Dawno tak spokojnie nie było.', 'Zostanę tu na dłużej.',
  ],
  // --- pan zamku spaceruje po dziedzińcu ---
  lord: [
    'Pan idzie! Czapki z głów!', 'Niech będzie pochwalony, panie.', 'Dobry pan, chodzi między ludźmi.', 'Ciszej, pan patrzy.',
    'Panie, dach mi przecieka…', 'Ukłon panu, ukłon!', 'Sam pan wyszedł? Pewnie sprawdza, czy robimy.',
  ],
};

/** Odzywki straży miejskiej (w duchu strażników Starego Obozu) */
export const GUARD_SAY = {
  day: [
    'Czego tu szukasz?', 'Nie szwendaj się tu bez potrzeby.', 'Trzymaj się z dala od kłopotów.', 'Spokojnie. Dopóki ja tu stoję, nikt nie podskoczy.',
    'Pan płaci, ja pilnuję. Proste.', 'Masz jakiś problem?', 'Idź swoją drogą.', 'Widziałem cię wczoraj przy spichlerzu. Uważaj.',
    'Cisza i spokój. Tak ma być.',
  ],
  night: [
    'Po zmroku lepiej siedź w chacie.', 'Wilki dziś blisko. Słyszałeś je?', 'Cicho. Coś się rusza przy palisadzie.', 'Noc długa, a piwa ani kropli.',
    'Kto idzie? A, to ty. Zmykaj spać.', 'Pochodnie mają się palić do świtu.',
  ],
  danger: ['Do broni!', 'Wróg pod bramą! Za mną!', 'Nie przejdą, póki ja stoję!', 'Trzymać szyk!', 'Bij ich!'],
  fire: ['Ogień! Ruszać się z tymi wiadrami!', 'Gasić, nie gapić się!', 'Wszyscy do studni!'],
  cold: ['Zimno, aż zbroja do skóry przymarza.', 'Mróz. Ogień by się przydał przy bramie.'],
  rain: ['Leje jak z cebra, a ja tu stoję.', 'Zbroja rdzewieje od tego deszczu.', 'Mokry strażnik, zły strażnik.'],
  hungry: ['Pusty kocioł w koszarach. Długo tak nie postoimy.', 'Głodny strażnik to zły strażnik.'],
  taxHigh: ['Chłopi narzekają na podatki. Pilnuj, żeby się nie zbuntowali.', 'Poborca chodzi z nami, bo sam by nie wrócił.'],
  lord: ['Pan na dziedzińcu. Baczność!', 'Z drogi, pan idzie!', 'Pilnować pana, chłopy!'],
};
