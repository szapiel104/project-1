import { createClient, type RealtimeChannel, type Session } from '@supabase/supabase-js';
import type { Command } from '../sim/step';
import { tx } from '../i18n';

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
const changed = (): void => { for (const f of accountListeners) f(); syncOnline(); };

// ---------------- poziom gracza (PD za mecze; liczy i zapisuje funkcja w bazie award_match) ----------------
export interface Progress { xp: number; level: number; matches: number; wins: number; kills: number }
let myProgress: Progress | null = null;
/** Poziom zalogowanego gracza (null: niezalogowany albo baza jeszcze bez tabeli postępu) */
export const progress = (): Progress | null => myProgress;
async function loadProgress(): Promise<void> {
  myProgress = null;
  if (!session) return;
  const { data, error } = await supa.from('player_progress').select('xp,level,matches,wins,kills').eq('user_id', session.user.id).maybeSingle();
  if (error) return; // tabela jeszcze nie założona — gra działa jak dotąd, bez poziomów
  myProgress = (data as Progress | null) ?? { xp: 0, level: 1, matches: 0, wins: 0, kills: 0 };
}
/** Po meczu: baza liczy PD z wyniku (z limitami) i zwraca, ile przybyło; null, gdy niezalogowany albo błąd */
export async function awardMatch(mode: string, s: { won: boolean; minutes: number; kills: number; razed: number; built: number }): Promise<{ gained: number; xp: number; level: number; before: number } | null> {
  if (!session) return null;
  const before = myProgress?.level ?? 1;
  const { data, error } = await supa.rpc('award_match', { p_mode: mode, p_won: s.won, p_minutes: s.minutes, p_kills: s.kills, p_razed: s.razed, p_built: s.built });
  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as { gained: number; xp: number; level: number } | undefined;
  if (!row) return null;
  myProgress = { ...(myProgress ?? { matches: 0, wins: 0, kills: 0 }), xp: row.xp, level: row.level, matches: (myProgress?.matches ?? 0) + 1, wins: (myProgress?.wins ?? 0) + (s.won ? 1 : 0), kills: (myProgress?.kills ?? 0) + s.kills };
  changed();
  return { ...row, before };
}

/** Poziomy innych graczy (do tytułu przy nicku w pokoju i rankingu); pamiętane na czas sesji, żeby nie pytać co chwilę */
const levelCache = new Map<string, number>();
const levelAsked = new Set<string>();
export const knownLevel = (id: string): number | undefined => levelCache.get(id);
export async function levelsOf(ids: string[]): Promise<Map<string, number>> {
  const want = [...new Set(ids)].filter((id) => id && !levelCache.has(id) && !levelAsked.has(id));
  if (want.length && session) {
    for (const id of want) levelAsked.add(id);
    const { data, error } = await supa.from('player_progress').select('user_id,level').in('user_id', want);
    if (!error) {
      for (const r of (data as { user_id: string; level: number }[] | null) ?? []) levelCache.set(r.user_id, r.level);
      for (const id of want) if (!levelCache.has(id)) levelCache.set(id, 1); // bez wpisu w bazie = jeszcze bez meczu, poziom 1
    }
  }
  if (session && myProgress) levelCache.set(session.user.id, myProgress.level);
  const out = new Map<string, number>();
  for (const id of ids) { const l = levelCache.get(id); if (l !== undefined) out.set(id, l); }
  return out;
}

async function loadNick(): Promise<void> {
  if (!session) { myNick = ''; return; }
  const { data } = await supa.from('profiles').select('nick').eq('id', session.user.id).maybeSingle();
  myNick = (data?.nick as string | undefined) ?? (session.user.user_metadata?.nick as string | undefined) ?? '';
}

export async function restore(): Promise<void> {
  const { data } = await supa.auth.getSession();
  session = data.session;
  await loadNick();
  await loadProgress();
  changed();
}

