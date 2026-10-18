/**
 * Dźwięki gry: nagrania Kenney (public/sounds, licencja w docs/zasoby.md), a gdy plik się jeszcze nie wczytał,
 * zastępczy dźwięk syntezowany w przeglądarce. Do tego tło: szum otoczenia w pętli.
 * Przeglądarka pozwala grać dopiero po pierwszym kliknięciu, więc kontekst powstaje leniwie.
 */
export type Sound = 'babble' | 'click' | 'build' | 'demolish' | 'collapse' | 'error' | 'road' | 'rotate' | 'select';

/** Nagrania dla każdego dźwięku; przy kilku wariantach losujemy jeden, żeby się nie powtarzało. */
const FILES: Partial<Record<Sound | 'ambience', string[]>> = {
  click: ['toggle'],
  build: ['placement-a', 'placement-b', 'placement-c', 'placement-d'],
  road: ['placement-a', 'placement-c'],
  demolish: ['removal-a', 'removal-b', 'removal-c', 'removal-d'],
  collapse: ['break'],
  rotate: ['rotate'],
  select: ['placement-b', 'placement-d'],
  ambience: ['ambience'],
};
/** Dźwięki świata (CC0, Kenney i OpenGameArt — docs/zasoby.md), grane z miejsca na mapie */
export type WorldSound = 'chop' | 'mine' | 'smith' | 'plank' | 'creak' | 'coins' | 'hit' | 'swing' | 'clang' | 'growl' | 'scream' | 'alert' | 'torch' | 'stepDirt' | 'stepStone' | 'stepWood' | 'stepGravel' | 'stepMud';
const WORLD: Record<WorldSound, string[]> = {
  chop: ['chop'], mine: ['mine-0', 'mine-1', 'mine-2'], smith: ['smith-0', 'smith-1', 'smith-2'], plank: ['plank-0', 'plank-1', 'plank-2'],
  creak: ['creak-1', 'creak-2', 'creak-3'], coins: ['coins'], hit: ['hit-0', 'hit-1', 'hit-2'], swing: ['swing-0', 'swing-1', 'swing-2'],
  clang: ['clang-0', 'clang-1'], growl: ['wolf'],
  // krzyk uciekającego albo poległego i zaskoczone „hę?!” chłopa na widok wroga (CC0, Freesound, przez C-Dogs SDL)
  scream: ['scream-0', 'scream-1', 'scream-2', 'scream-3', 'scream-4'], alert: ['alert-0', 'alert-1'],
  // buchnięcie płomienia przy zapalaniu pochodni w ręce (CC0, Freesound, przez C-Dogs SDL)
  torch: ['torch'],
  // kroki na różnym podłożu (CC0, Kenney: Impact Sounds i OGA Footsteps)
  stepDirt: ['step-dirt-0', 'step-dirt-1', 'step-dirt-2', 'step-dirt-3', 'step-dirt-4'],
  stepStone: ['step-stone-0', 'step-stone-1', 'step-stone-2', 'step-stone-3', 'step-stone-4', 'step-stone-5'],
  stepWood: ['step-wood-0', 'step-wood-1', 'step-wood-2', 'step-wood-3', 'step-wood-4'],
  stepGravel: ['step-gravel-0', 'step-stone-5'],
  stepMud: ['step-mud-0'],
};
/** Nagrania świata do teł i pojedynczych zdarzeń (docs/zasoby.md): ptaki za dnia, świerszcze nocą, odgłosy wsi,
 *  kury, dzwon w południe, róg alarmu, grzmot — 0 A.D. (Wildfire Games, CC-BY-SA 3.0) i Freesound (CC0) */
const NATURE = {
  day: ['day-0', 'day-1', 'day-2', 'day-3'], night: ['night-0', 'night-1'], farm: ['farm-0', 'farm-1'],
  hen: ['hen-0', 'hen-1', 'hen-2', 'hen-3'], bell: ['bell'], horn: ['horn'], thunder: ['thunder-0', 'thunder-1'],
};
const buffers = new Map<string, AudioBuffer>();
const pick = (list: string[]): AudioBuffer | undefined => { const ok = list.filter((n) => buffers.has(n)); return ok.length ? buffers.get(ok[Math.floor(Math.random() * ok.length)]!) : undefined; };
let ambienceOn = false;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Osobne suwaki: efekty (budowa, burzenie), interfejs (kliknięcia), otoczenie (szum w tle) */
export type Bus = 'sfx' | 'ui' | 'amb' | 'music';
const busGain: Partial<Record<Bus, GainNode>> = {};
const busLevel: Record<Bus, number> = { sfx: 1, ui: 1, amb: 1, music: 0.5 };
let out: GainNode | null = null;
/** Ściszanie muzyki i tła pod efekty (ducking): kroki, ciosy i głosy przebijają się przez muzykę */
let musicDuck: GainNode | null = null, ambDuck: GainNode | null = null;
/** Pauza: bramki ściszające odgłosy świata (ludzie, zwierzęta, walka, tło przyrody); interfejs, budowanie i muzyka grają dalej */
let worldSfx: GainNode | null = null, ambGate: GainNode | null = null;
let gamePaused = false;
/** Spacer chłopem: muzyka stale ciszej, żeby było słychać kroki i świat dookoła */
let walkFocus = false;
let noise: AudioBuffer | null = null;
let volume = 0.6;
let muted = false;

try {
  const v = localStorage.getItem('project1.volume');
  if (v !== null) volume = Number(v);
  muted = localStorage.getItem('project1.muted') === '1';
} catch { /* brak dostępu do pamięci przeglądarki */ }

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  // limiter na wyjściu: efekty mogą być głośniej, a suma i tak nie przesteruje
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
  master.connect(lim).connect(ctx.destination);
  musicDuck = ctx.createGain(); musicDuck.connect(master);
  ambGate = ctx.createGain(); ambGate.gain.value = gamePaused ? 0 : 1; ambGate.connect(master);
  ambDuck = ctx.createGain(); ambDuck.connect(ambGate);
  for (const b of ['sfx', 'ui', 'amb', 'music'] as Bus[]) {
    const gn = ctx.createGain(); gn.gain.value = busLevel[b];
    gn.connect(b === 'music' ? musicDuck : b === 'amb' ? ambDuck : master); busGain[b] = gn;
  }
  worldSfx = ctx.createGain(); worldSfx.gain.value = gamePaused ? 0 : 1; worldSfx.connect(busGain.sfx!);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const c = ctx;
  const names = new Set([...Object.values(FILES).flat(), ...Object.values(WORLD).flat(), ...Object.values(NATURE).flat()]);
  for (const name of names) {
    fetch(`sounds/${name}.ogg`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(name))))
      .then((data) => c.decodeAudioData(data))
      .then((buf) => { buffers.set(name, buf); if (name === 'ambience') startAmbience(); })
      .catch(() => { /* zostaje dźwięk syntezowany */ });
  }
  return ctx;
}

