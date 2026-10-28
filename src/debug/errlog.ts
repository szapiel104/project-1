/**
 * Dziennik błędów gry i grafiki.
 *
 * Łapie od pierwszej chwili wczytywania:
 *  - wyjątki JS i odrzucone obietnice (`error`, `unhandledrejection`),
 *  - wszystko, co trafia do `console.error` / `console.warn` (także ostrzeżenia three.js),
 *  - nieudane wczytanie plików (skrypty, style, obrazki, tekstury przez menedżer three.js),
 *  - grafikę: błędy kompilacji shaderów, utratę kontekstu WebGL, `gl.getError()`, stojący obraz
 *    (brak klatki przez 5 s przy widocznej karcie) i kamerę z NaN w położeniu.
 *
 * Każdy wpis liczony raz (te same komunikaty sumują się w `count`), najwyżej 200 różnych.
 * Ostatni dziennik zostaje w localStorage, więc po zawieszeniu karty widać go przy następnym wejściu (`previous`).
 *
 * Sprawdzanie: w konsoli `__errors()` (albo `__errors().items`), czyszczenie `__errors.clear()`.
 * Automatycznie: `npm run check:console` (tools/check/console.mjs) — otwiera grę w Chromium i wypisuje dziennik.
 */
import type * as THREE from 'three';

export type ErrKind = 'js' | 'promise' | 'console' | 'resource' | 'shader' | 'webgl' | 'render';
export type ErrLevel = 'error' | 'warn';
export interface ErrEntry {
  kind: ErrKind;
  level: ErrLevel;
  msg: string;
  /** pierwsze linijki stosu wywołań */
  stack?: string;
  count: number;
  /** sekundy od otwarcia strony: pierwszy i ostatni raz */
  first: number;
  last: number;
}
export interface ErrReport {
  page: string;
  build: string;
  /** sekundy od otwarcia strony */
  uptime: number;
  errors: number;
  warnings: number;
  items: ErrEntry[];
  /** dziennik z poprzedniego wejścia (np. gdy karta się zawiesiła) */
  previous: { page: string; build: string; at: string; items: ErrEntry[] } | null;
}

declare const __BUILD__: string;
declare const __VERSION__: string;
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';
/** Dodatkowe informacje do nagłówka skopiowanego dziennika (tryb gry, jakość, wątek…) — dopisuje je main.ts */
const context = new Map<string, () => unknown>();
/** Nazwa karty graficznej (pierwszy pilnowany renderer) */
let gpuName = '';
const KEY = 'p1.errlog';
const MAX = 200;
const t0 = performance.now();
const secs = (): number => Math.round((performance.now() - t0) / 100) / 10;

const items: ErrEntry[] = [];
const byKey = new Map<string, ErrEntry>();
const listeners = new Set<() => void>();
/** Znane, nieszkodliwe komunikaty bibliotek (nie zaśmiecają dziennika) */
const ignored: RegExp[] = [];
let previous: ErrReport['previous'] = null;
let saveTimer = 0;
let busy = false;

/** Wspólna kopia oryginalnych funkcji konsoli (dziennik sam nie może wołać zawiniętych) */
const rawError = console.error.bind(console);
const rawWarn = console.warn.bind(console);

function text(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}
function stackOf(v: unknown): string | undefined {
  const s = v instanceof Error ? v.stack : undefined;
  return s ? s.split('\n').slice(0, 12).join('\n') : undefined;
}

/** Dopisuje wpis do dziennika (ten sam komunikat tylko zwiększa licznik) */
export function report(kind: ErrKind, level: ErrLevel, msg: string, stack?: string): void {
  if (busy) return;
  msg = msg.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!msg || ignored.some((r) => r.test(msg))) return;
  const key = `${kind}|${msg}`;
  const old = byKey.get(key);
  if (old) { old.count++; old.last = secs(); return; }
  if (items.length >= MAX) return;
  const e: ErrEntry = { kind, level, msg, count: 1, first: secs(), last: secs() };
  if (stack) e.stack = stack.slice(0, 2400);
  items.push(e);
  byKey.set(key, e);
  save();
  busy = true;
  try { for (const f of listeners) f(); } catch { /* słuchacz nie może zepsuć dziennika */ } finally { busy = false; }
}

/** Informacja do nagłówka skopiowanego dziennika (liczona dopiero przy kopiowaniu) */
export function setContext(name: string, value: () => unknown): void { context.set(name, value); }

