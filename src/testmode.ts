/**
 * Tryb testowy (?test=1 w adresie): szybki start w przeglądarce bez karty graficznej.
 * Małe tekstury, bez cieni, bez cieniowania zagłębień, bez miniatur i bez puszczy za mapą.
 * Grafika jest wtedy uboga, ale gra wstaje w kilka sekund — do sprawdzania, czy coś działa.
 */
export const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
