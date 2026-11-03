/**
 * Ikony pozycji menu po lewej (Michał 3.11.2026: „menu po lewo mega czytelniej”) — proste kreski 24×24,
 * kolor z tekstu przycisku, żeby wszystko dało się rozpoznać jednym rzutem oka.
 */
export type MenuIcon = 'play' | 'resume' | 'new' | 'save' | 'load' | 'online' | 'friends' | 'settings' | 'help' | 'news' | 'notes' | 'quit' | 'flag'
  | 'eye' | 'gem' | 'sun' | 'tree' | 'gauge' | 'speaker' | 'layout' | 'crown' | 'mouse' | 'hammer' | 'scroll' | 'axe' | 'wheat' | 'flask' | 'moon' | 'sword' | 'shield';

const P: Record<MenuIcon, string> = {
  play: '<path d="M8 5v14l11-7z"/>',
  resume: '<path d="M8 5v14l11-7z"/>',
  new: '<path d="M4 20l7-7M14.5 3.5l6 6-9 9-6-6z M13 8l3 3"/>',
  save: '<path d="M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6"/>',
  load: '<path d="M3 7h6l2 2h10v10H3z M12 12v5 M9.5 14.5L12 17l2.5-2.5"/>',
  online: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17 M12 3.5c3 3 3 14 0 17 M12 3.5c-3 3-3 14 0 17"/>',
  friends: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14c3 0 5 2 5 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1"/>',
  help: '<path d="M4 5c3-1.5 6-1.5 8 0v15c-2-1.5-5-1.5-8 0z M20 5c-3-1.5-6-1.5-8 0v15c2-1.5 5-1.5 8 0z"/>',
  news: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z"/>',
  notes: '<path d="M5 3h10l4 4v14H5z M15 3v4h4 M8 12h8 M8 16h6"/>',
  quit: '<path d="M14 4H5v16h9 M10 12h11 M17 8l4 4-4 4"/>',
  flag: '<path d="M5 21V4 M5 4h12l-2 4 2 4H5"/>',
  // ikony rozdziałów „Jak grać” i stron ustawień (Michał 3.11.2026)
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9z M3 9h18 M9 4l3 16 3-16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5 M12 19v2.5 M2.5 12H5 M19 12h2.5 M5.3 5.3l1.8 1.8 M16.9 16.9l1.8 1.8 M5.3 18.7l1.8-1.8 M16.9 7.1l1.8-1.8"/>',
  tree: '<path d="M12 3l6 8h-3l4 6H5l4-6H6z M12 17v4"/>',
  gauge: '<path d="M3.5 17a8.5 8.5 0 1 1 17 0 M12 17l4-6"/><circle cx="12" cy="17" r="1.3"/>',
  speaker: '<path d="M4 9.5h4L13 5v14l-5-4.5H4z M16.5 9a4 4 0 0 1 0 6 M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  layout: '<path d="M3.5 4.5h17v15h-17z M3.5 9h17 M9 9v10.5"/>',
  crown: '<path d="M3.5 18h17 M4 16l-1-9 5.5 4L12 5l3.5 6L21 7l-1 9z"/>',
  mouse: '<rect x="6.5" y="3" width="11" height="18" rx="5.5"/><path d="M12 3v6"/>',
  hammer: '<path d="M14 4l6 6-2.5 2.5-6-6z M11.5 6.5L4 14l3 3 7.5-7.5 M4 14l-1 1 3 3 1-1"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z M7 16V4 M10 9h5 M10 12.5h5"/>',
  axe: '<path d="M14 3c4 1 6 4 6 8l-6-2z M14 3L5 21 M14 9l-3 1"/>',
  wheat: '<path d="M12 21V8 M12 8c-2-1.5-2-4 0-5.5 2 1.5 2 4 0 5.5z M12 13c-3 0-4.5-2-4.5-4 3 0 4.5 2 4.5 4z M12 13c3 0 4.5-2 4.5-4-3 0-4.5 2-4.5 4z M12 18c-3 0-4.5-2-4.5-4 3 0 4.5 2 4.5 4z M12 18c3 0 4.5-2 4.5-4-3 0-4.5 2-4.5 4z"/>',
  flask: '<path d="M9.5 3h5 M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3 M7 15h10"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>',
  sword: '<path d="M20 4l-1 4-9 9-3-3 9-9z M7 14l-3 3 M5.5 15.5l3 3 M4 20l2-2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V6z M12 3v18"/>',
};

export const menuIcon = (k: MenuIcon): string =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]}</svg>`;