/** Komunikat biblioteki, który wiemy, że jest nieszkodliwy — nie trafia do dziennika */
export function ignore(re: RegExp): void { ignored.push(re); }
/** Wywoływane przy każdym nowym (różnym) wpisie */
export function onReport(f: () => void): void { listeners.add(f); }
export function counts(): { errors: number; warnings: number } {
  let errors = 0, warnings = 0;
  for (const e of items) if (e.level === 'error') errors++; else warnings++;
  return { errors, warnings };
}
export function entries(): readonly ErrEntry[] { return items; }

export function snapshot(): ErrReport {
  return { page: location.pathname.split('/').pop() + location.search, build: BUILD, uptime: secs(), ...counts(), items: items.map((e) => ({ ...e })), previous };
}

export function clear(): void {
  items.length = 0;
  byKey.clear();
  previous = null;
  try { localStorage.removeItem(KEY); } catch { /* bez pamięci przeglądarki */ }
}

function save(): void {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    try { localStorage.setItem(KEY, JSON.stringify({ page: location.pathname.split('/').pop() + location.search, build: BUILD, at: new Date().toISOString(), items: items.slice(0, 60) })); } catch { /* pełna albo zablokowana pamięć */ }
  }, 1000);
}

// ---------------- instalacja (raz, od razu przy imporcie) ----------------
let installed = false;
export function install(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw) as NonNullable<ErrReport['previous']>; if (p.items?.length) previous = p; }
    localStorage.removeItem(KEY);
  } catch { /* bez pamięci przeglądarki */ }

  // wyjątki JS i błędy wczytywania plików (te drugie przychodzą tylko w fazie przechwytywania)
  window.addEventListener('error', (ev) => {
    const el = ev.target as (HTMLElement & { src?: string; href?: string }) | null;
    if (el && el !== (window as unknown) && el instanceof HTMLElement) {
      report('resource', 'warn', `nie wczytano ${el.tagName.toLowerCase()}: ${el.src || el.href || '?'}`);
      return;
    }
    const where = ev.filename ? ` (${ev.filename.split('/').pop()}:${ev.lineno}:${ev.colno})` : '';
    // bez obiektu błędu (np. błąd z innego okna) zostaje chociaż miejsce wywołania
    report('js', 'error', `${ev.message || text(ev.error)}${where}`, stackOf(ev.error) ?? (ev.filename ? `    at ${ev.filename}:${ev.lineno}:${ev.colno}` : undefined));
  }, true);
  window.addEventListener('unhandledrejection', (ev) => report('promise', 'error', text(ev.reason), stackOf(ev.reason)));

  console.error = (...a: unknown[]): void => {
    rawError(...a);
    report('console', 'error', a.map(text).join(' '), stackOf(a.find((x) => x instanceof Error)) ?? new Error().stack?.split('\n').slice(2, 6).join('\n'));
  };
  console.warn = (...a: unknown[]): void => {
    rawWarn(...a);
    report('console', 'warn', a.map(text).join(' '));
  };

  const w = window as unknown as { __errors: (() => ErrReport) & { clear: () => void; text: () => string } };
  w.__errors = Object.assign(() => snapshot(), { clear, text: () => formatText() });
}

/**
 * Dziennik jako zwykły tekst — do skopiowania i wklejenia w czacie z Claude'em. Ma wszystko, czego trzeba do naprawy
 * bez dopytywania: wersję gry (po niej tools/check/stack.mjs bierze mapy źródeł i tłumaczy stos na pliki w src/),
 * przeglądarkę, kartę graficzną, ekran, stan gry i pełny stos wywołań każdego błędu.
 */
export function formatText(): string {
  const s = snapshot();
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const ua = nav?.userAgent ?? '';
  const browser = (/(Edg|OPR|Chrome|Firefox|Version)\/[\d.]+/.exec(ua)?.[0] ?? ua.slice(0, 60)).replace('Version', 'Safari');
  const os = /Windows NT [\d.]+|Mac OS X [\d_]+|Linux|Android [\d.]+/.exec(ua)?.[0] ?? '?';
  const lines = [
    `project-1 ${VERSION} (build ${s.build}) · ${location.href}`,
    `${s.uptime}s od otwarcia · błędy ${s.errors}, ostrzeżenia ${s.warnings}`,
    `przeglądarka: ${browser} · ${os} · ekran ${screen.width}×${screen.height} @${devicePixelRatio}× · okno ${innerWidth}×${innerHeight} · rdzenie ${nav?.hardwareConcurrency ?? '?'}${gpuName ? ` · karta: ${gpuName}` : ''}`,
  ];
  const ctx: string[] = [];
  for (const [k, f] of context) { try { const v = f(); if (v !== undefined && v !== '') ctx.push(`${k}: ${String(v)}`); } catch { /* informacja niedostępna */ } }
  if (ctx.length) lines.push(ctx.join(' · '));
  lines.push('');
  for (const e of s.items) {
    lines.push(`[${e.level} ${e.kind}] ×${e.count} @${e.first}s${e.last !== e.first ? `–${e.last}s` : ''} ${e.msg}`);
    if (e.stack) for (const l of e.stack.split('\n')) if (/^\s*at |@/.test(l)) lines.push('    ' + l.trim());
  }
  if (s.previous) lines.push(`--- poprzednie wejście (${s.previous.at}, ${s.previous.build}) ---`, ...s.previous.items.map((e) => `[${e.level} ${e.kind}] ×${e.count} ${e.msg}`));
  return lines.join('\n');
}

