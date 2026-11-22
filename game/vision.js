/* FROST HARBOR — vision: cones, line of sight, fog, searchlight beams. */
'use strict';

function fhDist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function fhAngleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function fhAngleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* Segment (x1,y1)-(x2,y2) vs rect: true when the segment crosses the rect. */
function fhSegHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  let tmin = 0, tmax = 1;
  const slabs = [
    [dx, x1 - r.x], [dx, r.x + r.w - x1],
    [dy, y1 - r.y], [dy, r.y + r.h - y1],
  ];
  // X slabs then Y slabs, standard Liang-Barsky.
  const axes = [
    { d: dx, p1: x1, lo: r.x, hi: r.x + r.w },
    { d: dy, p1: y1, lo: r.y, hi: r.y + r.h },
  ];
  for (const ax of axes) {
    if (Math.abs(ax.d) < 1e-9) {
      if (ax.p1 < ax.lo || ax.p1 > ax.hi) return false;
    } else {
      let t1 = (ax.lo - ax.p1) / ax.d;
      let t2 = (ax.hi - ax.p1) / ax.d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    }
  }
  void slabs;
  return true;
}

/* True when any obstacle blocks the sight line between two points. */
function fhLosBlocked(ax, ay, bx, by, obstacles) {
  for (const o of obstacles) {
    if (fhSegHitsRect(ax, ay, bx, by, o)) return true;
  }
  return false;
}

/* Point inside a rect (with a small margin). */
function fhInRect(x, y, r, m) {
  m = m || 0;
  return x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
}

/* Is the point inside any fog bank? */
function fhInFog(x, y, fogZones) {
  for (const f of fogZones) {
    if (fhInRect(x, y, f, 0)) return true;
  }
  return false;
}

/* Circle (player) vs rect collision resolve: push the circle out. */
function fhResolveCircleRect(px, py, r, rect) {
  const cx = Math.max(rect.x, Math.min(px, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(py, rect.y + rect.h));
  const dx = px - cx, dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x: px, y: py, hit: false };
  if (d2 < 1e-9) return { x: px, y: rect.y - r, hit: true };
  const d = Math.sqrt(d2);
  return { x: cx + (dx / d) * r, y: cy + (dy / d) * r, hit: true };
}

/* Guard cone test: range, half-angle and line of sight. Returns 0..1 strength. */
function fhConeStrength(gx, gy, facing, range, halfAngle, px, py, obstacles) {
  const d = fhDist(gx, gy, px, py);
  if (d > range) return 0;
  const ang = Math.abs(fhAngleDiff(fhAngleTo(gx, gy, px, py), facing));
  if (ang > halfAngle) return 0;
  if (fhLosBlocked(gx, gy, px, py, obstacles)) return 0;
  // Closer + more centered = stronger.
  const distF = 1 - d / range;
  const angF = 1 - ang / halfAngle;
  return Math.max(0, Math.min(1, 0.35 + 0.65 * (distF * 0.6 + angF * 0.4)));
}

/* Searchlight beam test: huge sweeping sector. Returns 0..1 strength. */
function fhBeamStrength(sl, angle, px, py) {
  const d = fhDist(sl.x, sl.y, px, py);
  if (d > sl.range) return 0;
  const ang = Math.abs(fhAngleDiff(fhAngleTo(sl.x, sl.y, px, py), angle));
  if (ang > sl.halfAngle) return 0;
  const distF = 1 - d / sl.range;
  return Math.max(0, Math.min(1, 0.45 + 0.55 * distF));
}

/* Current sweep angle of a searchlight at game time t (seconds). */
function fhBeamAngle(sl, t) {
  return sl.center + sl.amplitude * Math.sin((Math.PI * 2 * (t + sl.phase)) / sl.period);
}

/* Cycle progress 0..1 for the countdown ring. */
function fhBeamCycle(sl, t) {
  return ((t + sl.phase) % sl.period) / sl.period;
}
