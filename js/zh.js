/* 中文 for TT Table Tennis: the words on the page, the calls and toasts, the canvas words and the ? panel
   (Kit.lang, from kit/lang.js). Stays in English on purpose: the kids' names and the roster names (TEDDY, TOMMY,
   ZOOM, LUNA, BOLT, BRUNO), and the game's name and logo (TT, TABLE TENNIS: the pun on Teddy & Tommy). */
(function () {
  const L = Kit.lang;
  const nm = (n) => L.t(n); // a name in a sentence (ZOMBIE becomes 僵尸; the kids keep theirs)
  L.keep([
    'TEDDY', 'TOMMY', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Teddy', 'Tommy', 'Bolt',
    'TT', 'TABLE TENNIS', 'TT: Table Tennis', 'TT Table Tennis', 'Esc',
  ]);

  L.add({
    // title screen
    '🏓 1 PLAYER': '🏓 单人', 'you vs the computer': '你和电脑比赛',
    '👫 2 PLAYERS': '👫 双人', 'one keyboard, side view': '一个键盘，侧面看',
    '🤖 RALLY CHALLENGE': '🤖 对打挑战', 'keep it going vs Bolt': '和 Bolt 一直打下去',
    'LEVEL': '难度', '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', '🏆 PRO': '🏆 高手',
    'MATCH': '比赛', '1 GAME': '1 局', 'BEST OF 3': '三局两胜', 'BEST OF 5': '五局三胜',
    'sound': '声音',
    // the player picker
    "WHO'S PLAYING?": '谁来打？', 'PICK YOUR PLAYERS!': '选选手！', 'RALLY CHALLENGE': '对打挑战',
    'YOU': '你', 'VS': '对手', 'VS (COMPUTER)': '对手（电脑）', 'PLAYER 1 · A D + F': '玩家 1 · A D + F', 'PLAYER 2 · ← → + L': '玩家 2 · ← → + L',
    'ZOMBIE': '僵尸', 'plays alone': '一个人打', '◀ BACK': '◀ 返回', 'PLAY! ▶': '开始！▶',
    'Keep the ball going against Bolt the wall robot. He never misses, and he gets faster every hit. How many can you do?':
      '和墙壁机器人 Bolt 一直对打。他从不失误，每打一下都更快。你能打几个？',
    'Side view. P1: W A S D move, F swing, T calls your brother. P2: arrows move, L swing, Enter calls. Hold toward the net for topspin, away for backspin. On a touch screen, tap your half to swing.':
      '侧面看。玩家 1：W A S D 移动，F 挥拍，T 叫兄弟来帮忙。玩家 2：方向键移动，L 挥拍，回车叫兄弟。挥拍时朝网按住是上旋球，往后按住是下旋球。触屏上点你那一半屏幕就挥拍。',
    "First to 11 (win by 2). Serves change every 2 points. Tap your brother's face, or press T, to call him in for 10 seconds of doubles!":
      '先得 11 分赢（要多 2 分）。每 2 分换人发球。点兄弟的头像或按 T，叫兄弟来帮忙，一起打 10 秒双打！',
    // the HUD
    'CPU': '电脑', 'WALL': '墙', 'PRO': '高手', 'TO 11': '11 分制', 'ENTER': '回车', 'RALLY': '对打',
    'TAP TO SERVE!': '点一下发球！', 'CLICK OR SPACE TO SERVE!': '点鼠标或按空格发球！',
    'PUT YOUR PADDLE IN THE RING!': '把球拍放进圆圈里！',
    // calls
    'DEUCE!': '平分！', 'GAME POINT!': '局点！', 'MATCH POINT!': '赛点！', 'NEW BEST!': '新纪录！',
    'ACE!': '发球得分！', 'SMASH!': '扣杀！', 'TWO BOUNCES': '弹了两下', 'MISSED': '没接到', 'NET': '下网',
    'OUT': '出界', 'FAULT': '发球失误', 'TIME': '超时',
    'TOPSPIN!': '上旋球！', 'BACKSPIN!': '下旋球！', 'CURVE!': '拐弯球！', 'LUCKY NET!': '擦网，好运！',
    // pause and results
    'P1: W A S D + F, T calls · P2: arrows + L, Enter calls · P pauses · M sound':
      '玩家 1：W A S D + F，T 叫兄弟 · 玩家 2：方向键 + L，回车叫兄弟 · P 暂停 · M 声音',
    'Mouse or finger moves the paddle · swipe up = topspin, down = backspin, sideways = curve · T calls your brother · P pauses · M sound':
      '鼠标或手指移动球拍 · 向上滑 = 上旋球，向下滑 = 下旋球，横着滑 = 拐弯球 · T 叫兄弟来帮忙 · P 暂停 · M 声音',
    'Great match! Try a harder level next?': '打得真好！下次试试更难的？',
    'So close! Call your brother in and try again!': '差一点点！叫兄弟来帮忙，再试一次！',
    // canvas words: the comic bursts and the barrier board
    'POW!': '砰！', 'WHAM!': '啪！', 'KAPOW!': '嘭！', 'SAVED!': '救到啦！', 'PING ★ PONG': '乒 ★ 乓',
    // the ? panel (js/keys.js)
    'Player 2 (2 players)': '玩家 2（双人）', 'swing · serve': '挥拍 · 发球',
    '1 player: the mouse or A D / ← → move the paddle. Space or F just before the ball arrives is a power drive; hold ↑ for topspin, ↓ for backspin, ← → to curve.':
      '单人：用鼠标或 A D / ← → 移动球拍。球快到时按空格或 F 是大力抽球；按住 ↑ 打上旋球，↓ 打下旋球，← → 打拐弯球。',
    "Drag your finger to move the paddle, and swipe as you meet the ball. Tap your brother's big face (bottom left) to call him.":
      '用手指拖动球拍，碰到球时滑一下。点左下角兄弟的大头像，叫他来帮忙。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', 'A COOKIE': '饼干', WATERMELON: '西瓜', 'A BANANA': '香蕉' };
  L.rule(/^GAME (\d+)$/, '第 $1 局');
  L.rule(/^🤖 (EASY|NORMAL|PRO)$/, (m, l) => `🤖 ${L.t(l)}`);
  L.rule(/^POINT (.+)!$/, (m, n) => `${nm(n)} 得分！`);
  L.rule(/^GAME (.+)!$/, (m, n) => `${nm(n)} 赢了这一局！`);
  L.rule(/^(.+) WINS!$/, (m, n) => `${nm(n)} 赢啦！`);
  L.rule(/^(.+) SAVED IT!$/, (m, n) => `${nm(n)} 救到球啦！`);
  L.rule(/^(.+): PRESS ([FL]) TO SERVE$/, (m, n, k) => `${nm(n)}：按 ${k} 发球`);
  L.rule(/^RALLY: (\d+)!$/, '对打：$1 个！');
  L.rule(/^BEST (\d+)$/, '最高 $1');
  L.rule(/^(\d+) IN A ROW!$/, '连打 $1 个！');
  L.rule(/^\+ BUDDY: (.+)$/, (m, n) => `+ 帮手：${nm(n)}`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE|A COOKIE|WATERMELON|A BANANA) FROM (.+)!$/, (m, e, item, who) => `${e} ${nm(who)} 送来的${TREAT[item]}！`);
  L.rule(/^Longest rally (\d+) · smashes (\d+) · brother saves (\d+) · treats (\d+)$/, '最长对打 $1 · 扣杀 $2 · 兄弟救球 $3 · 零食 $4');
  L.rule(/^Well played, (.+) and (.+)!$/, (m, a, b) => `${nm(a)} 和 ${nm(b)}，打得真棒！`);
})();