// ---------------- grafika ----------------
/**
 * Pilnuje jednego renderera: shadery, kontekst WebGL, błędy GL, stojący obraz i kamera z NaN.
 * `name` rozróżnia renderery (gra, podgląd modeli, miniatury).
 */
export function watchRenderer(renderer: THREE.WebGLRenderer, name = 'gra'): void {
  const gl = renderer.getContext();
  const canvas = renderer.domElement;
  renderer.debug.checkShaderErrors = true;
  if (!gpuName) {
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpuName = String((ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) ?? '');
    } catch { /* bez nazwy karty */ }
  }
  renderer.debug.onShaderError = (g, program, vs, fs): void => {
    const log = (sh: WebGLShader): string => (g.getShaderParameter(sh, g.COMPILE_STATUS) ? '' : (g.getShaderInfoLog(sh) ?? '').trim());
    const msg = [g.getProgramInfoLog(program)?.trim(), log(vs) && `VS: ${log(vs)}`, log(fs) && `FS: ${log(fs)}`].filter(Boolean).join(' | ');
    report('shader', 'error', `[${name}] shader się nie skompilował: ${msg || 'brak opisu'}`);
  };
  canvas.addEventListener('webglcontextlost', () => report('webgl', 'error', `[${name}] utracono kontekst WebGL (karta graficzna zresetowała rysowanie)`));
  canvas.addEventListener('webglcontextrestored', () => report('webgl', 'warn', `[${name}] kontekst WebGL odzyskany`));

  // znacznik klatki i ostatnia kamera: zawijamy render (wołany kilka razy na klatkę, koszt jednego przypisania)
  let lastFrame = 0, frames = 0, stalled = false;
  let cam: THREE.Camera | null = null;
  const render = renderer.render.bind(renderer);
  renderer.render = (scene, camera): void => { lastFrame = performance.now(); frames++; cam = camera; render(scene, camera); };

  const GL_NAMES: Record<number, string> = { 0x0500: 'INVALID_ENUM', 0x0501: 'INVALID_VALUE', 0x0502: 'INVALID_OPERATION', 0x0505: 'OUT_OF_MEMORY', 0x0506: 'INVALID_FRAMEBUFFER_OPERATION', 0x9242: 'CONTEXT_LOST_WEBGL' };
  if (GL_DEBUG) traceGl(gl, name, GL_NAMES, GL_PARAM === 'all' ? 0 : 40000);
  const timer = window.setInterval(() => {
    if (!canvas.isConnected) { window.clearInterval(timer); return; }
    if (gl.isContextLost()) return;
    // gl.getError wymusza synchronizację z kartą, więc tylko co kilka sekund
    // bez samoczynnego namierzania: sprawdzanie błędu po każdym wywołaniu GL zatrzymuje kartę i gra stawała (0 FPS) —
    // dokładne miejsce tylko na życzenie, z ?gldebug=1
    for (let i = 0, e = gl.getError(); e && i < 4; i++, e = gl.getError()) report('webgl', 'error', `[${name}] błąd WebGL ${GL_NAMES[e] ?? '0x' + e.toString(16)} (gdzieś w ostatnich 3 s${GL_DEBUG ? '' : '; dokładne miejsce: otwórz grę z ?gldebug=1 i skopiuj dziennik'})`);
    const now = performance.now();
    const visible = document.visibilityState === 'visible' && canvas.offsetParent !== null;
    if (frames && visible && now - lastFrame > 5000) {
      if (!stalled) report('render', 'error', `[${name}] obraz stoi: brak nowej klatki od ${Math.round((now - lastFrame) / 1000)} s`);
      stalled = true;
    } else stalled = false;
    if (cam) {
      const p = (cam as THREE.Camera).position;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) report('render', 'error', `[${name}] kamera ma złe położenie (NaN/∞)`);
    }
  }, 3000);
}

