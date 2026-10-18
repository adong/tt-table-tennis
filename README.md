# TT: Table Tennis

A table tennis (乒乓球) game starring Teddy and Tommy. The name is the pun: **TT** = **T**eddy & **T**ommy = **T**able **T**ennis. It's built with Claude Code from plain JavaScript and Three.js, on the shared Claude Games kit.

There are no image, model or audio files. The players are the kit's blocky characters, every texture is painted on a canvas, and every sound is synthesised.

You play from behind your player, looking down the blue table at the computer. Your paddle follows your mouse or finger, and the way you swipe through the ball sets how fast it goes, where it lands and how it spins. The orange ball has a shadow on the table or the floor beneath it, so you can always see where it is. On Easy, a yellow ring shows where to put your paddle.

Tap your brother's face (or press **T**) and he hops in for about 10 seconds of doubles. He hands you a treat and saves the next ball you'd miss.

The name lives in one place, `js/title.js`.

## Play

- **Double-click `index.html`.** It works offline, because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/tt-table-tennis.html` is the whole game inlined in one page, about 0.8 MB. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name tt-table-tennis`

The title screen has three modes and two settings. The settings and your picks are remembered on that device.

- **🏓 1 PLAYER**: you against the computer.
- **👫 2 PLAYERS**: two kids on one keyboard, in a side view of the table.
- **🤖 RALLY CHALLENGE**: keep the ball going against Bolt, the wall robot, for your best rally.
- **LEVEL**:
  - **🐣 EASY**, for little players like Tommy (5). The ball is slowest, your paddle reaches further, and it's pulled onto the ball at the last moment. You don't have to swing: put the paddle there and it hits the ball back by itself. A bright ring shows where to meet the ball. The computer is slow, hits back toward you, and gives you high floaters to smash.
  - **🔥 NORMAL**, for big kids like Teddy (8). The ball is faster and the pull is gentler. The ring is faint. The computer places the ball away from you, uses spin and smashes high balls.
  - **🏆 PRO**: fast, with no help and no ring. The computer goes for the corners. Spin coming at you needs an answer (see below).
- **MATCH**: 1 GAME, BEST OF 3 or BEST OF 5. A game is first to 11, win by 2.

Next you pick the players. Teddy vs Tommy is the default, and anyone from the kit roster can play: Teddy, Tommy, Zoom, Luna, Bolt the robot, Bruno the bear and the zombie. The card row shows who your companion will be.

## Controls

**1 player**

| | Mouse / finger | Keyboard |
|---|---|---|
| move the paddle | move the mouse, or drag your finger (the paddle sits just above your fingertip) | A D or ← → (the height follows the ball by itself; W S or ↑ ↓ move it up and down) |
| power, topspin, backspin, curve | the swipe as you meet the ball (see "How to hit") | Space or F just before the ball arrives = a power drive; hold ↑ / W for topspin, ↓ / S for backspin, ← → for a curve |
| serve | tap or click | Space, F or Enter |
| call your brother | tap his big face (bottom left) or his face in the bar at the top | T |

**2 players** (side view)

| | Player 1 (left) | Player 2 (right) |
|---|---|---|
| move | W A S D (D is toward the net) | arrows (← is toward the net) |
| swing / serve | F | L |
| call your brother | T | Enter |

- In 2 players the paddle reaches for the ball by itself: you move, and press swing as the ball arrives. Hold toward the net while you swing for topspin, away for backspin, and W/S (or ↑/↓) to aim. A swing right at its start or very end is a mishit, a floater the other side can smash.
- On Easy and Normal the game walks you toward the ball when you're not steering (fully on Easy, sideways on Normal).
- On a touch screen in 2 players, each player taps his own half of the screen to swing, and the game walks him to the ball.
- **P** or Esc pauses, and **M** turns the sound on or off. The ❚❚ and 🔊 buttons are at the top of the screen.
- **Menus:** on the title screen, 1, 2 and 3 pick a mode (Enter is 1 player), ← → change the level and G changes the match length. On the player screen, A D change player 1, ← → change player 2, and Enter plays. On the results screen, Enter plays again and Esc goes to the menu.

## How to hit

The ball is hit when it reaches your paddle after its bounce on your side. Where the paddle meets it is decided by the swipe at that moment:

