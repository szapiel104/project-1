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
export type WorldSound = 'chop' | 'mine' | 'smith' | 'plank' | 'creak' | 'coins' | 'hit' | 'swing' | 'clang' | 'growl';
const WORLD: Record<WorldSound, string[]> = {
  chop: ['chop'], mine: ['mine-0', 'mine-1', 'mine-2'], smith: ['smith-0', 'smith-1', 'smith-2'], plank: ['plank-0', 'plank-1', 'plank-2'],
  creak: ['creak-1', 'creak-2', 'creak-3'], coins: ['coins'], hit: ['hit-0', 'hit-1', 'hit-2'], swing: ['swing-0', 'swing-1', 'swing-2'],
  clang: ['clang-0', 'clang-1'], growl: ['wolf'],
};
const buffers = new Map<string, AudioBuffer>();
let ambienceOn = false;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Osobne suwaki: efekty (budowa, burzenie), interfejs (kliknięcia), otoczenie (szum w tle) */
export type Bus = 'sfx' | 'ui' | 'amb';
const busGain: Partial<Record<Bus, GainNode>> = {};
const busLevel: Record<Bus, number> = { sfx: 1, ui: 1, amb: 1 };
let out: GainNode | null = null;
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
  master.connect(ctx.destination);
  for (const b of ['sfx', 'ui', 'amb'] as Bus[]) { const gn = ctx.createGain(); gn.gain.value = busLevel[b]; gn.connect(master); busGain[b] = gn; }
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const c = ctx;
  const names = new Set([...Object.values(FILES).flat(), ...Object.values(WORLD).flat()]);
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
  g.gain.value = 0.35;
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
  const g = c.createGain(); g.gain.value = near * near * 0.7 * gain;
  src.connect(g).connect(p).connect(busGain.sfx ?? master!);
  src.start();
}

/**
 * Głos chłopa przy odzywce: bełkot sylab jak w starych strategiach, długi tyle co zdanie.
 * Każdy człowiek ma swoją wysokość głosu (z id), więc dwóch różnych brzmi inaczej.
 */
export function talk(text: string, voice: number): void {
  const c = ctx;
  if (!c || muted || c.state !== 'running') return;
  const base = 95 + (voice % 7) * 14;
  const n = Math.min(26, Math.max(4, Math.round(text.length / 2.6)));
  const t0 = c.currentTime + 0.02;
  for (let i = 0; i < n; i++) {
    const at = t0 + i * 0.1 + Math.random() * 0.025;
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
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
    o.connect(f).connect(g); o.connect(f2).connect(g);
    g.connect(busGain.sfx ?? master!);
    o.start(at); o.stop(at + 0.1);
  }
}
