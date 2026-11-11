/**
 * Konto w podglądzie modeli (Michał 11.11.2026: „w edytorze niech widnieje konto i możliwość zalogowania się”):
 * po prawej w górnej belce — nick zalogowanego (klik: wylogowanie) albo „Zaloguj się” z małym oknem logowania.
 * Po zalogowaniu edytor sam sprawdza uprawnienia twórcy (modelEditor.ts, onAuthStateChange) i pokazuje „Edytuj”.
 */
import { tx } from '../i18n';
import { isAdmin, me, onAccount, progress, restore, sendReset, setNick, setPassword, signIn, signOut } from '../net/supa';

export function createViewerAccount(host: HTMLElement): void {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'menu-top acct';
  host.append(chip);
  const paint = (): void => {
    const m = me();
    chip.textContent = m ? `👤 ${m.nick || m.email}` : tx('Zaloguj się', 'Sign in');
    chip.title = m ? tx(`Konto: ${m.nick || m.email} — ustawienia, hasło, wylogowanie`, `Account: ${m.nick || m.email} — settings, password, sign out`) : tx('Zaloguj się kontem z gry (edycja modeli tylko dla twórcy)', 'Sign in with your game account (model editing is for the creator only)');
  };
  chip.onclick = () => { if (me()) openAccount(); else openLogin(); };
  onAccount(paint);
  paint();
  void restore().then(paint).catch(() => undefined);

  /** okno z wyglądem jak reszta podglądu: tło, ramka, tytuł */
  function dialog(titleText: string): { back: HTMLElement; box: HTMLElement; close: () => void } {
    const back = document.createElement('div');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40;display:grid;place-items:center';
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', titleText);
    box.style.cssText = 'background:#24221d;border:1px solid #d8b25a;padding:18px 20px;width:min(380px,92vw);color:#e8e0cc;display:flex;flex-direction:column;gap:8px;font-size:14px';
    const h = document.createElement('div'); h.textContent = titleText; h.style.cssText = 'color:#e9c766;font-weight:600;font-size:16px';
    box.append(h); back.append(box); document.body.append(back);
    const close = (): void => back.remove();
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    return { back, box, close };
  }
  const inputCss = 'font:inherit;color:#e8e0cc;background:#1a1814;border:1px solid #4a4436;padding:7px 8px;min-height:34px';
  const btnCss = 'font:inherit;font-size:13px;padding:7px 12px;min-height:34px;color:#e8e0cc;background:#2e2b24;border:1px solid #3a362d;cursor:pointer';
  /** ustawienia konta: nick, hasło, reset mailem, wylogowanie (to samo co panel konta w grze) */
  function openAccount(): void {
    const m = me();
    if (!m) return;
    const { box, close } = dialog(tx('Konto', 'Account'));
    const pr = progress();
    const info = document.createElement('div'); info.style.cssText = 'color:#bfb294;font-size:13px;line-height:1.5';
    info.textContent = `${m.email}${pr ? tx(` · poziom ${pr.level} · ${pr.matches} bitew`, ` · level ${pr.level} · ${pr.matches} battles`) : ''}${isAdmin() ? tx(' · administrator', ' · administrator') : ''}`;
    box.append(info);
    const section = (label: string): HTMLElement => { const d = document.createElement('div'); d.textContent = label; d.style.cssText = 'color:#e9c766;margin-top:6px'; box.append(d); return d; };
    const msg = (): HTMLElement => { const d = document.createElement('div'); d.setAttribute('role', 'status'); d.style.cssText = 'min-height:16px;font-size:13px'; return d; };
    const say = (el: HTMLElement, err: string | null, ok: string): void => { el.style.color = err ? '#ff9a8a' : '#9fd88a'; el.textContent = err ?? ok; };
    // nick
    section(tx('Nazwa gracza', 'Player name'));
    const nickRow = document.createElement('div'); nickRow.style.cssText = 'display:flex;gap:6px';
    const nick = document.createElement('input'); nick.value = m.nick; nick.maxLength = 20; nick.setAttribute('aria-label', tx('Nazwa gracza', 'Player name')); nick.style.cssText = inputCss + ';flex:1';
    const nickBtn = document.createElement('button'); nickBtn.type = 'button'; nickBtn.textContent = tx('Zmień', 'Change'); nickBtn.style.cssText = btnCss;
    const nickMsg = msg();
    nickBtn.onclick = async () => { say(nickMsg, await setNick(nick.value.trim()), tx('Zmieniono nazwę', 'Name changed')); paint(); };
    nickRow.append(nick, nickBtn); box.append(nickRow, nickMsg);
    // hasło
    section(tx('Zmiana hasła', 'Change password'));
    const p1 = document.createElement('input'); p1.type = 'password'; p1.setAttribute('autocomplete', 'new-password'); p1.placeholder = tx('nowe hasło (min. 6 znaków)', 'new password (min. 6 characters)'); p1.setAttribute('aria-label', tx('Nowe hasło', 'New password')); p1.style.cssText = inputCss;
    const p2 = document.createElement('input'); p2.type = 'password'; p2.setAttribute('autocomplete', 'new-password'); p2.placeholder = tx('powtórz hasło', 'repeat password'); p2.setAttribute('aria-label', tx('Powtórz hasło', 'Repeat password')); p2.style.cssText = inputCss;
    const passBtn = document.createElement('button'); passBtn.type = 'button'; passBtn.textContent = tx('Zapisz nowe hasło', 'Save new password'); passBtn.style.cssText = btnCss;
    const passMsg = msg();
    passBtn.onclick = async () => {
      if (p1.value.length < 6) { say(passMsg, tx('Hasło musi mieć co najmniej 6 znaków', 'The password must be at least 6 characters'), ''); return; }
      if (p1.value !== p2.value) { say(passMsg, tx('Hasła się różnią', 'The passwords differ'), ''); return; }
      say(passMsg, await setPassword(p1.value), tx('Hasło zmienione', 'Password changed'));
      p1.value = p2.value = '';
    };
    const resetBtn = document.createElement('button'); resetBtn.type = 'button'; resetBtn.textContent = tx('Wyślij link do zmiany hasła mailem', 'Email me a password reset link'); resetBtn.style.cssText = btnCss;
    resetBtn.onclick = async () => say(passMsg, await sendReset(m.email), tx('Wysłano link (sprawdź pocztę)', 'Link sent (check your mail)'));
    box.append(p1, p2, passBtn, resetBtn, passMsg);
    // dół
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;justify-content:space-between;margin-top:6px';
    const out = document.createElement('button'); out.type = 'button'; out.textContent = tx('Wyloguj', 'Sign out'); out.style.cssText = btnCss;
    out.onclick = async () => { await signOut(); close(); paint(); };
    const done = document.createElement('button'); done.type = 'button'; done.textContent = tx('Zamknij', 'Close'); done.style.cssText = btnCss + ';border-color:#d8b25a';
    done.onclick = close;
    row.append(out, done); box.append(row);
    done.focus();
  }

  function openLogin(): void {
    const back = document.createElement('div');
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40;display:grid;place-items:center';
    const form = document.createElement('form');
    form.setAttribute('aria-label', tx('Logowanie', 'Sign in'));
    form.style.cssText = 'background:#24221d;border:1px solid #d8b25a;padding:18px 20px;width:min(340px,90vw);color:#e8e0cc;display:flex;flex-direction:column;gap:8px;font-size:14px';
    const h = document.createElement('div'); h.textContent = tx('Logowanie', 'Sign in'); h.style.cssText = 'color:#e9c766;font-weight:600;font-size:16px';
    const field = (label: string, type: string, auto: string): HTMLInputElement => {
      const l = document.createElement('label'); l.style.cssText = 'display:flex;flex-direction:column;gap:3px';
      l.append(document.createTextNode(label));
      const i = document.createElement('input'); i.type = type; i.setAttribute('autocomplete', auto); i.required = true;
      i.style.cssText = 'font:inherit;color:#e8e0cc;background:#1a1814;border:1px solid #4a4436;padding:7px 8px;min-height:34px';
      i.addEventListener('keydown', (e) => e.stopPropagation());   // bez lotu WASD i skrótów edytora przy pisaniu
      l.append(i); form.append(l);
      return i;
    };
    form.append(h);
    const email = field('E-mail', 'email', 'email');
    const pass = field(tx('Hasło', 'Password'), 'password', 'current-password');
    const msg = document.createElement('div'); msg.style.cssText = 'min-height:18px;color:#ff9a8a;font-size:13px'; msg.setAttribute('role', 'status');
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;justify-content:space-between;align-items:center;flex-wrap:wrap';
    const forgot = document.createElement('button'); forgot.type = 'button'; forgot.textContent = tx('Nie pamiętam hasła', 'Forgot password');
    forgot.style.cssText = 'font:inherit;font-size:13px;background:none;border:0;color:#d8b25a;text-decoration:underline;cursor:pointer;padding:4px 0';
    const btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:6px';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = tx('Anuluj', 'Cancel');
    const ok = document.createElement('button'); ok.type = 'submit'; ok.textContent = tx('Zaloguj', 'Sign in');
    for (const b of [cancel, ok]) b.style.cssText = 'font:inherit;font-size:13px;padding:7px 12px;min-height:34px;color:#e8e0cc;background:#2e2b24;border:1px solid #3a362d;cursor:pointer';
    ok.style.borderColor = '#d8b25a';
    btns.append(cancel, ok); row.append(forgot, btns);
    form.append(msg, row);
    back.append(form); document.body.append(back);
    email.focus();
    const close = (): void => back.remove();
    cancel.onclick = close;
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    forgot.onclick = async () => {
      if (!email.value) { msg.textContent = tx('Wpisz najpierw e-mail', 'Enter your e-mail first'); email.focus(); return; }
      const err = await sendReset(email.value.trim());
      msg.style.color = err ? '#ff9a8a' : '#9fd88a';
      msg.textContent = err ?? tx('Wysłano link do zmiany hasła (sprawdź pocztę)', 'A password reset link has been sent (check your mail)');
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      ok.disabled = true; msg.style.color = '#e8e0cc'; msg.textContent = tx('Loguję…', 'Signing in…');
      const err = await signIn(email.value.trim(), pass.value);
      ok.disabled = false;
      if (err) { msg.style.color = '#ff9a8a'; msg.textContent = err; return; }
      close();
      paint();
    };
  }
}
