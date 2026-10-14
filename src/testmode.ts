/**
 * Tryb testowy (?test=1 w adresie): szybki start w przeglądarce bez karty graficznej.
 * Małe tekstury, bez cieni, bez cieniowania zagłębień, bez miniatur i bez puszczy za mapą.
 * Grafika jest wtedy uboga, ale gra wstaje w kilka sekund — do sprawdzania, czy coś działa.
 * ?test=1&pusta=1: pusta płaska łąka tylko z twierdzami (bez lasów, wody, botów, wilków) — do zrzutów jednej rzeczy.
 * ?test=1&hd=1: piaskownica testowa (świeża mapa, bez ruszania zapisu gracza), ale z pełną grafiką.
 */
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
/** Piaskownica testowa: nie czyta i nie nadpisuje zapisu gracza, od razu gra */
export const SANDBOX = !!q?.has('test');
/** Uboga grafika do szybkich testów */
export const TEST = SANDBOX && !q?.has('hd');
/** Pusta scena testowa: płaska łąka, tylko twierdze; resztę stawia test (__test.place itd.) */
export const EMPTY = SANDBOX && !!q?.has('pusta');
