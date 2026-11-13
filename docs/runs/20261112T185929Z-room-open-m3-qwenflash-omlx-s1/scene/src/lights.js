// The light rig: one warm pool from the pendant (the only shadow caster the
// eye really reads), moonlight through the window, and the fire.

import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { L } from './layout.js';

export function buildLights(scene) {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  group.name = 'lights';

  // general warm bounce: the room is full of stuff that holds heat
  const hemi = new THREE.HemisphereLight(0x7f89ad, 0x3a2412, 0.9);
  group.add(hemi);

  const amb = new THREE.AmbientLight(0xffd9ae, 0.2);
  group.add(amb);

  // pendant: the main light of the room
  const spot = new THREE.SpotLight(0xffc388, 22, 8.5, 1.05, 0.9, 2);
  spot.position.set(L.pendant.x, L.pendant.y - 0.08, L.pendant.z);
  spot.target.position.set(L.pendant.x - 0.1, 0, L.pendant.z + 0.1);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.4;
  spot.shadow.camera.far = 8;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.022;
  spot.shadow.radius = 3;
  group.add(spot, spot.target);

  // a bare upward bounce so the ceiling is not dead black
  const upLight = new THREE.PointLight(0xffca8f, 1.6, 4.2, 2);
  upLight.position.set(L.pendant.x, L.pendant.y + 0.12, L.pendant.z);
  group.add(upLight);

  // picture light over the mantel: a thin warm wash down the chimney breast,
  // standing far enough forward that it is not buried in the brickwork
  const art = new THREE.SpotLight(0xffc98f, 3.2, 2.8, 0.6, 0.95, 2);
  art.position.set(L.fire.breastX - 0.3, L.fire.mantelY + 0.97, 0);
  art.target.position.set(L.fire.breastX + 0.04, L.fire.mantelY + 0.35, 0);
  group.add(art, art.target);

  // moonlight through the window: cool, low, casts the mullion shadow
  const moon = new THREE.DirectionalLight(0x9fc2f2, 0.9);
  moon.position.set(-2.4, 5.2, -8);
  moon.target.position.set(1.2, 0.35, 0.8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const sc = moon.shadow.camera;
  sc.left = -5.2;
  sc.right = 5.2;
  sc.top = 4.4;
  sc.bottom = -4.4;
  sc.near = 1;
  sc.far = 22;
  moon.shadow.bias = -0.0007;
  moon.shadow.normalBias = 0.03;
  moon.shadow.radius = 4;
  group.add(moon, moon.target);

  // soft cool wash from the sky through the glass
  const sky = new THREE.RectAreaLight(0xa8c6f0, 1.4, L.window.x1 - L.window.x0, L.window.head - L.window.sill);
  sky.position.set(0, (L.window.sill + L.window.head) / 2, L.north + 0.06);
  sky.lookAt(0.4, 0.55, 1.4);
  group.add(sky);

  // warm bounce off the books, low and wide, and one off the hearth stone
  const bounce = new THREE.PointLight(0xffb173, 0.5, 5.0, 2);
  bounce.position.set(-1.9, 0.5, 0.55);
  group.add(bounce);
  const hearthBounce = new THREE.PointLight(0xff9a52, 3.0, 5.0, 2);
  hearthBounce.position.set(2.55, 0.75, 0);
  group.add(hearthBounce);

  // flat light only used by the plan view so the layout reads clearly
  const topFill = new THREE.DirectionalLight(0xfff3e2, 2.4);
  topFill.position.set(0.4, 10, 0.3);
  topFill.target.position.set(0, 0, 0);
  topFill.visible = false;
  const topAmb = new THREE.AmbientLight(0xffeedb, 1.15);
  topAmb.visible = false;
  group.add(topFill, topFill.target, topAmb);

  const base = {
    hemi: hemi.intensity,
    amb: amb.intensity,
    spot: spot.intensity,
    upLight: upLight.intensity,
    art: art.intensity,
    moon: moon.intensity,
    sky: sky.intensity,
    bounce: bounce.intensity,
    hearthBounce: hearthBounce.intensity,
  };

  // The plan view is a drawing, not a mood: everything is lit evenly from
  // straight above so no corner reads as black.
  function setTopView(on) {
    topFill.visible = on;
    topAmb.visible = on;
    hemi.intensity = on ? 1.5 : base.hemi;
    amb.intensity = on ? 0.9 : base.amb;
    spot.intensity = on ? 0 : base.spot;
    upLight.intensity = on ? 0 : base.upLight;
    art.intensity = on ? 0 : base.art;
    moon.intensity = on ? 0 : base.moon;
    sky.intensity = on ? 0 : base.sky;
    bounce.intensity = on ? 0 : base.bounce;
    hearthBounce.intensity = on ? 0 : base.hearthBounce;
  }

  return { group, spot, moon, hemi, amb, setTopView };
}
