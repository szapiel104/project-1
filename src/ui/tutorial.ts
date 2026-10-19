/**
 * „Plan na start” — przewodnik w grze w stylu listy zadań z Cities: Skylines: jeden krok naraz (co zrobić i po co),
 * licznik postępu liczony ze stanu gry, złota obwódka na przycisku, który trzeba kliknąć (najpierw kategoria na pasku
 * budowy, potem karta budynku), krótkie potwierdzenie po wykonaniu. Kartę można zwinąć do paska (stan pamiętany).
 * Encyklopedia „Jak grać” zostaje jako ściąga; tu uczymy przez robienie.
 */
import { BUILDINGS } from '../data/buildings';
import { t, tx } from '../i18n';

/** Co przewodnik musi wiedzieć o grze (tylko liczby — bez zależności od symulacji) */
export interface TutorialView {
  /** Ile budynków danego typu ma gracz (także w budowie) */
  count(id: string): number;
  /** Ilu żołnierzy ma gracz */
  soldiers(): number;
}

interface Step {
  id: string;
  title: string;
  why: string;
  where?: string;
  /** Wymagane budynki (każdy po `n` sztuk); pierwszy brakujący dostaje obwódkę */
  need: { ids: string[]; n: number; label: string }[];
  soldiers?: number;
}

const STEPS: Step[] = [
  { id: 'wood', title: tx('Postaw chatę drwala', 'Build a woodcutter’s hut'), why: tx('Drewno idzie na prawie każdy budynek. Bez niego osada stanie.', 'Wood goes into nearly every building. Without it the settlement stalls.'),
    where: tx('Tuż przy lesie — drwal chodzi do najbliższych drzew.', 'Right by the forest — the woodcutter walks to the nearest trees.'), need: [{ ids: ['woodcutter'], n: 1, label: t('b.woodcutter') }] },
  { id: 'food', title: tx('Zadbaj o jedzenie', 'Secure food'), why: tx('Jabłka ze startu szybko się skończą, a głodni ludzie odchodzą.', 'The starting apples run out fast, and hungry people leave.'),
    where: tx('Sad na trawie albo chata rybaka nad wodą.', 'An orchard on open grass, or a fisherman’s hut by the water.'), need: [{ ids: ['orchard', 'fisher'], n: 1, label: `${t('b.orchard')} / ${t('b.fisher')}` }] },
  { id: 'house', title: tx('Postaw chatę dla nowych ludzi', 'Build a hovel for newcomers'), why: tx('Każda chata to 8 łóżek. Bez wolnych miejsc nikt nowy nie przyjdzie.', 'Each hovel holds 8 beds. Without free beds, no one new will come.'),
    need: [{ ids: ['house'], n: 3, label: t('b.house') }] },
  { id: 'granary', title: tx('Zbuduj spichlerz', 'Build a granary'), why: tx('Jedzenie trzyma się w spichlerzu — stodoła ze startu szybko się zapełni.', 'Food is kept in the granary — the starting barn fills up fast.'),
    where: tx('Blisko sadu albo rybaka, żeby nosili niedaleko.', 'Close to the orchard or fisherman so they don’t walk far.'), need: [{ ids: ['granary', 'granaryBig'], n: 1, label: t('b.granary') }] },
  { id: 'mine', title: tx('Otwórz kopalnię pod górami', 'Open a mine in the hills'), why: tx('Kopalnia daje kamień, żelazo i rudę — rudą płacisz za wojsko i lepsze budynki.', 'The mine yields stone, iron and ore — ore pays for soldiers and better buildings.'),
    where: tx('Tyłem do skały u stóp gór.', 'With its back against the rock at the foot of the hills.'), need: [{ ids: ['oremine'], n: 1, label: t('b.oremine') }] },
  { id: 'bread', title: tx('Uruchom chleb: farma, młyn, piekarnia', 'Start bread: farm, mill, bakery'), why: tx('Piekarnia daje najwięcej jedzenia z jednego budynku — tak wykarmisz dużą osadę.', 'The bakery gives the most food of any building — that is how you feed a big settlement.'),
    need: [{ ids: ['farm'], n: 1, label: t('b.farm') }, { ids: ['mill'], n: 1, label: t('b.mill') }, { ids: ['bakery'], n: 1, label: t('b.bakery') }] },
  { id: 'arms', title: tx('Przygotuj wojsko', 'Raise an army'), why: tx('Wróg w końcu przyjdzie. Włócznie robi warsztat, trzyma zbrojownia, a ludzi szkolą koszary.', 'The enemy will come. The workshop makes spears, the armoury stores them, the barracks trains the men.'),
    need: [{ ids: ['poleturner'], n: 1, label: t('b.poleturner') }, { ids: ['armory'], n: 1, label: t('b.armory') }, { ids: ['barracks'], n: 1, label: t('b.barracks') }] },
  { id: 'troops', title: tx('Wyszkol pięciu żołnierzy', 'Train five soldiers'), why: tx('Kliknij koszary i werbuj. Żołnierz potrzebuje broni ze zbrojowni i rudy.', 'Click the barracks and recruit. Each soldier needs a weapon from the armoury and ore.'),
    need: [], soldiers: 5 },
  { id: 'walls', title: tx('Otocz osadę palisadą z bramą', 'Ring the settlement with a palisade and gate'), why: tx('Palisada zatrzyma wilki i pierwszą falę wroga. Brama przepuszcza tylko Twoich.', 'The palisade stops wolves and the first enemy wave. The gate lets only your people through.'),
    where: tx('Palisadę ciągniesz myszą jak drogę; bramę wstaw w jej linię.', 'Drag the palisade like a road; set the gate into its line.'), need: [{ ids: ['palisade'], n: 12, label: t('b.palisade') }, { ids: ['gate'], n: 1, label: t('b.gate') }] },
];