/** Uruchamia dźwięk po pierwszym geście użytkownika (wymóg przeglądarek). */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (master && !muted) master.gain.value = volume;
  try { localStorage.setItem('project1.volume', String(volume)); } catch { /* nic */ }
}

/** Głośność jednej grupy dźwięków (0..1) */
export function setBusVolume(bus: Bus, v: number): void {
  busLevel[bus] = Math.max(0, Math.min(1, v));
  const gn = busGain[bus];
  if (gn) gn.gain.value = busLevel[bus];
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : volume;
  try { localStorage.setItem('project1.muted', muted ? '1' : '0'); } catch { /* nic */ }
  return muted;
}

/**
 * Ducking: efekt o głośności `level` (0..1) na chwilę ścisza muzykę (do ok. 45%) i trochę tło,
 * a potem powoli je oddaje. Seria kroków trzyma muzykę niżej, dopóki trwa.
 */
function duck(level: number): void {
  const c = ctx;
  if (!c || !musicDuck || !ambDuck || level < 0.04) return;
  const now = c.currentTime, k = Math.min(1, level * 1.6);
  const base = walkFocus ? 0.6 : 1;
  for (const [node, depth] of [[musicDuck, 0.55], [ambDuck, 0.35]] as const) {
    const top = node === musicDuck ? base : 1;
    const target = Math.min(node.gain.value, top * (1 - depth * k));
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.setTargetAtTime(target, now, 0.04);
    node.gain.setTargetAtTime(top, now + 0.35, 0.7);
  }
}

/** Tryb spaceru chłopem: muzyka stale ciszej (wołane co klatkę przez music()) */
function setWalkFocus(on: boolean): void {
  if (on === walkFocus || !ctx || !musicDuck) return;
  walkFocus = on;
  musicDuck.gain.cancelScheduledValues(ctx.currentTime);
  musicDuck.gain.setTargetAtTime(on ? 0.6 : 1, ctx.currentTime, 0.8);
}

/**
 * Pauza gry (wołane co klatkę): odgłosy świata płynnie cichną i wracają po wznowieniu,
 * także te, które już trwały (wiatr, deszcz, ptaki, rozmowy). Kliknięcia, stawianie budynków i muzyka zostają.
 */
export function setGamePaused(on: boolean): void {
  if (on === gamePaused) return;
  gamePaused = on;
  const c = ctx;
  if (!c) return;
  for (const g of [worldSfx, ambGate]) {
    if (!g) continue;
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.setValueAtTime(g.gain.value, c.currentTime);
    g.gain.setTargetAtTime(on ? 0 : 1, c.currentTime, on ? 0.08 : 0.25);
  }
}

export const isMuted = (): boolean => muted;
export const getVolume = (): number => volume;

/** Uderzenie: krótki ton, który szybko opada (drewno, młotek). */
function knock(c: AudioContext, at: number, freq: number, len: number, gain: number, type: OscillatorType = 'triangle'): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, at + len);
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  o.connect(g).connect(out ?? master!);
  o.start(at);
  o.stop(at + len + 0.02);
}

/** Szum przepuszczony przez filtr: chrzęst, sypanie, łoskot. */
function rumble(c: AudioContext, at: number, len: number, gain: number, freq: number, q = 0.8, attack = 0.01): void {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.6 + Math.random() * 0.6;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.001, at + len);
  src.connect(f).connect(g).connect(out ?? master!);
  src.start(at, Math.random() * 0.5);
  src.stop(at + len + 0.05);
}

/** Szum otoczenia w pętli, cicho pod resztą dźwięków. */
function startAmbience(): void {
  const buf = buffers.get('ambience');
  if (!ctx || !master || !buf || ambienceOn) return;
  ambienceOn = true;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0.22;
  src.connect(g).connect(busGain.amb ?? master);
  src.start();
}

function sample(c: AudioContext, sound: Sound, t: number): boolean {
  const list = FILES[sound];
  const name = list?.[Math.floor(Math.random() * list.length)];
  const buf = name ? buffers.get(name) : undefined;
  if (!buf) return false;
  const src = c.createBufferSource();
  src.buffer = buf;
  // lekko zmieniona wysokość przy każdym odtworzeniu; droga brzmi niżej i ciszej niż budynek
  src.playbackRate.value = (sound === 'road' ? 0.8 : sound === 'select' ? 1.35 : 1) * (0.94 + Math.random() * 0.12);
  const g = c.createGain();
  g.gain.value = sound === 'road' ? 0.5 : sound === 'click' ? 0.6 : sound === 'select' ? 0.45 : 1;
  src.connect(g).connect(out ?? master!);
  src.start(t);
  if (out === busGain.sfx) duck(g.gain.value * 0.6);
  return true;
}

export function play(sound: Sound): void {
  const c = audio();
  if (!c || !master || muted || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  out = (sound === 'click' || sound === 'select' || sound === 'rotate' || sound === 'error' ? busGain.ui : busGain.sfx) ?? master;
  if (sample(c, sound, t)) return;
  if (sound === 'babble') {
    // skryba „mówi”: seria krótkich sylab o skaczącej wysokości, jak bełkot w starych strategiach
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const at = t + i * 0.085 + Math.random() * 0.02;
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150 + Math.random() * 90, at);
      f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 900; f.Q.value = 5;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.28, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
      o.connect(f).connect(g).connect(busGain.ui ?? master!);
      o.start(at); o.stop(at + 0.09);
    }
    return;
  }
  switch (sound) {
    case 'click':
    case 'rotate':
    case 'select':
      knock(c, t, 900, 0.05, 0.12);
      break;
    case 'build':
      // deski kładzione na ziemię, potem trzy uderzenia młotkiem
      rumble(c, t, 0.25, 0.5, 300, 1.2);
      knock(c, t, 140, 0.18, 0.5);
      for (let i = 0; i < 3; i++) { knock(c, t + 0.22 + i * 0.16, 520 + Math.random() * 80, 0.07, 0.35, 'square'); rumble(c, t + 0.22 + i * 0.16, 0.06, 0.25, 2500, 2); }
      break;
    case 'road':
      rumble(c, t, 0.12, 0.25, 900, 1);
      break;
    case 'demolish':
      // uderzenia kilofa w ścianę
      for (let i = 0; i < 2; i++) { knock(c, t + i * 0.2, 260, 0.1, 0.4, 'square'); rumble(c, t + i * 0.2, 0.15, 0.35, 1800, 1.5); }
      break;
    case 'collapse':
      // łoskot walącego się budynku i sypiący się gruz
      rumble(c, t, 1.4, 0.9, 120, 0.7, 0.05);
      knock(c, t, 70, 0.6, 0.7, 'sine');
      for (let i = 0; i < 9; i++) rumble(c, t + 0.15 + Math.random() * 1.1, 0.12, 0.3, 1200 + Math.random() * 2500, 2);
      break;
    case 'error':
      knock(c, t, 200, 0.12, 0.25, 'sawtooth');
      knock(c, t + 0.13, 150, 0.16, 0.25, 'sawtooth');
      break;
  }
}

