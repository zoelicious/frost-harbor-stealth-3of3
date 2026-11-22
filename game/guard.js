/* FROST HARBOR — guards: patrol, suspicion, investigate, alarm chase. */
'use strict';

const FH_GUARD_CONE_RANGE = 190;
const FH_GUARD_CONE_HALF = 0.42; // ~48 deg full cone

function fhMakeGuard(def, idx) {
  const w0 = def.waypoints[0];
  return {
    name: def.name,
    short: def.short,
    x: w0.x, y: w0.y,
    facing: 0,
    speed: def.speed,
    waypoints: def.waypoints,
    wp: 1,
    state: 'PATROLLING', // PATROLLING | SUSPICIOUS | INVESTIGATING | ALARM
    suspicion: 0,        // 0..1 personal meter
    target: null,        // {x,y} investigate point
    wait: 0,
    stuck: 0,
  };
}

/* One guard step. Returns events: { noticed: bool, lostSight: bool }. */
function fhUpdateGuard(g, dt, player, game) {
  const ev = { noticed: false, lostSight: false };
  const prevSus = g.suspicion;

  // --- sensing ---
  let strength = 0;
  if (!game.over) {
    strength = fhConeStrength(
      g.x, g.y, g.facing, FH_GUARD_CONE_RANGE, FH_GUARD_CONE_HALF,
      player.x, player.y, FH_LEVEL.obstacles
    );
    if (strength > 0 && player.inFog) strength *= 0.5;
    if (strength > 0 && player.sneaking) strength *= 0.6;
  }
  g.lastStrength = strength;

  if (strength > 0.05) {
    g.suspicion = Math.min(1, g.suspicion + dt * strength * 0.9);
    g.target = { x: player.x, y: player.y };
    if (prevSus < 0.3 && g.suspicion >= 0.3) ev.noticed = true;
  } else {
    g.suspicion = Math.max(0, g.suspicion - dt * 0.25);
    if (prevSus >= 0.3 && g.suspicion < 0.3) ev.lostSight = true;
  }

  // --- state ---
  if (g.suspicion >= 0.85) g.state = 'ALARM';
  else if (g.suspicion >= 0.3) g.state = 'SUSPICIOUS';
  else if (g.target && g.state !== 'PATROLLING' && g.state !== 'INVESTIGATING') g.state = 'INVESTIGATING';
  if (g.suspicion < 0.05 && g.state === 'SUSPICIOUS') g.state = 'INVESTIGATING';
  if (g.state === 'INVESTIGATING' && !g.target) g.state = 'PATROLLING';

  // Flare lure overrides: nearest burning flare pulls guards.
  let dest = null;
  let speed = g.speed;
  if (game.flare && game.flare.burning) {
    const fd = fhDist(g.x, g.y, game.flare.x, game.flare.y);
    if (fd < 420) {
      dest = { x: game.flare.x, y: game.flare.y };
      g.state = 'INVESTIGATING';
      speed = g.speed * 1.25;
    }
  }

  // --- movement ---
  if (g.state === 'ALARM' && strength > 0.05) {
    dest = { x: player.x, y: player.y };
    speed = g.speed * 1.9;
  } else if (!dest && (g.state === 'SUSPICIOUS' || g.state === 'INVESTIGATING') && g.target) {
    dest = g.target;
    speed = g.speed * 1.45;
  } else if (!dest && g.state === 'PATROLLING') {
    if (g.wait > 0) {
      g.wait -= dt;
    } else {
      dest = g.waypoints[g.wp];
      const d = fhDist(g.x, g.y, dest.x, dest.y);
      if (d < 8) {
        g.wp = (g.wp + 1) % g.waypoints.length;
        g.wait = 0.6;
        dest = null;
      }
    }
  }

  if (dest) {
    const d = fhDist(g.x, g.y, dest.x, dest.y);
    if (d > 4) {
      const nx = (dest.x - g.x) / d, ny = (dest.y - g.y) / d;
      g.x += nx * speed * dt;
      g.y += ny * speed * dt;
      g.facing = Math.atan2(ny, nx);
      // Arrived at investigate point: look around, then resume patrol.
      if ((g.state === 'SUSPICIOUS' || g.state === 'INVESTIGATING') && d < 14 && !game.flare) {
        g.target = null;
        g.wait = 1.2;
        g.state = 'PATROLLING';
        g.facing += 0.9;
      }
    }
  }

  // Keep guards out of containers.
  for (const o of FH_LEVEL.obstacles) {
    const r = fhResolveCircleRect(g.x, g.y, 13, o);
    g.x = r.x; g.y = r.y;
  }
  g.x = Math.max(14, Math.min(FH_LEVEL.width - 14, g.x));
  g.y = Math.max(14, Math.min(FH_LEVEL.height - 14, g.y));
  return ev;
}

/* Draw one guard: bright cone, body, name tag, ? / ! bubble. */
function fhDrawGuard(ctx, g, alarmBoost) {
  const range = FH_GUARD_CONE_RANGE * (alarmBoost ? 1.18 : 1);
  const half = FH_GUARD_CONE_HALF * (alarmBoost ? 1.25 : 1);

  // Vision cone — bright warm white-yellow over the dark floor.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.arc(g.x, g.y, range, g.facing - half, g.facing + half);
  ctx.closePath();
  const grad = ctx.createRadialGradient(g.x, g.y, 8, g.x, g.y, range);
  const hot = g.state === 'ALARM';
  grad.addColorStop(0, hot ? 'rgba(255,120,80,0.55)' : 'rgba(255,238,170,0.50)');
  grad.addColorStop(0.6, hot ? 'rgba(255,120,80,0.28)' : 'rgba(255,238,170,0.26)');
  grad.addColorStop(1, 'rgba(255,238,170,0)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = hot ? 'rgba(255,140,90,0.65)' : 'rgba(255,240,180,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Body: high-contrast red-orange coat, white helmet ring.
  ctx.save();
  ctx.beginPath();
  ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#ff5a4e';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffd9d0';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe9d6';
  ctx.fill();
  // Facing tick.
  ctx.beginPath();
  ctx.moveTo(g.x + Math.cos(g.facing) * 10, g.y + Math.sin(g.facing) * 10);
  ctx.lineTo(g.x + Math.cos(g.facing) * 20, g.y + Math.sin(g.facing) * 20);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.restore();

  // Name tag.
  ctx.save();
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  const label = g.short;
  const w = ctx.measureText(label).width + 10;
  ctx.fillStyle = 'rgba(5,10,18,0.85)';
  ctx.fillRect(g.x - w / 2, g.y - 34, w, 15);
  ctx.strokeStyle = 'rgba(255,217,160,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(g.x - w / 2, g.y - 34, w, 15);
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText(label, g.x, g.y - 23);
  ctx.restore();

  // ? / ! bubble.
  if (g.suspicion >= 0.3) {
    const mark = g.state === 'ALARM' ? '!' : '?';
    ctx.save();
    ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = g.state === 'ALARM' ? '#ff4b3e' : '#ffd75e';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(mark, g.x + 20, g.y - 22);
    ctx.fillText(mark, g.x + 20, g.y - 22);
    ctx.restore();
  }
}
