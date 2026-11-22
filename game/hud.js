/* FROST HARBOR — HUD: side panel, roster, alarm bar, minimap, banner. */
'use strict';

const FH_HUD = {
  els: {},
  bannerTimer: 0,

  init() {
    const ids = ['hudTime', 'hudCrates', 'hudStrikes', 'hudFlares', 'detectWord',
      'seg1', 'seg2', 'seg3', 'seg4', 'visWord', 'noiseWord', 'spottedWord',
      'roster', 'goalText', 'banner', 'overlay', 'muteBtn', 'minimap'];
    for (const id of ids) this.els[id] = document.getElementById(id);
    const btn = this.els.muteBtn;
    if (btn) {
      btn.addEventListener('click', () => {
        const muted = FH_AUDIO.toggleMute();
        btn.textContent = muted ? 'SOUND: MUTED — CLICK TO UNMUTE (M)' : 'SOUND: ON — CLICK TO MUTE (M)';
      });
    }
  },

  fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  },

  /* Detection word + alarm segments from the 0..100 meter. */
  detectWord(meter) {
    if (meter >= 90) return 'ALARM';
    if (meter >= 70) return 'HUNTED';
    if (meter >= 45) return 'SUSPICIOUS';
    if (meter >= 20) return 'UNEASY';
    return 'CALM';
  },

  update(game) {
    const e = this.els;
    const p = game.player;
    if (e.hudTime) e.hudTime.textContent = this.fmtTime(game.timeLeft);
    if (e.hudCrates) e.hudCrates.textContent = p.delivered + '/3';
    if (e.hudStrikes) {
      const left = 3 - game.strikes;
      e.hudStrikes.textContent = '● '.repeat(left).trim() + (left < 3 ? ' ○'.repeat(3 - left) : '');
      e.hudStrikes.style.color = left === 0 ? '#ff6b6b' : '#ffd75e';
    }
    if (e.hudFlares) e.hudFlares.textContent = String(p.flares);

    const word = this.detectWord(game.meter);
    if (e.detectWord) {
      e.detectWord.textContent = word;
      e.detectWord.className = 'v ' + (word === 'CALM' ? 'green' : word === 'ALARM' ? 'red' : 'amber');
    }
    const level = game.meter >= 90 ? 4 : game.meter >= 70 ? 3 : game.meter >= 45 ? 2 : game.meter >= 20 ? 1 : 0;
    const segCls = ['', 'on1', 'on2', 'on3', 'on4'];
    for (let i = 1; i <= 4; i++) {
      const seg = e['seg' + i];
      if (seg) seg.className = 'seg' + (i <= level ? ' ' + segCls[i] : '');
    }
    if (e.visWord) {
      e.visWord.textContent = game.inBeam ? 'EXPOSED IN BEAM' : game.inCone ? 'GLIMPSED' : p.inFog ? 'HIDDEN IN FOG' : 'IN SHADOW';
      e.visWord.className = 'v ' + (game.inBeam || game.inCone ? 'red' : 'green');
    }
    if (e.noiseWord) {
      e.noiseWord.textContent = !p.moving ? 'SILENT' : p.sneaking ? 'SILENT' : 'FAINT STEPS';
      e.noiseWord.className = 'v ' + (!p.moving || p.sneaking ? 'green' : 'amber');
    }
    if (e.spottedWord) e.spottedWord.textContent = String(game.spotted);

    if (e.goalText) {
      e.goalText.textContent = p.delivered >= 3
        ? 'All crates loaded — board the ship through the green gangway before dawn!'
        : 'Carry 3 crates to the gangway (' + p.delivered + '/3 loaded), then board the ship before dawn. Stay out of the cones and the searchlights.';
    }

    if (e.roster) {
      let html = '';
      for (const g of game.guards) {
        const d = Math.round(fhDist(g.x, g.y, p.x, p.y) / 10);
        const st = g.state === 'ALARM' ? '<span style="color:#ff7b7b">ALARM</span>'
          : g.state === 'SUSPICIOUS' ? '<span style="color:#ffd75e">SUSPICIOUS</span>'
          : g.state === 'INVESTIGATING' ? '<span style="color:#ffb02e">INVESTIGATING</span>'
          : 'PATROLLING';
        html += '<div class="g"><span class="nm">' + g.name + '</span><span class="st">' + st + '</span><span class="dst">' + d + 'm</span></div>';
      }
      e.roster.innerHTML = html;
    }
  },

  showBanner(text, ms) {
    const b = this.els.banner;
    if (!b) return;
    b.textContent = text;
    b.classList.add('show');
    this.bannerTimer = ms || 1800;
  },

  tickBanner(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt * 1000;
      if (this.bannerTimer <= 0 && this.els.banner) this.els.banner.classList.remove('show');
    }
  },

  showOverlay(html) {
    const o = this.els.overlay;
    if (!o) return;
    o.innerHTML = html;
    o.classList.add('show');
  },

  hideOverlay() {
    const o = this.els.overlay;
    if (!o) return;
    o.classList.remove('show');
    o.innerHTML = '';
  },

  drawMinimap(game) {
    const cv = this.els.minimap;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const sx = cv.width / FH_LEVEL.width;
    const sy = cv.height / FH_LEVEL.height;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#0d1b2e';
    ctx.fillRect(0, 0, cv.width, cv.height);
    // Ship + gangway.
    ctx.fillStyle = '#3d5a78';
    ctx.fillRect(FH_LEVEL.ship.x * sx, FH_LEVEL.ship.y * sy, FH_LEVEL.ship.w * sx, FH_LEVEL.ship.h * sy);
    ctx.fillStyle = '#3ddc74';
    ctx.fillRect(FH_LEVEL.gangway.x * sx, FH_LEVEL.gangway.y * sy, FH_LEVEL.gangway.w * sx, FH_LEVEL.gangway.h * sy);
    // Fog.
    ctx.fillStyle = 'rgba(139,152,168,0.55)';
    for (const f of FH_LEVEL.fog) ctx.fillRect(f.x * sx, f.y * sy, f.w * sx, f.h * sy);
    // Obstacles.
    ctx.fillStyle = '#274b6d';
    for (const o of FH_LEVEL.obstacles) ctx.fillRect(o.x * sx, o.y * sy, o.w * sx, o.h * sy);
    // Crates left.
    ctx.fillStyle = '#d8a03a';
    for (const c of game.crates) {
      if (!c.taken) {
        ctx.fillRect(c.x * sx - 3, c.y * sy - 3, 6, 6);
      }
    }
    // Searchlight pivots.
    ctx.fillStyle = '#ffe9a8';
    for (const sl of FH_LEVEL.searchlights) {
      ctx.beginPath();
      ctx.arc(sl.x * sx, sl.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Flare.
    if (game.flare && game.flare.burning) {
      ctx.fillStyle = '#ff8c2e';
      ctx.beginPath();
      ctx.arc(game.flare.x * sx, game.flare.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Guards red, player green.
    ctx.fillStyle = '#ff5a4e';
    for (const g of game.guards) {
      ctx.beginPath();
      ctx.arc(g.x * sx, g.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#8dff9e';
    ctx.beginPath();
    ctx.arc(game.player.x * sx, game.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  },
};
