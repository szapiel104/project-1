/**
 * Konto w podglądzie modeli (Michał 11.11.2026: „w edytorze niech widnieje konto i możliwość zalogowania się”):
 * po prawej w górnej belce — nick zalogowanego (klik: wylogowanie) albo „Zaloguj się” z małym oknem logowania.
 * Po zalogowaniu edytor sam sprawdza uprawnienia twórcy (modelEditor.ts, onAuthStateChange) i pokazuje „Edytuj”.
 */
import { tx } from '../i18n';
import { me, onAccount, restore, sendReset, signIn, signOut } from '../net/supa';

export function createViewerAccount(host: HTMLElement): void {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'menu-top acct';
  host.append(chip);
  const paint = (): void => {
    const m = me();
    chip.textContent = m ? `👤 ${m.nick || m.email}` : tx('Zaloguj się', 'Sign in');
    chip.title = m ? tx(`Zalogowano jako ${m.nick || m.email} (${m.email}) — klik: wyloguj`, `Signed in as ${m.nick || m.email} (${m.email}) — click: sign out`) : tx('Zaloguj się kontem z gry (edycja modeli tylko dla twórcy)', 'Sign in with your game account (model editing is for the creator only)');
  };
  chip.onclick = () => {
    if (me()) { if (confirm(tx('Wylogować się?', 'Sign out?'))) void signOut(); return; }
    openLogin();
  };
  onAccount(paint);
  paint();
  void restore().then(paint).catch(() => undefined);

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
      const i = document.createElement('input'); i.type = type; i.autocomplete = auto; i.required = true;
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
