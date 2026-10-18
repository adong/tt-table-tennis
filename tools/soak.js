#!/usr/bin/env node
/* Headless CPU-vs-CPU matches, to show that every match finishes and the ball never gets stuck. It loads the same
   engine files the page uses (js/physics.js, js/match.js, js/cpu.js, and the kit roster) into node, with no browser.

   node tools/soak.js                     200 random matches (CPU levels and test bots, 1 player and 2 players,
                                          1 game / best of 3 / best of 5, every 10th one a rally challenge) and
                                          a fuzz of 3000 random balls thrown at the table
   node tools/soak.js 20 --max 1200       proves the check can fail: matches cut off after 10 s are unfinished
   node tools/soak.js --versus pad:kid easy 50 [--level easy]    win counts for one pairing
   Exit code 1 if any match didn't finish, a ball left the hall, a point took over a minute, or a fuzzed ball
   never ended in a point. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..');
const ctx = { console, Math, Date };
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.Kit = {};
vm.createContext(ctx);
for (const f of ['kit/roster.js', 'js/physics.js', 'js/match.js', 'js/cpu.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
}

const args = process.argv.slice(2);
const flag = (name, d) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : d;
};

if (args[0] === '--versus') {
  const [a, b, n] = args.slice(1);
  const res = ctx.TTCPU.versus(a, b, +(n || 50), { level: flag('--level', 'normal'), games: +flag('--games', 1) });
  console.log(JSON.stringify(res));
  process.exit(0);
}

const n = +(args.find((a) => /^\d+$/.test(a)) || 200);
const maxFrames = +flag('--max', 0) || undefined;
const t0 = Date.now();
const res = ctx.TTCPU.soak(n, { maxFrames });
res.fuzz = ctx.TTCPU.fuzz(maxFrames ? 200 : 3000);
res.seconds = +((Date.now() - t0) / 1000).toFixed(1);
console.log(JSON.stringify(res, null, 1));
process.exit(res.ok && res.fuzz.ok ? 0 : 1);
