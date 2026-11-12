// Seeded pseudo-random number generator (mulberry32).
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
  const f = mulberry32(seed);
  return {
    next: f,
    range: (a, b) => a + (b - a) * f(),
    int: (a, b) => Math.floor(a + (b - a + 1) * f()),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    sign: () => (f() < 0.5 ? -1 : 1),
  };
}
