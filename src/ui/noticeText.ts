import type { Notice } from '../net/social';
import { titleOf } from '../data/progress';
import { plainRich } from './richNote';
import { tx } from '../i18n';

/** Rodzaj meczu po ludzku (do powiadomień i historii meczów) */
export function modeText(mode: string | undefined): string {
  if (mode === 'online') return tx('przez sieć', 'online');
  if (mode === 'coop') return tx('razem przeciw botom', 'co-op vs bots');
  const lv = ['pokojowe', 'łatwe', 'średnie', 'trudne'], en = ['peaceful', 'easy', 'medium', 'hard'];
  if (mode?.startsWith('bots')) { const i = Number(mode.slice(4)); return tx(`z botami (${lv[i] ?? '?'})`, `vs bots (${en[i] ?? '?'})`); }
  return mode ?? '';
}

/** Treść powiadomienia — ta sama w dzwoneczku i w okienku w rogu */
export function noticeText(n: Notice): string {
  const p = n.payload ?? {};
  switch (n.kind) {
    case 'friend_request': return tx(`${n.from_nick} chce zostać Twoim znajomym`, `${n.from_nick} wants to be your friend`);
    case 'friend_accept': return tx(`${n.from_nick} przyjął zaproszenie — jesteście znajomymi`, `${n.from_nick} accepted — you are now friends`);
    case 'invite': return tx(`${n.from_nick} zaprasza Cię do gry „${p.name ?? ''}”`, `${n.from_nick} invites you to the game “${p.name ?? ''}”`);
    case 'note': return tx(`Nowa uwaga od ${n.from_nick}: „${plainRich(p.text ?? '')}”`, `New note from ${n.from_nick}: “${plainRich(p.text ?? '')}”`);
    case 'note_done': return tx(`Twoja uwaga jest zrobiona: „${plainRich(p.text ?? '')}”`, `Your note is done: “${plainRich(p.text ?? '')}”`);
    case 'friend_match': {
      const det = tx(`${modeText(p.mode)} · ${p.minutes ?? 0} min · wrogów ${p.kills ?? 0}${p.xp ? ` · +${p.xp} PD` : ''}`, `${modeText(p.mode)} · ${p.minutes ?? 0} min · ${p.kills ?? 0} foes${p.xp ? ` · +${p.xp} XP` : ''}`);
      return p.won ? tx(`${n.from_nick} wygrał bitwę (${det})`, `${n.from_nick} won a battle (${det})`) : tx(`${n.from_nick} przegrał bitwę (${det})`, `${n.from_nick} lost a battle (${det})`);
    }
    case 'friend_level': return tx(`${n.from_nick} osiągnął poziom ${p.level ?? '?'} — ${titleOf(p.level ?? 1)}`, `${n.from_nick} reached level ${p.level ?? '?'} — ${titleOf(p.level ?? 1)}`);
    case 'friend_badge': return tx(`${n.from_nick} zdobył odznakę`, `${n.from_nick} earned a badge`);
  }
}
/** Ikonka rodzaju powiadomienia (znak, bez emoji kolorowych) */
export function noticeMark(n: Notice): string {
  switch (n.kind) {
    case 'friend_match': return n.payload?.won ? '⚔' : '✗';
    case 'friend_level': return '▲';
    case 'invite': return '⚑';
    case 'friend_request': case 'friend_accept': return '✚';
    default: return '✎';
  }
}
