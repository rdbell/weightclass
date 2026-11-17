import * as THREE from 'three';
import { shellGeometry } from './utils.js';

// 4 hard steps: deep shadow, mid, light, highlight.
const gradientMap = new THREE.DataTexture(new Uint8Array([105, 170, 225, 255]), 4, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

export const shared = {
  rimColor: new THREE.Color('#ffedb8'),
};

const rimShared = {
  uRimColor: { value: shared.rimColor },
  uRimCut: { value: 0.68 },
};

const RIM_UNIFORMS = `
uniform vec3 uRimColor;
uniform float uRimCut;
uniform float uRimStrength;
`;

const RIM_CODE = `
{
  vec3 vDir = normalize(vViewPosition);
  float ndv = clamp(dot(normalize(vNormal), vDir), 0.0, 1.0);
  float rim = step(uRimCut, 1.0 - ndv) * uRimStrength;
  outgoingLight += uRimColor * rim;
}
`;

/** Toon material with an optional stepped fresnel rim injected into the shader. */
export function toon(color, opts = {}) {
  const { rimStrength = 0, ...rest } = opts;
  const m = new THREE.MeshToonMaterial({ color, gradientMap, ...rest });
  if (rimStrength > 0) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = rimShared.uRimColor;
      shader.uniforms.uRimCut = rimShared.uRimCut;
      shader.uniforms.uRimStrength = { value: rimStrength };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', RIM_UNIFORMS + 'void main() {')
        .replace('#include <opaque_fragment>', RIM_CODE + '#include <opaque_fragment>');
    };
  }
  return m;
}

// One shared ink material for every inverted-hull outline shell.
export const inkMaterial = new THREE.MeshBasicMaterial({ color: '#332a3f', side: THREE.BackSide });
// Flat ink for ground-level border rings and silhouette props.
export const inkFlatMaterial = new THREE.MeshBasicMaterial({ color: '#332a3f' });
export const birdMat = new THREE.MeshBasicMaterial({ color: '#332a3f', side: THREE.DoubleSide });

export function addShell(mesh, thickness) {
  const shell = new THREE.Mesh(shellGeometry(mesh.geometry, thickness), inkMaterial);
  shell.castShadow = false;
  shell.receiveShadow = false;
  mesh.add(shell);
  return shell;
}

const bound = [];
export function bind(mat, key) { bound.push({ mat, key }); }
export function applyBoundColors(theme) {
  for (const { mat, key } of bound) mat.color.copy(theme[key]);
}