const KEY = 'p1.tutorial';
const load = (): { min?: boolean; off?: boolean } => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as { min?: boolean; off?: boolean }; } catch { return {}; } };
const save = (v: { min?: boolean; off?: boolean }): void => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* bez pamięci przeglądarki */ } };

export interface Tutorial { update(): void; show(on: boolean): void; reset(): void }

export function createTutorial(view: () => TutorialView | null, sound: (k: 'done') => void): Tutorial {
  const st = load();
  const box = document.createElement('aside');
  box.className = 'tut';
  box.setAttribute('aria-label', tx('Plan na start', 'Opening plan'));
  box.hidden = true;
  document.body.append(box);
  let visible = false;
  let lastDone = -1;
  let glowEl: HTMLElement | null = null;
  let lastHtml = '';
  /** Wstawia treść tylko przy zmianie (bez migania hovera i powtórek dla czytnika ekranu) */
  const put = (html: string): boolean => { if (html === lastHtml) return false; lastHtml = html; box.innerHTML = html; return true; };

  const clearGlow = (): void => { glowEl?.classList.remove('tut-glow'); glowEl = null; };
  const glow = (el: HTMLElement | null): void => { if (el === glowEl) return; clearGlow(); if (el) { el.classList.add('tut-glow'); glowEl = el; } };

  /** Postęp kroku: ile z ilu (sumarycznie) i pierwszy brakujący budynek */
  const progress = (s: Step, v: TutorialView): { have: number; need: number; missing: string | null; rows: { label: string; have: number; n: number }[] } => {
    let have = 0, need = 0, missing: string | null = null;
    const rows = s.need.map((r) => {
      const c = Math.min(r.n, r.ids.reduce((a, id) => a + v.count(id), 0));
      have += c; need += r.n;
      if (c < r.n && !missing) missing = r.ids[0]!;
      return { label: r.label, have: c, n: r.n };
    });
    if (s.soldiers) { const c = Math.min(s.soldiers, v.soldiers()); have += c; need += s.soldiers; rows.push({ label: tx('Żołnierze', 'Soldiers'), have: c, n: s.soldiers }); }
    return { have, need, missing, rows };
  };

  const render = (v: TutorialView): void => {
    const doneIdx = STEPS.findIndex((s) => { const p = progress(s, v); return p.have < p.need; });
    const cur = doneIdx < 0 ? STEPS.length : doneIdx;
    if (lastDone >= 0 && cur > lastDone) sound('done');
    const fresh = cur !== lastDone;
    lastDone = cur;
    box.classList.toggle('min', !!st.min);
    const pips = STEPS.map((_, i) => `<span class="tut-pip${i < cur ? ' done' : i === cur ? ' now' : ''}" aria-hidden="true"></span>`).join('');
    const head = `<div class="tut-head"><span class="tut-kicker">${tx('Plan na start', 'Opening plan')} · ${Math.min(cur + 1, STEPS.length)} / ${STEPS.length}</span><button type="button" class="tut-min" aria-expanded="${!st.min}">${st.min ? tx('Rozwiń', 'Expand') : tx('Zwiń', 'Collapse')}</button></div><div class="tut-pips">${pips}</div>`;
    if (cur >= STEPS.length) {
      if (put(`${head}<div class="tut-body"><p class="tut-title">${tx('Osada stoi na nogach!', 'Your settlement stands on its own!')}</p><p class="tut-why">${tx('Masz drewno, jedzenie, kopalnię, wojsko i palisadę. Teraz rozbuduj osadę i rozbij wroga. Szczegóły w menu → Jak grać.', 'You have wood, food, a mine, an army and a palisade. Now grow the settlement and crush the enemy. Details in Menu → How to play.')}</p><button type="button" class="btn-plain tut-close">${tx('Zamknij plan', 'Close the plan')}</button></div>`)) {
        box.querySelector('.tut-close')!.addEventListener('click', () => { st.off = true; save(st); box.hidden = true; clearGlow(); });
        bindMin(v);
      }
      clearGlow();
    } else {
      const s = STEPS[cur]!;
      const p = progress(s, v);
      const rows = p.rows.map((r) => `<li class="${r.have >= r.n ? 'ok' : ''}"><span>${r.label}</span><strong>${r.have} / ${r.n}</strong></li>`).join('');
      const placing = !!document.querySelector('.card[aria-pressed="true"]');
      const hint = placing ? tx('Teraz kliknij miejsce na mapie. Prawy przycisk albo Esc anuluje.', 'Now click a spot on the map. Right-click or Esc cancels.')
        : p.missing ? tx(`Otwórz kategorię i wybierz kartę „${t(BUILDINGS.find((d) => d.id === p.missing)?.name ?? '')}” — świeci na złoto.`, `Open the category and pick the “${t(BUILDINGS.find((d) => d.id === p.missing)?.name ?? '')}” card — it glows gold.`) : '';
      if (put(`${head}<div class="tut-body"><p class="tut-title">${s.title}</p><p class="tut-why">${s.why}</p>${s.where ? `<p class="tut-where"><strong>${tx('Gdzie', 'Where')}:</strong> ${s.where}</p>` : ''}<ul class="tut-rows">${rows}</ul>${hint ? `<p class="tut-hint">${hint}</p>` : ''}</div>`)) bindMin(v);
      if (fresh) { box.classList.remove('step-in'); void box.offsetWidth; box.classList.add('step-in'); }
      // obwódka: karta budynku, gdy kategoria otwarta; inaczej przycisk kategorii
      if (st.min || placing || !p.missing) clearGlow();
      else {
        const card = document.querySelector<HTMLElement>(`.card[data-build="${p.missing}"]`);
        const cat = BUILDINGS.find((d) => d.id === p.missing)?.category;
        glow(card && !card.hidden && card.offsetParent ? card : cat ? document.querySelector<HTMLElement>(`.cat[data-cat="${cat}"]`) : null);
      }
    }
  };
  const bindMin = (v: TutorialView): void => {
    box.querySelector('.tut-min')!.addEventListener('click', () => { st.min = !st.min; save(st); render(v); box.querySelector<HTMLElement>('.tut-min')?.focus(); });
  };

  return {
    update() {
      if (!visible || st.off) { box.hidden = true; clearGlow(); return; }
      const v = view();
      if (!v) { box.hidden = true; clearGlow(); return; }
      box.hidden = false;
      render(v);
    },
    show(on) { visible = on; if (!on) { box.hidden = true; clearGlow(); } },
    reset() { st.off = false; st.min = false; save(st); lastDone = -1; lastHtml = ''; },
  };
}