| Swipe | Shot | What it does |
|---|---|---|
| none (paddle still) | **BLOCK** | soft, cross-court |
| fast | **DRIVE** | deeper and faster the faster you swipe |
| up through the ball | **TOPSPIN!** | dips down onto the table and kicks on fast after the bounce |
| down through the ball | **BACKSPIN!** | floats, slower, checks up after the bounce |
| sideways | **CURVE!** | aims to that side and bends in the air |
| any swipe at a high ball | **SMASH!** | a slow-motion POW! (or WHAM!, KAPOW!), very fast and steep, with a camera shake |

- **Smash:** a ball that bounces high (a lob, a floater, a backspin ball) can be smashed. On Easy any hit on a high ball smashes; on Normal and Pro you need a swipe. Teddy celebrates a smash winner with his basketball jump shot.
- **Spin coming at you** (Normal and Pro): block a topspin ball and it pops up high (a floater the other side can smash). Push a backspin ball without lifting it (a swipe up) and it goes into the net. On Easy, spin hardly matters.
- **Mistakes:** a wild, flat, full-power swipe can fly long (rarely on Easy). Otherwise your shots always clear the net and land on the table. You lose a point by not getting your paddle to the ball.
- **Rules (kid-friendly):**
  - The serve bounces once on your side, then on theirs. Serves are aimed so they always go in, and a serve that clips the net and lands in is "LUCKY NET!", not a let.
  - After that the ball must bounce once on your side before you hit it.
  - You win the point if it bounces twice on their side, gets past them, goes into the net or misses the table.
  - Serves change every 2 points, and every point from 10–10. First to 11, win by 2, with "DEUCE!", "GAME POINT!" and "MATCH POINT!" calls.
- **Rallies end:** after 12 shots the computer goes for winners and misses a bit more each shot, and after 20 shots everyone's reach and swing timing get a little stricter every shot, so no rally goes on forever.

## Celebrations

- **Teddy** wins a point with his Mike Tyson-style **boxing combo**. After a smash winner, or the match, he does his **🏀 jump shot** instead: a hop, both hands up, and a basketball flies off with a swish.
- **Tommy** does his **Y pose (比耶)**: both arms up with peace fingers.
- Everyone else does their roster signature, or waves. The player who lost the point hangs his head.
- In the 1-player view the winner turns around to face you. The friends watching from the benches cheer too.

## Call your brother (companion mode)

Your companion is the other brother: **Tommy** comes for everyone, and **Teddy** comes when Tommy is playing (`Kit.roster.buddyFor`).

- **Calling him:** tap his big face button (bottom left; bottom right for player 2), or his face in the top bar. On the keyboard it's T, or Enter for player 2 in 2 players.
- **He hops in** beside you with his own paddle and a name tag. In the 1-player view that's to the right of your paddle, where the camera can see him. He says hi with his signature move: Teddy's boxing combo, or Tommy's Y pose.
- **The treat:** then he hands you a treat (🍦 💧 🧃 🍪 🍉 🍌) with a toast like "🍦 ICE CREAM FROM TOMMY!". It flies into your free hand and you hold it for a few seconds.
- **He's got your back:** while he's there, the first ball you'd miss is his. Time slows down, he dives at the ball and pops it back over: **"TOMMY SAVED IT!"**, with a SAVED! burst. It counts whether the ball got past your paddle, bounced twice or hit the floor.
- **The HUD:** the bar with his face under your name shows how much of his visit is left. It's green and pulsing while he's there, and the big button glows.
- **Call him again:** in 1 player you can call him as often as you like. Calling him while he's there gives you another treat and another hello, starts his 10 seconds again and gets him ready for another save.
- **2 players:** each side has its own companion. A second call during his visit only gives a treat. After each visit he rests for **5 s**: his face goes grey while the bar refills, and calling just wiggles it.
- **When his time is up** he says bye (Teddy's jump shot, Tommy's Y) and hops away.
- If both sides have the same brother, the second one wears different colours.

## Rally challenge

