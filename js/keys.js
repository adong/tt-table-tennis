/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "TT Table Tennis",
  cols: ["Player 1", "Player 2 (2 players)"],
  keys: [
    ["move", "W A S D", "↑ ← ↓ →"],
    ["swing · serve", "F", "L"],
    ["call your brother", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "1 player: the mouse or A D / ← → move the paddle. Space or F just before the ball arrives is a power drive; hold ↑ for topspin, ↓ for backspin, ← → to curve.",
  touch: "Drag your finger to move the paddle, and swipe as you meet the ball. Tap your brother's big face (bottom left) to call him.",
});
