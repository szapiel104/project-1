import { me, onAccount, supa } from './supa';
import { tx } from '../i18n';

/** Wiadomości między znajomymi (migracja 20261102e): rozmowy, nieprzeczytane, nowe wiadomości na żywo */
export interface Message { id: number; from_id: string; to_id: string; body: string; read: boolean; created_at: string }

let unreadBy = new Map<string, number>();
const subs = new Set<() => void>();
const freshSubs = new Set<(m: Message) => void>();
export const unreadFrom = (id: string): number => unreadBy.get(id) ?? 0;
export const unreadAll = (): number => [...unreadBy.values()].reduce((a, b) => a + b, 0);
export const onMessages = (f: () => void): (() => void) => { subs.add(f); return () => subs.delete(f); };
/** Nowa wiadomość do mnie albo ode mnie (otwarta rozmowa dopisuje ją od razu) */
export const onMessage = (f: (m: Message) => void): (() => void) => { freshSubs.add(f); return () => freshSubs.delete(f); };
const ping = (): void => { for (const f of subs) f(); };

async function loadUnread(): Promise<void> {
  const m = me();
  if (!m) { unreadBy = new Map(); ping(); return; }
  const { data, error } = await supa.from('messages').select('from_id').eq('to_id', m.id).eq('read', false).limit(500);
  unreadBy = new Map();
  if (!error) for (const r of (data as { from_id: string }[] | null) ?? []) unreadBy.set(r.from_id, (unreadBy.get(r.from_id) ?? 0) + 1);
  ping();
}

export async function conversation(id: string, limit = 80): Promise<Message[] | string> {
  const m = me();
  if (!m) return tx('Zaloguj się.', 'Please sign in.');
  const { data, error } = await supa.from('messages').select('*')
    .or(`and(from_id.eq.${m.id},to_id.eq.${id}),and(from_id.eq.${id},to_id.eq.${m.id})`)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) return /PGRST20|Could not find/.test(error.message) ? tx('Wiadomości będą po aktualizacji bazy.', 'Messages come with the database update.') : error.message;
  return ((data as Message[] | null) ?? []).reverse();
}

/** Ostatnia wiadomość z każdym rozmówcą (lista rozmów) */
export async function conversations(): Promise<Map<string, Message>> {
  const m = me();
  const out = new Map<string, Message>();
  if (!m) return out;
  const { data, error } = await supa.from('messages').select('*').or(`from_id.eq.${m.id},to_id.eq.${m.id}`).order('created_at', { ascending: false }).limit(400);
  if (error) return out;
  for (const r of (data as Message[] | null) ?? []) { const other = r.from_id === m.id ? r.to_id : r.from_id; if (!out.has(other)) out.set(other, r); }
  return out;
}

export async function sendMessage(to: string, body: string): Promise<Message | string> {
  const m = me();
  if (!m) return tx('Zaloguj się.', 'Please sign in.');
  const text = body.trim().slice(0, 1000);
  if (!text) return tx('Pusta wiadomość.', 'Empty message.');
  const { data, error } = await supa.from('messages').insert({ from_id: m.id, to_id: to, body: text }).select().single();
  if (error) return /row-level security/i.test(error.message) ? tx('Pisać można tylko do znajomych.', 'You can only message friends.') : error.message;
  return data as Message;
}

export async function markRead(from: string): Promise<void> {
  const m = me();
  if (!m || !unreadFrom(from)) return;
  unreadBy.delete(from); ping();
  await supa.from('messages').update({ read: true }).eq('to_id', m.id).eq('from_id', from).eq('read', false);
}

let liveFor = '';
let live: ReturnType<typeof supa.channel> | null = null;
function sync(): void {
  const m = me();
  const key = m?.id ?? '';
  if (key === liveFor) return;
  liveFor = key;
  if (live) { void supa.removeChannel(live); live = null; }
  void loadUnread();
  if (!m) return;
  live = supa.channel(`messages:${m.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${m.id}` }, (e) => {
      const msg = e.new as Message;
      unreadBy.set(msg.from_id, (unreadBy.get(msg.from_id) ?? 0) + 1);
      for (const f of freshSubs) f(msg);
      ping();
    })
    .subscribe();
}
if (typeof window !== 'undefined') onAccount(sync);