Bolt the wall robot stands at the far end and **never misses**. Your rally counts each of your returns that lands on his side. Every hit he gets a little faster and aims a little wider. After 8 hits he adds spin, and after 25 he tries a turbo smash now and then. When you miss, you see your rally and your best ("NEW BEST!" with confetti), and Bolt serves the next one. Your companion works here too: he saves one miss per call.

Bests are saved per level on that device.

## How it works, and how it's tested

- **The ball** (`js/physics.js`) has gravity, a little air drag and spin, all simulated at 1/240 s.
  - Spin bends the ball in the air (Magnus): topspin dips, backspin floats and sidespin curves.
  - On the table, topspin kicks the ball on and low, and backspin checks it and pops it up.
  - It collides with the table top, the table's edges, the net (a ball that clips the tape dribbles over), the floor and the barriers.
  - The ball is drawn and collides at twice real size (4.5 cm), so kids can follow it. The table and net are real size.
- **Ball time runs slower than game time** (52% on Easy, 64% on Normal, 84% on Pro). That keeps real gravity but slows and flattens the flight.
- **The shot and serve solvers** fly candidate shots with the same integrator, and correct them until the ball lands on the chosen spot with the chosen spin, clearing the net. A solved shot then flies exactly as solved.
- **`TTPhys.predict()`** looks ahead along a ball's flight to find where a side should meet it: the top of its bounce, moved toward your end of the table.
  - Your paddle's contact plane slides there.
  - The CPU, the aim ring and the 2-player assist all use it.
- **The rules** (`js/match.js`) are plain state stepped at 120 frames a second, with no Three.js and no DOM. The same code runs the page and the headless tests.
- **The CPU** (`js/cpu.js`) plans each ball with the predictor, then spoils it on purpose:
  - it reacts late and moves at a limited speed, so wide balls are hard;
  - it misjudges some balls by more than its reach, more often for fast or spinning ones;
  - it hits into the net or long now and then;
  - it returns a smash only sometimes.
- **The renderer** (`js/game.js`) only reads match state, and turns `match.events` into sounds, bursts, calls and celebrations.
  - Your paddle is drawn exactly where the engine hits the ball. Your arm turns at the shoulder to reach its handle, stretching a little if it has to.
  - In the 1-player view the camera looks over your right shoulder. You turn see-through whenever the ball, or the spot where you'll meet it, is behind you on the screen.
- **Headless match runner** (node, no browser):

```bash
node tools/soak.js
```

```bash
node tools/soak.js 20 --max 1200
```

```bash
node tools/soak.js --versus pad:kid easy 50 --level easy
```

  - **`node tools/soak.js`** plays 200 random matches:
    - CPU levels and test bots, 1 player and 2 players;
    - 1 game, best of 3 and best of 5;
    - every 10th one a rally challenge;
    - every 4th one with player 1's companion called every 7.5 s.

    It then throws 3,000 random balls at the table (any speed, any spin) and checks each one ends in a point or is hit back. It exits 1 if a match doesn't finish, a ball leaves the hall, a point takes over 90 s of game time, or a thrown ball never ends.
  - **`node tools/soak.js 20 --max 1200`** proves the check can fail: matches cut off after 10 s are reported unfinished, with exit code 1.
  - **`--versus`** gives win counts for one pairing.
- **Test bots** stand in for kids at the controls:
  - `pad:kid` follows the ball late and loosely, swipes at random, looks away a quarter of the time and calls his brother now and then.
  - `pad:good` gets there about a quarter of a second after the shot and swipes up through most balls.
  - `pad:flail` waves the paddle around and taps everything.
  - `pad:still` never moves and waits 3 s to serve.
  - `keys:eight` and `keys:ten` walk to the ball and press swing about on time, the eight-year-old looser.
  - `keys:mash` mashes keys.
- **At the last check:**
  - 200 of 200 matches finished. The 6-second stuck-ball watchdog never fired, no ball left the hall, and every point ended within the 90 s limit. Matches averaged 30 points and 6.5 minutes of game time. All 3,000 thrown balls ended within 3.1 s.
  - **Easy:** `pad:kid` won 50 of 50 games, 550 points to 58, with about 7.6 hits a point, so little players can rally.
  - **Normal:** `pad:kid` won 22 of 50 games (472 points to 476), and `pad:good` won 50 of 50 (550 to 23).
  - **Pro:** `pad:good` won 3 of 50 games (235 to 542).
  - **CPU vs CPU:** Easy beat Normal in 4 of 50 games, and Normal beat Pro in 1 of 50.
  - **Rally challenge:** median best runs were 15 (`pad:kid`, Easy), 39 (`pad:good`, Easy), 20 (`pad:good`, Normal) and 14 (`pad:good`, Pro).
