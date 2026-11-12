---
id: eiffel-spec
title: Eiffel Tower (spec)
category: landscape
variant: spec
subject: eiffel
modes: day,dusk,night     # judged render: one screenshot per mode
mode_param: tod           # ...loaded as index.html?tod=<mode>
version: 1
---
# Cel-shaded Eiffel Tower

Build a three.js scene of the Eiffel Tower in a bright, cel-shaded cartoon-adventure style, with real shadow mapping and a Day/Dusk/Night toggle. All logic lives in `index.html`.

## The cel-shading pipeline: implement exactly this

The look comes from three lookup stages. Do NOT fake it with `step()` functions or base color × scalar; use real 1D lookup textures.

1. **Per-vertex lighting** (vertex shader):
   ```glsl
   vec3 n = normalize( mat3( modelMatrix ) * normal );   // world space
   vDiffuse = dot( n, uLightDir );                       // one directional light, no ambient
   ```
2. **Toon band LUT** (fragment): one shared 256×1 RGBA `DataTexture`, `NearestFilter` for min and mag, holding **four hard plateaus** with values `[0.125, 0.375, 0.625, 0.875]` (the centers of the four palette texels). Band boundaries on `t = clamp(vDiffuse * 0.5 + 0.5, 0, 1)`:
   - `t < 0.5` → shadow plateau, `t < 0.625` → mid, `t < 0.85` → upper, else lit
   - (on diffuse `d = 2t − 1`: `d < 0`, `0 ≤ d < 0.25`, `0.25 ≤ d < 0.7`, `d ≥ 0.7`)
   - Sample: `float band = texture2D( uBands, vec2( t, 0.5 ) ).r;`
3. **Palette LUT**: a 4×1 RGBA `DataTexture`, `NearestFilter`, one **per material**, entries `[shadow, mid, upper, lit]`. `vec3 col = texture2D( uPalette, vec2( band, 0.5 ) ).rgb;` gives each surface its own colors instead of a scalar multiply. The time-of-day toggle re-tints the scene by swapping these textures (see below).

Fog: include the fog chunks (`fog_pars_vertex`, `fog_vertex`, `fog_pars_fragment`, `fog_fragment`), merge `THREE.UniformsLib.fog` into the uniforms, set `fog: true` on the material, and keep `fogColor`/`fogNear`/`fogFar` in sync with `scene.fog` (copy at init and on every time-of-day switch).

## Shadow mapping for a custom ShaderMaterial (the part that will bite you)

three.js wires shadow uniforms into a `ShaderMaterial` only when `material.lights === true`, and that wiring expects **all** light uniforms to be present. For every toon material and the outline material:

- `new THREE.ShaderMaterial({ lights: true, fog: true, uniforms: THREE.UniformsUtils.merge([ THREE.UniformsLib.lights, THREE.UniformsLib.fog, { ...your own } ]) })`
- **Vertex shader** includes, in this order: `common`, `packing`, `fog_pars_vertex`, `shadowmap_pars_vertex`, then `begin_vertex`, `beginnormal_vertex`, `defaultnormal_vertex`, `worldpos_vertex`, `shadowmap_vertex`, then your own position math, then `fog_vertex`.
- **Fragment shader** includes: `common`, `packing`, `fog_pars_fragment`, `shadowmap_pars_fragment`, then your own code, then `fog_fragment`.
- Guard the sampling with `#ifdef USE_SHADOWMAP` and `#if NUM_DIR_LIGHT_SHADOWS > 0`; the renderer sets both when a shadow-casting light exists. In this three.js version `getShadow()` takes a shadow-intensity argument:
  ```glsl
  DirectionalLightShadow dl = directionalLightShadows[ 0 ];
  float shadow = getShadow( directionalShadowMap[ 0 ], dl.shadowMapSize, dl.shadowIntensity,
                            dl.shadowBias, dl.shadowRadius, vDirectionalShadowCoord[ 0 ] );
  ```
  Shader chunk details change between three.js releases; read the chunks in `vendor/three/build/three.module.js` when something does not compile.
