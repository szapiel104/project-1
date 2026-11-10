/** Ikony paska narzędzi edytora modeli (proste SVG 20×20, kolor z currentColor) */
const P: Record<string, string> = {
  move: 'M10 2l3 3h-2v4h4V7l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H5v2l-3-3 3-3v2h4V5H7z',
  rotate: 'M10 3a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 10 5v2.5L6.5 4 10 .5z',
  scale: 'M3 3h6v2H6.4l3.3 3.3-1.4 1.4L5 6.4V9H3zm14 14h-6v-2h2.6l-3.3-3.3 1.4-1.4 3.3 3.3V11h2z',
  copy: 'M6 2h9a2 2 0 0 1 2 2v9h-2V4H6zM3 6h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v9h9V8z',
  mirrorX: 'M9 2h2v16H9zM7 5v10L1 10zm6 0l6 5-6 5zm1.5 3.2v3.6L16.6 10z',
  mirrorZ: 'M2 9v2h16V9zm3-2h10L10 1zm0 6l5 6 5-6zm3.2 1.5h3.6L10 16.6z',
  drop: 'M9 2h2v9.2l3.3-3.3 1.4 1.4L10 15 4.3 9.3l1.4-1.4L9 11.2zM2 17h16v2H2z',
  both: 'M2 4l8-2v16l-8-2zm10-2l6 2v12l-6 2v-2l4-1.3V5.3L12 4z',
  del: 'M7 2h6v2h4v2H3V4h4zm-2 5h10l-1 11H6zm3 2v7h1V9zm3 0v7h1V9z',
  undo: 'M8 4V1L2 6l6 5V8h4a4 4 0 0 1 0 8H7v2h5a6 6 0 0 0 0-12z',
  save: 'M3 2h11l3 3v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm3 2v4h7V4zm4 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  file: 'M10 2v9l3-3 1.4 1.4L10 13.8 5.6 9.4 7 8l3 3V2zM3 15h14v3H3z',
  focus: 'M2 2h5v2H4v3H2zm11 0h5v5h-2V4h-3zM2 13h2v3h3v2H2zm14 0h2v5h-5v-2h3zM10 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  align: 'M2 2h2v16H2zm4 3h8v4H6zm0 6h12v4H6z',
  pencil: 'M14.5 2.5l3 3L7 16H4v-3zM12.8 4.2l3 3',
};

export function icon(name: keyof typeof P | string): string {
  if (!(name in P)) return icon2(name);
  return `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path fill="currentColor" d="${P[name] ?? ''}"/></svg>`;
}
const P2: Record<string, string> = {
  redo: 'M12 4V1l6 5-6 5V8H8a4 4 0 0 0 0 8h5v2H8A6 6 0 0 1 8 6z',
  group: 'M2 2h7v7H2zm2 2v3h3V4zm7-2h7v7h-7zm2 2v3h3V4zM2 11h7v7H2zm2 2v3h3v-3zm7-2h7v7h-7zm2 2v3h3v-3z',
  ungroup: 'M1 1h6v6H1zm12 0h6v6h-6zM1 13h6v6H1zm12 0h6v6h-6zM8 9h4v2H8z',
  grid: 'M2 2h16v16H2zm2 2v4h4V4zm6 0v4h4V4zM4 10v4h4v-4zm6 0v4h4v-4z',
  hide: 'M10 4c4.5 0 7.5 4 8.5 6-.5 1-1.6 2.7-3.3 4l1.6 1.6-1.4 1.4L2.6 4.2 4 2.8l2 2C7.2 4.3 8.5 4 10 4zm-6 4.3l2.2 2.2A4 4 0 0 0 9.5 13.8l1.6 1.6c-.4.1-.7.1-1.1.1-4.5 0-7.5-4-8.5-6 .5-1 1.3-2.3 2.5-3.2z',
  show: 'M10 4c4.5 0 7.5 4 8.5 6-1 2-4 6-8.5 6S2.5 12 1.5 10C2.5 8 5.5 4 10 4zm0 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  alignL: 'M2 2h2v16H2zm4 3h10v4H6zm0 6h6v4H6z',
  alignC: 'M9 2h2v3h5v4h-5v2h3v4h-3v3H9v-3H6v-4h3V9H4V5h5z',
  alignR: 'M16 2h2v16h-2zM4 5h10v4H4zm4 6h6v4H8z',
  spread: 'M1 3h2v14H1zm16 0h2v14h-2zM5 7h3v6H5zm7 0h3v6h-3z',
  surface: 'M9 1h2v8.2l3.3-3.3 1.4 1.4L10 13 4.3 7.3l1.4-1.4L9 9.2zM1 15h18v4H1z',
  plinth: 'M5 4h10v6H5zM2 12h16l-1 5H3z',
  air: 'M6 3h8v6H6zM3 15c2-1.5 4-1.5 7 0s5 1.5 7 0v2c-2 1.5-4 1.5-7 0s-5-1.5-7 0z',
  grass: 'M2 17h16v2H2zM4 17l1-7 1.5 7zM8 17l1.5-10L11 17zM13 17l1.5-8L16 17z',
  night: 'M12.5 2A8 8 0 1 0 18 13.5 6.5 6.5 0 0 1 12.5 2z',
  noroof: 'M10 2l8 6h-2.5L10 4.2 4.5 8H2zM4 10h12v8H4zm4 3v5h4v-5z',
  wire: 'M10 1l8 5v8l-8 5-8-5V6zm0 2.3L4.5 6.7 10 10l5.5-3.3zM4 8.5v4.4l5 3.1v-4.4zm12 0l-5 3.1V16l5-3.1z',
  spin: 'M10 3a7 7 0 0 1 7 7h2l-3 4-3-4h2a5 5 0 1 0-1.5 3.6l1.4 1.4A7 7 0 1 1 10 3z',
  far: 'M1 16l5-8 3 5 2-3 4 6zM14 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
};
export function icon2(name: string): string {
  return `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path fill="currentColor" d="${P2[name] ?? ''}"/></svg>`;
}