// --- przyroda: wiatr przez cały czas, wrony za dnia, wilki nocą (wszystko syntezowane, bez plików) ---
let wind: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
let nextCrow = 0, nextWolf = 0, nextDrop = 0;
let rainNoise: { gain: GainNode } | null = null;

/** Deszcz: dwie warstwy szumu (szelest kropel i niski szum ulewy) plus pojedyncze krople o dachy */
function startRain(c: AudioContext): void {
  if (rainNoise || !noise) return;
  const gain = c.createGain(); gain.gain.value = 0;
  gain.connect(busGain.amb ?? master!);
  const hiSrc = c.createBufferSource(); hiSrc.buffer = noise; hiSrc.loop = true; hiSrc.playbackRate.value = 1;
  const hi = c.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 2200;
  const hiG = c.createGain(); hiG.gain.value = 0.55;
  hiSrc.connect(hi).connect(hiG).connect(gain);
  const loSrc = c.createBufferSource(); loSrc.buffer = noise; loSrc.loop = true; loSrc.playbackRate.value = 0.5;
  const lo = c.createBiquadFilter(); lo.type = 'bandpass'; lo.frequency.value = 600; lo.Q.value = 0.5;
  const loG = c.createGain(); loG.gain.value = 0.8;
  loSrc.connect(lo).connect(loG).connect(gain);
  hiSrc.start(); loSrc.start(0, 0.37);
  rainNoise = { gain };
}

function drop(c: AudioContext, at: number): void {
  const o = c.createOscillator(); o.type = 'sine';
  const f0 = 1800 + Math.random() * 2500;
  o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f0 * 0.5, at + 0.04);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.05, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  const p = c.createStereoPanner(); p.pan.value = Math.random() * 2 - 1;
  o.connect(g).connect(p).connect(busGain.amb ?? master!);
  o.start(at); o.stop(at + 0.06);
}

function startWind(c: AudioContext): void {
  if (wind || !noise) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.playbackRate.value = 0.35;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(busGain.amb ?? master!);
  src.start();
  wind = { src, filter, gain };
}

/** Kracz wrony: chrapliwy, krótki „kraa” opadający w tonie, 1–3 razy */
function crow(c: AudioContext, at: number, pan: number): void {
  const n = 1 + Math.floor(Math.random() * 3);
  const p = c.createStereoPanner(); p.pan.value = pan; p.connect(busGain.amb ?? master!);
  for (let i = 0; i < n; i++) {
    const t = at + i * (0.38 + Math.random() * 0.12);
    const o = c.createOscillator(); o.type = 'sawtooth';
    const base = 620 + Math.random() * 120;
    o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.26);
    // chrypa: szybkie drgania częstotliwości
    const lfo = c.createOscillator(); lfo.frequency.value = 55; const lg = c.createGain(); lg.gain.value = 90; lfo.connect(lg).connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(f).connect(g).connect(p);
    o.start(t); lfo.start(t); o.stop(t + 0.32); lfo.stop(t + 0.32);
  }
}

/** Wycie wilka z daleka: długi ton wznoszący się i opadający, z drżeniem, mocno wytłumiony */
let echo: ConvolverNode | null = null;
/** Pogłos lasu: długi, ciemny ogon, żeby wycie niosło się po okolicy */
function forestEcho(c: AudioContext): ConvolverNode {
  if (echo) return echo;
  const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  echo = c.createConvolver(); echo.buffer = ir;
  const g = c.createGain(); g.gain.value = 0.9;
  echo.connect(g).connect(busGain.amb ?? master!);
  return echo;
}

/** Szczeknięcia i skowyt: krótkie, wysokie „jip” kilku wilków, jak wataha w pogoni */
function yips(c: AudioContext, at: number, pan: number): void {
  const p = c.createStereoPanner(); p.pan.value = pan; p.connect(busGain.amb ?? master!); p.connect(forestEcho(c));
  const n = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const t = at + i * (0.12 + Math.random() * 0.2);
    const o = c.createOscillator(); o.type = 'triangle';
    const f0 = 600 + Math.random() * 350;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.5 : 0.6), t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.5;
    o.connect(f).connect(g).connect(p); o.start(t); o.stop(t + 0.18);
  }
}

/** Warczenie: niski, chropowaty szum drgający jak oddech zwierzęcia tuż za palisadą */
function snarl(c: AudioContext, at: number, pan: number): void {
  if (!noise) return;
  const p = c.createStereoPanner(); p.pan.value = pan; p.connect(busGain.amb ?? master!);
  const len = 1.2 + Math.random() * 1.2;
  const src = c.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = 0.4;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 170 + Math.random() * 60; f.Q.value = 4;
  const am = c.createGain(); am.gain.value = 0;
  const lfo = c.createOscillator(); lfo.frequency.value = 22 + Math.random() * 10; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(1.4, at + 0.2); g.gain.setValueAtTime(1.4, at + len * 0.7); g.gain.exponentialRampToValueAtTime(0.001, at + len);
  src.connect(f).connect(am).connect(g).connect(p);
  src.start(at); lfo.start(at); src.stop(at + len + 0.05); lfo.stop(at + len + 0.05);
}

function wolf(c: AudioContext, at: number, pan: number): void {
  const p = c.createStereoPanner(); p.pan.value = pan;
  const dry = c.createGain(); dry.gain.value = 0.6;
  p.connect(dry).connect(busGain.amb ?? master!);
  p.connect(forestEcho(c));
  // wataha: kilka głosów jeden po drugim, a na koniec warknięcie blisko
  const voices = 2 + Math.floor(Math.random() * 3);
  const growl = buffers.get('wolf');
  if (growl && Math.random() < 0.6) {
    const src = c.createBufferSource(); src.buffer = growl; src.playbackRate.value = 0.75;
    const g = c.createGain(); g.gain.value = 0.9;
    src.connect(g).connect(p); src.start(at + 3.5 + Math.random() * 2);
  }
  for (let v = 0; v < voices; v++) {
    const t = at + v * (0.8 + Math.random());
    const len = 2.6 + Math.random() * 1.2;
    const base = 300 + Math.random() * 60 + v * 55;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(base * 0.7, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.25, t + len * 0.3);
    o.frequency.setValueAtTime(base * 1.25, t + len * 0.65);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t + len);
    const vib = c.createOscillator(); vib.frequency.value = 5.5; const vg = c.createGain(); vg.gain.value = 6; vib.connect(vg).connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.5);
    g.gain.setValueAtTime(0.32, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(f).connect(g).connect(p);
    o.start(t); vib.start(t); o.stop(t + len + 0.05); vib.stop(t + len + 0.05);
  }
}

/**
 * Wołane co klatkę: `night` 0..1, `rain` 0..1. Wiatr zawsze szumi (mocniej w deszczu i nocą, z porywami),
 * wrony kraczą co kilkanaście sekund za dnia, wilki wyją co pół minuty–minutę nocą.
 */