- Apply the shadow as a **color multiplier AFTER the palette lookup**. Do NOT fold it into the diffuse before the LUT; that darkens the negative-diffuse side and breaks the bands:
  ```glsl
  float shadowAmount = ( 1.0 - smoothstep( 0.4, 0.6, shadow ) ) * uReceiveShadow;
  float shadowFactor = mix( 1.0, uShadowStrength, shadowAmount );
  gl_FragColor = vec4( col * shadowFactor, 1.0 );
  ```
  `uReceiveShadow` = 0 for clouds (opt out), 1 for everything else. `uShadowStrength` is per time of day.

Light setup: `renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;` One `DirectionalLight` (sun/moon) with `castShadow = true`, `shadow.mapSize.set(2048, 2048)`, ortho shadow camera `left/right/top/bottom = ±280`, `near = 1`, `far = 1500`, `bias = -0.0004`, `normalBias = 0.6`, `radius = 3`. Position the light at `sunDir * 600 + (0, 100, 0)`; its `target` is a scene object at `(0, 100, 0)`. After moving either, call `target.updateMatrixWorld()`.

Mesh flags: real meshes `castShadow = true, receiveShadow = true`; inverted-hull meshes receive only (`castShadow = false`); cloud puffs cast/receive `false`. Ground and plaza receive.

## Outlines (inverted hull, constant screen width)

One shared `ShaderMaterial` with `side: THREE.BackSide` (also `lights: true` and the same shadow chunks, so outlines darken in shadow). The vertex shader expands along the view-space normal by a constant pixel width:
```glsl
vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
float worldW = uPx * 2.0 * -mvPosition.z * tan( uFov * 0.5 ) / uViewportH;
mvPosition.xyz += normalize( normalMatrix * normal ) * worldW;
gl_Position = projectionMatrix * mvPosition;
```
with `uPx = 1.0`, `uFov = THREE.MathUtils.degToRad(camera.fov)`, `uViewportH = window.innerHeight` (update on resize). Fragment: flat `uColor` × shadowFactor. For every real mesh, add `new THREE.Mesh(mesh.geometry, outlineMat)` as a child (shared geometry, no extra allocation).

## Scene contents

- **Tower** (real dimensions, meters). Profile via power-curve interpolation `halfWidth(y)` between anchors `(y, halfWidth)`: `(0, 62.45)`, `(57.63, 35.35)`, `(115.73, 20.48)`, `(276.13, 9.33)`, `(300, 2.0)`; per-segment powers `[1.7, 1.4, 1.15, 1.2]`.
  - **Four curved corner legs**: sample the profile at 32 steps per leg (corners at `±w, ±w`), connect consecutive points with tapered, open-ended 8-radial cylinders (radius `max(0.5, w*0.08)`, taper 1.12→0.98).
  - **Lattice**, per section `(y0, y1, levels)`: `(0, 57.63, 6)`, `(57.63, 115.73, 5)`, `(115.73, 276.13, 8)`, `(276.13, 300, 3)`. For each level × 4 faces: two X diagonals + one top horizontal, 6-radial cylinders, radius `max(0.3, midHalfWidth*0.028)` (horizontals ×1.5).
  - **Three platforms** as boxes at `y = 57.63 / 115.73 / 276.13`: half-width = local halfWidth + overhang `(1.5 / 1.5 / 1.2)`, thickness `6 / 5 / 4`, dark-iron material.
  - **Antenna**: tapered 6-radial cylinder from 300→330 (r 1.1→0.35) + small sphere (r 1.1) at 330.
- **Ground**: `CircleGeometry(1600, 48)` rotated flat. **Plaza**: `CircleGeometry(100, 48)` at `y = 0.15`.
- **14 trees** in a ring, radius 118–173 (evenly spaced angle + jitter): 6-radial cylinder trunk (h ≈ 7s) + two stacked 7-radial cones (r 6s/4.6s, h 10s/8s) at y 11s/16s; random scale s 0.8–1.5, random Y rotation.
- **8 puffy clouds**: 5 overlapping spheres per cloud, offsets `[0,0,0,1.0] [9,−1,2,0.75] [−9,−1.5,−1,0.7] [4,3,−2,0.6] [−4,2.5,1,0.55]` × base r 7; group scale `(1.6, 0.7, 1)`; placed at radius 420–920, y 190–330; drift +x at 5–11 m/s, wrap at ±1200.
- **Camera/controls**: `PerspectiveCamera(50, aspect, 1, 4000)` at `(330, 165, 430)`; OrbitControls target `(0, 115, 0)`, damping 0.08, autoRotate speed 0.5, minDistance 80, maxDistance 1400, `maxPolarAngle = Math.PI * 0.495`.
- **Sky**: `scene.background` = flat color; `scene.fog = new THREE.Fog(sameColor, 600, 1700)`.
- Small label bottom-left: "Cel-shaded Eiffel Tower: vertex light → band LUT → palette LUT · drag to orbit, scroll to zoom".

