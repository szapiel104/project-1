import { tx } from '../i18n';

/**
 * Wskazówka o karcie graficznej (Michał 7.11.2026): na laptopie z RTX 3050 Chrome liczył grę na wbudowanej karcie AMD
 * (Radeon 680M) i gra chodziła po 15–20 FPS, choć „duże gry chodziły”. Gry instalowane same wybierają mocną kartę,
 * przeglądarka nie. Gdy po nazwie karty widać kartę wbudowaną w procesor, raz pokazujemy w menu, jak przełączyć Chrome
 * na mocniejszą kartę. „Rozumiem” chowa ją na zawsze.
 */
const KEY = 'project1.gpuHint';

/** Nazwa karty z WebGL (WebGPU w Chrome nie podaje nazwy modelu); pusty napis, gdy przeglądarka jej nie zdradza */
function rendererName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
}

/** Karta wbudowana w procesor: ogólna nazwa „Radeon Graphics” / „Vega N Graphics” (AMD) albo Intel UHD/Iris/HD */
export function isIntegrated(name: string): boolean {
  if (/RTX|GTX|Quadro|GeForce|Radeon RX|\bRX \d|Radeon Pro|Arc\b/i.test(name)) return false;
  return /Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|Intel\(R\) (UHD|Iris|HD) Graphics|Intel.*(UHD|Iris|HD Graphics)/i.test(name);
}

export function maybeShowGpuHint(parent: HTMLElement): void {
  try { if (localStorage.getItem(KEY) === 'ok') return; } catch { /* bez pamięci przeglądarki pokazujemy zwykle */ }
  const name = rendererName();
  if (!isIntegrated(name) || document.querySelector('.gpu-hint')) return;
  const box = document.createElement('aside');
  box.className = 'gpu-hint';
  box.setAttribute('role', 'note');
  const card = name.replace(/^ANGLE \(|, Direct3D.*$|\)$/g, '').replace(/^[^,]*, /, '');
  box.innerHTML = `
    <strong class="gpu-hint-t">${tx('Gra liczy się na słabszej karcie graficznej', 'The game is running on the weaker graphics chip')}</strong>
    <p>${tx(`Przeglądarka używa karty wbudowanej w procesor (${card}). Jeśli komputer ma też mocniejszą kartę (np. NVIDIA GeForce), gra może chodzić kilka razy płynniej.`,
      `Your browser is using the graphics built into the processor (${card}). If your computer also has a stronger card (e.g. NVIDIA GeForce), the game can run several times smoother.`)}</p>
    <ol>
      <li>${tx('Windows: <b>Ustawienia → System → Ekran → Grafika</b>.', 'Windows: <b>Settings → System → Display → Graphics</b>.')}</li>
      <li>${tx('Dodaj przeglądarkę („Potrzebujesz aplikacji desktopowej?”), np. <code>C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe</code>.', 'Add your browser (“Browse” / desktop app), e.g. <code>C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe</code>.')}</li>
      <li>${tx('Rozwiń ją i wybierz <b>Wysoka wydajność</b> (tam widać nazwę mocniejszej karty).', 'Expand it and choose <b>High performance</b> (the stronger card is named there).')}</li>
      <li>${tx('W Chrome wpisz w pasek adresu <code>chrome://flags/#force-high-performance-gpu</code>, ustaw <b>Enabled</b> i kliknij <b>Relaunch</b> (na laptopach z dwiema kartami samo ustawienie Windows często nie wystarcza).', 'In Chrome open <code>chrome://flags/#force-high-performance-gpu</code>, set it to <b>Enabled</b> and click <b>Relaunch</b> (on laptops with two graphics chips the Windows setting alone often is not enough).')}</li>
    </ol>`;
  const row = document.createElement('div');
  row.className = 'gpu-hint-row';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'gpu-hint-ok';
  ok.textContent = tx('Rozumiem', 'Got it');
  ok.addEventListener('click', () => { try { localStorage.setItem(KEY, 'ok'); } catch { /* trudno */ } box.remove(); });
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'gpu-hint-later';
  later.textContent = tx('Później', 'Later');
  later.addEventListener('click', () => box.remove());
  row.append(later, ok);
  box.append(row);
  parent.append(box);
}
