import * as THREE from 'three';

// Big inverted sphere with a two-stop vertical gradient plus a sun glow term.
// Colours are driven by the time-of-day state each frame.
export function makeSky() {
  const uniforms = {
    topColor: { value: new THREE.Color('#2f8fd8') },
    horizonColor: { value: new THREE.Color('#d9f2ff') },
    sunColor: { value: new THREE.Color('#fff8dc') },
    sunDir: { value: new THREE.Vector3(0.45, 0.78, 0.42).normalize() },
    sunAmount: { value: 1 },
    sunHalo: { value: 0.3 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      uniform float sunAmount;
      uniform float sunHalo;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld - cameraPosition);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.62));
        float d = max(dot(dir, normalize(sunDir)), 0.0);
        col += sunColor * (pow(d, 220.0) * 0.55 + pow(d, 10.0) * sunHalo) * sunAmount;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return {
    mesh,
    set(s) {
      uniforms.topColor.value.copy(s.skyTop);
      uniforms.horizonColor.value.copy(s.skyHorizon);
      uniforms.sunColor.value.copy(s.sunTint);
      uniforms.sunDir.value.copy(s.sunDir);
      uniforms.sunAmount.value = s.sunAmount;
      uniforms.sunHalo.value = s.sunHalo;
    },
  };
}
