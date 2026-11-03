import { me, supa } from './supa';
import { tx } from '../i18n';

/** Uwagi testerów (migracja 20261102b): tester dodaje i widzi swoje, administrator widzi wszystkie i oznacza zrobione */
export interface Note { id: number; author: string; nick: string; body: string; place: string; version: string; status: 'open' | 'done'; reply: string | null; created_at: string; done_at: string | null }

const why = (m: string): string => /PGRST20|does not exist|Could not find/i.test(m)
  ? tx('Baza nie ma jeszcze uwag testerów — trzeba wykonać migrację 20261102b_testers.sql.', 'The database has no tester notes yet — run migration 20261102b_testers.sql.')
  : /row-level security|brak uprawnień/i.test(m) ? tx('To konto nie ma roli testera.', 'This account has no tester role.') : m;

export async function addNote(body: string, place: string, version: string): Promise<string | null> {
  const m = me();
  if (!m) return tx('Zaloguj się, żeby wysłać uwagę.', 'Sign in to send a note.');
  const { error } = await supa.from('tester_notes').insert({ body: body.trim(), place, version, nick: m.nick });
  return error ? why(error.message) : null;
}

/** Uwagi: swoje (tester) albo wszystkie (administrator — RLS sam decyduje, co widać) */
export async function listNotes(onlyMine: boolean, limit = 100): Promise<Note[] | string> {
  let q = supa.from('tester_notes').select('*').order('created_at', { ascending: false }).limit(limit);
  const m = me();
  if (onlyMine && m) q = q.eq('author', m.id);
  const { data, error } = await q;
  if (error) return why(error.message);
  return (data as Note[] | null) ?? [];
}

export async function markNote(id: number, done: boolean, reply: string): Promise<string | null> {
  const { error } = await supa.rpc('admin_note', { p_id: id, p_done: done, p_reply: reply });
  return error ? why(error.message) : null;
}

/** Administrator: uwaga znika na zawsze (z powiadomieniami o niej) — migracja 20261103_note_delete.sql */
export async function deleteNote(id: number): Promise<string | null> {
  const { error } = await supa.rpc('admin_note_delete', { p_id: id });
  if (error && /admin_note_delete|PGRST202/i.test(error.message)) return tx('Usuwanie uwag będzie po aktualizacji bazy (migracja 20261103_note_delete.sql).', 'Deleting notes comes with the database update (migration 20261103_note_delete.sql).');
  return error ? why(error.message) : null;
}
