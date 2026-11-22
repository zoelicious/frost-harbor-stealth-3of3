/* FROST HARBOR — WebAudio: footsteps on ice, alarm sting, pickup, win. */
'use strict';

const FH_AUDIO = {
  ctx: null,
  muted: false,
  stepTimer: 0,

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  },

  /* Short filtered noise crunch: a footstep on frozen planks. */
  footstep(sneaking) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const dur = 0.07;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = sneaking ? 500 : 900;
    filt.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = sneaking ? 0.05 : 0.13;
    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start();
  },

  /* Two-tone alarm sting when the alarm trips. */
  alarmSting() {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const notes = [466, 622, 466, 622];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.16);
    });
  },

  /* Soft blip: crate picked up / delivered. */
  pickup(delivered) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = delivered ? 660 : 520;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.25);
    if (delivered) {
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 880;
      const g2 = ctx.createGain();
      const t1 = ctx.currentTime + 0.12;
      g2.gain.setValueAtTime(0.0001, t1);
      g2.gain.exponentialRampToValueAtTime(0.1, t1 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.2);
      o2.connect(g2).connect(ctx.destination);
      o2.start(t1);
      o2.stop(t1 + 0.22);
    }
  },

  /* Rising arpeggio on escape. */
  win() {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.42);
    });
  },

  /* Low thud when spotted. */
  spotted() {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.42);
  },
};
