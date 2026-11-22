/* FROST HARBOR — main loop, rendering, detection, shots. */
'use strict';

const FH = {
  canvas: null,
  ctx: null,
  keys: {},
  mouse: { x: 480, y: 360 },
  time: 0,
  last: 0,
  player: null,
  guards: [],
  crates: [],
  flare: null,
  meter: 0,        // 0..100 global detection
  timeLeft: FH_LEVEL.nightLength,
  spotted: 0,
  strikes: 0,
  over: false,
  won: false,
  alarmOn: false,
  inBeam: false,
  inCone: false,
  shot: null,
  demo: false,
  bannerCooldown: 0,
};

FH.flash = function (text) {
  FH_HUD.showBanner(text, 2200);
};

FH.reset = function () {
  FH.player = fhMakePlayer();
  FH.guards = FH_LEVEL.guards.map((d, i) => fhMakeGuard(d, i));
  FH.crates = FH_LEVEL.crates.map(c => ({ id: c.id, x: c.x, y: c.y, taken: false }));
  FH.flare = null;
  FH.meter = 0;
  FH.timeLeft = FH_LEVEL.nightLength;
  FH.spotted = 0;
  FH.strikes = 0;
  FH.over = false;
  FH.won = false;
  FH.alarmOn = false;
  FH.inBeam = false;
  FH.inCone = false;
  FH_HUD.hideOverlay();
};

/* Spotted: strike, respawn at the dock gate, guards reset. */
FH.onSpotted = function () {
  FH.spotted += 1;
  FH.strikes += 1;
  FH_AUDIO.spotted();
  FH_AUDIO.alarmSting();
  FH.flash('SPOTTED! STRIKE ' + FH.strikes + ' OF 3');
  FH.meter = 0;
  FH.alarmOn = false;
  for (const g of FH.guards) {
    g.suspicion = 0;
    g.state = 'PATROLLING';
    g.target = null;
  }
  if (FH.strikes >= 3) {
    FH.over = true;
    FH_HUD.showOverlay(
      '<h1 class="bad">CAUGHT</h1>' +
      '<p>Three strikes — Harbor Master Falk has you hauled off the dock.</p>' +
      '<p class="big">Press R to try the night again.</p>'
    );
    return;
  }
  const p = FH.player;
  p.x = FH_LEVEL.playerStart.x;
  p.y = FH_LEVEL.playerStart.y;
  p.carrying = false;
  // The dropped crate returns to its pile.
  for (const c of FH.crates) {
    if (c.taken && p.delivered < 3) { /* keep delivered count; dropped crate respawns */ }
  }
  FH.crates = FH_LEVEL.crates.map(c => ({ id: c.id, x: c.x, y: c.y, taken: false }));
  // Crates already delivered stay delivered.
  for (let i = 0; i < p.delivered; i++) FH.crates[i].taken = true;
};

FH.win = function () {
  if (FH.over) return;
  FH.over = true;
  FH.won = true;
  FH_AUDIO.win();
  const ghost = FH.spotted === 0 ? 'GHOST BONUS +500 — UNSEEN ALL NIGHT!' : 'ESCAPED — SPOTTED ' + FH.spotted + ' TIME' + (FH.spotted > 1 ? 'S' : '');
  FH_HUD.showOverlay(
    '<h1>NIGHT 1 CLEAR</h1>' +
    '<p>Kess slips aboard with all 3 crates as the searchlights sweep the empty dock behind her.</p>' +
    '<p class="big">' + ghost + '</p>' +
    '<p>Level 1 of 3 complete — press R for Night 2.</p>'
  );
};

FH.dawn = function () {
  if (FH.over) return;
  FH.over = true;
  FH_HUD.showOverlay(
    '<h1 class="bad">DAWN BREAKS</h1>' +
    '<p>The sun finds the dock still loaded — the ship sails without its cargo.</p>' +
    '<p class="big">Press R to try the night again.</p>'
  );
};

