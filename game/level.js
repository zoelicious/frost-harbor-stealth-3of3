/* FROST HARBOR — level data: frozen dock, Night 1 of 3. World is 960x720. */
'use strict';

const FH_LEVEL = {
  width: 960,
  height: 720,
  nightLength: 360, // 6:00 countdown to dawn
  playerStart: { x: 80, y: 620 },

  // The ship waits top-right; the gangway is the exit.
  ship: { x: 768, y: 0, w: 192, h: 150 },
  gangway: { x: 692, y: 96, w: 84, h: 84 },

  // Crates to load: pick up (walk over) then carry to the gangway.
  crates: [
    { id: 0, x: 180, y: 500 },
    { id: 1, x: 480, y: 296 },
    { id: 2, x: 828, y: 520 },
  ],

  // Containers and stacked pallets: solid cover, block sight lines.
  obstacles: [
    { x: 150, y: 120, w: 140, h: 50, kind: 'container', tint: '#274b6d' },
    { x: 380, y: 80,  w: 160, h: 50, kind: 'container', tint: '#2c4a63' },
    { x: 560, y: 220, w: 50,  h: 140, kind: 'container', tint: '#274b6d' },
    { x: 120, y: 320, w: 50,  h: 140, kind: 'container', tint: '#2c4a63' },
    { x: 300, y: 420, w: 160, h: 50, kind: 'container', tint: '#274b6d' },
    { x: 620, y: 380, w: 140, h: 50, kind: 'container', tint: '#2c4a63' },
    { x: 824, y: 220, w: 60,  h: 120, kind: 'container', tint: '#274b6d' },
    { x: 430, y: 560, w: 120, h: 44, kind: 'pallet', tint: '#3a2f22' },
    { x: 60,  y: 60,  w: 60,  h: 44, kind: 'pallet', tint: '#3a2f22' },
  ],

  // Grey fog banks: half-cover, slower movement inside.
  fog: [
    { x: 240, y: 180, w: 150, h: 110 },
    { x: 600, y: 480, w: 170, h: 120 },
    { x: 56,  y: 430, w: 120, h: 96 },
  ],

  // Rotating searchlights: fixed sweep cycles. angle in radians.
  // beamRange is huge; standing in a beam is seen from afar.
  searchlights: [
    {
      id: 'SL-1', x: 300, y: 60, range: 430, halfAngle: 0.24,
      center: 1.40, amplitude: 0.88, period: 9, phase: 0,
    },
    {
      id: 'SL-2', x: 700, y: 648, range: 430, halfAngle: 0.24,
      center: 4.36, amplitude: 0.79, period: 11, phase: 1.8,
    },
  ],

  // Named guards with patrol loops.
  guards: [
    {
      name: 'Harbor Master Falk', short: 'FALK', speed: 62,
      waypoints: [
        { x: 200, y: 150 }, { x: 500, y: 150 },
        { x: 500, y: 420 }, { x: 200, y: 420 },
      ],
    },
    {
      name: 'Guard Rook', short: 'ROOK', speed: 56,
      waypoints: [
        { x: 350, y: 250 }, { x: 650, y: 250 },
        { x: 650, y: 330 }, { x: 350, y: 330 },
      ],
    },
    {
      name: 'Guard Pell', short: 'PELL', speed: 58,
      waypoints: [
        { x: 600, y: 200 }, { x: 760, y: 200 },
        { x: 760, y: 380 }, { x: 600, y: 380 },
      ],
    },
  ],
};

/* Decorative ice details, fixed so every render is stable. */
const FH_DECOR = [];
(function seedDecor() {
  let s = 1234567;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 90; i++) {
    FH_DECOR.push({
      x: 20 + rnd() * 920, y: 20 + rnd() * 680,
      r: 1 + rnd() * 2.4, a: 0.05 + rnd() * 0.12,
    });
  }
  for (let i = 0; i < 14; i++) {
    FH_DECOR.push({
      crack: true, x: 40 + rnd() * 880, y: 40 + rnd() * 640,
      len: 20 + rnd() * 46, ang: rnd() * Math.PI, a: 0.10 + rnd() * 0.10,
    });
  }
})();
