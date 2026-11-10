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
  return `<svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path fill="currentColor" d="${P[name] ?? ''}"/></svg>`;
}
