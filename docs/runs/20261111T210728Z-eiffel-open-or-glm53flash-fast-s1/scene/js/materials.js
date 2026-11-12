import * as THREE from 'three';

// 3-band gradient map -> hard cel light steps (no smooth gradients).
// 4 texels wide: RedFormat rows must satisfy WebGL's 4-byte unpack alignment.
const gradData = new Uint8Array([90, 90, 166, 255]);
export const gradientMap = new THREE.DataTexture(gradData, 4, 1, THREE.RedFormat);
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

export function toon(color, params = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...params });
}

// Ink outline: back-face hull pushed outward along view-space normals,
// so the outline stays a constant world thickness even on scaled instances.
const OUTLINE_VERT = /* glsl */`
  uniform float uT;
  #include <common>
  void main(){
    #include <beginnormal_vertex>
    #include <begin_vertex>
    #include <defaultnormal_vertex>
    #include <project_vertex>
    gl_Position += projectionMatrix * vec4(normalize(transformedNormal) * uT, 0.0);
  }
`;
const OUTLINE_FRAG = /* glsl */`
  uniform vec3 uColor;
  void main(){
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }
`;

export function outlineMaterial(thickness = 1.0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: thickness },
      uColor: { value: new THREE.Color('#181019') },
    },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
  });
}

export function addOutline(mesh, thickness = 1.0) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  mesh.add(o);
  return o;
}

// Outline twin for an InstancedMesh: shares the same instanceMatrix buffer.
export function addInstancedOutline(src, thickness = 1.0) {
  const o = new THREE.InstancedMesh(src.geometry, outlineMaterial(thickness), src.count);
  o.instanceMatrix = src.instanceMatrix;
  o.frustumCulled = false;
  src.parent && src.parent.add(o);
  return o;
}
