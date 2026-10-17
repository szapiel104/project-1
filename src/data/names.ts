import { lang } from '../i18n';

/**
 * Imiona i przydomki mieszkańców. Każdy chłop dostaje je na stałe z numeru i ziarna mapy.
 * Imiona zostają polskie w obu językach (to postacie); przydomki mają wersję angielską
 * na tych samych miejscach, więc ten sam numer daje tego samego człowieka w obu językach.
 */
export const FIRST_NAMES: readonly string[] = [
  'Mieszko', 'Bolko', 'Zbyszko', 'Jaśko', 'Staszek', 'Wojciech', 'Maciej', 'Bartosz', 'Kuba', 'Jędrzej', 'Witek', 'Bogdan',
  'Dobromir', 'Radosław', 'Sławek', 'Marcin', 'Piotr', 'Paweł', 'Szymon', 'Tomasz', 'Mikołaj', 'Grzegorz', 'Wawrzyniec', 'Klemens',
  'Jagna', 'Dobrawa', 'Bogna', 'Halszka', 'Kasia', 'Anka', 'Zofia', 'Małgorzata', 'Agnieszka', 'Jadwiga', 'Elżbieta', 'Dorota',
];

const BYNAMES_PL = [
  'Rudy', 'Długi', 'Mały', 'Cichy', 'Śmiały', 'Krzywy', 'Siwy', 'Łysy', 'Gruby', 'Chudy', 'Wesoły', 'Ponury',
  'z Lasu', 'znad Rzeki', 'spod Góry', 'z Młyna', 'z Brodu', 'ze Wzgórza', 'Kowalczyk', 'Bednarz', 'Kołodziej', 'Garncarz', 'Cieśla', 'Zdun',
] as const;

/** Te same miejsca co BYNAMES_PL (tsc pilnuje długości) */
type Same<T extends readonly unknown[]> = { readonly [K in keyof T]: string };
const BYNAMES_EN: Same<typeof BYNAMES_PL> = [
  'the Red', 'the Tall', 'the Small', 'the Quiet', 'the Bold', 'the Crooked', 'the Grey', 'the Bald', 'the Fat', 'the Lean', 'the Merry', 'the Grim',
  'of the Forest', 'by the River', 'Underhill', 'of the Mill', 'of the Ford', 'of the Hill', 'Smithson', 'the Cooper', 'the Wheelwright', 'the Potter', 'the Carpenter', 'the Stovemaker',
];

export const BYNAMES: readonly string[] = lang() === 'en' ? BYNAMES_EN : BYNAMES_PL;