export function nature(night: number, rain: number, paused: boolean, wolvesNear = 0): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  startWind(c);
  const now = c.currentTime;
  if (wind) {
    const gust = 0.5 + 0.5 * Math.sin(now * 0.31) * Math.sin(now * 0.17 + 1);
    const level = (0.05 + gust * 0.07 + rain * 0.1 + night * 0.03) * (paused ? 0.5 : 1);
    wind.gain.gain.setTargetAtTime(level, now, 0.5);
    wind.filter.frequency.setTargetAtTime(280 + gust * 420 + rain * 500, now, 0.5);
  }
  startRain(c);
  if (rainNoise) rainNoise.gain.gain.setTargetAtTime(rain * 0.22, now, 0.8);
  if (rain > 0.1 && now > nextDrop) { for (let i = 0; i < 3; i++) drop(c, now + Math.random() * 0.1); nextDrop = now + 0.05 + (1 - rain) * 0.3; }
  if (paused) return;
  if (!nextCrow) nextCrow = now + 6 + Math.random() * 10;
  if (!nextWolf) nextWolf = now + 15 + Math.random() * 20;
  if (now > nextCrow) { if (night < 0.3 && rain < 0.5) crow(c, now, Math.random() * 1.6 - 0.8); nextCrow = now + 12 + Math.random() * 25; }
  if (now > nextWolf) {
    // gdy wataha jest na mapie, słychać ją dużo częściej i bliżej: wycie, ujadanie, warczenie
    const pan = Math.random() * 1.6 - 0.8, pick = Math.random();
    if (wolvesNear) { if (pick < 0.4) wolf(c, now, pan); else if (pick < 0.7) yips(c, now, pan); else snarl(c, now, pan); }
    else if (night > 0.6) { if (pick < 0.75) wolf(c, now, pan); else yips(c, now, pan); }
    nextWolf = now + (wolvesNear ? 7 + Math.random() * 9 : 25 + Math.random() * 30);
  }
}

let nextDrip = 0, nextPick = 0, caveEcho: { input: GainNode } | null = null;
/** Pogłos sztolni: krótkie echo z wygaszaniem (opóźnienie ze sprzężeniem przez filtr), wspólne dla kapania i kilofów */
function echoBus(c: AudioContext): GainNode {
  if (caveEcho) return caveEcho.input;
  const input = c.createGain(), delay = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain();
  delay.delayTime.value = 0.23; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 2400; wet.gain.value = 0.5;
  input.connect(busGain.amb ?? master!);
  input.connect(delay); delay.connect(lp).connect(fb).connect(delay); lp.connect(wet).connect(busGain.amb ?? master!);
  caveEcho = { input };
  return input;
}
/** Kropla spadająca do kałuży: krótkie „plum” z opadającym tonem, odbite echem od skały */
function drip(c: AudioContext, at: number, pan: number, gain: number): void {
  const o = c.createOscillator(); o.type = 'sine';
  const f0 = 900 + Math.random() * 900;
  o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f0 * 2.1, at + 0.035);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09 * gain, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  const p = c.createStereoPanner(); p.pan.value = pan;
  o.connect(g).connect(p).connect(echoBus(c));
  o.start(at); o.stop(at + 0.12);
}
/**
 * Dźwięki sztolni zamiast łąki: wiatr i deszcz cichną, ze stropu kapie woda (`water` 0–1 = gęstsze kapanie),
 * a z dalszych chodników niesie się echo kilofów, gdy ktoś kopie (`picks` = ilu górników pracuje).
 */
export function caveSounds(water: number, picks: number): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  const now = c.currentTime;
  if (wind) wind.gain.gain.setTargetAtTime(0, now, 0.4);
  if (rainNoise) rainNoise.gain.gain.setTargetAtTime(0, now, 0.4);
  if (now > nextDrip) {
    drip(c, now, Math.random() * 1.4 - 0.7, 0.5 + water * 0.7);
    if (Math.random() < 0.3) drip(c, now + 0.18 + Math.random() * 0.2, Math.random() * 1.4 - 0.7, 0.4 + water * 0.5);
    nextDrip = now + (0.6 + Math.random() * 2.2) * (1 - water * 0.6);
  }
  if (picks > 0 && now > nextPick) {
    // daleki stuk kilofa o skałę: dwa twarde uderzenia z echem
    const pan = Math.random() * 1.6 - 0.8, p = c.createStereoPanner(); p.pan.value = pan; p.connect(echoBus(c));
    for (let i = 0; i < 2; i++) {
      const at = now + i * 0.06, o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(1500 + Math.random() * 500, at); o.frequency.exponentialRampToValueAtTime(600, at + 0.03);
      g.gain.setValueAtTime(0.025, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      o.connect(g).connect(p); o.start(at); o.stop(at + 0.06);
    }
    nextPick = now + (2.6 + Math.random() * 3) / Math.min(4, picks);
  }
}

/**
 * Dźwięk z miejsca na mapie: `near` 0..1 (1 = przy środku ekranu), `pan` -1..1 (lewo/prawo).
 * Daleko — cicho i bez wysokich tonów nie ma sensu grać, więc poniżej progu po prostu milczymy.
 */
export function playAt(kind: WorldSound, near: number, pan: number, gain = 1): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running' || near < 0.05) return;
  const list = WORLD[kind];
  const buf = buffers.get(list[Math.floor(Math.random() * list.length)]!);
  if (!buf) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.92 + Math.random() * 0.16;
  const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  // głośność z odległości opada łagodniej niż z kwadratem — z bliska wyraźnie, z daleka cicho, ale słychać
  const level = Math.pow(near, 1.5) * gain;
  const g = c.createGain(); g.gain.value = level;
  src.connect(g).connect(p).connect(worldSfx ?? master!);
  src.start();
  duck(level);
}

/**
 * Głos chłopa przy odzywce: bełkot sylab jak w starych strategiach, długi tyle co zdanie.
 * Każdy człowiek ma swoją wysokość głosu (z id), więc dwóch różnych brzmi inaczej.
 */
