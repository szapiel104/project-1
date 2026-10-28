/**
 * Co chowa dana chata — tylko jeden rodzaj, żeby 20 chat nie dawało 20 stad wszystkiego naraz:
 * mniej więcej 4 na 10 chat ma kury (1–2), 3 na 10 jedną świnię, reszta nic. Rudera z desek trzyma co najwyżej kury,
 * namiot nic. Wybór z numeru budynku, więc ta sama chata zawsze ma to samo (gospodyni sypie ziarno tylko tam, gdzie są kury).
 */
export function yardAnimal(typeId: string, id: number): 'hens' | 'pig' | 'none' {
  if (typeId !== 'house' && typeId !== 'shack') return 'none';
  const h = (Math.imul(id + 17, 2654435761) >>> 0) % 10;
  if (typeId === 'shack') return h < 3 ? 'hens' : 'none';
  return h < 4 ? 'hens' : h < 7 ? 'pig' : 'none';
}
/** Ile kur przy chacie z kurami (1 albo 2) */
export const henCount = (id: number): number => 1 + ((Math.imul(id + 5, 40503) >>> 7) & 1);
