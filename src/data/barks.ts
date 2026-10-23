import { lang } from '../i18n';

/**
 * Odzywki ludzi w osadzie: krótko, szorstko, po chłopsku, w duchu Gothica. Klucz = sytuacja albo zajęcie
 * (id budynku z data/buildings.ts). Dobiera je main.ts (lineFor / sayGuard / chatter).
 * Wersja angielska niżej (SAY_EN) ma te same klucze, ale własne kwestie — pisane po swojemu, nie słowo w słowo.
 */
const SAY_PL = {
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
  fieldTent: [
    'Zaciśnij zęby, będzie bolało.', 'Kto następny?', 'Bandaży znowu brakuje.', 'Przeżyjesz. Chyba.',
    'Woda gorąca? To dawaj.', 'Rękę zostawię, nogi nie obiecuję.',
  ],
  forester: [
    'Jedno ścinają, ja sadzę dwa.', 'Za wnuków tu będzie las.', 'Świerczek, rośnij, nie marudź.', 'Ziemia zmarznie, to i robota stanie.',
    'Drwal to tylko rąbać umie.', 'Korzenie w płótno, inaczej uschnie.', 'Las to nie pole, czeka się latami.',
  ],
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
  armorer: [
    'Kółko do kółka, nit do nitu.', 'Dobra kolczuga zatrzyma i topór.', 'Jeszcze rękaw i gotowa.', 'Drut cienki, ręce zdarte.',
    'Kto oszczędza na zbroi, ten oszczędza na życiu.',
  ],
  smithy: [
    'Żelazo trzeba bić, póki gorące.', 'Dmuchaj w miech, nie śpij!', 'Dobra stal, nie pęknie na tarczy.', 'Jeszcze hartowanie i miecz gotowy.',
    'Bez węgla nie ma żaru, bez żaru nie ma miecza.',
  ],
  poleturner: [
    'Drzewce równe, grot ostry.', 'Włócznia długa, wróg daleko.', 'Jeszcze ze trzy i odnoszę do zbrojowni.', 'Jesion najlepszy na drzewce.',
  ],
  engineers: [
    'Taran nie zbuduje się sam.', 'Liczymy, mierzymy, potem tniemy.', 'Ten mur padnie, zobaczysz.', 'Belka krzywa? To nie ja.',
    'Znowu ta palisada. Wczoraj łatałem.', 'Gdzie walnęli, tam ja z młotkiem.', 'Postawię, ale niech już nikt nie podpala.',
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
  bribe: ['Pan rudą sypie, niech mu Bóg da zdrowie!', 'Takiego pana to ze świecą szukać.', 'Ruda od pana? Postawię kolejkę!'],
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
const GUARD_SAY_PL = {
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

const SAY_EN: Record<keyof typeof SAY_PL, string[]> = {
  // --- idle and everyday work ---
  idle: [
    'What?', 'There\'d be work somewhere, surely…', 'Sitting and waiting. Like everyone.', 'Give us some work, my lord.', 'Cold by this fire.',
    'Got hands, got strength, got no work.', 'Heard the woodcutter needs men.', 'Watching others work. That\'s a job too.',
    'No work, no coin. Simple as that.', 'Build a workshop, my lord, and I\'ll mind it.', 'Boring. Wish someone\'d chase off a wolf at least.',
  ],
  work: [
    'Working, working.', 'Don\'t bother me, my lord.', 'Work won\'t do itself.', 'Aye, keeping busy.', 'Me again?',
    'On my feet since dawn.', 'Bit more, then a break.', 'Sweat down my back and the day\'s still long.', 'Work\'s work.',
    'Just till evening.', 'The lord\'s watching, so I\'m trying.',
  ],
  // --- jobs (building id) ---
  fieldTent: [
    'Bite down. This\'ll hurt.', 'Who\'s next?', 'Out of bandages again.', 'You\'ll live. Probably.',
    'Is the water boiling? Then bring it.', 'I\'ll save the arm. The leg, I promise nothing.',
  ],
  forester: [
    'They fell one, I plant two.', 'There\'ll be woods here for the grandchildren.', 'Grow, little spruce, quit your sulking.', 'Ground freezes, work stops.',
    'Woodcutters only know how to chop.', 'Roots in sacking, or it dries out.', 'A forest\'s not a field. You wait years.',
  ],
  woodcutter: [
    'Trees won\'t fell themselves.', 'Axe is dull as the reeve.', 'Forest\'s far, my feet ache.', 'Timber!', 'Tough pine, but she\'ll crack.',
    'Woodchips down my breeches again.', 'Something\'s prowling in the woods. I heard it.', 'One more log and I\'m hauling it in.',
  ],
  quarry: [
    'Stone, stone. My whole life.', 'My back\'s going to snap.', 'A digger\'s got a pick and sore hands. That\'s all.', 'One more block, then a drink.',
    'Dust in my throat like sand.', 'Walls of this stone\'ll stand a hundred years.', 'Miss once and there go your fingers.',
  ],
  mine: [
    'Dark as a grave down there.', 'Ore won\'t climb out by itself.', 'The digger digs, the lord gets rich.', 'Just pray the roof holds.',
    'Good vein. Red as blood.', 'Torch is dying and I\'m still hacking.', 'This ore\'ll make iron for spears.',
  ],
  farm: [
    'Just let the rain spare the crop.', 'Good soil. Shame about my hands.', 'Wheat grows fine if you leave it be.',
    'Crows in the field again.', 'Sharp scythe, long field.', 'No peasant in the field, no bread in the keep.',
  ],
  orchard: [
    'Apples big as fists this year.', 'Half of them wormy, but they\'ll eat.', 'Don\'t pick the green ones. Gut-ache.',
    'Bees are mean as wasps today.', 'Ladder creaks. Not going any higher.',
  ],
  fisher: [
    'Nothing biting today.', 'Water\'s cold as a tax collector\'s heart.', 'Pike snapped my line, the rascal.', 'Quiet, you\'ll scare them off.',
    'Fish like peace and quiet. Same as me.', 'Net\'s full of holes, but it\'ll catch something.',
  ],
  mill: [
    'Good wind, the stone\'s grinding.', 'Flour up my nose, flour in my ears.', 'No mill, no baker.', 'Sails stopped? No, still turning.',
    'Sack after sack, all day long.',
  ],
  bakery: [
    'Fresh from the oven! Hands off, it\'s hot.', 'Dough\'s rising. I\'m not.', 'Need to stoke the oven.', 'Smells good, eh? You\'re not getting any.',
    'Short on flour. Miller\'s dawdling.',
  ],
  brewery: [
    'Good hops. Ale\'ll be strong.', 'Vat\'s full and I\'m sober. Shameful.', 'Got to taste it to know it.',
    'Without ale the lads would\'ve run off long ago.', 'Malt smells like bread, only better.',
  ],
  tavern: [
    'No coin, no ale.', 'Bench is free, sit down.', 'Barrel\'s nearly dry, roll in another.', 'It\'ll be packed in here tonight.',
    'No brawling at the bar!', 'Ale\'s good today. Tried it myself.',
  ],
  fletcher: [
    'Arrow straight as a string.', 'Goose feathers. Best fletching there is.', 'Yew for the bow, gut for the string.', 'An archer with no arrows is just a shepherd.',
  ],
  armorer: [
    'Ring to ring, rivet to rivet.', 'Good mail will turn an axe.', 'One more sleeve and she\'s done.', 'Fine wire, raw hands.',
    'Skimp on your mail, skimp on your life.',
  ],
  smithy: [
    'Strike while the iron\'s hot.', 'Work the bellows, don\'t doze off!', 'Good steel. Won\'t snap on a shield.', 'Quench it, and the blade\'s done.',
    'No charcoal, no fire. No fire, no sword.',
  ],
  poleturner: [
    'Shaft\'s straight, point\'s sharp.', 'Long spear, enemy stays far.', 'Three more and I\'m off to the armoury.', 'Ash makes the best shafts.',
  ],
  engineers: [
    'Ram won\'t build itself.', 'Measure twice, cut once.', 'That wall\'s coming down, you\'ll see.', 'Beam\'s crooked? Wasn\'t me.',
    'This palisade again. Patched it only yesterday.', 'Wherever they smash it, there I go with my hammer.', 'I\'ll put it back up — just stop setting it alight.',
  ],
  stockpile: [
    'Planks with planks, stone with stone.', 'Who stacked this mess?', 'Counting and counting, never adds up.', 'Running out of room.',
  ],
  granary: [
    'Rats in the grain again.', 'Granary\'s full, mind\'s at ease.', 'Will it last the winter? It\'ll have to.', 'Dry. Won\'t go damp.',
  ],
  barn: ['Hay under the roof before the rain comes.', 'Big barn, and still cramped.'],
  cemetery: [
    'Everyone ends up here someday.', 'I dig the hole and keep my mouth shut.', 'May the earth rest light on him.', 'Quiet here. I like quiet.',
  ],
  well: ['Water\'s clean and cold as ice.', 'Bucket, crank, bucket, crank…'],
  // --- building and hauling ---
  build: [
    'Knock, knock, and it stands.', 'Whoever drew this never carried a beam.', 'One more beam and we\'re done.', 'Pass the hammer!',
    'Crooked? Can\'t tell from afar.', 'If it falls down, not my fault.', 'Foundation by the line, the rest by eye.',
  ],
  carry: [
    'Heavy bloody thing.', 'Hauling, hauling.', 'Out of the way!', 'Watch it or I\'ll drop it!', 'My shoulder\'s about to fall off.', 'Bit further to the stockpile.',
  ],
  // --- moods and situations ---
  hungry: [
    'Folk are going hungry, my lord.', 'My belly\'s stuck to my spine.', 'Can\'t work on an empty stomach.', 'The children are crying from hunger.',
    'Just a crust of bread…', 'Nothing in the granary but the wind.',
  ],
  angry: [
    'These taxes will be the death of us.', 'Other lords pay better.', 'Bit longer and I\'m off.', 'Fat lord in the keep, and we\'re skin and bone.',
    'They say it\'s better in the next village.', 'We won\'t put up with this much longer.',
  ],
  night: [
    'Wolves are howling tonight, hear that?', 'Don\'t wander past the palisade after dark.', 'Could do with some sleep.', 'Dark as a sack in here.',
    'Bright moon, bold wolves.', 'A torch would come in handy.',
  ],
  wolves: ['Wolves! Help!', 'Grab a stick, they\'re coming!', 'Mother of God, wolves!', 'Into the huts, quick!', 'Guards! Wolves at the village!'],
  wolvesNight: ['Hear that? Howling past the palisade.', 'At night the wolves come right up to the huts.', 'Bolt the doors, wolves are circling.'],
  cold: [
    'Freezing! Need to light the stove.', 'Can\'t feel my fingers. Off to make a fire.', 'Frost won\'t let up. Need more wood.',
    'Cold as a dog kennel. Throw a log on!', 'Water in the bucket\'s frozen.', 'Who\'s got dry firewood? Hut\'s freezing.',
  ],
  coldNight: ['I\'ll stoke the stove or we\'ll freeze by morning.', 'Shut the door, feed the fire, then sleep.', 'Two blankets and still cold.'],
  hot: ['This heat\'s unbearable.', 'Water! My throat\'s like pepper.', 'Heat like this, you just sit in the shade.', 'Sun\'s scorching, sweat\'s pouring.'],
  rain: ['Pours and pours.', 'Mud up to my knees.', 'Soaked to the bone.', 'Rain\'s good for the wheat, bad for me.', 'Need to get under a roof.'],
  morning: [
    'Cock\'s crowed, time to get up.', 'Dawn, and I\'m already up.', 'Morning fog thick as milk.', 'New day, same old work.',
    'Dew on the grass, cold in the feet.',
  ],
  evening: [
    'To the tavern, lads!', 'Done for the day. Finally.', 'Let\'s sit by the fire.', 'My legs are falling off from all this work.', 'Who\'s buying the ale?',
    'Did I tell you about the time I fought a wolf bare-handed…', 'Sun\'s going down and we\'re still breathing.',
  ],
  sleep: ['Yawn… time for bed.', 'Enough for today.', 'Off to sleep. Back to the grind tomorrow.', 'Good night, my lord.', 'The straw awaits.'],
  sleeping: ['Zzzz…', 'Mmm… just a bit longer…', 'Zzzz… pfff…', 'Mmm… ale… more…'],
  outside: ['Hard ground and not a roof in sight.', 'Sleeping on straw under the sky, like a dog.', 'Build us a hut, my lord, it\'s cold out here.'],
  crowded: ['Eight of us in one hut, like herring in a barrel.', 'Whoever snores sleeps outside!', 'Cramped, my lord. We need more huts.'],
  taxHigh: [
    'Tax collector came again. Left me a button.', 'The lord\'s skinning us alive.', 'With taxes like these the keep should be gilded.', 'Pay and pay, and live on what?',
    'Gave him my last coin.',
  ],
  bribe: ['The lord\'s handing out ore, God bless him!', 'You won\'t find a lord like this anywhere.', 'Ore from the lord? Next round\'s on me!'],
  noTax: ['No taxes. Makes a man want to live.', 'Good lord, this one. Doesn\'t fleece us.'],
  fire: ['Fire! Water!', 'Fire! Get the buckets!', 'It\'ll all burn, help!', 'To the well, run!', 'Roof\'s coming down, move!'],
  enemy: [
    'Soldiers coming! Not ours!', 'Hide, lad, a spear in the gut and you\'re done for!', 'Enemy at the village!',
    'Everyone to the keep!', 'Somebody tell the guards to do something!',
  ],
  dry: ['Tavern\'s dry as a desert. No ale.', 'An evening without ale is no evening at all.', 'Brewery\'s idle and my throat\'s parched.'],
  good: [
    'Not a bad life here, I\'ll give you that.', 'Full belly, roof overhead. What more do you want?', 'Long live the lord!',
    'Haven\'t had it this quiet in ages.', 'Think I\'ll stay a while.',
  ],
  // --- the lord walks the courtyard ---
  lord: [
    'The lord\'s coming! Hats off!', 'Praise be, my lord.', 'Good lord, walks among his people.', 'Quiet, the lord\'s watching.',
    'My lord, my roof\'s leaking…', 'Bow to the lord, bow!', 'Out on his own? Checking we\'re working, no doubt.',
  ],
};

const GUARD_SAY_EN: { [K in keyof typeof GUARD_SAY_PL]: string[] } = {
  day: [
    'What are you looking for?', 'Don\'t loiter here without a reason.', 'Stay out of trouble.', 'Easy. As long as I\'m standing here, nobody tries anything.',
    'The lord pays, I keep watch. Simple.', 'Got a problem?', 'Move along.', 'Saw you by the granary yesterday. Careful.',
    'Peace and quiet. That\'s how it should be.',
  ],
  night: [
    'After dark you\'d best stay in your hut.', 'Wolves are close tonight. Hear them?', 'Quiet. Something\'s moving by the palisade.', 'Long night, and not a drop of ale.',
    'Who goes there? Oh, it\'s you. Off to bed.', 'Torches stay lit till dawn.',
  ],
  danger: ['To arms!', 'Enemy at the gate! Follow me!', 'They won\'t pass while I stand!', 'Hold the line!', 'Hit them!'],
  fire: ['Fire! Move it with those buckets!', 'Put it out, don\'t gawk!', 'Everyone to the well!'],
  cold: ['So cold my armour\'s freezing to my skin.', 'Frost. Could use a fire by the gate.'],
  rain: ['Pouring buckets, and here I stand.', 'This rain\'s rusting my armour.', 'Wet guard, grumpy guard.'],
  hungry: ['Empty pot in the barracks. We won\'t last long like this.', 'A hungry guard is a bad guard.'],
  taxHigh: ['The peasants grumble about taxes. Keep an eye out for trouble.', 'The tax collector walks with us. Wouldn\'t come back alone.'],
  lord: ['The lord\'s in the courtyard. Attention!', 'Make way, the lord\'s coming!', 'Guard the lord, lads!'],
};

const EN = lang() === 'en';
export const SAY: Record<string, string[]> = EN ? SAY_EN : SAY_PL;
export const GUARD_SAY: { [K in keyof typeof GUARD_SAY_PL]: string[] } = EN ? GUARD_SAY_EN : GUARD_SAY_PL;