export function talk(text: string, voice: number, shout = false, gain = 1, pan = 0): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running' || gain <= 0.01) return;
  // rozmowa w osadzie: ciszej i z boku, tam gdzie stoją rozmówcy
  const outN = c.createGain(); outN.gain.value = gain;
  const panN = c.createStereoPanner(); panN.pan.value = Math.max(-1, Math.min(1, pan));
  outN.connect(panN).connect(worldSfx ?? master!);
  duck(gain * 0.5);
  // okrzyk żołnierza: niżej, krócej, głośniej i ostrzej niż gadanie chłopa
  const base = (95 + (voice % 7) * 14) * (shout ? 0.82 : 1);
  const n = Math.min(shout ? 10 : 26, Math.max(shout ? 2 : 4, Math.round(text.length / (shout ? 3.2 : 2.6))));
  const t0 = c.currentTime + 0.02;
  for (let i = 0; i < n; i++) {
    const at = t0 + i * (shout ? 0.085 : 0.1) + Math.random() * 0.025;
    const o = c.createOscillator(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    // intonacja: zdanie lekko opada pod koniec, pytanie by rosło
    const tone = base * (1 + Math.sin(i * 1.7 + voice) * 0.12) * (1 - (i / n) * 0.15);
    o.frequency.setValueAtTime(tone, at);
    o.frequency.linearRampToValueAtTime(tone * (0.9 + Math.random() * 0.2), at + 0.08);
    // dwa formanty: „samogłoska” zmienia się z sylaby na sylabę
    f.type = 'bandpass'; f.frequency.value = 450 + Math.random() * 500; f.Q.value = 6;
    f2.type = 'bandpass'; f2.frequency.value = 1100 + Math.random() * 900; f2.Q.value = 8;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(shout ? (i === 0 ? 0.95 : 0.75) : 0.5, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
    o.connect(f).connect(g); o.connect(f2).connect(g);
    g.connect(outN);
    o.start(at); o.stop(at + 0.1);
  }
}

// --- więcej przyrody i osady: ptaki o świcie, świerszcze wieczorem, puszczyk nocą, grzmot w burzy, dzwon, róg ---
let nextBird = 0, nextCricket = 0, nextOwl = 0, nextThunder = 0, lastBellHour = -1;

function out2(c: AudioContext, pan: number, gain: number): GainNode {
  const p = c.createStereoPanner(); p.pan.value = pan; p.connect(busGain.amb ?? master!);
  const g = c.createGain(); g.gain.value = gain; g.connect(p);
  return g;
}

/** Ptak: kilka szybkich, wysokich ćwierknięć z glissandem */
function bird(c: AudioContext, at: number): void {
  const o = out2(c, Math.random() * 1.6 - 0.8, 0.06);
  const n = 3 + Math.floor(Math.random() * 5), base = 2600 + Math.random() * 1600;
  for (let i = 0; i < n; i++) {
    const t = at + i * (0.07 + Math.random() * 0.06);
    const s = c.createOscillator(); s.type = 'sine';
    s.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t);
    s.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.05);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    s.connect(g).connect(o); s.start(t); s.stop(t + 0.07);
  }
}

/** Świerszcz: szybkie cykanie wysokiego tonu w seriach */
function cricket(c: AudioContext, at: number): void {
  const o = out2(c, Math.random() * 1.8 - 0.9, 0.025);
  const f = 4200 + Math.random() * 600;
  for (let burst = 0; burst < 3; burst++)
    for (let i = 0; i < 6; i++) {
      const t = at + burst * 0.45 + i * 0.035;
      const s = c.createOscillator(); s.type = 'square'; s.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      s.connect(g).connect(o); s.start(t); s.stop(t + 0.03);
    }
}

/** Puszczyk: „hu… huuu-hu-hu” nisko, miękko */
function owl(c: AudioContext, at: number): void {
  const o = out2(c, Math.random() * 1.6 - 0.8, 0.12);
  const notes: [number, number, number][] = [[0, 0.35, 420], [0.7, 0.6, 400], [1.4, 0.18, 380], [1.65, 0.3, 370]];
  for (const [dt, len, f] of notes) {
    const t = at + dt;
    const s = c.createOscillator(); s.type = 'sine'; s.frequency.setValueAtTime(f * 1.03, t); s.frequency.linearRampToValueAtTime(f * 0.94, t + len);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(g).connect(o); s.start(t); s.stop(t + len + 0.05);
  }
}

/** Grzmot: trzask i długi, toczący się niski pomruk */
function thunder(c: AudioContext, at: number): void {
  const rec = pick(NATURE.thunder);
  if (rec) {
    // nagrany grzmot (0 A.D.), trochę wolniej i niżej co drugi raz, żeby się nie powtarzał
    const src = c.createBufferSource(); src.buffer = rec; src.playbackRate.value = 0.85 + Math.random() * 0.2;
    src.connect(out2(c, Math.random() * 1.2 - 0.6, 0.9)); src.start(at);
    return;
  }
  if (!noise) return;
  const o = out2(c, Math.random() * 1.2 - 0.6, 1);
  const src = c.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = 0.25;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, at); f.frequency.exponentialRampToValueAtTime(90, at + 3.5);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.9, at + 0.05); g.gain.exponentialRampToValueAtTime(0.35, at + 0.6);
  g.gain.setValueAtTime(0.35, at + 1.2); g.gain.exponentialRampToValueAtTime(0.001, at + 4.5);
  src.connect(f).connect(g).connect(o); src.start(at); src.stop(at + 4.6);
}

/** Róg wojenny: niski, chropowaty dźwięk narastający i opadający — wróg wyrusza */
export function warHorn(): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  const at = c.currentTime + 0.05;
  const rec = pick(NATURE.horn);
  if (rec) {
    // nagrany róg (0 A.D.) z echem lasu: wróg wyrusza
    const src = c.createBufferSource(); src.buffer = rec;
    const g = c.createGain(); g.gain.value = 0.8; src.connect(g).connect(worldSfx ?? master!); g.connect(forestEcho(c));
    src.start(at);
    return;
  }
  const o = c.createGain(); o.gain.value = 0.5; o.connect(worldSfx ?? master!);
  for (const [mul, det] of [[1, 0], [1.005, 3], [2, 0]] as const) {
    const s = c.createOscillator(); s.type = 'sawtooth';
    s.frequency.setValueAtTime(110 * mul, at); s.frequency.linearRampToValueAtTime(130 * mul, at + 0.4); s.frequency.setValueAtTime(130 * mul, at + 2.2); s.frequency.linearRampToValueAtTime(118 * mul, at + 2.8);
    s.detune.value = det;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(mul === 2 ? 0.15 : 0.35, at + 0.35); g.gain.setValueAtTime(mul === 2 ? 0.15 : 0.35, at + 2.3); g.gain.exponentialRampToValueAtTime(0.001, at + 3);
    s.connect(f).connect(g).connect(o); s.start(at); s.stop(at + 3.1);
  }
}

/** Dzwon alarmowy: szybkie, nerwowe uderzenia — atak na osadę */
export function alarmBell(): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  const at = c.currentTime + 0.02;
  const o = c.createGain(); o.gain.value = 0.25; o.connect(worldSfx ?? master!);
  for (let k = 0; k < 4; k++) {
    const t = at + k * 0.28;
    for (const [mul, amp] of [[1, 1], [2.7, 0.4], [4.1, 0.2]] as const) {
      const s = c.createOscillator(); s.type = 'sine'; s.frequency.value = 880 * mul;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      s.connect(g).connect(o); s.start(t); s.stop(t + 0.55);
    }
  }
}