const plErr = (m: string): string => {
  if (/Invalid login/i.test(m)) return tx('Zły e-mail albo hasło.', 'Wrong e-mail or password.');
  if (/already registered/i.test(m)) return tx('To konto już istnieje — zaloguj się.', 'This account already exists — sign in.');
  if (/Password should be/i.test(m)) return tx('Hasło musi mieć co najmniej 6 znaków.', 'Password must be at least 6 characters.');
  if (/duplicate key.*nick/i.test(m) || /profiles_nick_key/.test(m)) return tx('Ten nick jest zajęty.', 'This nickname is taken.');
  if (/rate limit/i.test(m)) return tx('Za dużo prób, spróbuj za chwilę.', 'Too many attempts, try again in a moment.');
  return m;
};

export async function signUp(email: string, password: string, nick: string): Promise<string | null> {
  const n = nick.trim();
  if (n.length < 3 || n.length > 20) return tx('Nick: od 3 do 20 znaków.', 'Nickname: 3 to 20 characters.');
  const { data, error } = await supa.auth.signUp({ email, password, options: { data: { nick: n } } });
  if (error) return plErr(error.message);
  session = data.session;
  if (!session) return tx('Konto utworzone — zaloguj się.', 'Account created — sign in.');
  const { error: e2 } = await supa.from('profiles').insert({ id: session.user.id, nick: n });
  if (e2) return plErr(e2.message);
  myNick = n;
  await loadProgress();
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
  await loadProgress();
  changed();
  return null;
}

export async function signOut(): Promise<void> { await supa.auth.signOut(); session = null; myNick = ''; myProgress = null; changed(); }

/** Zmiana nicku w profilu (unikalny w bazie) */
export async function setNick(nick: string): Promise<string | null> {
  const n = nick.trim();
  if (!session) return tx('Zaloguj się.', 'Please sign in.');
  if (n.length < 3 || n.length > 20) return tx('Nick: od 3 do 20 znaków.', 'Nickname: 3 to 20 characters.');
  const { error } = await supa.from('profiles').update({ nick: n }).eq('id', session.user.id);
  if (error) return plErr(error.message);
  await supa.auth.updateUser({ data: { nick: n } });
  myNick = n; changed();
  return null;
}

export async function setPassword(password: string): Promise<string | null> {
  if (password.length < 6) return tx('Hasło musi mieć co najmniej 6 znaków.', 'Password must be at least 6 characters.');
  const { error } = await supa.auth.updateUser({ password });
  return error ? (/different from the old/i.test(error.message) ? tx('Nowe hasło musi być inne niż stare.', 'The new password must be different from the old one.') : plErr(error.message)) : null;
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
  const { data } = await supa.from('rooms').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(40);
  // na liście tylko gry, do których da się dołączyć; trwające mecze są zamknięte dla nowych.
  // Pokoje sprzed kilku godzin to porzucone lobby (np. zamknięta karta) — nie pokazujemy ich
  const old = Date.now() - 3 * 3600_000;
  return ((data as Room[] | null) ?? []).filter((r) => Date.parse(r.created_at) > old);
}

/** Usuwa wszystkie moje pokoje (zostały po zamkniętej karcie, zerwanym połączeniu albo skończonym meczu) — baza się nie zapycha */
export async function closeMyStaleRooms(): Promise<void> {
  const m = me();
  if (!m) return;
  await supa.from('rooms').delete().eq('host', m.id);
}

export async function createRoom(name: string, preset: string, seed: string): Promise<Room | string> {
  const m = me();
  if (!m) return tx('Zaloguj się.', 'Please sign in.');
  const { data, error } = await supa.from('rooms').insert({ host: m.id, host_nick: m.nick, name, preset, seed }).select().single();
  return error ? plErr(error.message) : (data as Room);
}

/** Pokój po numerze (dołączanie odbywa się w kanale pokoju — gospodarz przydziela miejsca) */
export async function getRoom(id: string): Promise<Room | string> {
  const { data, error } = await supa.from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) return plErr(error.message);
  return (data as Room | null) ?? tx('Tego pokoju już nie ma.', 'This room no longer exists.');
}

