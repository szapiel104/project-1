// testy sprawdzają polskie teksty: Node udaje przeglądarkę „en-US”, więc przed wczytaniem gry ustawiamy polski
Object.defineProperty(globalThis.navigator, 'language', { value: 'pl-PL', configurable: true });
