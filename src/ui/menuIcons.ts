/**
 * Ikony pozycji menu po lewej (Michał 3.11.2026: „menu po lewo mega czytelniej”) — proste kreski 24×24,
 * kolor z tekstu przycisku, żeby wszystko dało się rozpoznać jednym rzutem oka.
 */
export type MenuIcon = 'play' | 'resume' | 'new' | 'save' | 'load' | 'online' | 'friends' | 'settings' | 'help' | 'news' | 'notes' | 'quit' | 'flag';

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
};

export const menuIcon = (k: MenuIcon): string =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k]}</svg>`;
