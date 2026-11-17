import * as THREE from 'three';
import * as T from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);

export const M = {
  floor: std({ map: T.woodFloorTexture(), roughness: 0.82 }),
  wall: std({ map: T.plasterTexture('#75806a'), roughness: 0.95 }),
  ceiling: std({ color: '#e9e1cd', roughness: 1 }),
  trim: std({ color: '#e0d5bc', roughness: 0.88 }),
  beam: std({ map: T.woodFineTexture(), color: '#4a3223', roughness: 0.85 }),
  woodDark: std({ map: T.woodFineTexture(), color: '#54381f', roughness: 0.72 }),
  woodMid: std({ map: T.woodFineTexture(), color: '#7a5638', roughness: 0.7 }),
  door: std({ color: '#d7cdb4', roughness: 0.75 }),
  brick: std({ map: T.brickTexture(), roughness: 1 }),
  stone: std({ color: '#8f887c', roughness: 1 }),
  charred: std({ color: '#171310', roughness: 1 }),
  iron: std({ color: '#24211e', roughness: 0.55, metalness: 0.65 }),
  brass: std({ color: '#b08d57', roughness: 0.35, metalness: 0.85 }),
  sofa: std({ color: '#96503c', roughness: 1 }),
  sofaLight: std({ color: '#ab624a', roughness: 1 }),
  chair: std({ color: '#a8823f', roughness: 1 }),
  chairShell: std({ color: '#a8823f', roughness: 1, side: THREE.DoubleSide }),
  chairLight: std({ color: '#c29a58', roughness: 1 }),
  cushionCream: std({ color: '#d9c9a8', roughness: 1 }),
  cushionNavy: std({ color: '#4a5570', roughness: 1 }),
  blanket: std({ map: T.plaidTexture(), roughness: 1 }),
  curtain: std({ color: '#cbb894', roughness: 1, side: THREE.DoubleSide }),
  shade: std({ color: '#f3e7c8', emissive: '#ff9c4a', emissiveIntensity: 0.38, side: THREE.DoubleSide, roughness: 1 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#9fb8cc', transparent: true, opacity: 0.16, roughness: 0.08, metalness: 0, side: THREE.DoubleSide }),
  basket: std({ color: '#7d5c3a', roughness: 1, side: THREE.DoubleSide }),
  log: std({ color: '#5f452e', roughness: 1 }),
  pot: std({ color: '#96543f', roughness: 1 }),
  leafA: std({ color: '#41603a', roughness: 1 }),
  leafB: std({ color: '#567648', roughness: 1 }),
  ceramic: std({ color: '#c9b8a4', roughness: 0.4 }),
  mug: std({ color: '#9c5a45', roughness: 0.5 }),
  rugSide: std({ color: '#6b342b', roughness: 1 }),
};