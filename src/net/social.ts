import { me, myStatus, onAccount, onStatus, sendInvite, supa } from './supa';
import { tx } from '../i18n';

/**
 * Znajomi jak na Steamie (Michał 2.11.2026) — migracja 20261102c_social.sql:
 * zaproszenia do znajomych (jeden wiersz A→B = czeka na B, dwa = znajomi), wyszukiwanie graczy, „ostatnio w grze”
 * i „ostatnio grał”, powiadomienia z dzwoneczkiem (na żywo) i zaproszenia do gry, które zostają też po wyjściu z gry.
 */
export interface Player { id: string; nick: string; avatar: number; last_seen: string | null; last_played: string | null }
export interface Notice { id: number; kind: 'friend_request' | 'friend_accept' | 'invite' | 'note' | 'note_done' | 'friend_match' | 'friend_level' | 'friend_badge'; from_id: string | null; from_nick: string; from_avatar: number; payload: { room?: string; name?: string; note?: number; text?: string; won?: boolean; mode?: string; minutes?: number; kills?: number; razed?: number; xp?: number; level?: number } | null; read: boolean; created_at: string }

const COLS = 'id,nick,avatar,last_seen,last_played';
/** Profile graczy; przed migracją (bez nowych kolumn) — sam nick */
async function profiles(build: (cols: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Player[]> {
  let r = await build(COLS);
  if (r.error) r = await build('id,nick');
  return ((r.data as Partial<Player>[] | null) ?? []).map((p) => ({ id: p.id!, nick: p.nick ?? '?', avatar: p.avatar ?? 0, last_seen: p.last_seen ?? null, last_played: p.last_played ?? null }));
}

export interface FriendLists { friends: Player[]; incoming: Player[]; outgoing: Player[] }
export async function friendLists(): Promise<FriendLists> {
  const m = me();
  if (!m) return { friends: [], incoming: [], outgoing: [] };
  const { data } = await supa.from('friends').select('user_id,friend_id').or(`user_id.eq.${m.id},friend_id.eq.${m.id}`);
  const rows = (data as { user_id: string; friend_id: string }[] | null) ?? [];
  const out = new Set(rows.filter((r) => r.user_id === m.id).map((r) => r.friend_id));
  const inc = new Set(rows.filter((r) => r.friend_id === m.id).map((r) => r.user_id));
  const ids = [...new Set([...out, ...inc])];
  if (!ids.length) return { friends: [], incoming: [], outgoing: [] };
  const ps = await profiles((c) => supa.from('profiles').select(c).in('id', ids));
  const by = (f: (id: string) => boolean): Player[] => ps.filter((p) => f(p.id)).sort((a, b) => a.nick.localeCompare(b.nick, 'pl'));
  return { friends: by((id) => out.has(id) && inc.has(id)), incoming: by((id) => inc.has(id) && !out.has(id)), outgoing: by((id) => out.has(id) && !inc.has(id)) };
}

/** Szukanie graczy po fragmencie nicku (bez mnie) */
export async function searchPlayers(q: string): Promise<Player[]> {
  const m = me();
  const t = q.trim().replace(/[%_,()]/g, '');
  if (t.length < 2) return [];
  return (await profiles((c) => supa.from('profiles').select(c).ilike('nick', `%${t}%`).limit(30))).filter((p) => p.id !== m?.id);
}

/** Ostatnio aktywni gracze — propozycje nowych znajomych */
export async function recentPlayers(limit = 20): Promise<Player[]> {
  const m = me();
  const r = await supa.from('profiles').select(COLS).not('last_seen', 'is', null).order('last_seen', { ascending: false }).limit(limit + 1);
  if (r.error) return [];
  return ((r.data as unknown as Player[] | null) ?? []).filter((p) => p.id !== m?.id).slice(0, limit);
}

const err = (e: { message: string } | null): string | null => (e && !/duplicate key/i.test(e.message) ? e.message : null);
/** Zaproszenie do znajomych (albo akceptacja, gdy ta osoba już zaprosiła mnie) */
export async function befriend(id: string): Promise<string | null> {
  const m = me();
  if (!m) return tx('Zaloguj się.', 'Please sign in.');
  if (id === m.id) return tx('To Ty :)', "That's you :)");
  const { error } = await supa.from('friends').insert({ user_id: m.id, friend_id: id });
  return err(error);
}
/** Odrzucenie zaproszenia albo usunięcie znajomego (oba kierunki) */
export async function unfriend(id: string): Promise<void> {
  const m = me();
  if (!m) return;
  await Promise.all([
    supa.from('friends').delete().eq('user_id', m.id).eq('friend_id', id),
    supa.from('friends').delete().eq('user_id', id).eq('friend_id', m.id),
  ]);
}

/** Zaproszenie do gry: na żywo (okienko u znajomego w grze) i do dzwoneczka (zostaje, gdy go nie ma) */
export async function inviteToGame(toId: string, roomId: string, roomName: string): Promise<string | null> {
  void sendInvite(toId, roomId, roomName);
  const { error } = await supa.rpc('notify_invite', { p_to: toId, p_room: roomId, p_room_name: roomName });
  if (error && /zapraszać można tylko znajomych/.test(error.message)) return tx('Zapraszać można tylko znajomych.', 'You can only invite friends.');
  return null;
}

// ---------------- powiadomienia ----------------
let notices: Notice[] = [];
const noticeSubs = new Set<() => void>();
/** Nowe powiadomienie, które przyszło przed chwilą (do okienka w rogu ekranu) */
const freshSubs = new Set<(n: Notice) => void>();
export const onFreshNotice = (f: (n: Notice) => void): (() => void) => { freshSubs.add(f); return () => freshSubs.delete(f); };
export const noticesNow = (): Notice[] => notices;
export const unread = (): number => notices.filter((n) => !n.read).length;
export const onNotices = (f: () => void): (() => void) => { noticeSubs.add(f); return () => noticeSubs.delete(f); };
const ping = (): void => { for (const f of noticeSubs) f(); };
export async function loadNotices(): Promise<void> {
  if (!me()) { notices = []; ping(); return; }
  const { data, error } = await supa.from('notifications').select('*').order('created_at', { ascending: false }).limit(40);
  notices = error ? [] : ((data as Notice[] | null) ?? []);
  ping();
}
export async function markRead(): Promise<void> {
  const m = me();
  if (!m || !unread()) return;
  notices = notices.map((n) => ({ ...n, read: true })); ping();
  await supa.from('notifications').update({ read: true }).eq('user_id', m.id).eq('read', false);
}
export async function dropNotice(id: number): Promise<void> {
  notices = notices.filter((n) => n.id !== id); ping();
  await supa.from('notifications').delete().eq('id', id);
}

// ---------------- na żywo: powiadomienia i „ostatnio w grze” ----------------
let liveFor = '';
let live: ReturnType<typeof supa.channel> | null = null;
let beat: ReturnType<typeof setInterval> | null = null;
const seen = (): void => {
  const m = me();
  if (!m) return;
  const w = myStatus().where;
  void supa.rpc('seen', { p_playing: w === 'game' || w === 'solo', p_avatar: m.avatar });
};
function sync(): void {
  const m = me();
  const key = m?.id ?? '';
  if (key === liveFor) return;
  liveFor = key;
  if (live) { void supa.removeChannel(live); live = null; }
  if (beat) { clearInterval(beat); beat = null; }
  void loadNotices();
  if (!m) return;
  live = supa.channel(`notices:${m.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${m.id}` }, (e) => {
      if (e.eventType === 'INSERT' && e.new) for (const f of freshSubs) f(e.new as Notice);
      void loadNotices();
    })
    .subscribe();
  seen();
  beat = setInterval(seen, 60_000);
}
if (typeof window !== 'undefined') {
  onAccount(sync);
  onStatus(seen);
}

// ---------------- profil gracza: poziom, liczniki, ostatnie mecze ----------------
export interface Stats { xp: number; level: number; matches: number; wins: number; kills: number; razed?: number; built?: number; minutes?: number; online_wins?: number; hard_wins?: number }
/** Liczniki postępu wielu graczy naraz (poziom na kafelkach znajomych) */
export async function statsOf(ids: string[]): Promise<Map<string, Stats>> {
  const out = new Map<string, Stats>();
  if (!ids.length) return out;
  const { data, error } = await supa.from('player_progress').select('*').in('user_id', ids);
  if (error) return out;
  for (const r of (data as (Stats & { user_id: string })[] | null) ?? []) out.set(r.user_id, r);
  return out;
}
export interface Match { mode: string; won: boolean; minutes: number; kills: number; razed: number; built: number; xp: number; created_at: string }
/** Ostatnie mecze gracza (widzi sam gracz, jego znajomi i administrator) */
export async function playerMatches(id: string, limit = 15): Promise<Match[] | string> {
  const { data, error } = await supa.rpc('player_matches', { p_user: id, p_limit: limit });
  if (error) return /tylko znajomi/.test(error.message) ? tx('Mecze widzą tylko znajomi.', 'Only friends can see matches.') : /PGRST20|Could not find/.test(error.message) ? tx('Historia meczów będzie po aktualizacji bazy.', 'Match history comes with the database update.') : error.message;
  return (data as Match[] | null) ?? [];
}
export async function playerById(id: string): Promise<Player | null> {
  const ps = await profiles((c) => supa.from('profiles').select(c).eq('id', id));
  return ps[0] ?? null;
}
