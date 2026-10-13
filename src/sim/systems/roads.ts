import { BUILDINGS } from '../../data/buildings';
import { resIndex, type ResourceId } from '../../data/resources';
import { Phase, type GameState, type Unit } from '../state';
import { dayPart } from './workers';

/** Czym się układa drogę danego rodzaju (surowiec do przyniesienia ze składu albo -1 dla piaskowej) */
const MATERIAL: number[] = [-1, -1, -1, -1];
for (const d of BUILDINGS) if (d.road) { const k = Object.keys(d.cost)[0]; MATERIAL[d.road] = k ? resIndex(k as ResourceId) : -1; }

/** Najwięcej chłopów na raz przy drogach jednego gracza (reszta zostaje do budów i pracy) */
const CREW = 4;
/** Zajęcia, które pracownik może przerwać, żeby ułożyć drogę (gdy brak wolnych ludzi); potem wraca do swojej roboty */
const DROPPABLE = new Set<Phase>([Phase.Idle, Phase.Returning, Phase.Working, Phase.ToSite, Phase.WorkingSite, Phase.ToInputStore, Phase.ToRest, Phase.Resting]);

/**
 * Drogi się buduje: postawiona droga to najpierw plan na polu, a układa ją wolny chłop z obozowiska.
 * Każdy bierze najbliższe zaplanowane pole, którego nikt jeszcze nie układa.
 */
export function roadSystem(g: GameState): void {
  if (g.tick % 10 !== 0) return;
  if (dayPart(g.tick) !== 'work') return; // drogi układa się za dnia
  const w = g.map.width;
  let planned: number[] | null = null;
  for (const p of g.players) {
    const taken = new Set<number>();
    let busy = 0;
    for (const u of g.units) if (u.owner === p.id && (u.phase === Phase.ToPave || u.phase === Phase.Paving || u.phase === Phase.ToRoadFetch)) { busy++; taken.add(u.target - 1); }
    if (busy >= CREW) continue;
    if (!planned) {
      planned = [];
      for (let t = 0; t < g.roadPlan.length; t++) {
        if (!g.roadPlan[t]) continue;
        // na planie stanął budynek: tej drogi już nie będzie
        if (g.occupancy[t]) { g.roadPlan[t] = 0; continue; }
        planned.push(t);
      }
    }
    if (!planned.length) return;
    const free = planned.filter((t) => !taken.has(t));
    if (!free.length) continue;
    let idle: Unit[] = g.units.filter((u) => u.owner === p.id && u.job === 0 && u.phase === Phase.Idle && u.carryRes < 0 && !u.path.length);
    // nikt nie siedzi w obozowisku: jeden pracownik z pustymi rękami odrywa się od roboty (jak przy budowie)
    if (!idle.length && !g.units.some((u) => u.owner === p.id && u.job !== 0 && (u.phase === Phase.ToPave || u.phase === Phase.Paving || u.phase === Phase.ToRoadFetch))) {
      const w1 = g.units.find((u) => u.owner === p.id && u.job !== 0 && u.carryRes < 0 && DROPPABLE.has(u.phase));
      idle = w1 ? [w1] : [];
    }
    for (const u of idle) {
      if (busy >= CREW || !free.length) break;
      // tylko drogi tego gracza: planu nie da się postawić daleko od własnej twierdzy, więc wystarczy wziąć najbliższe pole
      const ux = u.px >> 8, uy = u.py >> 8;
      let bi = -1, bd = Infinity;
      for (let i = 0; i < free.length; i++) {
        const t = free[i]!, x = t % w, y = (t - x) / w;
        const d = Math.abs(x - ux) + Math.abs(y - uy);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0 || bd > 60) break;
      const t = free.splice(bi, 1)[0]!;
      // dyle i bruk trzeba przynieść ze składu; piaskową ubija się z tego, co leży na polu
      const res = MATERIAL[g.roadPlan[t]!] ?? -1;
      u.target = t + 1; u.path = []; u.wait = 0;
      if (res >= 0) { u.phase = Phase.ToRoadFetch; u.timer = res + 1; } else { u.phase = Phase.ToPave; u.timer = 0; }
      busy++;
    }
  }
}
