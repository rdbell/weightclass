import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/**
 * Final toon FX pass (works on the sRGB image after OutputPass):
 *  - a light Sobel ink line where luminance jumps (crispens shadow edges,
 *    lattice gaps and platform rims)
 *  - a soft vignette
 */
export class ToonFXPass extends ShaderPass {
  constructor() {
    super({
      uniforms: {
        tDiffuse: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uInk: { value: new THREE.Color('#2a2115') },
        uEdge: { value: 0.5 },
        uThr: { value: 0.16 },
        uVig: { value: 0.3 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 uRes;
        uniform vec3 uInk;
        uniform float uEdge;
        uniform float uThr;
        uniform float uVig;
        varying vec2 vUv;

        float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        void main() {
          vec2 px = 1.0 / uRes;
          vec4 c = texture2D(tDiffuse, vUv);

          float l00 = lum(texture2D(tDiffuse, vUv + vec2(-px.x, -px.y)).rgb);
          float l01 = lum(texture2D(tDiffuse, vUv + vec2(0.0, -px.y)).rgb);
          float l02 = lum(texture2D(tDiffuse, vUv + vec2(px.x, -px.y)).rgb);
          float l10 = lum(texture2D(tDiffuse, vUv + vec2(-px.x, 0.0)).rgb);
          float l12 = lum(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb);
          float l20 = lum(texture2D(tDiffuse, vUv + vec2(-px.x, px.y)).rgb);
          float l21 = lum(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb);
          float l22 = lum(texture2D(tDiffuse, vUv + vec2(px.x, px.y)).rgb);

          float gx = (l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20);
          float gy = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
          float e = sqrt(gx * gx + gy * gy);
          float line = smoothstep(uThr, uThr + 0.09, e);

          vec3 col = c.rgb;
          col = mix(col, uInk, clamp(line * uEdge, 0.0, 1.0));

          vec2 q = vUv - 0.5;
          float vg = smoothstep(0.95, 0.35, length(q) * 1.7);
          col *= mix(1.0, vg, uVig);

          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }
}
