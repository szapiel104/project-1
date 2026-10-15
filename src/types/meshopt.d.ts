declare module 'three/examples/jsm/libs/meshopt_simplifier.module.js' {
  type Flag = 'LockBorder' | 'Sparse' | 'ErrorAbsolute' | 'Prune' | 'Regularize' | 'Permissive' | 'RegularizeLight';
  export const MeshoptSimplifier: {
    ready: Promise<void>;
    supported: boolean;
    generatePositionRemap(positions: Float32Array, stride: number): Uint32Array;
    getScale(positions: Float32Array, stride: number): number;
    simplify(indices: Uint32Array, positions: Float32Array, stride: number, targetIndexCount: number, targetError: number, flags?: Flag[]): [Uint32Array, number];
    simplifyWithAttributes(
      indices: Uint32Array, positions: Float32Array, stride: number, attributes: Float32Array, attributeStride: number,
      weights: number[], lock: Uint8Array | null, targetIndexCount: number, targetError: number, flags?: Flag[],
    ): [Uint32Array, number];
    simplifySloppy(indices: Uint32Array, positions: Float32Array, stride: number, lock: Uint8Array | null, targetIndexCount: number, targetError: number): [Uint32Array, number];
  };
}
