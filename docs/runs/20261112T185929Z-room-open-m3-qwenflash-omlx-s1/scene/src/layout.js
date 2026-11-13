// ---------------------------------------------------------------------------
// The plan, as numbers.  North is -z, east is +x, y is up, metres, origin =
// centre of the floor.  Every piece of geometry reads its dimensions from here
// so the whole scene is one editable spec.
//
//   x: -3 (west wall) ..................... +3 (east wall)      6.0 m
//   z: -2.25 (north wall) ................. +2.25 (south wall)  4.5 m
//   y: 0 (floor) ...................... 2.7 (ceiling)
// ---------------------------------------------------------------------------

export const L = {
  // ---- shell ------------------------------------------------------------
  west: -3,
  east: 3,
  north: -2.25,
  south: 2.25,
  height: 2.7,
  wallT: 0.12, // walls sit outside the interior faces

  // ---- openings ---------------------------------------------------------
  // Door: south wall, 0.9 m wide, centre 1.2 m from the west wall.
  // Hinged on its west side and it opens into the room.
  door: {
    wall: 'south',
    x0: -2.25,
    x1: -1.35,
    height: 2.05,
    hingeX: -2.25,
    leafT: 0.045,
    openDeg: 100, // resting open, held by a floor stop
    // clear swing = quarter disc, centre (hingeX, south), radius 0.9
  },

  // Window: north wall, 1.6 m wide, centred, sill 0.9 m up.
  window: {
    x0: -0.8,
    x1: 0.8,
    sill: 0.9,
    head: 2.25,
  },

  // Fireplace: centred on the east wall, 1 m wide firebox opening.
  fire: {
    opening: { z0: -0.5, z1: 0.5, y0: 0.15, y1: 1.15 },
    faceX: 2.9, // stone surround projects 0.10 m off the wall
    halfWidth: 1.15, // width of the masonry band around the opening
    mantelY: 1.35,
    mantelProjX: 2.72,
    mantelHalfZ: 1.3,
    breastX: 2.78, // plaster chimney breast above the mantel
    breastHalfZ: 0.9,
    cavityBackX: 3.42, // firebox cut back into the wall
  },

  // ---- seating group ----------------------------------------------------
  // Sofa faces the fireplace: back face 2.5 m from the east wall => x = 0.5.
  sofa: {
    backX: 0.5, // 3.0 - 2.5
    depth: 0.85,
    frontX: 1.35, // backX + depth
    halfZ: 1.1, // 2.2 m long, three seats
    seatY: 0.45,
    backTopY: 0.93,
    armTopY: 0.63,
    legFrontX: 1.3,
    legBackX: 0.62,
  },

  // Coffee table between sofa and fireplace: 0.455 m to the sofa, 0.545 m to
  // the hearth, 0.55 m to the armchair and 1.73 m to the south wall, so every
  // side keeps a >= 0.45 m walkway.
  table: {
    x0: 1.805,
    x1: 2.355,
    cx: 2.08,
    halfZ: 0.52,
    topY: 0.4,
  },

  // Rug centred on the coffee table, reaching under the sofa's front legs and
  // stopping just short of the stone surround.
  rug: {
    cx: 2.08,
    x0: 1.27,
    x1: 2.89,
    halfZ: 1.25,
    y: 0.016,
  },

  // Armchair in the north-east corner, turned 45 deg to face the fire.
  // Its footprint stays east of the window (|x| <= 0.8) and inside the walls.
  chair: {
    cx: 2.34,
    cz: -1.63,
    halfW: 0.39,
    halfD: 0.4,
    deg: 45,
    seatY: 0.44,
    backTopY: 0.95,
  },

  // Floor lamp beside the armchair, on its west side (away from the fire).
  lamp: {
    x: 1.33,
    z: -2.0,
    baseR: 0.15,
    shadeY: 1.42,
  },

  // ---- west wall --------------------------------------------------------
  // Floor-to-ceiling bookshelf, covering the west wall except the door swing
  // (which occupies z >= 1.35 at that depth; the case stops at 1.28).
  shelf: {
    x0: -3,
    x1: -2.62, // 380 mm deep
    z0: -2.25,
    z1: 1.28,
    bays: [-2.25, -1.4, -0.5, 0.4, 1.28],
    levels: [0.06, 0.42, 0.8, 1.17, 1.54, 1.91, 2.28],
  },

  // ---- odds and ends ----------------------------------------------------
  ladder: { z: -0.75, topY: 2.25, footX: -2.24, railGap: 0.42 },
  sideTable: { cx: 1.05, cz: -1.55, half: 0.22, topY: 0.55 },
  plant: { x: -1.3, z: -1.85, potR: 0.22 },
  logBasket: { x: 2.6, z: 0.95, r: 0.22 },
  floorBooks: { x: 1.05, z: 1.55 },
  pendant: { x: 0.35, z: 0, y: 2.12, r: 0.22 },
  beamZ: [-1.35, 1.35],
};

export const ROOM_MINS = [L.west, 0, L.north];
export const ROOM_MAXS = [L.east, L.height, L.south];

/** Degrees to radians; geometry is specified in degrees for readability. */
export const D = (deg) => (deg * Math.PI) / 180;