## Materials (tuned palettes; entries are [shadow, mid, upper, lit])

| material | day | dusk | night |
|---|---|---|---|
| iron (legs/lattice) | `0x7d4f2c 0xa56a38 0xc8864a 0xe8a45e` | `0x6a3a1e 0x9c5828 0xc87838 0xf09848` | `0x26364e 0x384a66 0x4a5c7a 0x68789a` |
| ironDark (platforms/antenna) | `0x6d4426 0x946034 0xb87a42 0xd89450` | `0x5a3016 0x8a4c24 0xb86834 0xd88840` | `0x1e2c42 0x2e3e58 0x3e4e68 0x586880` |
| ground (grass) | `0x3f8a35 0x5cb04a 0x6fc258 0x82d468` | `0x4a6a28 0x6a8838 0x88a848 0xa8c058` | `0x16301f 0x24462e 0x345c3e 0x4a7852` |
| plaza (sand) | `0xb09058 0xd0b078 0xe0c088 0xf0d098` | `0xa88850 0xc8a868 0xe0c080 0xf8d898` | `0x3a3e52 0x4c5066 0x5e6278 0x787c92` |
| leaf (cones) | `0x3a7a34 0x4f9c44 0x60b452 0x74cc62` | `0x3a6a28 0x558838 0x70a848 0x90c058` | `0x16382a 0x245038 0x346848 0x4a8858` |
| trunk | `0x5a3e26 0x7a5230 0x8f6238 0xa47440` | `0x5a3820 0x7a5230 0x986838 0xb88048` | `0x222838 0x323848 0x424858 0x585e70` |
| cloud | `0xc8d8e8 0xe8f0f8 0xf4f8fc 0xffffff` | `0xd89878 0xf0b890 0xf8d0b0 0xffe8d0` | `0x303c54 0x404c66 0x505c78 0x687490` |

## Day / Dusk / Night toggle

A `TIMES` object, one entry per mode with: `sky`/`fog` hex (day `0x56bce8` · dusk `0xef9a58` · night `0x16263e`), `sunDir` (day `(300, 420, 180)` · dusk `(1.0, 0.16, 0.28)` · night `(0.5, 0.72, 0.45)`, each normalized; night is a moon on the camera side so the tower's front is lit, not a silhouette), `shadowStrength` (0.5 / 0.42 / 0.55), outline ink `uColor` (`0x2b1a10` / `0x2a1608` / `0x0a0e18`), and the palette set above.

`applyTimeOfDay(name)`: set `scene.background` and fog color; move the light to `sunDir * 600 + (0, 100, 0)` (target `(0, 100, 0)`, then `updateMatrixWorld()`); swap each material's `uPalette` to its pre-built texture for that mode; set `uLightDir` and `uShadowStrength`; set outline `uColor` and `uShadowStrength`; sync fog uniforms; toggle the active button class. **Pre-build all palette DataTextures at startup** (7 materials × 3 modes) so switching is a uniform swap, not a rebuild.

UI: three pill buttons (Day / Dusk / Night) top-right; active = yellow fill. Deep-linkable: read `?tod=` from `location.search` at load (validate against `TIMES`, fall back to `day`). Call `applyTimeOfDay` once at init, before the first frame.

## Acceptance

`preview` loads the page without a query string, so it shows Day. To check Dusk and Night, temporarily change the fallback mode, preview, then restore `day`. Deliver with the 2048 shadow map even if software rendering is slow.

- Day: bright warm tower, with the tower and trees casting shadows on the ground.
- Dusk: orange sky, long low-sun shadows.
- Night: dark blue moonlit scene, the tower's front clearly lit (not a silhouette).
- No shader compile errors or console errors in any mode.
