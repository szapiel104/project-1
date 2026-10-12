import { createClient, type RealtimeChannel, type Session } from '@supabase/supabase-js';
import type { Command } from '../sim/step';

/**
 * Supabase: konta (e-mail + hasło), lista pokojów i kanał gry.
 * Klucz publiczny jest przeznaczony do przeglądarki; dostęp do danych pilnują zasady RLS w bazie.
 * W trakcie meczu do bazy nic nie trafia — polecenia graczy idą kanałem na żywo (broadcast).
 */
const URL = 'https://psccakqdinwqloozdsyf.supabase.co';
const KEY = 'sb_publishable_7YlZMQWsSgn7R6k8-1kFpw_uRpFkfhh';
export const supa = createClient(URL, KEY, { auth: { persistSession: true } });

export interface Room { id: string; host: string; host_nick: string; name: string; preset: string; seed: string; guest: string | null; guest_nick: string | null; status: 'open' | 'playing' | 'done'; created_at: string }

let session: Session | null = null;
let myNick = '';
export interface Me { id: string; nick: string; avatar: number; email: string }
export const me = (): Me | null => (session ? { id: session.user.id, nick: myNick, avatar: Number(session.user.user_metadata?.avatar ?? 0) || 0, email: session.user.email ?? '' } : null);
/** Słuchacze zmiany konta (logowanie, wylogowanie, nowy nick lub herb) — menu odświeża nagłówek */
const accountListeners = new Set<() => void>();
export const onAccount = (f: () => void): (() => void) => { accountListeners.add(f); return () => accountListeners.delete(f); };
const changed = (): void => { for (const f of accountListeners) f(); };

async function loadNick(): Promise<void> {
  if (!session) { myNick = ''; return; }
  const { data } = await supa.from('profiles').select('nick').eq('id', session.user.id).maybeSingle();
  myNick = (data?.nick as string | undefined) ?? (session.user.user_metadata?.nick as string | undefined) ?? '';
}

export async function restore(): Promise<void> {
  const { data } = await supa.auth.getSession();
  session = data.session;
  await loadNick();
  changed();
}

const plErr = (m: string): string => {
  if (/Invalid login/i.test(m)) return 'Zły e-mail albo hasło.';
  if (/already registered/i.test(m)) return 'To konto już istnieje — zaloguj się.';
  if (/Password should be/i.test(m)) return 'Hasło musi mieć co najmniej 6 znaków.';
  if (/duplicate key.*nick/i.test(m) || /profiles_nick_key/.test(m)) return 'Ten nick jest zajęty.';
  if (/rate limit/i.test(m)) return 'Za dużo prób, spróbuj za chwilę.';
  return m;
};

export async function signUp(email: string, password: string, nick: string): Promise<string | null> {
  const n = nick.trim();
  if (n.length < 3 || n.length > 20) return 'Nick: od 3 do 20 znaków.';
  const { data, error } = await supa.auth.signUp({ email, password, options: { data: { nick: n } } });
  if (error) return plErr(error.message);
  session = data.session;
  if (!session) return 'Konto utworzone — zaloguj się.';
  const { error: e2 } = await supa.from('profiles').insert({ id: session.user.id, nick: n });
  if (e2) return plErr(e2.message);
  myNick = n;
  changed();
  return null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if (error) return plErr(error.message);
  session = data.session;
  await loadNick();
  // konto bez profilu (np. założone, gdy potwierdzanie e-maila było włączone): profil z nicku z rejestracji
  if (!myNick && session) {
    const n = (session.user.user_metadata?.nick as string | undefined) ?? `gracz-${session.user.id.slice(0, 5)}`;
    await supa.from('profiles').insert({ id: session.user.id, nick: n });
    myNick = n;
  }
  changed();
  return null;
}

export async function signOut(): Promise<void> { await supa.auth.signOut(); session = null; myNick = ''; changed(); }

/** Zmiana nicku w profilu (unikalny w bazie) */
export async function setNick(nick: string): Promise<string | null> {
  const n = nick.trim();
  if (!session) return 'Zaloguj się.';
  if (n.length < 3 || n.length > 20) return 'Nick: od 3 do 20 znaków.';
  const { error } = await supa.from('profiles').update({ nick: n }).eq('id', session.user.id);
  if (error) return plErr(error.message);
  await supa.auth.updateUser({ data: { nick: n } });
  myNick = n; changed();
  return null;
}

export async function setPassword(password: string): Promise<string | null> {
  if (password.length < 6) return 'Hasło musi mieć co najmniej 6 znaków.';
  const { error } = await supa.auth.updateUser({ password });
  return error ? (/different from the old/i.test(error.message) ? 'Nowe hasło musi być inne niż stare.' : plErr(error.message)) : null;
}

/** Herb gracza trzymany przy koncie (dane użytkownika w Supabase Auth) */
export async function setAvatar(avatar: number): Promise<string | null> {
  const { data, error } = await supa.auth.updateUser({ data: { avatar } });
  if (error) return plErr(error.message);
  if (session && data.user) session = { ...session, user: data.user };
  changed();
  return null;
}

