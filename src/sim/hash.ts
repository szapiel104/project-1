/** Skrót (FNV-1a, 32 bity) z tablic bajtów — do porównywania stanu między klientami. */
export function hashBytes(...chunks: Uint8Array[]): number {
  let h = 0x811c9dc5;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      h ^= c[i]!;
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}
