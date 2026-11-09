import { tx } from '../i18n';

/**
 * Załoga budynku jako drużyna w grze RPG (Michał 9.11.2026: „w każdym budynku główki — kto dokładnie pracuje, wolne
 * miejsca”). Każdy pracownik, magazynier albo żołnierz na wieży ma kafel z twarzą, imieniem i tym, co robi; klik
 * zaznacza go i pokazuje na mapie. Wolne miejsca to kafle z przerywaną ramką, które wypełniają się, gdy ktoś przyjdzie.
 */
export interface CrewMember { id: number; name: string; doing: string; /** rodzaj żołnierza (archer, spearman…) albo brak = chłop */ kind?: string }
export interface CrewInfo { title: string; members: CrewMember[]; max: number; /** co zrobić, by wolne miejsce się zapełniło */ freeHint: string; /** same portrety bez imion (załoga wieży) */ compact?: boolean }

/** Twarz chłopa: słomiany kapelusz, lniana koszula */
export const PEASANT_FACE = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <rect width="32" height="32" fill="#4a3220"/>
  <path d="M5 32c0-7 4.5-10 11-10s11 3 11 10z" fill="#c9b48a" stroke="#1c120a"/>
  <path d="M13 22l3 4 3-4" fill="none" stroke="#8a6d3b" stroke-width="1.2"/>
  <circle cx="16" cy="15" r="5.8" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M13.6 15.2h.01M18.4 15.2h.01" stroke="#1c120a" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M6 11.5c3-1.4 17-1.4 20 0-2 1.3-18 1.3-20 0z" fill="#d9b25a" stroke="#1c120a"/>
  <path d="M10.5 11c.6-4.6 10.4-4.6 11 0z" fill="#e3c06a" stroke="#1c120a"/>
</svg>`;

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Klucz do sprawdzenia, czy trzeba przerysować (bez przebudowy co klatkę) */
export const crewKey = (c: CrewInfo): string => `${c.title}|${c.max}|${c.members.map((m) => `${m.id}:${m.doing}`).join(',')}`;

/** Sama drużyna (kafle), bez nagłówka — używa jej też okno magazynu */
export function crewParty(c: CrewInfo, face: (kind?: string) => string, pick?: (unit: number) => void): HTMLElement {
  // same głowy obok siebie (Michał 9.11.2026: „bez napisów, tylko głowy”); imię i zajęcie w dymku
  const party = node('div', 'keeper-party compact');
  for (let i = 0; i < Math.max(c.max, c.members.length); i++) {
    const m = c.members[i];
    if (!m) {
      const free = node('div', 'keeper-card free');
      free.innerHTML = '<span class="keeper-face"></span>';
      free.append(node('span', 'keeper-name', tx('Wolne miejsce', 'Free post')));
      free.title = c.freeHint;
      party.append(free);
      continue;
    }
    const card = node('button', 'keeper-card');
    card.type = 'button';
    card.innerHTML = `<span class="keeper-face">${face(m.kind)}</span>`;
    const txt = node('span', 'keeper-txt');
    txt.append(node('strong', 'keeper-name', m.name), node('span', 'keeper-doing', m.doing));
    card.append(txt);
    card.title = m.kind ? tx(`${m.doing}${m.name ? ` ${m.name}` : ''} — kliknij, by go zaznaczyć`, `${m.doing}${m.name ? ` ${m.name}` : ''} — click to select him`) : tx(`${m.name} — ${m.doing}. Kliknij, by pokazać na mapie`, `${m.name} — ${m.doing}. Click to show on the map`);
    card.setAttribute('aria-label', card.title);
    if (pick) card.addEventListener('click', () => pick(m.id));
    party.append(card);
  }
  return party;
}

/** Sekcja załogi z nagłówkiem „Pracownicy 1 / 2” */
export function renderCrew(c: CrewInfo, face: (kind?: string) => string, pick?: (unit: number) => void): HTMLElement[] {
  const head = node('p', 'logi-head');
  head.append(node('strong', '', c.title), node('em', 'keeper-count', `${c.members.length} / ${c.max}`));
  return [head, crewParty(c, face, pick)];
}
