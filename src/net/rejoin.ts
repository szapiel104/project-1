import type { MapPresetId } from '../data/maps';
import { deserialize, type SaveData } from '../sim/save';
import type { GameState } from '../sim/state';
import { tx } from '../i18n';
import { Lockstep, type NetSnapshot } from './lockstep';
import { getRoom, me, restore, roomLink, type NetMsg, type Room, type RoomLink, type Slot } from './supa';

/**
 * Powrót do meczu przez sieć po odświeżeniu strony albo zerwanym połączeniu.
 * Przeglądarka pamięta trwający mecz (pokój, miejsce, skład). Po powrocie gracz prosi kanał pokoju o swoje miejsce,
 * jeden z grających przesyła mu stan gry (zapis + polecenia na najbliższe tury), a gra rusza od tego miejsca.
 * W czasie nieobecności jego zamkiem rządzi bot.
 */

/** Trwający mecz zapamiętany w przeglądarce */
export interface MatchMemo { room: Room; seed: string; preset: MapPresetId; level: number; slots: Slot[]; me: number; humans: number[]; coop: boolean; at: number }

const KEY = 'project1.netmatch';
/** Po tylu godzinach mecz uznajemy za skończony (pokój i tak zostaje sprzątnięty) */
const MAX_AGE = 3 * 3600_000;

export function rememberMatch(m: Omit<MatchMemo, 'at'>): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...m, at: Date.now() })); } catch { /* brak dostępu do pamięci */ }
}
export function forgetMatch(): void { try { localStorage.removeItem(KEY); } catch { /* nic */ } }
export function recallMatch(): MatchMemo | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const m = JSON.parse(raw) as MatchMemo;
    if (!m?.room?.id || !Array.isArray(m.slots) || !Number.isInteger(m.me) || Date.now() - m.at > MAX_AGE) { forgetMatch(); return null; }
    return m;
  } catch { return null; }
}

// ---------------- pakowanie stanu: JSON → gzip → base64 → kawałki (kanał na żywo ma limit wielkości wiadomości) ----------------
const CHUNK = 48_000;
interface Packed { save: SaveData; net: NetSnapshot }

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
const toB64 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function packState(save: SaveData, net: NetSnapshot): Promise<string[]> {
  const b64 = toB64(await gzip(JSON.stringify({ save, net } satisfies Packed)));
  const out: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK) out.push(b64.slice(i, i + CHUNK));
  return out.length ? out : [''];
}
export async function unpackState(parts: string[]): Promise<Packed> {
  return JSON.parse(await gunzip(fromB64(parts.join('')))) as Packed;
}

/** Wysyła wracającemu graczowi stan gry po turze `turn` (zapis i lockstep wzięte od razu, pakowanie w tle) */
export function sendState(link: Pick<RoomLink, 'send'>, to: number, turn: number, save: SaveData, net: NetSnapshot): void {
  void packState(save, net).then((parts) => parts.forEach((data, part) => link.send({ k: 'state', to, turn, part, parts: parts.length, data })));
}

export interface Rejoined { game: GameState; memo: MatchMemo; link: RoomLink; net: Lockstep }

/**
 * Wraca do zapamiętanego meczu: łączy się z kanałem pokoju, prosi o miejsce (co 3 s, bo grający mogą jeszcze nie wiedzieć,
 * że wyszliśmy) i czeka na stan gry. Zwraca grę gotową do wznowienia albo opis, czemu się nie udało.
 */
export async function rejoinMatch(memo: MatchMemo, note: (text: string) => void, wait = 45_000): Promise<Rejoined | string> {
  await restore();
  const m = me();
  const seat = memo.slots[memo.me];
  if (!m) return tx('Zaloguj się na to samo konto, żeby wrócić do meczu.', 'Sign in to the same account to return to the match.');
  if (seat?.kind !== 'human' || seat.id !== m.id) return tx('Ten mecz grało inne konto.', 'This match was played on another account.');
  const room = await getRoom(memo.room.id);
  if (typeof room === 'string' || room.status !== 'playing') { forgetMatch(); return tx('Ten mecz już się skończył.', 'This match has already ended.'); }
  const link = roomLink(room.id, { id: m.id, nick: m.nick, avatar: m.avatar });
  await link.ready;
  // lockstep słucha od razu: polecenia, które przyjdą w czasie czekania na stan, nie przepadną
  const net = new Lockstep(link, memo.me, memo.humans);
  const parts: string[] = [];
  let turn = -1, got = 0;
  return new Promise<Rejoined | string>((done) => {
    let finished = false;
    const finish = (r: Rejoined | string): void => {
      if (finished) return;
      finished = true; clearInterval(ask); clearTimeout(giveUp); off();
      if (typeof r === 'string') { net.close(false); link.close(); }
      done(r);
    };
    const off = link.on((msg: NetMsg) => {
      if (msg.k !== 'state' || msg.to !== memo.me || !Number.isInteger(msg.part) || msg.parts < 1 || msg.parts > 400) return;
      // nowszy stan (np. drugi przesłany po kolejnej prośbie) zastępuje stary
      if (msg.turn !== turn) { if (msg.turn < turn) return; turn = msg.turn; parts.length = 0; got = 0; }
      if (parts[msg.part] === undefined) { parts[msg.part] = msg.data; got++; }
      note(tx(`Pobieram stan gry… ${Math.round((got / msg.parts) * 100)}%`, `Downloading the game state… ${Math.round((got / msg.parts) * 100)}%`));
      if (got < msg.parts) return;
      const at = turn;
      void unpackState(parts.slice(0, msg.parts)).then((p) => {
        const game = deserialize(p.save);
        if (!game) { finish(tx('Nie udało się wczytać stanu gry (inna wersja gry? Odśwież stronę).', 'Could not load the game state (different game version? Refresh the page).')); return; }
        net.resume(at, p.net);
        finish({ game, memo: { ...memo, room }, link, net });
      }).catch(() => finish(tx('Stan gry przyszedł uszkodzony.', 'The game state arrived damaged.')));
    });
    const request = (): void => link.send({ k: 'rejoin', id: m.id, slot: memo.me });
    request();
    note(tx('Czekam, aż grający wpuszczą Cię z powrotem…', 'Waiting for the players to let you back in…'));
    const ask = setInterval(request, 3000);
    const giveUp = setTimeout(() => finish(tx('Nikt z grających nie odpowiada — mecz chyba się skończył.', 'None of the players respond — the match has probably ended.')), wait);
  });
}
