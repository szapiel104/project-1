import { tx } from '../i18n';

/** Porady na ekranie wczytywania (przy starcie gry i przy budowie nowej mapy), po polsku i po angielsku */
const TIPS: [string, string][] = [
  ['Wilki wychodzą z lasu o zmierzchu. Palisada wokół osady daje ludziom spokojniejszą noc.', 'Wolves come out of the forest at dusk. A palisade around the settlement gives your people a quieter night.'],
  ['Najpierw jedzenie: sad albo rybak, zanim postawisz kolejne chaty dla nowych ludzi.', 'Food first: an orchard or a fisherman before you build more houses for new settlers.'],
  ['Chata drwala przy samym lesie: krótsza droga po drewno to więcej desek.', 'Put the woodcutter’s hut right by the forest: a shorter walk for wood means more planks.'],
  ['Grabarz zbiera ciała tylko na swoim terenie. Kliknij cmentarz, żeby zobaczyć, gdzie sięga.', 'The gravedigger only collects bodies within his ground. Click the cemetery to see how far it reaches.'],
  ['Budowniczy najpierw idą do składu po materiał. Skład blisko budowy = szybsza budowa.', 'Builders first go to the stockpile for materials. A stockpile close to the site means faster building.'],
  ['Prawy klik z przeciąganiem ustawia oddział w szyku i wskazuje, w którą stronę ma patrzeć.', 'Right-click and drag to form a unit into a line and set the way it faces.'],
  ['Zaznacz chłopa i wciśnij F, żeby przejść się jego oczami. F bez zaznaczenia (albo oko na pasku) i klik na mapie: spacer od tego miejsca.', 'Select a peasant and press F to walk through his eyes. F with nothing selected (or the eye on the bar) and a click on the map: a walk from that spot.'],
  ['Wydeptane ścieżki pokazują, gdzie ludzie chodzą najczęściej. Tam warto położyć drogę.', 'Trodden paths show where people walk most often. That is where a road pays off.'],
  ['W nocy ludzie schodzą do ogniska i karczmy, a o świcie wracają do pracy.', 'At night people gather at the campfire and the tavern, and at dawn they go back to work.'],
  ['F3 pokazuje okno wydajności. Gra sama dobiera jakość grafiki do komputera.', 'F3 shows the performance window. The game picks graphics quality to suit your computer.'],
];

/** Losowa porada w bieżącym języku (losowanie to tylko ozdoba ekranu, nie symulacja) */
export function randomTip(): string {
  const [p, e] = TIPS[Math.floor(Math.random() * TIPS.length)]!;
  return tx(p, e);
}