/** Gospodarz zmienia opis pokoju: tryb, nazwę albo podsumowanie składu (guest_nick, np. „3/4 · Ola, Kuba”) */
export async function updateRoom(id: string, patch: Partial<Pick<Room, 'preset' | 'name' | 'guest_nick' | 'status' | 'seed'>>): Promise<void> {
  await supa.from('rooms').update(patch).eq('id', id);
}

export async function setRoomStatus(id: string, status: Room['status']): Promise<void> { await supa.from('rooms').update({ status }).eq('id', id); }
export async function deleteRoom(id: string): Promise<void> { await supa.from('rooms').delete().eq('id', id); }

/** Zmiany na liście pokojów na żywo */
export function watchRooms(onChange: () => void): () => void {
  const ch = supa.channel('rooms-list').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => onChange()).subscribe();
  return () => { void supa.removeChannel(ch); };
}

// ---------------- wyniki i ranking ----------------
export interface Result { nick: string; avatar: number; preset: string; won: boolean; minutes: number; created_at: string }
export interface RankRow { user_id: string; nick: string; avatar: number; wins: number; losses: number; games: number }

/**
 * Start meczu przez sieć: w wynikach od razu wpis „w toku”, liczony jako porażka, jeśli gracz uciekł i nie wrócił
 * (funkcja match_begin w bazie; bez niej — przed wykonaniem migracji 20261024 — nic się nie dzieje).
 */
export async function matchBegin(room: string, preset: string): Promise<void> {
  const m = me();
  if (!m) return;
  await supa.rpc('match_begin', { p_room: room, p_preset: preset, p_nick: m.nick, p_avatar: m.avatar });
}

/**
 * Każdy gracz zapisuje swój wynik po meczu przez sieć (zasady w bazie pozwalają tylko na własny).
 * Z numerem pokoju wynik zastępuje wpis „w toku” z początku meczu; gdy baza jeszcze nie ma tej funkcji, zwykły zapis.
 */
export async function saveResult(preset: string, won: boolean, minutes: number, room?: string): Promise<void> {
  const m = me();
  if (!m) return;
  if (room) {
    const { error } = await supa.rpc('match_end', { p_room: room, p_preset: preset, p_nick: m.nick, p_avatar: m.avatar, p_won: won, p_minutes: minutes });
    if (!error) return;
  }
  await supa.from('results').insert({ user_id: m.id, nick: m.nick, avatar: m.avatar, preset, won, minutes });
}

export async function myResults(limit = 12): Promise<Result[]> {
  const m = me();
  if (!m) return [];
  const { data } = await supa.from('results').select('nick,avatar,preset,won,minutes,created_at').eq('user_id', m.id).order('created_at', { ascending: false }).limit(limit);
  return (data as Result[] | null) ?? [];
}

/** Jeden wpis kroniki: nagroda za mecz z tabeli xp_awards (gracz widzi tylko swoje) */
export interface Award { mode: string; won: boolean; minutes: number; kills: number; razed: number; built: number; xp: number; created_at: string }
/** Kronika ostatnich meczów gracza (wszystkie rodzaje: przez sieć i z botami); null, gdy baza bez tabeli albo błąd */
export async function myAwards(limit = 20): Promise<Award[] | null> {
  const m = me();
  if (!m) return [];
  const { data, error } = await supa.from('xp_awards').select('mode,won,minutes,kills,razed,built,xp,created_at').eq('user_id', m.id).order('created_at', { ascending: false }).limit(limit);
  if (error) return null;
  return (data as Award[] | null) ?? [];
}

export async function myRecord(): Promise<RankRow | null> {
  const m = me();
  if (!m) return null;
  const { data } = await supa.from('ranking').select('*').eq('user_id', m.id).maybeSingle();
  return (data as RankRow | null) ?? null;
}

