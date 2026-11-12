import * as THREE from 'three';

// ---------------------------------------------------------------- gradients
// Hard-band gradient maps for MeshToonMaterial (sampled with NearestFilter).
export function makeGradient(steps) {
  const data = new Uint8Array(steps.length);
  for (let i = 0; i < steps.length; i++) data[i] = Math.round(THREE.MathUtils.clamp(steps[i], 0, 1) * 255);
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export const GRADIENTS = {
  g3: makeGradient([0.24, 0.62, 1.0]),
  g4: makeGradient([0.16, 0.4, 0.7, 1.0]),
};

// ---------------------------------------------------------------- toon material
// MeshToonMaterial + injected view-space rim light for that cartoon pop.
export function toonMat(opts = {}) {
  const m = new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    gradientMap: opts.gradient ?? GRADIENTS.g3,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    map: opts.map ?? null,
    emissiveMap: opts.emissiveMap ?? null,
    vertexColors: !!opts.vertexColors,
    side: opts.side ?? THREE.FrontSide,
  });
  m.userData.rim = {
    color: new THREE.Color(opts.rimColor ?? 0xffffff),
    strength: opts.rimStrength ?? 0,
    power: opts.rimPower ?? 2.5,
  };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: m.userData.rim.color };
    shader.uniforms.uRimStrength = { value: m.userData.rim.strength };
    shader.uniforms.uRimPower = { value: m.userData.rim.power };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;'
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        {
          float rimDot = saturate( dot( normalize( vViewPosition ), normal ) );
          float rim = pow( 1.0 - rimDot, uRimPower ) * uRimStrength;
          reflectedLight.indirectDiffuse += uRimColor * rim;
        }`
      );
    m.userData.shader = shader;
  };
  m.customProgramCacheKey = () => 'toon-rim';
  return m;
}

export function setRim(mat, color, strength, power) {
  const r = mat.userData.rim;
  r.color.set(color);
  r.strength = strength;
  if (power != null) r.power = power;
  const s = mat.userData.shader;
  if (s) {
    s.uniforms.uRimStrength.value = strength;
    if (power != null) s.uniforms.uRimPower.value = power;
  }
}

// ---------------------------------------------------------------- ink outline
// One shared inverted-hull material; per-geometry thickness via aThickness.
export function makeOutlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x382a3e) },
      fogColor: { value: new THREE.Color(0xffffff) },
      fogDensity: { value: 0.0004 },
    },
    vertexShader: /* glsl */ `
      attribute float aThickness;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position + normalize( normal ) * aThickness;
        vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4( uColor, 1.0 );
        gl_FragColor = linearToOutputTexel( gl_FragColor );
        #include <fog_fragment>
      }
    `,
    side: THREE.BackSide,
    fog: true,
  });
}

export function addThickness(geo, t) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n).fill(t);
  geo.setAttribute('aThickness', new THREE.BufferAttribute(arr, 1));
  return geo;
}

// Paint a uniform color into the `color` attribute (multiplied in shader).
export function paintGeo(geo, color, multiplier = 1) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r * multiplier;
    arr[i * 3 + 1] = c.g * multiplier;
    arr[i * 3 + 2] = c.b * multiplier;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// ---------------------------------------------------------------- canvas textures
export function canvasTexture(size, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = 4;
  return tex;
}

// Soft radial glow sprite texture (additive).
export function glowTexture(rgb = [255, 255, 255], size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const [r, g, b] = rgb;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.3, `rgba(${r},${g},${b},0.55)`);
  grad.addColorStop(0.65, `rgba(${r},${g},${b},0.16)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