/**
 * `?gldebug=1`: namierzanie błędów WebGL. Przez pierwsze 40 s (wczytywanie i pierwsze klatki) błąd sprawdzany po
 * KAŻDYM wywołaniu WebGL — wiadomo, która funkcja go zrobiła. Potem tylko na granicach przejść rysowania (cienie,
 * scena, AO…), co prawie nic nie kosztuje. `?gldebug=all` sprawdza każde wywołanie cały czas (gra bardzo wolna).
 */
const GL_PARAM = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('gldebug') : null;
export const GL_DEBUG = GL_PARAM !== null;
let glFull = GL_DEBUG;
let glRaw: (() => number) | null = null;
let glWho = '';
let glErrNames: Record<number, string> = {};

/** Krótki opis argumentu wywołania GL (liczby jako stałe GL, gdy pasują, tablice jako typ i długość) */
function argText(v: unknown, names: Map<number, string>): string {
  if (typeof v === 'number') return names.get(v) ?? String(v);
  if (v === null || v === undefined) return String(v);
  if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${(v as unknown as { length?: number }).length ?? v.byteLength})`;
  if (typeof v === 'object') return (v as object).constructor?.name ?? 'obj';
  return String(v).slice(0, 40);
}

const traced = new WeakSet<object>();
/** Sprawdzanie błędu po każdym wywołaniu GL przez `fullMs` (0 = zawsze), potem tylko na granicach przejść (glSection) */
function traceGl(gl: WebGLRenderingContext, name: string, errNames: Record<number, string>, fullMs: number): void {
  if (traced.has(gl)) return;
  traced.add(gl);
  glFull = true;
  const g = gl as unknown as Record<string, unknown>;
  const raw = gl.getError.bind(gl);
  glRaw = raw; glWho = name; glErrNames = errNames;
  // stałe GL po nazwie (np. 3553 → TEXTURE_2D), żeby argumenty dało się czytać
  const names = new Map<number, string>();
  for (const k in g) if (/^[A-Z0-9_]+$/.test(k) && typeof g[k] === 'number' && !names.has(g[k] as number) && (g[k] as number) > 1) names.set(g[k] as number, k);
  for (const k in g) {
    const f = g[k];
    if (typeof f !== 'function' || k === 'getError' || k === 'isContextLost') continue;
    g[k] = function (this: unknown, ...a: unknown[]): unknown {
      const r = (f as (...x: unknown[]) => unknown).apply(gl, a);
      if (!glFull) return r;
      const e = raw();
      if (e) report('webgl', 'error', `[${name}] ${errNames[e] ?? '0x' + e.toString(16)} w gl.${k}(${a.map((x) => argText(x, names)).join(', ')})${glPass ? ` · przejście: ${glPass}` : ''}`, new Error().stack?.split('\n').slice(2, 9).join('\n'));
      return r;
    };
  }
  if (fullMs) setTimeout(() => { glFull = false; report('webgl', 'warn', `[${name}] namierzanie GL: koniec sprawdzania każdego wywołania (${fullMs / 1000} s), dalej tylko granice przejść`); }, fullMs);
  report('webgl', 'warn', `[${name}] namierzanie GL${GL_DEBUG ? ` (?gldebug=${GL_PARAM || '1'})` : ' włączone samo po błędzie'}: każde wywołanie WebGL sprawdzane${fullMs ? ` przez ${fullMs / 1000} s` : ''} (gra chwilę wolniejsza)`);
}

let glPass = '';
/**
 * Nazwa aktualnego przejścia rysowania (cienie, scena, AO…) — w trybie ?gldebug=1 dopisywana do błędów, a na
 * granicy przejścia sprawdzamy błąd, więc wiadomo, które przejście go zrobiło. Zwraca poprzednią nazwę.
 */
export function glSection(n: string): string {
  const was = glPass;
  if (glRaw && !glFull) { const e = glRaw(); if (e) report('webgl', 'error', `[${glWho}] ${glErrNames[e] ?? '0x' + e.toString(16)} w przejściu: ${was || 'poza rysowaniem'} (szczegóły: ?gldebug=all)`); }
  glPass = n;
  return was;
}

/** Błędy wczytywania przez menedżer three.js (tekstury, pliki modeli) */
export function watchLoading(manager: THREE.LoadingManager): void {
  const prev = manager.onError;
  manager.onError = (url: string): void => { report('resource', 'error', `three.js nie wczytał: ${url}`); prev?.(url); };
}

install();
