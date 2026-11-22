/* FROST HARBOR — Kess, the dockworker: move, sneak, carry, flare. */
'use strict';

function fhMakePlayer() {
  return {
    x: FH_LEVEL.playerStart.x,
    y: FH_LEVEL.playerStart.y,
    r: 12,
    facing: 0,
    speed: 175,
    moving: false,
    sneaking: false,
    inFog: false,
    carrying: false,   // carrying a crate right now
    delivered: 0,      // crates already loaded on the ship
    flares: 2,
    stepAcc: 0,
  };
}

/* Move the player from the key state; returns nothing, mutates player + game. */
function fhUpdatePlayer(p, keys, dt, game) {
  let mx = 0, my = 0;
  if (keys['arrowleft'] || keys['a']) mx -= 1;
  if (keys['arrowright'] || keys['d']) mx += 1;
  if (keys['arrowup'] || keys['w']) my -= 1;
  if (keys['arrowdown'] || keys['s']) my += 1;
  p.sneaking = !!keys['shift'];
  p.moving = mx !== 0 || my !== 0;

  let sp = p.speed;
  if (p.sneaking) sp *= 0.55;
  if (p.inFog) sp *= 0.8;
  if (p.carrying) sp *= 0.9;

  if (p.moving) {
    const len = Math.sqrt(mx * mx + my * my);
    mx /= len; my /= len;
    p.facing = Math.atan2(my, mx);
    p.x += mx * sp * dt;
    p.y += my * sp * dt;
    // Footsteps on ice.
    p.stepAcc += dt * (p.sneaking ? 2.2 : 3.4);
    if (p.stepAcc >= 1) {
      p.stepAcc = 0;
      FH_AUDIO.footstep(p.sneaking);
    }
  }

  // Collide with containers and pallets.
  for (const o of FH_LEVEL.obstacles) {
    const r = fhResolveCircleRect(p.x, p.y, p.r, o);
    p.x = r.x; p.y = r.y;
  }
  // Stay on the dock (ship deck is reached only through the gangway).
  p.x = Math.max(p.r + 2, Math.min(FH_LEVEL.width - p.r - 2, p.x));
  p.y = Math.max(p.r + 2, Math.min(FH_LEVEL.height - p.r - 2, p.y));

  p.inFog = fhInFog(p.x, p.y, FH_LEVEL.fog);

  // Pick up a crate by walking over it.
  if (!p.carrying) {
    for (const c of game.crates) {
      if (!c.taken && fhDist(p.x, p.y, c.x, c.y) < 26) {
        c.taken = true;
        p.carrying = true;
        FH_AUDIO.pickup(false);
        game.flash('CRATE PICKED UP — CARRY IT TO THE GANGWAY');
        break;
      }
    }
  }

  // Deliver at the gangway.
  if (p.carrying && fhInRect(p.x, p.y, FH_LEVEL.gangway, 6)) {
    p.carrying = false;
    p.delivered += 1;
    FH_AUDIO.pickup(true);
    if (p.delivered >= 3) {
      game.flash('ALL CRATES LOADED — BOARD THE SHIP!');
    } else {
      game.flash('CRATE LOADED ' + p.delivered + '/3 — FETCH THE NEXT ONE');
    }
  }

  // Board the ship once all crates are loaded.
  if (p.delivered >= 3 && fhInRect(p.x, p.y, FH_LEVEL.ship, 0)) {
    game.win();
  }
}

/* Throw a flare toward (tx,ty): it lands, burns, and pulls guards over. */
function fhThrowFlare(p, tx, ty, game) {
  if (p.flares <= 0 || game.over) return false;
  p.flares -= 1;
  const d = fhDist(p.x, p.y, tx, ty);
  const maxThrow = 260;
  const k = d > maxThrow ? maxThrow / d : 1;
  game.flare = {
    x: p.x + (tx - p.x) * k,
    y: p.y + (ty - p.y) * k,
    burn: 7, burning: true,
  };
  FH_AUDIO.pickup(false);
  game.flash('FLARE THROWN — GUARDS GO CHECK IT');
  return true;
}

/* Draw Kess: amber hooded dockworker, brighter than the floor. */
function fhDrawPlayer(ctx, p) {
  ctx.save();
  // Soft light pool around Kess so the player reads on the dark floor.
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 46);
  glow.addColorStop(0, 'rgba(255,190,90,0.20)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb02e';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff3d6';
  ctx.stroke();
  // Face / facing tick.
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.facing) * 8, p.y + Math.sin(p.facing) * 8);
  ctx.lineTo(p.x + Math.cos(p.facing) * 19, p.y + Math.sin(p.facing) * 19);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff3d6';
  ctx.stroke();
  // Carried crate on the shoulder.
  if (p.carrying) {
    ctx.fillStyle = '#d8a03a';
    ctx.strokeStyle = '#7a5a1a';
    ctx.lineWidth = 2;
    ctx.fillRect(p.x - 8, p.y - 26, 16, 12);
    ctx.strokeRect(p.x - 8, p.y - 26, 16, 12);
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y - 20);
    ctx.lineTo(p.x + 8, p.y - 20);
    ctx.stroke();
  }
  // KESS tag.
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText('KESS').width + 10;
  ctx.fillStyle = 'rgba(5,10,18,0.85)';
  ctx.fillRect(p.x - w / 2, p.y + 16, w, 15);
  ctx.strokeStyle = 'rgba(255,200,90,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x - w / 2, p.y + 16, w, 15);
  ctx.fillStyle = '#ffd75e';
  ctx.fillText('KESS', p.x, p.y + 27);
  ctx.restore();
}
