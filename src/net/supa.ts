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
export const me = (): { id: string; nick: string } | null => (session ? { id: session.user.id, nick: myNick } : null);

async function loadNick(): Promise<void> {
  if (!session) { myNick = ''; return; }
  const { data } = await supa.from('profiles').select('nick').eq('id', session.user.id).maybeSingle();
  myNick = (data?.nick as string | undefined) ?? (session.user.user_metadata?.nick as string | undefined) ?? '';
}

export async function restore(): Promise<void> {
  const { data } = await supa.auth.getSession();
  session = data.session;
  await loadNick();
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
  return null;
}

export async function signOut(): Promise<void> { await supa.auth.signOut(); session = null; myNick = ''; }

export async function listRooms(): Promise<Room[]> {
  const { data } = await supa.from('rooms').select('*').in('status', ['open', 'playing']).order('created_at', { ascending: false }).limit(30);
  return (data as Room[] | null) ?? [];
}

export async function createRoom(name: string, preset: string, seed: string): Promise<Room | string> {
  const m = me();
  if (!m) return 'Zaloguj się.';
  const { data, error } = await supa.from('rooms').insert({ host: m.id, host_nick: m.nick, name, preset, seed }).select().single();
  return error ? plErr(error.message) : (data as Room);
}

export async function joinRoom(id: string): Promise<Room | string> {
  const m = me();
  if (!m) return 'Zaloguj się.';
  const { data, error } = await supa.from('rooms').update({ guest: m.id, guest_nick: m.nick }).eq('id', id).is('guest', null).eq('status', 'open').select().maybeSingle();
  if (error) return plErr(error.message);
  return (data as Room | null) ?? 'Ktoś był szybszy — pokój jest już pełny.';
}

export async function setRoomStatus(id: string, status: Room['status']): Promise<void> { await supa.from('rooms').update({ status }).eq('id', id); }
export async function deleteRoom(id: string): Promise<void> { await supa.from('rooms').delete().eq('id', id); }

/** Zmiany na liście pokojów na żywo */
export function watchRooms(onChange: () => void): () => void {
  const ch = supa.channel('rooms-list').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => onChange()).subscribe();
  return () => { void supa.removeChannel(ch); };
}

/** Wiadomości kanału meczu: polecenia na turę, skrót stanu, start i wyjście */
export type NetMsg =
  | { k: 'turn'; turn: number; from: number; cmds: Command[]; hash?: number; hashTurn?: number }
  | { k: 'start' }
  | { k: 'bye'; from: number }
  | { k: 'hello'; from: number };

export function gameChannel(roomId: string, onMsg: (m: NetMsg) => void): { send: (m: NetMsg) => void; close: () => void; ready: Promise<void> } {
  const ch: RealtimeChannel = supa.channel(`game:${roomId}`, { config: { broadcast: { self: false, ack: false } } });
  ch.on('broadcast', { event: 'm' }, (p) => onMsg(p.payload as NetMsg));
  const ready = new Promise<void>((ok) => ch.subscribe((st) => { if (st === 'SUBSCRIBED') ok(); }));
  return {
    send: (m) => { void ch.send({ type: 'broadcast', event: 'm', payload: m }); },
    close: () => { void supa.removeChannel(ch); },
    ready,
  };
}
