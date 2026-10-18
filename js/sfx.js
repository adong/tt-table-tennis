/* TT Table Tennis: ping-pong sounds, made from Kit.sound.tone / hiss (no audio files). */
(function () {
  'use strict';
  const S = window.Kit.sound;

  window.TTSfx = {
    // paddle on ball: the hollow "tok"; harder shots are louder and a little lower
    tok(power = 0.4) {
      S.tone({ type: 'triangle', f: 1500 - power * 400, to: 900, dur: 0.045, vol: 0.22 + power * 0.18 });
      S.tone({ type: 'sine', f: 520, to: 380, dur: 0.05, vol: 0.12 + power * 0.1 });
      S.hiss({ filter: 'highpass', f: 3500, dur: 0.025, vol: 0.1 + power * 0.08 });
    },
    // ball on the table: a bright "tik"
    tik(v = 2) {
      const k = Math.min(1, v / 4);
      S.tone({ type: 'sine', f: 2100, to: 1600, dur: 0.035, vol: 0.12 + k * 0.12 });
      S.hiss({ filter: 'bandpass', f: 4200, q: 2, dur: 0.02, vol: 0.06 + k * 0.06 });
    },
    floor() { S.tone({ type: 'sine', f: 900, to: 600, dur: 0.05, vol: 0.08 }); },
    net() {
      S.hiss({ filter: 'lowpass', f: 1200, to: 300, dur: 0.2, vol: 0.22 });
      S.tone({ type: 'sine', f: 180, to: 110, dur: 0.15, vol: 0.12 });
    },
    smash() {
      S.tone({ type: 'square', f: 420, to: 110, dur: 0.16, vol: 0.18, lp: 2200 });
      S.hiss({ filter: 'lowpass', f: 5000, to: 600, dur: 0.3, vol: 0.32 });
      S.tone({ type: 'triangle', f: 1300, to: 600, dur: 0.06, vol: 0.32 });
    },
    swing() { S.hiss({ filter: 'bandpass', f: 1000, to: 2800, q: 1.4, dur: 0.12, vol: 0.08 }); },
    toss() { S.tone({ type: 'sine', f: 420, to: 760, dur: 0.12, vol: 0.06 }); },
    point(good) {
      const notes = good ? [659, 784, 1047] : [523, 392];
      notes.forEach((f, i) => S.tone({ type: 'triangle', f, at: i * 0.09, dur: 0.2, vol: 0.14 }));
    },
    cheer(vol = 1) {
      for (let i = 0; i < 6; i++) S.hiss({ filter: 'bandpass', f: 900 + Math.random() * 900, q: 0.8, at: i * 0.07, dur: 0.5, vol: 0.05 * vol });
    },
    aww() { S.tone({ type: 'sawtooth', f: 330, to: 220, dur: 0.5, vol: 0.05, lp: 900 }); },
    fanfare() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => S.tone({ type: 'square', f, at: i * 0.12, dur: 0.18, vol: 0.07, lp: 2400 }));
      S.tone({ type: 'triangle', f: 1047, at: 0.75, dur: 0.6, vol: 0.12 });
    },
    boing() { S.tone({ type: 'sine', f: 220, to: 660, dur: 0.18, vol: 0.14 }); },
    yum() {
      S.tone({ type: 'triangle', f: 660, to: 990, dur: 0.12, vol: 0.12 });
      S.tone({ type: 'triangle', f: 880, to: 1320, dur: 0.14, vol: 0.1, at: 0.1 });
    },
    nope() { S.tone({ type: 'square', f: 180, dur: 0.08, vol: 0.06, lp: 900 }); },
    beep(hi) { S.tone({ type: 'square', f: hi ? 1320 : 880, dur: 0.07, vol: 0.05, lp: 3000 }); },
    // slow-motion swell for a smash
    slowmo() {
      S.tone({ type: 'sawtooth', f: 160, to: 60, dur: 0.6, vol: 0.08, lp: 700 });
      S.hiss({ filter: 'lowpass', f: 600, to: 200, dur: 0.6, vol: 0.12 });
    },
  };
})();
