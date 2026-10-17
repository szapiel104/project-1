/**
 * Gra jest tylko na komputery. Telefon albo tablet (sam dotyk, bez myszy) dostaje tablicę z informacją,
 * a gra w ogóle się nie wczytuje.
 */
/** Porady na ekranie wczytywania (musi stać przed uruchomieniem load) */
const TIPS = [
  'Wilki wychodzą z lasu o zmierzchu. Palisada wokół osady daje ludziom spokojniejszą noc.',
  'Najpierw jedzenie: sad albo rybak, zanim postawisz kolejne chaty dla nowych ludzi.',
  'Chata drwala przy samym lesie: krótsza droga po drewno to więcej desek.',
  'Grabarz zbiera ciała tylko na swoim terenie. Kliknij cmentarz, żeby zobaczyć, gdzie sięga.',
  'Budowniczy najpierw idą do składu po materiał. Skład blisko budowy = szybsza budowa.',
  'Prawy klik z przeciąganiem ustawia oddział w szyku i wskazuje, w którą stronę ma patrzeć.',
  'Zaznacz chłopa i wciśnij F, żeby przejść się jego oczami. F bez zaznaczenia (albo oko na pasku) i klik na mapie: spacer od tego miejsca.',
  'Wydeptane ścieżki pokazują, gdzie ludzie chodzą najczęściej. Tam warto położyć drogę.',
  'W nocy ludzie schodzą do ogniska i karczmy, a o świcie wracają do pracy.',
  'F3 pokazuje okno wydajności. Gra sama dobiera jakość grafiki do komputera.',
];

const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

if (touchOnly || mobileAgent) {
  document.getElementById('game')?.remove();
  document.getElementById('loading')?.remove();
  const ui = document.getElementById('ui')!;
  ui.innerHTML = `<div class="desktop-only panel" role="alert">
    <p class="info-name">Tylko na komputerze</p>
    <p>Ta gra działa w przeglądarce na komputerze, z myszą i klawiaturą. Na telefonie i tablecie się nie uruchomi.</p>
    <p>Otwórz ten adres na komputerze.</p>
  </div>`;
} else {
  void load();
  // pliki gry zostają w przeglądarce (Service Worker): kolejne wejście startuje bez pobierania
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && !location.search.includes('test=')) {
    addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* bez pamięci podręcznej gra działa jak dotąd */ }); });
  }
}


/**
 * Wczytywanie z paskiem: silnik 3D, każda tekstura osobno (rysowane w przeglądarce, to trwa najdłużej),
 * na końcu budowa świata. Między krokami oddajemy przeglądarce klatkę, żeby pasek się odświeżył.
 */
async function load(): Promise<void> {
  const fill = document.getElementById('loading-fill');
  const label = document.getElementById('loading-label');
  const count = document.getElementById('loading-count');
  // porada na czas wczytywania (losowanie to tylko ozdoba ekranu, nie symulacja)
  const tip = document.getElementById('loading-tip');
  if (tip) tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]!;
  // klatka do odświeżenia paska; w karcie w tle przeglądarka wstrzymuje klatki, więc jest też zapasowy zegar
  const frame = (): Promise<void> => new Promise((ok) => { requestAnimationFrame(() => setTimeout(ok, 0)); setTimeout(ok, 60); });
  let done = 0, total = 3;
  const times: [string, number][] = [];
  let last = performance.now(), lastText = '';
  const step = async (text: string): Promise<void> => {
    const now = performance.now();
    if (lastText) times.push([lastText, Math.round(now - last)]);
    last = now; lastText = text;
    if (label) label.textContent = text;
    if (count) count.textContent = `${done} / ${total}`;
    if (fill) fill.style.width = `${Math.round((done / total) * 100)}%`;
    await frame();
  };
  await step('Wczytywanie silnika gry…');
  const tex = await import('./render/textures');
  const kinds = tex.KINDS();
  total = 2 + kinds.length + 1;
  done = 1;
  const names: Record<string, string> = {
    bricks: 'kamień', planks: 'deski', thatch: 'strzecha', plaster: 'tynk', tiles: 'dachówki', grass: 'trawa', leaves: 'liście',
    needles: 'igliwie', bark: 'kora', soil: 'ziemia', window: 'okna', water: 'woda', ashlar: 'mur', cobble: 'bruk', rock: 'skała', dressed: 'ciosy', organic: 'żywność', slate: 'łupek',
  };
  for (const kind of kinds) {
    // zapamiętana z poprzedniej wizyty wczytuje się od razu, bez klatki przerwy
    if (await tex.restore(kind)) { tex.pattern(kind); tex.bump(kind); done++; continue; }
    await step(`Tekstury: ${names[kind] ?? kind}`);
    tex.pattern(kind);
    tex.bump(kind);
    done++;
  }
  await step('Modele…');
  // modele z Blendera leżą poza kodem gry: pobierają się tu równolegle (za drugim razem z pamięci przeglądarki)
  const { loadModels } = await import('./render/modelstore');
  await loadModels((n, all) => { if (count) count.textContent = `${done} / ${total} · modele ${n}/${all}`; });
  const assets = await import('./render/assets');
  await assets.preloadAssets();
  done++;
  // miniatury budynków z poprzedniej wizyty (tej samej wersji gry): menu nie rysuje ich od nowa
  await import('./render/thumbcache').then((m) => m.loadThumbs()).catch(() => undefined);
  await step('Budowanie świata i osady…');
  const game = await import('./main');
  await step('Przygotowanie grafiki…');
  game.warmup();
  done = total;
  await step('Gotowe');
  (window as unknown as { __loadTimes: unknown }).__loadTimes = times;
  console.info('[wczytywanie]', times.map(([t, ms]) => `${t} ${ms} ms`).join(' | '));
  document.getElementById('loading')?.classList.add('done');
  setTimeout(() => document.getElementById('loading')?.remove(), 600);
}