/** Tło z nagrań w pętli: kolejne warianty z płynnym przejściem (bez słyszalnego szwu), głośność płynnie za porą dnia */
const beds = new Map<string, { gain: GainNode; until: number }>();
function bed(c: AudioContext, key: string, list: string[], level: number): void {
  let b = beds.get(key);
  if (!b) {
    if (level <= 0.001 || !pick(list)) return;
    const gain = c.createGain(); gain.gain.value = 0; gain.connect(busGain.amb ?? master!);
    b = { gain, until: 0 }; beds.set(key, b);
  }
  const now = c.currentTime;
  b.gain.gain.setTargetAtTime(level, now, 1.5);
  // następny wariant zaczyna się 2 s przed końcem poprzedniego, oba się przenikają
  if (now > b.until - 2 && level > 0.001) {
    const buf = pick(list);
    if (!buf) return;
    const src = c.createBufferSource(); src.buffer = buf;
    const x = c.createGain(); const t = Math.max(now, b.until - 2);
    x.gain.setValueAtTime(0.0001, t); x.gain.exponentialRampToValueAtTime(1, t + 2);
    x.gain.setValueAtTime(1, t + buf.duration - 2); x.gain.exponentialRampToValueAtTime(0.0001, t + buf.duration);
    src.connect(x).connect(b.gain); src.start(t); src.stop(t + buf.duration + 0.05);
    b.until = t + buf.duration;
  }
}

/** Woła się co klatkę z godziną gry: pora dnia decyduje, co słychać */
export function daySounds(hour: number, rain: number, paused: boolean): boolean {
  const c = ctx;
  if (!c || muted || c.state !== 'running' || paused) return false;
  const now = c.currentTime;
  if (!nextBird) { nextBird = now + 3; nextCricket = now + 4; nextOwl = now + 20; nextThunder = now + 10; }
  // tła z nagrań: śpiew ptaków od świtu (najgłośniej rano, w południe ciszej, milkną o zmierzchu), nocą świerszcze;
  // w deszczu ptaki i świerszcze cichną. Odgłosy wsi (kury, zwierzęta) za dnia, cicho w tle.
  const dawn = hour >= 4.5 && hour < 9 ? 1 : 0;
  const dayK = hour < 4.5 || hour >= 19.5 ? 0 : Math.min(1, (hour - 4.5) / 0.8, (19.5 - hour) / 1.2) * (dawn ? 1 : 0.55);
  const nightK = hour >= 20 || hour < 4.5 ? Math.min(1, hour >= 20 ? (hour - 20) / 0.8 : (4.5 - hour) / 0.6) : 0;
  const dry = 1 - Math.min(1, rain * 1.6);
  bed(c, 'day', NATURE.day, 0.22 * dayK * dry);
  bed(c, 'night', NATURE.night, 0.2 * nightK * dry);
  bed(c, 'farm', NATURE.farm, 0.07 * Math.min(1, dayK * 1.6) * dry);
  // świt i ranek: dodatkowe pojedyncze ćwierknięcia tylko gdy nagrania jeszcze się nie wczytały
  const recorded = !!pick(NATURE.day);
  if (now > nextBird) { if (!recorded && hour >= 4.5 && hour < 18 && rain < 0.4) bird(c, now); nextBird = now + (hour < 8 ? 1.5 + Math.random() * 3 : 6 + Math.random() * 10); }
  // wieczór i noc: świerszcze (syntezowane, gdy brak nagrania)
  if (now > nextCricket) { if (!pick(NATURE.night) && (hour >= 19 || hour < 4) && rain < 0.4) cricket(c, now); nextCricket = now + 1.5 + Math.random() * 2.5; }
  if (now > nextOwl) { if (hour >= 21 || hour < 4) owl(c, now); nextOwl = now + 25 + Math.random() * 30; }
  // burza: przy mocnym deszczu grzmot co kilkanaście sekund; zwraca true, żeby scena błysnęła
  let flash = false;
  if (now > nextThunder) { if (rain > 0.6) { thunder(c, now + 0.4 + Math.random() * 1.2); flash = true; } nextThunder = now + 12 + Math.random() * 18; }
  // dzwon w południe (3 uderzenia) i o zmierzchu (5)
  const h = Math.floor(hour);
  // dzwon bije tylko w południe (z daleka, z kościółka za lasem); poza tym odzywa się na alarm (alarmBell)
  if (h !== lastBellHour) {
    if (lastBellHour === 11 && h === 12) { const b = pick(NATURE.bell); if (b) { const src = c.createBufferSource(); src.buffer = b; src.connect(out2(c, Math.random() * 0.8 - 0.4, 0.3)); src.connect(forestEcho(c)); src.start(now + 0.1); } }
    lastBellHour = h;
  }
  return flash;
}

/** Szarpnięta struna lutni (półtony od D), głośność z odległości */
export function pluck(semi: number, near: number): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running' || near < 0.05) return;
  const at = c.currentTime + 0.01;
  const f = 293.66 * Math.pow(2, semi / 12);
  const o = c.createGain(); o.gain.value = near * near * 0.35; o.connect(busGain.amb ?? master!);
  for (const [mul, amp, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.15, 'sine']] as const) {
    const s = c.createOscillator(); s.type = type; s.frequency.value = f * mul;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(amp, at + 0.004); g.gain.exponentialRampToValueAtTime(0.001, at + 0.9 / mul + 0.3);
    s.connect(g).connect(o); s.start(at); s.stop(at + 1.3);
  }
}

// --- muzyka w tle: utwory z plików albo (bez plików) średniowieczne utwory składane na bieżąco ---
// Dzień: bordun (kwinta) i melodia w skali doryckiej na „flecie” i „lutni”, spokojnie.
// Noc: niżej, wolniej, w skali eolskiej, sam bordun z rzadkimi nutami. Atak: bębny i niski róg.
let musicNext = 0, musicStep = 0, drone: { o: OscillatorNode[]; g: GainNode } | null = null, droneRoot = 0;

function setDrone(c: AudioContext, root: number, level: number): void {
  if (!drone) {
    const g = c.createGain(); g.gain.value = 0; g.connect(busGain.music ?? master!);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.connect(g);
    const o = [0, 7, 12].map((_semi, i) => {
      const s = c.createOscillator(); s.type = i === 2 ? 'triangle' : 'sawtooth';
      const sg = c.createGain(); sg.gain.value = i === 2 ? 0.25 : 0.18; s.connect(sg).connect(f); s.start(); s.detune.value = (i - 1) * 4;
      return s;
    });
    drone = { o, g };
  }
  if (root !== droneRoot) {
    droneRoot = root;
    [0, 7, 12].forEach((semi, i) => drone!.o[i]!.frequency.setTargetAtTime(root * Math.pow(2, semi / 12), c.currentTime, 2));
  }
  drone.g.gain.setTargetAtTime(level, c.currentTime, 2.5);
}