/* ---------- shot presets: real game states for the four screenshots ---------- */
FH.applyShot = function (shot) {
  FH.shot = shot;
  // Demo freeze: the staged scene holds still (guards keep their poses and
  // the meter stays at its staged value) while the timer runs and the
  // searchlights keep sweeping, so the screenshot is a real live render.
  FH.demo = shot !== 'victory';
  const p = FH.player;
  if (shot === 'cover') {
    // NEAR-MISS: Kess carrying a crate, Falk closing in with "?", between two beams.
    p.x = 430; p.y = 330; p.carrying = true; p.delivered = 1; p.flares = 2;
    FH.crates[0].taken = true;
    FH.timeLeft = 324; // 5:24
    FH.meter = 55; // SUSPICIOUS
    const falk = FH.guards[0];
    falk.x = 486; falk.y = 296; falk.facing = fhAngleTo(falk.x, falk.y, p.x, p.y);
    falk.suspicion = 0.62; falk.state = 'SUSPICIOUS';
    const rook = FH.guards[1];
    rook.x = 560; rook.y = 250; rook.facing = 2.6;
    const pell = FH.guards[2];
    pell.x = 700; pell.y = 220; pell.facing = 2.2;
    FH_HUD.showBanner('WHAT WAS THAT?', 60000);
  } else if (shot === 'searchlight') {
    // Sweep pattern: Kess mid-crossing between the two beams.
    p.x = 480; p.y = 380; p.carrying = false; p.delivered = 0; p.flares = 2;
    FH.timeLeft = 340; // 5:40
    FH.meter = 14; // CALM
    const falk = FH.guards[0];
    falk.x = 240; falk.y = 150; falk.facing = 0.4;
    FH.guards[1].x = 420; FH.guards[1].y = 250; FH.guards[1].facing = 0.2;
    FH.guards[2].x = 660; FH.guards[2].y = 380; FH.guards[2].facing = 3.1;
    FH_HUD.showBanner('TIME THE SWEEP — CROSS BETWEEN THE BEAMS', 60000);
  } else if (shot === 'flare') {
    // Flare distraction: Pell walks to the burning flare, Kess hidden in fog.
    p.x = 300; p.y = 235; p.carrying = false; p.delivered = 1; p.flares = 1;
    FH.crates[0].taken = true;
    FH.timeLeft = 296; // 4:56
    FH.meter = 30; // UNEASY
    FH.flare = { x: 520, y: 210, burn: 6, burning: true };
    const pell = FH.guards[2];
    pell.x = 592; pell.y = 234; pell.facing = fhAngleTo(pell.x, pell.y, FH.flare.x, FH.flare.y);
    pell.state = 'INVESTIGATING'; pell.target = { x: FH.flare.x, y: FH.flare.y };
    pell.suspicion = 0.35;
    FH.guards[0].x = 220; FH.guards[0].y = 150; FH.guards[0].facing = 0.4;
    FH.guards[1].x = 420; FH.guards[1].y = 330; FH.guards[1].facing = 0.2;
    FH_HUD.showBanner('FLARE THROWN — PELL GOES TO CHECK IT', 60000);
  } else if (shot === 'victory') {
    // Victory on the gangway: 3/3 loaded, boarding the ship, unseen.
    p.x = 724; p.y = 138; p.carrying = false; p.delivered = 3; p.flares = 2;
    FH.crates.forEach(c => { c.taken = true; });
    FH.timeLeft = 252; // 4:12
    FH.meter = 0;
    FH.spotted = 0;
    FH.guards[0].x = 300; FH.guards[0].y = 420; FH.guards[0].facing = 4.7;
    FH.guards[1].x = 480; FH.guards[1].y = 250; FH.guards[1].facing = 0.2;
    FH.guards[2].x = 620; FH.guards[2].y = 380; FH.guards[2].facing = 4.7;
    FH_HUD.showOverlay(
      '<h1>NIGHT 1 CLEAR</h1>' +
      '<p>Kess slips aboard with all 3 crates as the searchlights sweep the empty dock behind her.</p>' +
      '<p class="big">GHOST BONUS +500 — UNSEEN ALL NIGHT!</p>' +
      '<p>Level 1 of 3 complete — press R for Night 2.</p>'
    );
    FH.over = true;
    FH.won = true;
  }
};

