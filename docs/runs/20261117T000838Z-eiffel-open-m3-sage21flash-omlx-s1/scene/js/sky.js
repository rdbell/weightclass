import * as THREE from 'three';

/**
 * Gradient sky dome with a hard-edged sun/moon disc, one halo band and
 * procedural twinkling stars (night).
 */
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color('#2e7cd6') },
    uHorizon: { value: new THREE.Color('#aadcf5') },
    uBottom: { value: new THREE.Color('#eaf7fd') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#fff4cc') },
    uHaloColor: { value: new THREE.Color('#fff6d8') },
    uSunDisc: { value: 0.99935 },
    uHalo: { value: 0.9987 },
    uStars: { value: 0 },
    uTime: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunColor, uHaloColor;
      uniform float uSunDisc, uHalo, uStars, uTime;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(0.02, 0.55, h));
        col = mix(uBottom, col, smoothstep(-0.3, 0.02, h));

        // hard-edged sun/moon disc + one halo band
        float c = dot(d, normalize(uSunDir));
        float disc = step(uSunDisc, c);
        float halo = step(uHalo, c) * (1.0 - disc);
        col = mix(col, uHaloColor, halo * 0.55);
        col = mix(col, uSunColor, disc);

        // stars: two layers of twinkling points on a spherical grid
        if (uStars > 0.001) {
          vec2 sph = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
          for (int i = 0; i < 2; i++) {
            float scale = 60.0 + float(i) * 55.0;
            vec2 g = sph * scale;
            vec2 id = floor(g);
            vec2 f = fract(g);
            float rnd = hash(id + float(i) * 17.0);
            vec2 sp = vec2(hash(id + 3.1), hash(id + 7.7));
            float dst = length(f - sp);
            float tw = 0.6 + 0.4 * sin(uTime * (1.5 + rnd * 2.0) + rnd * 50.0);
            float star = step(0.93, rnd) * smoothstep(0.11, 0.02, dst) * tw;
            col += vec3(1.0, 0.96, 0.88) * star * uStars * smoothstep(0.02, 0.2, d.y);
          }
        }

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 48, 24), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1;

  return { sky, uniforms };
}