function voice(c: AudioContext, at: number, f: number, len: number, kind: 'flute' | 'lute', gain: number): void {
  const out = busGain.music ?? master!;
  const g = c.createGain();
  if (kind === 'flute') {
    const s = c.createOscillator(); s.type = 'sine'; s.frequency.value = f;
    const vib = c.createOscillator(); vib.frequency.value = 5; const vg = c.createGain(); vg.gain.value = f * 0.006; vib.connect(vg).connect(s.frequency);
    const breath = c.createBiquadFilter(); breath.type = 'lowpass'; breath.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.12); g.gain.setValueAtTime(gain, at + len * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    s.connect(breath).connect(g).connect(out); s.start(at); vib.start(at); s.stop(at + len + 0.05); vib.stop(at + len + 0.05);
  } else {
    for (const [mul, amp] of [[1, 1], [2, 0.4], [3, 0.15]] as const) {
      const s = c.createOscillator(); s.type = mul === 1 ? 'triangle' : 'sine'; s.frequency.value = f * mul;
      const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, at); sg.gain.exponentialRampToValueAtTime(gain * amp, at + 0.005); sg.gain.exponentialRampToValueAtTime(0.0001, at + len * 1.6);
      s.connect(sg).connect(out); s.start(at); s.stop(at + len * 1.7);
    }
  }
}

function drum(c: AudioContext, at: number, low: boolean): void {
  const s = c.createOscillator(); s.type = 'sine';
  s.frequency.setValueAtTime(low ? 90 : 140, at); s.frequency.exponentialRampToValueAtTime(low ? 45 : 70, at + 0.25);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(low ? 0.9 : 0.5, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
  s.connect(g).connect(busGain.music ?? master!); s.start(at); s.stop(at + 0.45);
  if (noise) {
    const n = c.createBufferSource(); n.buffer = noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.25, at); ng.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
    n.connect(f).connect(ng).connect(busGain.music ?? master!); n.start(at, Math.random() * 0.5); n.stop(at + 0.1);
  }
}

/** Woła się co klatkę: night 0..1, danger = wróg nadchodzi albo trwa atak; w menu gra cicho sam bordun */
export function music(night: number, danger: boolean, inMenu: boolean, walking = false): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  setWalkFocus(walking && !inMenu);
  const now = c.currentTime;
  const root = night > 0.5 || danger ? 110 : 146.83; // A nocą i w boju, D za dnia
  setDrone(c, root, inMenu ? 0.05 : danger ? 0.09 : 0.06);
  if (now < musicNext - 0.2) return;
  const t = Math.max(now, musicNext);
  if (danger && playTracks(c, 'battle', false)) { musicNext = now + 1; return; }
  if (danger) {
    // bębny wojenne: ciężkie „bum — bum-bum”, co takt niski róg
    const beat = 0.42;
    drum(c, t, true); drum(c, t + beat, false); drum(c, t + beat * 1.5, false);
    if (musicStep % 4 === 0) voice(c, t, 110, beat * 3.5, 'flute', 0.05);
    musicStep++;
    musicNext = t + beat * 4;
    return;
  }
  // utwory z plików (public/music) mają pierwszeństwo; generowana muzyka gra, gdy plików brak
  if (playTracks(c, night > 0.5 ? 'night' : 'day', inMenu)) { musicNext = now + 1; return; }
  // utwór się skończył: cisza (słychać tylko otoczenie), potem nowy, inny utwór
  if (!piece || now > piece.end) {
    if (piece && now < piece.end + piece.rest) { musicNext = piece.end + piece.rest; return; }
    piece = newPiece(night > 0.5);
  }
  const pc = piece;
  // melodia: motyw utworu w odmianach (przesunięty o stopień, odwrócony, zwolniony), co takt akord lutni
  const bar = Math.floor(musicStep / pc.motif.length);
  const pos = musicStep % pc.motif.length;
  const varSeed = (bar * 7 + pc.seed) % 4;
  let idx = pc.motif[pos]!;
  if (idx >= 0) {
    if (varSeed === 1) idx += 2; else if (varSeed === 2) idx = pc.motif[0]! * 2 - idx + 2; else if (varSeed === 3 && pos % 2) idx = -1;
  }
  const len = pc.beat * (pos === pc.motif.length - 1 ? 2 : 1);
  if (pos === 0) {
    // akord na początek taktu: pryma i kwinta nisko
    voice(c, t, pc.root, pc.beat * 3, 'lute', pc.night ? 0.035 : 0.045);
    voice(c, t + 0.02, pc.root * 1.5, pc.beat * 3, 'lute', pc.night ? 0.025 : 0.035);
  }
  if (idx >= 0 && !(pc.night && Math.random() < 0.35)) {
    const sc = pc.scale;
    const deg = ((idx % sc.length) + sc.length) % sc.length, oct = Math.floor(idx / sc.length);
    const f = pc.root * 2 * Math.pow(2, (sc[deg]! + 12 * oct) / 12);
    voice(c, t, f, len, pc.lead, pc.night ? 0.05 : 0.065);
  }
  musicStep++;
  musicNext = t + len;
}

// --- generator utworów: każdy ma własną tonację, skalę, tempo, instrument i motyw (bez dwóch takich samych) ---
const SCALES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], ionian: [0, 2, 4, 5, 7, 9, 11] };
interface Piece { root: number; scale: number[]; beat: number; lead: 'flute' | 'lute'; motif: number[]; end: number; rest: number; night: boolean; seed: number }
let piece: Piece | null = null;
function newPiece(night: boolean): Piece {
  const c = ctx!;
  const R = Math.random;
  const day = [SCALES.dorian, SCALES.mixolydian, SCALES.ionian, SCALES.dorian, SCALES.aeolian];
  const nite = [SCALES.aeolian, SCALES.phrygian, SCALES.dorian];
  const scale = (night ? nite : day)[Math.floor(R() * (night ? nite.length : day.length))]!;
  const roots = night ? [110, 116.54, 123.47, 98] : [146.83, 130.81, 164.81, 174.61, 196 / 1.5];
  const root = roots[Math.floor(R() * roots.length)]!;
  // motyw: błądzenie po skali małymi krokami, z pauzami i powrotem do toniki na końcu
  const n = 6 + Math.floor(R() * 7);
  const motif: number[] = [];
  let cur = Math.floor(R() * 3);
  for (let i = 0; i < n - 1; i++) {
    if (R() < 0.14) { motif.push(-1); continue; }
    cur = Math.max(-2, Math.min(9, cur + [-2, -1, -1, 1, 1, 2, 0, 3][Math.floor(R() * 8)]!));
    motif.push(cur);
  }
  motif.push(0);
  const beat = night ? 0.9 + R() * 0.7 : 0.45 + R() * 0.4;
  const length = night ? 50 + R() * 50 : 70 + R() * 70;
  musicStep = 0;
  return { root, scale, beat, lead: R() < (night ? 0.7 : 0.45) ? 'lute' : 'flute', motif, end: c.currentTime + length, rest: 12 + R() * 30, night, seed: Math.floor(R() * 100) };
}

