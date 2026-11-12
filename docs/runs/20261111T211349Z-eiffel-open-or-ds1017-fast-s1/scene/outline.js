import * as THREE from 'three';

/**
 * Ink-outline post pass.
 *
 * The scene is first rendered normally (antialiased) to the canvas. Then the
 * visible geometry is rendered into a small offscreen target as view-space
 * normals + depth. A fullscreen pass detects depth / crease discontinuities and
 * composites dark ink lines on top of the already-rendered frame. This keeps the
 * main render multisampled while giving consistent outlines on every object,
 * including the thin lattice of the tower.
 */
export class InkOutline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.excluded = [];
    this.pixelRatio = 1;

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
    });
    this.target.texture.generateMipmaps = false;
    this.target.texture.colorSpace = THREE.NoColorSpace;
    this.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.depthTexture.format = THREE.DepthFormat;
    this.depthTexture.minFilter = THREE.NearestFilter;
    this.depthTexture.magFilter = THREE.NearestFilter;
    this.target.depthTexture = this.depthTexture;

    this.normalMaterial = new THREE.MeshNormalMaterial();

    this.uniforms = {
      tNormal: { value: this.target.texture },
      tDepth: { value: this.depthTexture },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uPixel: { value: 1 },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uColor: { value: new THREE.Color(0x2b2030) },
      uOpacity: { value: 0.9 },
      uFadeNear: { value: 260 },
      uFadeFar: { value: 540 },
    };

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D tNormal;
          uniform sampler2D tDepth;
          uniform vec2 uTexel;
          uniform float uPixel;
          uniform float uNear;
          uniform float uFar;
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uFadeNear;
          uniform float uFadeFar;
          varying vec2 vUv;

          float viewDistance(vec2 uv) {
            float d = texture2D(tDepth, uv).x;
            if (d >= 0.99999) return -1.0;
            return (uNear * uFar) / ((uFar - uNear) * d - uFar) * -1.0;
          }

          void main() {
            float d0 = viewDistance(vUv);
            if (d0 < 0.0) {
              gl_FragColor = vec4(0.0);
              return;
            }
            vec3 n0 = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;

            float edge = 0.0;
            vec2 base = uTexel * uPixel * 1.0;

            for (int i = 0; i < 8; i++) {
              float ang = float(i) * 0.7853981634;
              vec2 off = vec2(cos(ang), sin(ang)) * base;
              vec2 uv1 = vUv + off;

              float d1 = viewDistance(uv1);
              if (d1 < 0.0) {
                // silhouette against the sky / background
                edge = max(edge, 1.0);
                continue;
              }
              vec3 n1 = texture2D(tNormal, uv1).rgb * 2.0 - 1.0;

              float diff = abs(d0 - d1);
              float depthEdge = smoothstep(0.010 * d0 + 0.035, 0.045 * d0 + 0.16, diff);

              float nd = dot(n0, n1);
              float normalEdge = 1.0 - smoothstep(0.58, 0.92, nd);

              edge = max(edge, max(depthEdge * 0.95, normalEdge));
            }

            float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, d0);
            edge *= fade;

            gl_FragColor = vec4(uColor, edge * uOpacity);
            #include <colorspace_fragment>
          }
        `,
      })
    );
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this._hidden = [];
  }

  setSize(width, height, pixelRatio) {
    this.pixelRatio = Math.min(pixelRatio, 2);
    const w = Math.max(1, Math.floor(width * this.pixelRatio));
    const h = Math.max(1, Math.floor(height * this.pixelRatio));
    this.target.setSize(w, h);
    this.depthTexture.image.width = w;
    this.depthTexture.image.height = h;
    this.depthTexture.needsUpdate = true;
    this.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.uniforms.uPixel.value = this.pixelRatio;
    this.uniforms.uNear.value = this.camera.near;
    this.uniforms.uFar.value = this.camera.far;
  }

  collectExcluded(root) {
    this.excluded.length = 0;
    root.traverse((o) => {
      if (o.userData && o.userData.noOutline) this.excluded.push(o);
    });
  }

  render() {
    if (!this.enabled) return;
    const r = this.renderer;

    this._hidden.length = 0;
    for (const o of this.excluded) {
      if (o.visible) {
        this._hidden.push(o);
        o.visible = false;
      }
    }

    const oldClear = r.autoClear;
    const oldAlpha = r.getClearAlpha();
    const oldColor = r.getClearColor(new THREE.Color());

    r.setRenderTarget(this.target);
    r.autoClear = true;
    r.setClearColor(0x000000, 0);
    this.scene.overrideMaterial = this.normalMaterial;
    r.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    r.setRenderTarget(null);
    r.setClearColor(oldColor, oldAlpha);

    for (const o of this._hidden) o.visible = true;

    // composite lines on top of the finished frame
    r.autoClear = false;
    r.render(this.quadScene, this.quadCamera);
    r.autoClear = oldClear;
  }
}
