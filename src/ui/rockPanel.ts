import { tx } from '../i18n';
import type { GameState } from '../sim/state';
import { canSmash, ROCK_COST, ROCK_STONE } from '../sim/systems/boulders';

/**
 * Okienko głazu (Michał 30.10.2026): po kliknięciu dużego głazu na łące — co to jest i przycisk „Rozbij” (cech
 * inżynierów, ROCK_COST rudy). Rozbicie zostawia stos kamienia, który wynoszą ludzie (boulders.ts, rubble.ts).
 * Stan przycisku odświeża się, póki okienko jest otwarte (cech mógł stanąć, ruda przybyć).
 */
export interface RockPanel { show(tile: number | null): void; refresh(g: GameState, me: number): void; readonly tile: number | null }

export function createRockPanel(onSmash: (tile: number) => void): RockPanel {
  const root = document.createElement('div');
  root.className = 'panel rock-panel';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', tx('Głaz', 'Boulder'));
  root.hidden = true;
  const name = document.createElement('p');
  name.className = 'info-name';
  name.textContent = tx('Głaz', 'Boulder');
  const desc = document.createElement('p');
  desc.textContent = tx(`Wielki kamień w darni. Na nim nic nie postawisz ani nie położysz drogi. Inżynierowie z cechu mogą go rozbić — zostanie stos kamienia (${ROCK_STONE} szt.), który ludzie zaniosą do składu.`,
    `A great stone set in the turf. Nothing can be built or paved over it. Engineers from the guild can break it up, leaving a heap of stone (${ROCK_STONE}) for your folk to carry to the stockpile.`);
  const why = document.createElement('p');
  why.className = 'hint';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-btn';
  btn.textContent = tx(`Rozbij — ${ROCK_COST} rudy`, `Break it up — ${ROCK_COST} ore`);
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = tx('Zamknij', 'Close');
  root.append(name, desc, why, btn, close);
  document.getElementById('ui')?.append(root) ?? document.body.append(root);
  let tile: number | null = null;
  btn.addEventListener('click', () => { if (tile !== null && !btn.disabled) { onSmash(tile); api.show(null); } });
  close.addEventListener('click', () => api.show(null));
  const api: RockPanel = {
    get tile() { return tile; },
    show(t) { tile = t; root.hidden = t === null; if (t !== null) btn.focus(); },
    refresh(g, me) {
      if (tile === null) return;
      const err = canSmash(g, me, tile);
      if (err === 'rock.none') { api.show(null); return; }
      btn.disabled = !!err;
      why.textContent = err === 'rock.guild' ? tx('Potrzebny gotowy cech inżynierów.', 'You need a finished engineers\' guild.')
        : err === 'rock.cost' ? tx(`Za mało rudy (potrzeba ${ROCK_COST}).`, `Not enough ore (${ROCK_COST} needed).`) : '';
      why.hidden = !err;
    },
  };
  return api;
}
