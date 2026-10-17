/**
 * Gra jest tylko na komputery. Telefon albo tablet (sam dotyk, bez myszy) dostaje tablicę z informacją,
 * a gra w ogóle się nie wczytuje.
 */
import { t, tx } from './i18n';
import { randomTip } from './data/tips';

const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

if (touchOnly || mobileAgent) {
  document.getElementById('game')?.remove();
  document.getElementById('loading')?.remove();
  const ui = document.getElementById('ui')!;
  ui.innerHTML = `<div class="desktop-only panel" role="alert">
    <p class="info-name">${tx('Tylko na komputerze', 'Computer only')}</p>
    <p>${tx('Ta gra działa w przeglądarce na komputerze, z myszą i klawiaturą. Na telefonie i tablecie się nie uruchomi.', 'This game runs in a browser on a computer, with a mouse and keyboard. It will not start on a phone or tablet.')}</p>
    <p>${tx('Otwórz ten adres na komputerze.', 'Open this address on a computer.')}</p>
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
  if (tip) tip.textContent = randomTip();
  // napisy wpisane w index.html (zanim gra się wczyta) w wybranym języku
  const sub = document.querySelector('#loading .loading-sub');
  if (sub) sub.textContent = t('menu.subtitle');
  document.getElementById('game')?.setAttribute('aria-label', tx('Mapa gry', 'Game map'));
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
  await step(tx('Wczytywanie silnika gry…', 'Loading the game engine…'));
  const tex = await import('./render/textures');
  const kinds = tex.KINDS();
  total = 2 + kinds.length + 1;
  done = 1;
  const names: Record<string, [string, string]> = {
    bricks: ['kamień', 'stone'], planks: ['deski', 'planks'], thatch: ['strzecha', 'thatch'], plaster: ['tynk', 'plaster'], tiles: ['dachówki', 'roof tiles'], grass: ['trawa', 'grass'], leaves: ['liście', 'leaves'],
    needles: ['igliwie', 'needles'], bark: ['kora', 'bark'], soil: ['ziemia', 'soil'], window: ['okna', 'windows'], water: ['woda', 'water'], ashlar: ['mur', 'masonry'], cobble: ['bruk', 'cobbles'], rock: ['skała', 'rock'], dressed: ['ciosy', 'dressed stone'], organic: ['żywność', 'food'], slate: ['łupek', 'slate'],
  };
  for (const kind of kinds) {
    // zapamiętana z poprzedniej wizyty wczytuje się od razu, bez klatki przerwy
    if (await tex.restore(kind)) { tex.pattern(kind); tex.bump(kind); done++; continue; }
    await step(`${tx('Tekstury', 'Textures')}: ${names[kind] ? tx(...names[kind]!) : kind}`);
    tex.pattern(kind);
    tex.bump(kind);
    done++;
  }
  await step(tx('Modele…', 'Models…'));
  // modele z Blendera leżą poza kodem gry: pobierają się tu równolegle (za drugim razem z pamięci przeglądarki)
  const { loadModels } = await import('./render/modelstore');
  await loadModels((n, all) => { if (count) count.textContent = `${done} / ${total} · ${tx('modele', 'models')} ${n}/${all}`; });
  const assets = await import('./render/assets');
  await assets.preloadAssets();
  done++;
  // miniatury budynków z poprzedniej wizyty (tej samej wersji gry): menu nie rysuje ich od nowa
  await import('./render/thumbcache').then((m) => m.loadThumbs()).catch(() => undefined);
  await step(tx('Budowanie świata i osady…', 'Building the world and the settlement…'));
  const game = await import('./main');
  await step(tx('Przygotowanie grafiki…', 'Preparing the graphics…'));
  game.warmup();
  done = total;
  await step(tx('Gotowe', 'Ready'));
  (window as unknown as { __loadTimes: unknown }).__loadTimes = times;
  console.info('[wczytywanie]', times.map(([t, ms]) => `${t} ${ms} ms`).join(' | '));
  document.getElementById('loading')?.classList.add('done');
  setTimeout(() => document.getElementById('loading')?.remove(), 600);
}