/** Ranking: najwięcej wygranych, przy remisie mniej porażek */
export async function ranking(limit = 50): Promise<RankRow[]> {
  const { data } = await supa.from('ranking').select('*').order('wins', { ascending: false }).order('losses', { ascending: true }).limit(limit);
  return (data as RankRow[] | null) ?? [];
}

/** Miejsce w pokoju: wolne (dla gracza), bot albo zajęte przez gracza */
export type Slot = { kind: 'open' } | { kind: 'bot' } | { kind: 'human'; id: string; nick: string; avatar: number };
export interface Member { id: string; nick: string; avatar: number }

/** Wiadomości kanału pokoju: skład lobby, prośby o miejsce, start, polecenia na turę i wyjście */
export type NetMsg =
  | { k: 'turn'; turn: number; from: number; cmds: Command[]; hash?: number; hashTurn?: number }
  | { k: 'lobby'; preset: string; level: number; slots: Slot[]; seed?: string; coop?: boolean }
  | { k: 'seat'; id: string; slot: number }
  | { k: 'hello'; who: Member }
  | { k: 'start'; preset: string; level: number; seed: string; slots: Slot[]; coop?: boolean }
  | { k: 'close' }
  | { k: 'chat'; who: Member; text: string }
  /** Znacznik dla sojuszników (Alt + klik): 0 atak, 1 pomocy, 2 zbiórka; x, y w polach mapy */
  | { k: 'ping'; from: number; kind: number; x: number; y: number }
  /** Wyjście z meczu; give = poddanie (bez tego: zerwane połączenie, zamkiem rządzi bot, można wrócić) */
  | { k: 'bye'; from: number; last: number; give?: boolean }
  /** Gracz po odświeżeniu albo zerwaniu połączenia prosi o powrót na swoje miejsce */
  | { k: 'rejoin'; id: string; slot: number }
  /** Stan gry dla wracającego gracza (`to`), w kawałkach: skompresowany zapis gry i lockstepu po turze `turn` */
  | { k: 'state'; to: number; turn: number; part: number; parts: number; data: string };

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

// ---------------- znajomi i obecność ----------------
export interface Profile { id: string; nick: string }
/** Gdzie jest gracz: w menu, w pokoju (z nazwą), w meczu przez sieć albo w grze z botami */
export interface Status { where: 'menu' | 'room' | 'game' | 'solo'; roomId?: string; roomName?: string }
export type OnlinePlayer = Member & Status;
export interface Invite { from: Member; roomId: string; roomName: string }

export async function findProfile(nick: string): Promise<Profile | null> {
  const { data } = await supa.from('profiles').select('id,nick').ilike('nick', nick.trim()).limit(1).maybeSingle();
  return (data as Profile | null) ?? null;
}

/** Moja lista znajomych i ci, którzy dodali mnie (a ja ich jeszcze nie) */
export async function listFriends(): Promise<{ mine: Profile[]; addedMe: Profile[] }> {
  const m = me();
  if (!m) return { mine: [], addedMe: [] };
  const { data } = await supa.from('friends').select('user_id,friend_id').or(`user_id.eq.${m.id},friend_id.eq.${m.id}`);
  const rows = (data as { user_id: string; friend_id: string }[] | null) ?? [];
  const mineIds = rows.filter((r) => r.user_id === m.id).map((r) => r.friend_id);
  const addedIds = rows.filter((r) => r.friend_id === m.id && !mineIds.includes(r.user_id)).map((r) => r.user_id);
  const ids = [...new Set([...mineIds, ...addedIds])];
  if (!ids.length) return { mine: [], addedMe: [] };
  const { data: profs } = await supa.from('profiles').select('id,nick').in('id', ids);
  const byId = new Map(((profs as Profile[] | null) ?? []).map((p) => [p.id, p]));
  const pick = (list: string[]): Profile[] => list.map((id) => byId.get(id)).filter((p): p is Profile => !!p).sort((a, b) => a.nick.localeCompare(b.nick, 'pl'));
  return { mine: pick(mineIds), addedMe: pick(addedIds) };
}

