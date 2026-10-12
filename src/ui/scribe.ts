/**
 * Skryba w lewym górnym rogu: okrągły portret z gęsim piórem i krótka wiadomość, która wysuwa się,
 * chwilę wisi i znika. Ta sama wiadomość nie powtarza się częściej niż raz na minutę.
 */
/** Doradca wojenny: wąsy, kapalin, kolczuga, w tle sztandar */
const HERALD = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
  <defs><radialGradient id="hb" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#7a1d16"/><stop offset="1" stop-color="#2e0b08"/></radialGradient></defs>
  <circle cx="24" cy="24" r="23" fill="url(#hb)"/>
  <path d="M7 46c1-11 8-15 17-15s16 4 17 15z" fill="#7c8088" stroke="#1c120a"/>
  <path d="M15 46c1-7 4-10 9-10s8 3 9 10z" fill="#a32a22" stroke="#1c120a" stroke-width=".8"/>
  <circle cx="24" cy="22" r="8.5" fill="#d9a877" stroke="#1c120a"/>
  <path d="M17 26c2 2 5 1 7 0c2 1 5 2 7 0" stroke="#6b4a2b" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M14 19c1-8 19-8 20 0z" fill="#5a5e66" stroke="#1c120a"/>
  <path d="M11 19.5h26" stroke="#5a5e66" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="21" cy="21.5" r=".9"/><circle cx="27" cy="21.5" r=".9"/>
</svg>`;

const FACE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
  <defs><radialGradient id="sb" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#6b4a2a"/><stop offset="1" stop-color="#22150a"/></radialGradient></defs>
  <circle cx="24" cy="24" r="23" fill="url(#sb)"/>
  <path d="M8 46c1-10 7-14 16-14s15 4 16 14z" fill="#5a3d6b" stroke="#1c120a"/>
  <circle cx="24" cy="21" r="9" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M14 19c0-9 20-9 20 0c-3-4-17-4-20 0z" fill="#7a3a2a" stroke="#1c120a"/>
  <path d="M20 27c2 1.5 6 1.5 8 0" stroke="#7a4a2c" fill="none"/>
  <path d="M36 44l7-22c-4 3-7 11-7 22z" fill="#f6ecd0" stroke="#1c120a" stroke-width=".8"/>
</svg>`;

export type Speaker = 'scribe' | 'herald';
export interface Scribe { say(key: string, text: string, urgent?: boolean, who?: Speaker): void }

const NAMES: Record<Speaker, string> = { scribe: 'Skryba Bartłomiej', herald: 'Wojewoda Mieszko' };

export function createScribe(onSpeak: () => void): Scribe {
  const box = document.createElement('div');
  box.className = 'scribe';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  document.body.append(box);
  const last = new Map<string, number>();
  // nowa wiadomość pojawia się na górze, starsze zjeżdżają niżej, bledną i znikają
  const show = (text: string, urgent: boolean, who: Speaker): void => {
    const card = document.createElement('div');
    card.className = `scribe-card by-${who}${urgent ? ' urgent' : ''}`;
    card.innerHTML = `<span class="scribe-face">${who === 'herald' ? HERALD : FACE}</span><span class="scribe-body"><span class="scribe-name">${NAMES[who]}</span><span class="scribe-text"></span></span>`;
    card.querySelector('.scribe-text')!.textContent = text;
    for (const old of Array.from(box.children) as HTMLElement[]) {
      old.classList.add('older');
      setTimeout(() => old.classList.add('out'), 2500);
      setTimeout(() => old.remove(), 3100);
    }
    box.prepend(card);
    while (box.children.length > 3) box.lastElementChild!.remove();
    onSpeak();
    setTimeout(() => card.classList.add('out'), 6500);
    setTimeout(() => card.remove(), 7100);
  };
  return {
    say(key, text, urgent = false, who: Speaker = 'scribe') {
      const now = performance.now();
      if ((last.get(key) ?? -1e9) > now - 60000) return;
      last.set(key, now);
      show(text, urgent, who);
    },
  };
}
