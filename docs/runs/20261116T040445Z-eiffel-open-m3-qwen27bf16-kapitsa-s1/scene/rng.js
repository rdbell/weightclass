// Tiny seeded RNG (mulberry32) + convenience helpers.
// Every random placement in the scene flows through this so repeated
// loads of the page look identical.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
  };
}
