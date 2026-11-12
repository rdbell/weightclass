import * as THREE from 'three';

/** Stylised procedural sky dome: banded gradient, hard-edged sun, moon and stars. */
export class SkyDome {
  constructor() {
    this.uniforms = {
      uTop: { value: new THREE.Color(0x3b9fe0) },
      uMid: { value: new THREE.Color(0x8bd9f6) },
      uHorizon: { value: new THREE.Color(0xdff7ff) },
      uSunColor: { value: new THREE.Color(0xfff4c4) },
      uMoonColor: { value: new THREE.Color(0xeaf3ff) },
      uGlow: { value: new THREE.Color(0xffc680) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
      uMoonDir: { value: new THREE.Vector3(-0.5, 0.6, -0.5).normalize() },
      uSunAmt: { value: 1 },
      uSunSize: { value: 0.035 },
      uMoonAmt: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uGroundGlow: { value: 0.1 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uMoonColor;
        uniform vec3 uGlow;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform float uSunAmt;
        uniform float uSunSize;
        uniform float uMoonAmt;
        uniform float uStars;
        uniform float uTime;
        uniform float uGroundGlow;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float band(float edge0, float edge1, float x) {
          return smoothstep(edge0, edge1, x);
        }

        void main() {
          vec3 dir = normalize(vDir);
          float y = dir.y;

          vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.20, y));
          col = mix(col, uTop, smoothstep(0.16, 0.62, y));

          // warm haze hugging the horizon
          float haze = 1.0 - smoothstep(-0.03, 0.17, abs(y));
          col = mix(col, uGlow, haze * uGroundGlow);

          // ---- sun ----------------------------------------------------
          float sd = dot(dir, uSunDir);
          float sunR = uSunSize;
          float sunCore = 1.0 - smoothstep(cos(sunR), cos(sunR + 0.0022), sd);
          float sunHalo = pow(clamp(sd, 0.0, 1.0), 220.0) * 0.55;
          float sunWide = pow(clamp(sd, 0.0, 1.0), 14.0) * 0.20;
          col += uSunColor * (sunCore * 1.02 + sunHalo + sunWide) * uSunAmt;

          // ---- moon ---------------------------------------------------
          float md = dot(dir, uMoonDir);
          float moonR = 0.036;
          float moonDisk = 1.0 - smoothstep(cos(moonR), cos(moonR + 0.0018), md);

          vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir) + vec3(1e-4));
          vec3 up = cross(uMoonDir, right);
          vec2 mp = vec2(dot(dir, right), dot(dir, up)) / moonR;

          float crater = 0.0;
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            vec2 cc = vec2(
              hash21(vec2(fi * 3.1, 1.7)) * 1.34 - 0.67,
              hash21(vec2(fi * 7.3, 5.1)) * 1.34 - 0.67
            );
            float cr = 0.06 + hash21(vec2(fi * 1.9, 9.2)) * 0.09;
            crater = max(crater, 1.0 - smoothstep(cr * 0.82, cr, length(mp - cc)));
          }
          float moonShade = 1.0 - crater * 0.14;
          float moonHalo = pow(clamp(md, 0.0, 1.0), 90.0) * 0.28;
          col += uMoonColor * (moonDisk * moonShade + moonHalo) * uMoonAmt;

          // ---- stars --------------------------------------------------
          if (uStars > 0.001 && y > 0.005) {
            vec2 sph = vec2(
              atan(dir.z, dir.x) / 6.2831853 + 0.5,
              asin(clamp(y, -1.0, 1.0)) / 3.14159265 + 0.5
            );

            for (int layer = 0; layer < 2; layer++) {
              float scale = layer == 0 ? 250.0 : 170.0;
              vec2 sp = sph * vec2(scale, scale * 0.5);
              vec2 cell = floor(sp);
              vec2 f = fract(sp);
              vec2 rnd = vec2(hash21(cell), hash21(cell + 13.7));
              float present = step(layer == 0 ? 0.968 : 0.952, rnd.x);
              vec2 center = vec2(hash21(cell + 3.1), hash21(cell + 8.3));
              float dist = length(f - center);
              float radius = layer == 0 ? 0.055 : 0.085;
              float dot = 1.0 - smoothstep(radius * 0.45, radius, dist);
              // a little four-point sparkle on a few of the brightest stars
              float arms = 1.0 - smoothstep(0.0, 0.010, min(abs(f.x - center.x), abs(f.y - center.y)));
              float reach = 1.0 - smoothstep(radius * 0.65, radius * 2.3, dist);
              float star = (dot + arms * reach * step(0.88, rnd.y) * 0.55) * present;
              float twinkle = 0.55 + 0.45 * sin(uTime * 2.2 + rnd.y * 40.0);
              float horizonFade = smoothstep(0.015, 0.22, y);
              col += vec3(0.82, 0.90, 1.0) * star * twinkle * uStars * horizonFade * (layer == 0 ? 0.8 : 1.0);
            }
          }

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), mat);
    this.mesh.userData.noOutline = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  update(camera, time) {
    this.mesh.position.copy(camera.position);
    this.uniforms.uTime.value = time;
  }
}
