import * as THREE from 'three';

/**
 * Warstwa „tylko cień”: siatki na tej warstwie nie trafiają do zwykłego obrazu, rysuje je wyłącznie
 * mapa cieni słońca. Służy do zastępczych brył cienia — gęsty krzak czy korona drzewa rzuca cień
 * prostszą bryłą tego samego kształtu (w mapie cieni różnicy nie widać), a w obrazie zostaje pełny model.
 */
export const SHADOW_LAYER = 1;

/** Materiał zastępczych brył cienia (w obrazie i tak ich nie ma; liczy się tylko kształt) */
export const shadowProxyMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

/** Mapa cieni widzi warstwę „tylko cień”, zwykły obraz nie (three sprawdza warstwy kamery także przy cieniach) */
export function enableShadowLayer(renderer: THREE.WebGLRenderer): void {
  const sm = renderer.shadowMap;
  const render = sm.render.bind(sm);
  sm.render = (lights, scene, camera) => {
    const had = camera.layers.isEnabled(SHADOW_LAYER);
    camera.layers.enable(SHADOW_LAYER);
    try { render(lights, scene, camera); } finally { if (!had) camera.layers.disable(SHADOW_LAYER); }
  };
}