/* ---------- update ---------- */
FH.update = function (dt) {
  if (FH.over) {
    // Keep the world alive behind the overlay: beams sweep, timer ticks.
    FH.time -= 0; // time still advances for beam animation below
    FH.timeLeft = Math.max(0, FH.timeLeft - dt * 0.2);
    return;
  }
  if (FH.demo) {
    // Staged screenshot state: timer runs, beams sweep, nothing else moves.
    FH.timeLeft = Math.max(0, FH.timeLeft - dt);
    if (FH.flare && FH.flare.burning) FH.flare.burn -= dt;
    return;
  }
  FH.timeLeft -= dt;
  if (FH.timeLeft <= 0) {
    FH.timeLeft = 0;
    FH.dawn();
    return;
  }

  fhUpdatePlayer(FH.player, FH.keys, dt, FH);

  // Flare burn.
  if (FH.flare && FH.flare.burning) {
    FH.flare.burn -= dt;
    if (FH.flare.burn <= 0) FH.flare.burning = false;
  }

  // Guards sense + move.
  let anyNoticed = false;
  let inCone = false;
  let maxStrength = 0;
  for (const g of FH.guards) {
    const ev = fhUpdateGuard(g, dt, FH.player, FH);
    if (ev.noticed) anyNoticed = true;
    if (g.lastStrength > 0.05) inCone = true;
    maxStrength = Math.max(maxStrength, g.lastStrength || 0);
  }
  FH.inCone = inCone;

  // Searchlight beams: seen from afar, fast detection.
  let inBeam = false;
  let beamStrength = 0;
  for (const sl of FH_LEVEL.searchlights) {
    const ang = fhBeamAngle(sl, FH.time);
    const s = fhBeamStrength(sl, ang, FH.player.x, FH.player.y);
    if (s > 0) {
      inBeam = true;
      beamStrength = Math.max(beamStrength, s);
    }
  }
  FH.inBeam = inBeam;

  // Global meter: rises in cones/beams, faster in a beam; decays hidden.
  let rise = maxStrength * 22;
  if (inBeam) rise += beamStrength * 55;
  if (rise > 0) {
    if (FH.player.inFog) rise *= 0.5;
    if (FH.player.sneaking) rise *= 0.6;
    FH.meter = Math.min(100, FH.meter + rise * dt);
  } else {
    FH.meter = Math.max(0, FH.meter - 14 * dt);
  }

  if (anyNoticed && FH.bannerCooldown <= 0) {
    FH_HUD.showBanner('WHAT WAS THAT?', 1800);
    FH.bannerCooldown = 4;
  }
  FH.bannerCooldown -= dt;

  const wasAlarm = FH.alarmOn;
  FH.alarmOn = FH.meter >= 90;
  if (FH.alarmOn && !wasAlarm) FH_AUDIO.alarmSting();

  if (FH.meter >= 100) FH.onSpotted();
};