export async function addFriend(nick: string): Promise<string | null> {
  const m = me();
  if (!m) return tx('Zaloguj się.', 'Please sign in.');
  const p = await findProfile(nick);
  if (!p) return tx(`Nie ma gracza o nicku „${nick.trim()}”.`, `No player with the nickname “${nick.trim()}”.`);
  if (p.id === m.id) return tx('To Ty :)', "That's you :)");
  const { error } = await supa.from('friends').insert({ user_id: m.id, friend_id: p.id });
  if (error && !/duplicate key/i.test(error.message)) return plErr(error.message);
  return null;
}

export async function removeFriend(id: string): Promise<void> {
  const m = me();
  if (m) await supa.from('friends').delete().eq('user_id', m.id).eq('friend_id', id);
}

// Obecność: jeden wspólny kanał, w którym każdy zalogowany gracz ogłasza, gdzie jest. Nic nie trafia do bazy.
let onlineCh: RealtimeChannel | null = null;
let inboxCh: RealtimeChannel | null = null;
let onlineFor = '';
let status: Status = { where: 'menu' };
const presenceSubs = new Set<() => void>();
const inviteSubs = new Set<(i: Invite) => void>();
export const onPresence = (f: () => void): (() => void) => { presenceSubs.add(f); return () => presenceSubs.delete(f); };
export const onInvite = (f: (i: Invite) => void): (() => void) => { inviteSubs.add(f); return () => inviteSubs.delete(f); };

function syncOnline(): void {
  const m = me();
  const key = m ? `${m.id}:${m.nick}:${m.avatar}` : '';
  if (key === onlineFor) return;
  onlineFor = key;
  if (onlineCh) { void supa.removeChannel(onlineCh); onlineCh = null; }
  if (inboxCh) { void supa.removeChannel(inboxCh); inboxCh = null; }
  if (!m) { for (const f of presenceSubs) f(); return; }
  onlineCh = supa.channel('online', { config: { presence: { key: m.id } } });
  onlineCh.on('presence', { event: 'sync' }, () => { for (const f of presenceSubs) f(); });
  onlineCh.subscribe((st) => { if (st === 'SUBSCRIBED') void onlineCh?.track({ id: m.id, nick: m.nick, avatar: m.avatar, ...status }); });
  // skrzynka zaproszeń: znajomy wysyła na kanał z moim numerem
  inboxCh = supa.channel(`inbox:${m.id}`);
  inboxCh.on('broadcast', { event: 'invite' }, (p) => {
    const i = p.payload as Invite;
    if (i?.from?.nick && typeof i.roomId === 'string') for (const f of inviteSubs) f(i);
  });
  inboxCh.subscribe();
}

export function setStatus(st: Status): void {
  status = st;
  const m = me();
  if (m && onlineCh) void onlineCh.track({ id: m.id, nick: m.nick, avatar: m.avatar, ...status });
}

/** Kto jest teraz w grze (zalogowani gracze) */
export function onlinePlayers(): OnlinePlayer[] {
  if (!onlineCh) return [];
  return Object.values(onlineCh.presenceState<OnlinePlayer>()).map((l) => l[l.length - 1]!).filter(Boolean);
}

export async function sendInvite(toId: string, roomId: string, roomName: string): Promise<void> {
  const m = me();
  if (!m) return;
  const ch = supa.channel(`inbox:${toId}`);
  await new Promise<void>((ok) => { ch.subscribe((st) => { if (st === 'SUBSCRIBED') ok(); }); setTimeout(ok, 4000); });
  await ch.send({ type: 'broadcast', event: 'invite', payload: { from: { id: m.id, nick: m.nick, avatar: m.avatar }, roomId, roomName } satisfies Invite });
  setTimeout(() => void supa.removeChannel(ch), 1500);
}