// Footprints used by the sanity check (?debug=1).  h = clear height, rug/flat
// things are marked so they can sit under furniture.
export const FOOTPRINTS = [
  { name: 'sofa', x0: L.sofa.backX, x1: L.sofa.frontX, z0: -L.sofa.halfZ, z1: L.sofa.halfZ, h: L.sofa.backTopY },
  { name: 'table', x0: L.table.x0, x1: L.table.x1, z0: -L.table.halfZ, z1: L.table.halfZ, h: L.table.topY + 0.05 },
  { name: 'armchair', x0: 1.78, x1: 2.9, z0: -2.19, z1: -1.02, h: L.chair.backTopY },
  { name: 'lamp', x0: L.lamp.x - 0.15, x1: L.lamp.x + 0.15, z0: L.lamp.z - 0.15, z1: L.lamp.z + 0.15, h: 1.6 },
  { name: 'shelf', x0: L.shelf.x0, x1: L.shelf.x1, z0: L.shelf.z0, z1: L.shelf.z1, h: L.height },
  { name: 'ladder', x0: -2.62, x1: -2.2, z0: -1.0, z1: -0.5, h: 2.3 },
  { name: 'sideTable', x0: 0.83, x1: 1.27, z0: -1.77, z1: -1.33, h: 0.95 },
  { name: 'plant', x0: -1.66, x1: -0.94, z0: -2.21, z1: -1.49, h: 1.35 },
  { name: 'logBasket', x0: 2.38, x1: 2.82, z0: 0.73, z1: 1.17, h: 0.42 },
  { name: 'floorBooks', x0: 0.9, x1: 1.2, z0: 1.4, z1: 1.7, h: 0.14 },
  { name: 'fireplace', x0: L.fire.faceX, x1: L.east, z0: -L.fire.halfWidth, z1: L.fire.halfWidth, h: L.height },
];

// Pairs that are allowed to touch or overlap on purpose (the rug and the things
// standing on it, a lantern sitting on a table, ...).
export const TOUCH_OK = [
  ['rug:*'],
];

export function withinRoom(r, eps = 0.002) {
  return (
    r.x0 >= L.west - eps &&
    r.x1 <= L.east + eps &&
    r.z0 >= L.north - eps &&
    r.z1 <= L.south + eps &&
    r.h <= L.height + eps
  );
}

export function overlaps(a, b, eps = 0.004) {
  return a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.z0 < b.z1 - eps && a.z1 > b.z0 + eps;
}

// Door swing: quarter disc of radius 0.9 centred on the hinge, swept into the
// room from the south wall to the line x = hingeX.
export function inDoorSwing(r, pad = 0) {
  const cx = L.door.hingeX;
  const cz = L.south;
  const rad = L.door.x1 - L.door.x0 + pad;
  if (r.x1 < cx || r.z1 < cz) return false;
  let best = Infinity;
  for (const x of [r.x0, r.x1]) {
    for (const z of [r.z0, r.z1]) {
      if (x >= cx && z <= cz) best = Math.min(best, Math.hypot(x - cx, z - cz));
    }
  }
  return best <= rad;
}

// Prints a little table of clearances; only used with ?debug=1.
export function validate() {
  const problems = [];
  for (const f of FOOTPRINTS) {
    if (!withinRoom(f)) problems.push(`${f.name}: outside the room`);
    if (inDoorSwing(f)) problems.push(`${f.name}: inside the door swing`);
  }
  for (let i = 0; i < FOOTPRINTS.length; i++) {
    for (let j = i + 1; j < FOOTPRINTS.length; j++) {
      const a = FOOTPRINTS[i];
      const b = FOOTPRINTS[j];
      if (overlaps(a, b)) {
        const gap = Math.max(a.z0 - b.z1, b.z0 - a.z1, a.x0 - b.x1, b.x0 - a.x1);
        problems.push(`${a.name} overlaps ${b.name} (${gap.toFixed(2)} m)`);
      }
    }
  }
  const chairNearestZ = -1.072; // the armchair's front-left corner, from layout.js
  const clear = {
    'sofa -> table': +(L.table.x0 - L.sofa.frontX).toFixed(3),
    'table -> hearth face': +(L.fire.faceX - L.table.x1).toFixed(3),
    'table -> armchair': +(-chairNearestZ - L.table.halfZ).toFixed(3),
    'table -> south wall': +(L.south - L.table.halfZ).toFixed(3),
    'shelf corner -> hinge': +(Math.hypot(L.shelf.x1 - L.door.hingeX, L.shelf.z1 - L.south)).toFixed(3) + ' (swing r = 0.9)',
    'open leaf -> shelf end': +(1.363 - L.shelf.z1).toFixed(3),
    'armchair -> north wall': +((L.chair.cz - 0.558) - L.north).toFixed(3),
    'armchair -> east wall': +(L.east - (L.chair.cx + 0.558)).toFixed(3),
    'armchair -> window edge': +(1.78 - L.window.x1).toFixed(3),
    'rug -> hearth face': +(L.fire.faceX - L.rug.x1).toFixed(3),
  };
  return { problems, clear };
}
