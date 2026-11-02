import { befriend, dropNotice, onFreshNotice, playerById, type Notice } from '../net/social';
import { onMessage } from '../net/messages';
import { noticeMark, noticeText } from './noticeText';
import { avatarSvg } from './avatars';
import { tx } from '../i18n';

/**
 * Okienka w rogu ekranu, gdy przychodzi powiadomienie (Michał 2.11.2026: „żeby to wyświetlało się równocześnie”):
 * znajomy wygrał albo przegrał bitwę, wszedł na nowy poziom, ktoś chce być znajomym, nowa uwaga testera.
 * W menu i w grze z botami; w meczu przez sieć nie przeszkadzamy (wszystko i tak czeka w dzwoneczku).
 * Zaproszenia do gry pokazuje osobne okienko z online.ts (przychodzą też na żywo kanałem), więc tu ich nie ma.
 */
export interface ToastActions {
  profile(id: string): void;
  friends(tab: number): void;
  adminNotes(id?: number): void;
  myNotes(id?: number): void;
  /** Rozmowa ze znajomym */
  chat(id: string): void;
  /** true w meczu przez sieć */
  quiet(): boolean;
  sound?(): void;
}

export function startSocialToasts(go: ToastActions): void {
  const stack = document.createElement('div');
  stack.className = 'soc-toasts';
  stack.setAttribute('role', 'log');
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-label', tx('Powiadomienia', 'Notifications'));
  document.body.append(stack);
  const btn = (text: string, run: () => void, cls: string): HTMLButtonElement => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text;
    b.addEventListener('click', run);
    return b;
  };
  // wiadomość od znajomego: okienko z treścią i „Odpowiedz” (gdy rozmowa z nim jest właśnie otwarta — bez okienka)
  onMessage((m) => {
    if (go.quiet() || document.querySelector('.fr-chat-head')?.getAttribute('data-with') === m.from_id) return;
    void playerById(m.from_id).then((p) => {
      const t = document.createElement('div');
      t.className = 'soc-toast panel message';
      const av = document.createElement('span'); av.className = 'net-shield'; av.innerHTML = avatarSvg(p?.avatar ?? 0, 38);
      const mark = document.createElement('span'); mark.className = 'soc-mark'; mark.textContent = '✉'; mark.setAttribute('aria-hidden', 'true');
      const body = document.createElement('div'); body.className = 'soc-body';
      const text = document.createElement('span'); text.className = 'soc-text';
      const who = document.createElement('strong'); who.textContent = `${p?.nick ?? '?'}: `;
      text.append(who, document.createTextNode(m.body.length > 160 ? m.body.slice(0, 160) + '…' : m.body));
      const acts = document.createElement('div'); acts.className = 'soc-acts';
      const close = (): void => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
      acts.append(btn(tx('Odpowiedz', 'Reply'), () => { close(); go.chat(m.from_id); }, 'btn-ok soc-btn'));
      const x = btn('✕', close, 'soc-x'); x.setAttribute('aria-label', tx('Zamknij', 'Close'));
      body.append(text, acts);
      t.append(av, mark, body, x);
      stack.prepend(t);
      while (stack.children.length > 4) stack.lastElementChild?.remove();
      go.sound?.();
      setTimeout(close, 10_000);
    });
  });
  onFreshNotice((n: Notice) => {
    if (n.kind === 'invite' || go.quiet()) return;
    const t = document.createElement('div');
    t.className = `soc-toast panel ${n.kind}${n.kind === 'friend_match' ? (n.payload?.won ? ' won' : ' lost') : ''}`;
    const av = document.createElement('span'); av.className = 'net-shield'; av.innerHTML = avatarSvg(n.from_avatar, 38);
    const mark = document.createElement('span'); mark.className = 'soc-mark'; mark.textContent = noticeMark(n); mark.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div'); body.className = 'soc-body';
    const text = document.createElement('span'); text.className = 'soc-text'; text.textContent = noticeText(n);
    const acts = document.createElement('div'); acts.className = 'soc-acts';
    const close = (): void => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
    const id = n.from_id ?? '';
    if (n.kind === 'friend_request') {
      acts.append(btn(tx('Przyjmij', 'Accept'), () => { void befriend(id).then(() => dropNotice(n.id)); close(); }, 'btn-ok soc-btn'), btn(tx('Profil', 'Profile'), () => { close(); go.profile(id); }, 'btn-plain soc-btn'));
    } else if (n.kind === 'note') acts.append(btn(tx('Przejdź do uwagi', 'Open the note'), () => { close(); go.adminNotes(n.payload?.note); }, 'btn-plain soc-btn'));
    else if (n.kind === 'note_done') acts.append(btn(tx('Moje uwagi', 'My notes'), () => { close(); go.myNotes(n.payload?.note); }, 'btn-plain soc-btn'));
    else if (id) acts.append(btn(tx('Profil', 'Profile'), () => { close(); go.profile(id); }, 'btn-plain soc-btn'));
    const x = btn('✕', close, 'soc-x'); x.setAttribute('aria-label', tx('Zamknij', 'Close'));
    body.append(text, acts);
    t.append(av, mark, body, x);
    stack.prepend(t);
    while (stack.children.length > 4) stack.lastElementChild?.remove();
    go.sound?.();
    setTimeout(close, n.kind === 'friend_request' || n.kind === 'note' ? 12_000 : 7_000);
  });
}
