declare module 'n8ao' {
  import type { Camera, Scene, WebGLRenderTarget } from 'three';
  import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: Record<string, unknown>;
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
    setSize(width: number, height: number): void;
    /** Bufor, do którego n8ao samo rysuje scenę (z mapą głębi); można mu ustawić MSAA (samples) */
    beautyRenderTarget: WebGLRenderTarget;
  }
}
