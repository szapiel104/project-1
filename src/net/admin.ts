import { supa } from './supa';
import { tx } from '../i18n';

/**
 * Panel administratora kont (Michał 2.11.2026): wyszukiwanie kont, poziom i liczniki, nick, prawa administratora.
 * Wszystko idzie przez funkcje w bazie (`admin_*`, migracja 20261102_admins_achievements.sql), które same sprawdzają,
 * czy wołający jest administratorem, i zapisują każdą zmianę w `admin_log`. Przeglądarka niczego tu nie rozstrzyga.
 */
export interface AdminAccount {
  id: string; nick: string; avatar: number; xp: number; level: number; matches: number; wins: number; kills: number;
  razed: number; built: number; minutes: number; online_wins: number; hard_wins: number; admin: boolean; tester?: boolean;
}
export type Counters = Pick<AdminAccount, 'xp' | 'matches' | 'wins' | 'kills' | 'razed' | 'built' | 'minutes' | 'online_wins' | 'hard_wins'>;
export interface AdminLogRow { created_at: string; action: string; target: string | null; detail: Record<string, unknown> | null }

/** Komunikat błędu z bazy po ludzku (brak migracji, brak praw, zajęty nick) */
function why(m: string): string {
  if (/PGRST202|Could not find the function|does not exist/i.test(m)) return tx('Baza nie ma jeszcze funkcji administratora — trzeba wykonać migrację 20261102_admins_achievements.sql.', 'The database has no admin functions yet — run migration 20261102_admins_achievements.sql.');
  if (/brak uprawnień/.test(m)) return tx('To konto nie ma praw administratora.', 'This account has no admin rights.');
  if (/duplicate key|profiles_nick/i.test(m)) return tx('Ten nick jest zajęty.', 'This nickname is taken.');
  return m;
}

export async function adminFind(nick: string): Promise<AdminAccount[] | string> {
  const { data, error } = await supa.rpc('admin_find', { p_nick: nick.trim() });
  if (error) return why(error.message);
  return (data as AdminAccount[] | null) ?? [];
}

export async function adminSetProgress(id: string, c: Counters): Promise<{ xp: number; level: number } | string> {
  const { data, error } = await supa.rpc('admin_set_progress', {
    p_user: id, p_xp: c.xp, p_matches: c.matches, p_wins: c.wins, p_kills: c.kills, p_razed: c.razed, p_built: c.built,
    p_minutes: c.minutes, p_online_wins: c.online_wins, p_hard_wins: c.hard_wins,
  });
  if (error) return why(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { xp: number; level: number } | undefined;
  return row ?? tx('Baza nie zwróciła wyniku.', 'The database returned nothing.');
}

export async function adminSetNick(id: string, nick: string): Promise<string | null> {
  const { error } = await supa.rpc('admin_set_nick', { p_user: id, p_nick: nick.trim() });
  return error ? why(error.message) : null;
}

export async function adminGrant(id: string, on: boolean): Promise<string | null> {
  const { error } = await supa.rpc('admin_grant', { p_user: id, p_on: on });
  return error ? why(error.message) : null;
}

export async function adminTester(id: string, on: boolean): Promise<string | null> {
  const { error } = await supa.rpc('admin_tester', { p_user: id, p_on: on });
  return error ? why(error.message) : null;
}

export async function adminLog(limit = 20): Promise<AdminLogRow[] | string> {
  const { data, error } = await supa.from('admin_log').select('created_at,action,target,detail').order('created_at', { ascending: false }).limit(limit);
  if (error) return why(error.message);
  return (data as AdminLogRow[] | null) ?? [];
}
