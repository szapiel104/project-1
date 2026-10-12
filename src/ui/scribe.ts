/**
 * Skryba w lewym górnym rogu: okrągły portret z gęsim piórem i krótka wiadomość, która wysuwa się,
 * chwilę wisi i znika. Ta sama wiadomość nie powtarza się częściej niż raz na minutę.
 */
const FACE = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
  <circle cx="24" cy="24" r="23" fill="#3b2716"/>
  <path d="M8 46c1-10 7-14 16-14s15 4 16 14z" fill="#5a3d6b" stroke="#1c120a"/>
  <circle cx="24" cy="21" r="9" fill="#e2bd94" stroke="#1c120a"/>
  <path d="M14 19c0-9 20-9 20 0c-3-4-17-4-20 0z" fill="#7a3a2a" stroke="#1c120a"/>
  <path d="M20 27c2 1.5 6 1.5 8 0" stroke="#7a4a2c" fill="none"/>
  <path d="M36 44l7-22c-4 3-7 11-7 22z" fill="#f6ecd0" stroke="#1c120a" stroke-width=".8"/>
</svg>`;

export interface Scribe { say(key: string, text: string, urgent?: boolean): void }

export function createScribe(onSpeak: () => void): Scribe {
  const box = document.createElement('div');
  box.className = 'scribe';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  document.body.append(box);
  const last = new Map<string, number>();
  return {
    say(key, text, urgent = false) {
      const now = performance.now();
      if ((last.get(key) ?? -1e9) > now - 60000) return;
      last.set(key, now);
      const card = document.createElement('div');
      card.className = `scribe-card${urgent ? ' urgent' : ''}`;
      card.innerHTML = `<span class="scribe-face">${FACE}</span><span class="scribe-text"></span>`;
      card.querySelector('.scribe-text')!.textContent = text;
      box.prepend(card);
      while (box.children.length > 4) box.lastElementChild!.remove();
      onSpeak();
      setTimeout(() => card.classList.add('out'), 6500);
      setTimeout(() => card.remove(), 7200);
    },
  };
}