- **Console hooks** (`window.game`), for the browser:

```js
game.start({ mode: '1p', level: 'easy', games: 3, p: ['teddy', 'tommy'] }) // straight into a match ('1p' | '2p' | 'rally')
game.hold(true)          // stop the live loop, so only step() moves time
game.step(2)             // advance 2 s and draw (when the tab's animation is throttled)
game.drive(10)           // play side 0 for 10 s with real pointer events ({ touch: true }, { idle: true }, { miss: 0.7 })
game.swing({ y: 3 })     // meet the next ball with a swipe (m/s; y > 0 is up = topspin)
game.pop(); game.drive(6, { swipe: 260 })  // the CPU hits a floater, and you smash it
game.buddy(0)            // call side 0's companion
game.auto(0)             // a test bot plays side 0
game.celebrate(0, 'jumpshot'); game.look([x, y, z], [x, y, z], fov); game.look(null)
game.state(); game.soak(50); game.fuzz(500); game.sim({ who: ['pad:kid', 'easy'] })
```

## Files

```
index.html        page, HUD, menus (CSS inline)
js/title.js       the game's name, in one place
js/physics.js     ball flight with spin, table, net, edges, floor; shot and serve solvers; the look-ahead predictor
js/match.js       the rules: controls, contact plane, hitting, points, games, serving order, the companion, rally challenge
js/cpu.js         CPU levels, Bolt the wall robot, test bots, headless sim / soak / fuzz / versus
js/stage.js       the sports hall: table and net, floor, barriers with our own TT boards, scoreboard, benches, fans
js/poses.js       the paddle, arm reach (aimArm), ready / shuffle / serve / sad / dive / give poses, kit celebrations
js/fx.js          the ball and its glow, shadow and trail, bounce rings, the aim ring, POW bursts, sparks, confetti, emoji
js/sfx.js         ping-pong sounds on top of Kit.sound (tok, tik, net, smash, cheer, yum, ...)
js/input.js       mouse / finger with swipe speed, keyboard for one or two players, touch halves in 2 players
js/game.js        scene, cameras, players and companions, events, HUD, menus, main loop, window.game hooks
tools/soak.js     the headless match runner (node)
kit/              copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .), never edited here
dist/tt-table-tennis.html   the single-page build
```

## Kit candidates

These live in this game's own JS for now. They could move into `~/claude-games/kit` if another game wants them:

- **`aimArm(p, arm, target)`** (`js/poses.js`) turns a kit arm at the shoulder so the hand lands on any world point, stretching it slightly. Use it for holding props that live in world space: paddles, rackets, a ball being caught.
- **`placePaddle`** (`js/poses.js`): orient a held prop by "face this way, handle toward the hand".
- **The see-through fade** (`seeThrough` in `js/game.js`): fades a kit person when something important is behind him on the screen. Useful for any over-the-shoulder camera.
- **Ball physics with spin** (`js/physics.js`): Magnus in flight, spin kick on bounce, and a shot solver that iterates the real integrator.
- **Comic burst texture** (`js/fx.js`), the same idea as kof-teddy's and volleyball-teddy's: three games now have one.

## Not verified

- **Sound:** the synth code runs without errors, but nobody listened to it in this build.
- **Real touch devices:** touch was tested with synthetic pointer events at iPad landscape size (1024×768) in the Browser pane: a 7-shot rally with the paddle above the "fingertip". It wasn't tried on a real iPad or phone. The 2-player touch halves weren't tested. Neither was a phone in portrait: the camera widens for narrow screens, but that was only glanced at.
- **Double-click from Finder (`file://`):** the page uses only classic `<script src>` tags and makes no network requests except the optional Google font. But it was tested over `http://localhost`, because the test browser can't drive `file://` pages. The single-page build was loaded over localhost too.
- **Real kids:** the levels were tuned against the test bots, not against Teddy and Tommy.