// --- utwory z plików: public/music/<plik>.ogg, nastrój wybiera, kiedy grają; między utworami chwila ciszy ---
type Mood = 'day' | 'night' | 'battle' | 'menu';
/** Lista utworów (darmowe, CC0 — źródła w docs/zasoby.md). Pusta lista = muzyka generowana. */
export const MUSIC_TRACKS: { file: string; moods: Mood[] }[] = [
  { file: 'kings-feast.ogg', moods: ['menu', 'day'] },
  { file: 'minstrel-dance.ogg', moods: ['day'] },
  { file: 'peasantry.ogg', moods: ['day'] },
  { file: 'old-tower-inn.ogg', moods: ['night', 'menu'] },
  { file: 'medievals5.ogg', moods: ['night'] },
  { file: 'battle.ogg', moods: ['battle'] },
];
let trackEl: HTMLAudioElement | null = null, trackGain: GainNode | null = null, trackMood: Mood | null = null, trackFile = '', trackRestUntil = 0;
/** Nastrój, o który prosi gra, i od kiedy (zmiana utworu dopiero, gdy prośba się utrzyma — alarm migający co sekundę nie przełącza muzyki) */
let askMood: Mood | null = null, askSince = 0;
/** Utwory wyciszane po zmianie nastroju; nowy utwór nie zacznie się, póki stary całkiem nie ucichnie i nie stanie */
const fading = new Set<HTMLAudioElement>();
function playTracks(c: AudioContext, mood: Mood, inMenu: boolean): boolean {
  const want: Mood = inMenu ? 'menu' : mood;
  const list = MUSIC_TRACKS.filter((x) => x.moods.includes(want));
  if (!list.length) { stopTrack(c); return false; }
  if (want !== askMood) { askMood = want; askSince = c.currentTime; }
  if (trackEl && trackMood === want) return true;
  // inny nastrój: przełącza dopiero po chwili (do walki szybko, z walki i między dniem a nocą wolniej)
  if (trackEl && trackMood !== want) {
    const hold = want === 'battle' ? 1.5 : trackMood === 'battle' ? 8 : 4;
    if (c.currentTime - askSince < hold) return true;
    stopTrack(c);
  }
  if (fading.size) return true; // stary jeszcze wybrzmiewa
  if (c.currentTime < trackRestUntil) return true;
  const pick = list.filter((x) => x.file !== trackFile);
  const tr = (pick.length ? pick : list)[Math.floor(Math.random() * (pick.length ? pick.length : list.length))]!;
  const el = new Audio(`./music/${tr.file}`);
  el.crossOrigin = 'anonymous';
  const src = c.createMediaElementSource(el);
  const g = c.createGain(); g.gain.value = 0; src.connect(g).connect(busGain.music ?? master!);
  g.gain.setTargetAtTime(0.55, c.currentTime, 2);
  // zdarzenia dotyczą tylko tego utworu: stary, wyciszony utwór nie może skasować bieżącego
  el.addEventListener('ended', () => { fading.delete(el); if (trackEl === el) { trackRestUntil = c.currentTime + 15 + Math.random() * 35; trackEl = null; trackGain = null; trackMood = null; } });
  void el.play().catch(() => { fading.delete(el); if (trackEl === el) { trackEl = null; trackGain = null; trackMood = null; } });
  trackEl = el; trackGain = g; trackMood = want; trackFile = tr.file;
  return true;
}
function stopTrack(c: AudioContext): void {
  if (!trackEl || !trackGain) return;
  const el = trackEl, g = trackGain;
  g.gain.setTargetAtTime(0, c.currentTime, 0.6);
  fading.add(el);
  setTimeout(() => { el.pause(); el.removeAttribute('src'); el.load(); fading.delete(el); }, 3000);
  trackEl = null; trackGain = null; trackMood = null;
}

/**
 * Zwierzęta w osadzie (syntezowane): szczekanie psa, gdakanie kury, chrząkanie świni.
 * `near` 0..1 (blisko kamery = głośno), `pan` -1..1.
 */
export function animal(kind: 'bark' | 'cluck' | 'grunt', near: number, pan: number): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running' || near < 0.05) return;
  const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  const out = c.createGain(); out.gain.value = near * near;
  out.connect(p).connect(worldSfx ?? master!);
  const t0 = c.currentTime + 0.01;
  if (kind === 'bark') {
    // „hau hau”: dwa krótkie, chropawe szczeknięcia z opadającym tonem
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const at = t0 + i * (0.22 + Math.random() * 0.08);
      const o = c.createOscillator(); o.type = 'sawtooth';
      const f0 = 330 + Math.random() * 80;
      o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, at + 0.13);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2.2;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.5, at + 0.012); g.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
      o.connect(f).connect(g).connect(out); o.start(at); o.stop(at + 0.17);
      if (noise) {
        const ns = c.createBufferSource(); ns.buffer = noise; ns.playbackRate.value = 0.8;
        const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1300; nf.Q.value = 1.2;
        const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, at); ng.gain.exponentialRampToValueAtTime(0.25, at + 0.01); ng.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
        ns.connect(nf).connect(ng).connect(out); ns.start(at); ns.stop(at + 0.12);
      }
    }
  } else if (kind === 'cluck' && pick(NATURE.hen)) {
    // nagrane gdakanie kury (0 A.D.)
    const src = c.createBufferSource(); src.buffer = pick(NATURE.hen)!; src.playbackRate.value = 0.92 + Math.random() * 0.18;
    const g = c.createGain(); g.gain.value = 0.7; src.connect(g).connect(out); src.start(t0);
  } else if (kind === 'cluck') {
    // gdakanie: kilka szybkich, wysokich „ko-ko-ko” i dłuższe na końcu
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const at = t0 + i * 0.09 + (i === n - 1 ? 0.08 : 0);
      const o = c.createOscillator(); o.type = 'square';
      const f0 = 700 + Math.random() * 200, len = i === n - 1 ? 0.16 : 0.05;
      o.frequency.setValueAtTime(f0, at); o.frequency.linearRampToValueAtTime(f0 * (i === n - 1 ? 1.4 : 0.85), at + len);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 3;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.12, at + 0.008); g.gain.exponentialRampToValueAtTime(0.001, at + len);
      o.connect(f).connect(g).connect(out); o.start(at); o.stop(at + len + 0.02);
    }
  } else {
    // chrząkanie: niski, chrapliwy pomruk raz albo dwa razy
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const at = t0 + i * 0.3;
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(95 + Math.random() * 20, at); o.frequency.linearRampToValueAtTime(70, at + 0.22);
      const am = c.createGain(); am.gain.value = 0.6;
      const lfo = c.createOscillator(); lfo.frequency.value = 28; const lg = c.createGain(); lg.gain.value = 0.4; lfo.connect(lg).connect(am.gain);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.6, at + 0.03); g.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
      o.connect(am).connect(f).connect(g).connect(out); o.start(at); lfo.start(at); o.stop(at + 0.27); lfo.stop(at + 0.27);
    }
  }
}
