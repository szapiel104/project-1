/**
 * Gra jest tylko na komputery. Telefon albo tablet (sam dotyk, bez myszy) dostaje tablicę z informacją,
 * a gra w ogóle się nie wczytuje.
 */
import './debug/errlog'; // dziennik błędów od pierwszej chwili (window.__errors())
import { t, tx } from './i18n';
import { randomTip } from './data/tips';
import { loadInfo } from './ui/loadinfo';

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
  const info = loadInfo(document.querySelector('#loading .loading-card'));
  let done = 0, total = 3;
  const times: [string, number][] = [];
  let last = performance.now(), lastText = '';
  const modelsText = tx('Modele…', 'Models…');
  const step = async (text: string): Promise<void> => {
    const now = performance.now();
    if (lastText) times.push([lastText, Math.round(now - last)]);
    last = now; lastText = text;
    if (label) label.textContent = text;
    if (count) count.textContent = `${done} / ${total}`;
    if (fill) fill.style.width = `${Math.round((done / total) * 100)}%`;
    await frame();
  };
  info.step(tx('Silnik gry', 'Game engine'), tx('pobieranie kodu gry i biblioteki 3D', 'downloading the game code and the 3D library'));
  await step(tx('Wczytywanie silnika gry…', 'Loading the game engine…'));
  const tex = await import('./render/textures');
  // pobieranie z sieci rusza od razu i idzie w tle, równolegle z rysowaniem tekstur (wcześniej modele czekały na
  // tekstury, a duże tekstury KTX2 na wszystko inne): modele z Blendera, a z niższym priorytetem tekstury terenu
  // i zdjęciowe tekstury budynków (prefetch.ts). Kod gry pobiera się od otwarcia strony (modulepreload w index.html).
  const { loadModels } = await import('./render/modelstore');
  let modelsDone = 0, modelsAll = 0;
  const models = loadModels((n, all) => {
    modelsDone = n; modelsAll = all;
    if (lastText === modelsText) {
      if (count) count.textContent = `${done} / ${total} · ${tx('modele', 'models')} ${n}/${all}`;
      info.detail(`${tx('pobrane modele', 'models downloaded')}: ${n} / ${all}`);
    }
  });
  models.catch(() => undefined); // błąd pokaże się niżej, przy await (bez „nieobsłużonej obietnicy” w międzyczasie)
  void import('./render/prefetch').then((p) => p.prefetchTextures([...p.basisUrls(), ...p.TERRAIN_FILES.map(p.terrainUrl), ...tex.photoUrls()])).catch(() => undefined);
  const kinds = tex.KINDS();
  total = 2 + kinds.length + 1;
  done = 1;
  const names: Record<string, [string, string]> = {
    bricks: ['kamień', 'stone'], planks: ['deski', 'planks'], thatch: ['strzecha', 'thatch'], plaster: ['tynk', 'plaster'], tiles: ['dachówki', 'roof tiles'], grass: ['trawa', 'grass'], leaves: ['liście', 'leaves'],
    needles: ['igliwie', 'needles'], bark: ['kora', 'bark'], soil: ['ziemia', 'soil'], window: ['okna', 'windows'], water: ['woda', 'water'], ashlar: ['mur', 'masonry'], cobble: ['bruk', 'cobbles'], rock: ['skała', 'rock'], dressed: ['ciosy', 'dressed stone'], organic: ['żywność', 'food'], slate: ['łupek', 'slate'],
  };
  let fromCache = 0, drawn = 0;
  info.step(tx('Tekstury', 'Textures'), `${kinds.length} ${tx('rodzajów', 'kinds')}`);
  // zapamiętane z poprzedniej wizyty wczytują się wszystkie naraz (wcześniej po jednej, każda czekała na poprzednią)
  const restored = await Promise.all(kinds.map((k) => tex.restore(k).catch(() => false)));
  // pierwsze wejście: brakujące tekstury rysuje kilka wątków w tle naraz, każdy na innym rdzeniu (texworker.ts);
  // wątek główny rysuje tylko to, czego tam się nie dało (stara przeglądarka, błąd wątku)
  const toPaint = kinds.filter((k, i) => !restored[i] && tex.needsPaint(k));
  let inBack = 0;
  if (toPaint.length) {
    await step(`${tx('Tekstury', 'Textures')}: ${tx('rysowanie w tle', 'painting in the background')}`);
    info.detail(`${tx('rysowane w tle', 'painted in the background')}: 0 / ${toPaint.length}`);
  }
  const leftover = new Set(await tex.paintInBackground(toPaint, () => {
    inBack++;
    info.detail(`${tx('rysowane w tle', 'painted in the background')}: ${inBack} / ${toPaint.length}`);
    if (fill) fill.style.width = `${Math.round(((done + inBack) / total) * 100)}%`;
  }).catch(() => toPaint));
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i]!;
    info.detail(`${names[kind] ? tx(...names[kind]!) : kind} · ${tx('z pamięci', 'cached')} ${fromCache}, ${tx('rysowane', 'drawn')} ${drawn} / ${kinds.length}`);
    if (restored[i]) { tex.pattern(kind); tex.bump(kind); done++; fromCache++; continue; }
    // gotowa z wątku w tle albo zdjęciowa (z pliku, nic do rysowania): bez klatki przerwy
    if (!leftover.has(kind)) { tex.pattern(kind); tex.bump(kind); done++; if (toPaint.includes(kind)) drawn++; continue; }
    drawn++;
    await step(`${tx('Tekstury', 'Textures')}: ${names[kind] ? tx(...names[kind]!) : kind}`);
    tex.pattern(kind);
    tex.bump(kind);
    done++;
  }
  info.step(tx('Modele', 'Models'), tx('pobieranie modeli budynków, ludzi i zwierząt', 'downloading models of buildings, people and animals'));
  await step(modelsText);
  // modele pobierają się od początku wczytywania (wyżej); tu czekamy tylko na resztę, często już są
  if (modelsAll) {
    if (count) count.textContent = `${done} / ${total} · ${tx('modele', 'models')} ${modelsDone}/${modelsAll}`;
    info.detail(`${tx('pobrane modele', 'models downloaded')}: ${modelsDone} / ${modelsAll}`);
  }
  await models;
  info.step(tx('Drzewa, trawa i postacie', 'Trees, grass and characters'), tx('pliki z zasobów (las, trawa, strażnik)', 'asset files (forest, grass, guard)'));
  const assets = await import('./render/assets');
  await assets.preloadAssets();
  done++;
  // miniatury budynków z poprzedniej wizyty (tej samej wersji gry): menu nie rysuje ich od nowa
  await import('./render/thumbcache').then((m) => m.loadThumbs()).catch(() => undefined);
  info.step(tx('Świat i osada', 'World and settlement'), tx('teren, rzeki, lasy, budynki i mieszkańcy z zapisu — przy tym kroku licznik może na chwilę stanąć, to normalne', 'terrain, rivers, forests, buildings and villagers from the save — the timer may pause for a moment here, that is normal'));
  await step(tx('Budowanie świata i osady…', 'Building the world and the settlement…'));
  const game = await import('./main');
  info.step(tx('Grafika', 'Graphics'), tx('kompilacja shaderów wszystkich budynków — licznik może na chwilę stanąć', 'compiling shaders for every building — the timer may pause for a moment'));
  await step(tx('Przygotowanie grafiki…', 'Preparing the graphics…'));
  // shadery kompiluje karta w tle, modele próbne budują się partiami — pasek idzie, strona nie zamarza
  await game.warmup((n, all) => {
    if (count) count.textContent = `${done} / ${total} · ${tx('budynki', 'buildings')} ${n}/${all}`;
    info.detail(`${tx('budynki', 'buildings')}: ${n} / ${all}`);
  });
  info.done();
  done = total;
  await step(tx('Gotowe', 'Ready'));
  (window as unknown as { __loadTimes: unknown }).__loadTimes = times;
  console.info('[wczytywanie]', times.map(([t, ms]) => `${t} ${ms} ms`).join(' | '));
  document.getElementById('loading')?.classList.add('done');
  setTimeout(() => document.getElementById('loading')?.remove(), 600);
}