export async function listRooms(): Promise<Room[]> {
  const { data } = await supa.from('rooms').select('*').in('status', ['open', 'playing']).order('created_at', { ascending: false }).limit(40);
  // pokoje sprzed kilku godzin to porzucone mecze (np. zamknięta karta) — nie pokazujemy ich
  const old = Date.now() - 4 * 3600_000;
  return ((data as Room[] | null) ?? []).filter((r) => Date.parse(r.created_at) > old);
}

/** Moje stare pokoje (zostały po zamkniętej karcie albo zerwanym połączeniu) oznacza jako zakończone */
export async function closeMyStaleRooms(): Promise<void> {
  const m = me();
  if (!m) return;
  await supa.from('rooms').update({ status: 'done' }).eq('host', m.id).in('status', ['open', 'playing']);
}

export async function createRoom(name: string, preset: string, seed: string): Promise<Room | string> {
  const m = me();
  if (!m) return 'Zaloguj się.';
  const { data, error } = await supa.from('rooms').insert({ host: m.id, host_nick: m.nick, name, preset, seed }).select().single();
  return error ? plErr(error.message) : (data as Room);
}

/** Pokój po numerze (dołączanie odbywa się w kanale pokoju — gospodarz przydziela miejsca) */
export async function getRoom(id: string): Promise<Room | string> {
  const { data, error } = await supa.from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) return plErr(error.message);
  return (data as Room | null) ?? 'Tego pokoju już nie ma.';
}

/** Gospodarz zmienia opis pokoju: tryb, nazwę albo podsumowanie składu (guest_nick, np. „3/4 · Ola, Kuba”) */
export async function updateRoom(id: string, patch: Partial<Pick<Room, 'preset' | 'name' | 'guest_nick' | 'status'>>): Promise<void> {
  await supa.from('rooms').update(patch).eq('id', id);
}

export async function setRoomStatus(id: string, status: Room['status']): Promise<void> { await supa.from('rooms').update({ status }).eq('id', id); }
export async function deleteRoom(id: string): Promise<void> { await supa.from('rooms').delete().eq('id', id); }

/** Zmiany na liście pokojów na żywo */
export function watchRooms(onChange: () => void): () => void {
  const ch = supa.channel('rooms-list').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => onChange()).subscribe();
  return () => { void supa.removeChannel(ch); };
}

/** Miejsce w pokoju: wolne (dla gracza), bot albo zajęte przez gracza */
export type Slot = { kind: 'open' } | { kind: 'bot' } | { kind: 'human'; id: string; nick: string; avatar: number };
export interface Member { id: string; nick: string; avatar: number }

/** Wiadomości kanału pokoju: skład lobby, prośby o miejsce, start, polecenia na turę i wyjście */
export type NetMsg =
  | { k: 'turn'; turn: number; from: number; cmds: Command[]; hash?: number; hashTurn?: number }
  | { k: 'lobby'; preset: string; level: number; slots: Slot[] }
  | { k: 'seat'; id: string; slot: number }
  | { k: 'hello'; who: Member }
  | { k: 'start'; preset: string; level: number; seed: string; slots: Slot[] }
  | { k: 'close' }
  | { k: 'bye'; from: number; last: number };

/** Kanał pokoju: jeden na lobby i mecz. Obecność (presence) mówi, kto jest w pokoju. */
export interface RoomLink {
  send(m: NetMsg): void;
  on(f: (m: NetMsg) => void): () => void;
  /** Kto jest teraz w pokoju (wg obecności) */
  members(): Member[];
  onMembers(f: () => void): () => void;
  close(): void;
  ready: Promise<void>;
}

export function roomLink(roomId: string, self: Member): RoomLink {
  const ch: RealtimeChannel = supa.channel(`game:${roomId}`, { config: { broadcast: { self: false, ack: false }, presence: { key: self.id } } });
  const subs = new Set<(m: NetMsg) => void>();
  const memberSubs = new Set<() => void>();
  ch.on('broadcast', { event: 'm' }, (p) => { for (const f of subs) f(p.payload as NetMsg); });
  ch.on('presence', { event: 'sync' }, () => { for (const f of memberSubs) f(); });
  const ready = new Promise<void>((ok) => ch.subscribe(async (st) => { if (st === 'SUBSCRIBED') { await ch.track(self); ok(); } }));
  return {
    send: (m) => { void ch.send({ type: 'broadcast', event: 'm', payload: m }); },
    on: (f) => { subs.add(f); return () => subs.delete(f); },
    members: () => Object.values(ch.presenceState<Member>()).map((l) => l[0]!).filter(Boolean).map((x) => ({ id: x.id, nick: x.nick, avatar: x.avatar })),
    onMembers: (f) => { memberSubs.add(f); return () => memberSubs.delete(f); },
    close: () => { void ch.untrack(); void supa.removeChannel(ch); },
    ready,
  };
}
