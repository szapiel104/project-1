/** Adresy spakowanych modeli (nazwa → plik .bin); robi je wtyczka `modelPacks` w vite.config.ts */
declare module 'virtual:model-packs' {
  const packs: Record<string, string>;
  export default packs;
}