/* ---------- render ---------- */
FH.drawFloor = function (ctx) {
  ctx.fillStyle = '#0d1b2e';
  ctx.fillRect(0, 0, FH_LEVEL.width, FH_LEVEL.height);
  // Ice planks.
  ctx.strokeStyle = 'rgba(120,170,220,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= FH_LEVEL.width; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FH_LEVEL.height); ctx.stroke();
  }
  for (let y = 0; y <= FH_LEVEL.height; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(FH_LEVEL.width, y); ctx.stroke();
  }
  // Frost speckles + cracks.
  for (const d of FH_DECOR) {
    if (d.crack) {
      ctx.strokeStyle = 'rgba(190,220,255,' + d.a + ')';
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + Math.cos(d.ang) * d.len, d.y + Math.sin(d.ang) * d.len);
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(200,230,255,' + d.a + ')';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

FH.drawShip = function (ctx) {
  const s = FH_LEVEL.ship;
  // Ship deck: steel hull, lit portholes, containers aboard.
  ctx.fillStyle = '#16283e';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = '#3d5a78';
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
  ctx.fillStyle = '#274b6d';
  ctx.fillRect(s.x + 18, s.y + 22, 60, 40);
  ctx.fillRect(s.x + 96, s.y + 22, 60, 40);
  ctx.fillStyle = '#ffd75e';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(s.x + 28 + i * 44, s.y + 92, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText('SS MERIDIAN', s.x + s.w / 2, s.y + 132);

  // Gangway: green exit ramp.
  const g = FH_LEVEL.gangway;
  const pulse = 0.55 + 0.25 * Math.sin(FH.time * 3);
  ctx.fillStyle = 'rgba(61,220,116,' + pulse + ')';
  ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.strokeStyle = '#b8ffcf';
  ctx.lineWidth = 2;
  ctx.strokeRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = '#06210f';
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillText('EXIT', g.x + g.w / 2, g.y + g.h / 2 + 5);
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.fillText('GANGWAY', g.x + g.w / 2, g.y + g.h / 2 + 18);
  // Arrow pointing at the exit from the dock.
  ctx.strokeStyle = 'rgba(141,255,158,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(g.x - 26, g.y + g.h / 2);
  ctx.lineTo(g.x - 6, g.y + g.h / 2);
  ctx.moveTo(g.x - 14, g.y + g.h / 2 - 7);
  ctx.lineTo(g.x - 6, g.y + g.h / 2);
  ctx.lineTo(g.x - 14, g.y + g.h / 2 + 7);
  ctx.stroke();
};

FH.drawObstacles = function (ctx) {
  for (const o of FH_LEVEL.obstacles) {
    ctx.fillStyle = o.tint;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = 'rgba(190,220,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    ctx.strokeStyle = 'rgba(190,220,255,0.18)';
    ctx.lineWidth = 1;
    if (o.w > o.h) {
      for (let x = o.x + 20; x < o.x + o.w - 8; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, o.y + 3); ctx.lineTo(x, o.y + o.h - 3); ctx.stroke();
      }
    } else {
      for (let y = o.y + 20; y < o.y + o.h - 8; y += 24) {
        ctx.beginPath(); ctx.moveTo(o.x + 3, y); ctx.lineTo(o.x + o.w - 3, y); ctx.stroke();
      }
    }
  }
};

FH.drawFog = function (ctx) {
  for (const f of FH_LEVEL.fog) {
    ctx.fillStyle = 'rgba(150,160,172,0.30)';
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.strokeStyle = 'rgba(200,210,220,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    ctx.setLineDash([]);
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(230,238,248,0.85)';
    ctx.fillText('FOG — HALF-COVER', f.x + 8, f.y + 16);
  }
};

FH.drawCrates = function (ctx) {
  for (const c of FH.crates) {
    if (c.taken) continue;
    // Warm amber glow so crates read as objectives.
    const glow = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 40);
    glow.addColorStop(0, 'rgba(255,180,60,0.35)');
    glow.addColorStop(1, 'rgba(255,180,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8a03a';
    ctx.strokeStyle = '#7a5a1a';
    ctx.lineWidth = 2;
    ctx.fillRect(c.x - 13, c.y - 13, 26, 26);
    ctx.strokeRect(c.x - 13, c.y - 13, 26, 26);
    ctx.beginPath();
    ctx.moveTo(c.x - 13, c.y); ctx.lineTo(c.x + 13, c.y);
    ctx.moveTo(c.x, c.y - 13); ctx.lineTo(c.x, c.y + 13);
    ctx.stroke();
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3d6';
    ctx.fillText('CRATE', c.x, c.y + 28);
  }
};

FH.drawSearchlights = function (ctx) {
  for (const sl of FH_LEVEL.searchlights) {
    const ang = fhBeamAngle(sl, FH.time);
    const cycle = fhBeamCycle(sl, FH.time);

    // Sweep arc: the full sweep range, dashed, so the pattern reads.
    ctx.save();
    ctx.beginPath();
    ctx.arc(sl.x, sl.y, sl.range * 0.92, sl.center - sl.amplitude, sl.center + sl.amplitude);
    ctx.strokeStyle = 'rgba(255,240,190,0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // The beam itself: a giant cold-white cone.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sl.x, sl.y);
    ctx.arc(sl.x, sl.y, sl.range, ang - sl.halfAngle, ang + sl.halfAngle);
    ctx.closePath();
    const grad = ctx.createRadialGradient(sl.x, sl.y, 10, sl.x, sl.y, sl.range);
    grad.addColorStop(0, 'rgba(255,246,214,0.55)');
    grad.addColorStop(0.55, 'rgba(255,246,214,0.28)');
    grad.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,220,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Tower base.
    ctx.save();
    ctx.beginPath();
    ctx.arc(sl.x, sl.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#3d5a78';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffe9a8';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sl.x, sl.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe9a8';
    ctx.fill();
    ctx.restore();

    // Countdown ring: the sweep cycle as a ring that drains.
    ctx.save();
    ctx.beginPath();
    ctx.arc(sl.x, sl.y, 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,233,168,0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sl.x, sl.y, 26, -Math.PI / 2, -Math.PI / 2 + cycle * Math.PI * 2);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Seconds left in this sweep, on the ring.
    const remain = sl.period * (1 - cycle);
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(remain.toFixed(0) + 's', sl.x, sl.y - 32);
    ctx.restore();

    // Tower label.
    ctx.save();
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(sl.id + ' SEARCHLIGHT', sl.x, sl.y + 44);
    ctx.restore();
  }
};

FH.drawFlare = function (ctx) {
  const f = FH.flare;
  if (!f || !f.burning) return;
  const flick = 0.75 + 0.25 * Math.sin(FH.time * 17);
  const glow = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, 90 * flick);
  glow.addColorStop(0, 'rgba(255,160,50,0.75)');
  glow.addColorStop(0.5, 'rgba(255,110,30,0.30)');
  glow.addColorStop(1, 'rgba(255,110,30,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(f.x, f.y, 90 * flick, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff2cf';
  ctx.fill();
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb02e';
  ctx.fillText('FLARE ' + Math.ceil(f.burn) + 's', f.x, f.y - 16);
};

FH.render = function () {
  const ctx = FH.ctx;
  FH.drawFloor(ctx);
  FH.drawShip(ctx);
  FH.drawObstacles(ctx);
  FH.drawFog(ctx);
  FH.drawCrates(ctx);
  FH.drawSearchlights(ctx);
  FH.drawFlare(ctx);
  const alarmBoost = FH.alarmOn;
  for (const g of FH.guards) fhDrawGuard(ctx, g, alarmBoost);
  fhDrawPlayer(ctx, FH.player);

  // Level + night tag painted on the dock itself.
  ctx.save();
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(160,200,240,0.75)';
  ctx.fillText('LEVEL 1 OF 3 — NIGHT 1', 14, 706);
  ctx.textAlign = 'right';
  ctx.fillText('DAWN IN ' + FH_HUD.fmtTime(FH.timeLeft), FH_LEVEL.width - 14, 706);
  ctx.restore();
};

FH.loop = function (t) {
  const now = t / 1000;
  let dt = FH.last ? Math.min(0.05, now - FH.last) : 0.016;
  FH.last = now;
  FH.time += dt;
  FH.update(dt);
  FH.render();
  FH_HUD.update(FH);
  FH_HUD.tickBanner(dt);
  FH_HUD.drawMinimap(FH);
  requestAnimationFrame(FH.loop);
};

/* ---------- input ---------- */
FH.bindInput = function () {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    FH.keys[k] = true;
    FH_AUDIO.ensure();
    if (k === 'f') fhThrowFlare(FH.player, FH.mouse.x, FH.mouse.y, FH);
    if (k === 'm') {
      const muted = FH_AUDIO.toggleMute();
      const btn = document.getElementById('muteBtn');
      if (btn) btn.textContent = muted ? 'SOUND: MUTED — CLICK TO UNMUTE (M)' : 'SOUND: ON — CLICK TO MUTE (M)';
    }
    if (k === 'r') {
      FH.reset();
      if (FH.shot) FH.applyShot(FH.shot);
    }
  });
  window.addEventListener('keyup', (e) => {
    FH.keys[e.key.toLowerCase()] = false;
  });
  FH.canvas.addEventListener('mousemove', (e) => {
    const r = FH.canvas.getBoundingClientRect();
    FH.mouse.x = (e.clientX - r.left) * (FH.canvas.width / r.width);
    FH.mouse.y = (e.clientY - r.top) * (FH.canvas.height / r.height);
  });
  FH.canvas.addEventListener('click', (e) => {
    FH_AUDIO.ensure();
    const r = FH.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (FH.canvas.width / r.width);
    const y = (e.clientY - r.top) * (FH.canvas.height / r.height);
    fhThrowFlare(FH.player, x, y, FH);
  });
};

/* ---------- boot ---------- */
(function boot() {
  FH.canvas = document.getElementById('game');
  FH.ctx = FH.canvas.getContext('2d');
  FH_HUD.init();
  FH.reset();
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) FH.applyShot(shot);
  FH.bindInput();
  requestAnimationFrame(FH.loop);
})();
