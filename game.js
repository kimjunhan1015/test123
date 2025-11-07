'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const LEVEL_SPEEDS = [1000, 850, 700, 550, 450, 350, 275, 200, 150, 100];

const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(BLOCK_SIZE, BLOCK_SIZE);

const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(30, 30);

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');

const TETROMINOES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0],
  ],
  O: [
    [4, 4],
    [4, 4],
  ],
  S: [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  Z: [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0],
  ],
};

const COLORS = [
  null,
  '#00f5ff',
  '#4c6ef5',
  '#f59f00',
  '#ffd166',
  '#4ade80',
  '#a855f7',
  '#f87171',
];

function createMatrix(width, height) {
  const matrix = [];
  while (height--) {
    matrix.push(new Array(width).fill(0));
  }
  return matrix;
}

function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; y += 1) {
    for (let x = 0; x < m[y].length; x += 1) {
      if (
        m[y][x] !== 0 &&
        (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < y; x += 1) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach((row) => row.reverse());
  } else {
    matrix.reverse();
  }
}

function drawMatrix(matrix, offset, contextRef = context) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        contextRef.fillStyle = COLORS[value];
        contextRef.fillRect(x + offset.x, y + offset.y, 1, 1);
        contextRef.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        contextRef.lineWidth = 0.05;
        contextRef.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function drawGrid() {
  context.save();
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  context.lineWidth = 0.02;
  for (let x = 0; x <= COLS; x += 1) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, ROWS);
    context.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(COLS, y);
    context.stroke();
  }
  context.restore();
}

function draw() {
  context.fillStyle = '#060a13';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawMatrix(arena, { x: 0, y: 0 });
  if (player.matrix) {
    drawGhostPiece();
    drawMatrix(player.matrix, player.pos);
  }
}

function drawGhostPiece() {
  if (!player.matrix) return;
  const ghost = {
    matrix: player.matrix,
    pos: { x: player.pos.x, y: player.pos.y },
  };

  while (!collide(arena, ghost)) {
    ghost.pos.y += 1;
  }
  ghost.pos.y -= 1;

  context.save();
  context.globalAlpha = 0.25;
  drawMatrix(ghost.matrix, ghost.pos);
  context.restore();
}

function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = arena.length - 1; y >= 0; y -= 1) {
    for (let x = 0; x < arena[y].length; x += 1) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    y += 1;
    rowCount += 1;
  }

  if (rowCount > 0) {
    const lineScores = [0, 40, 100, 300, 1200];
    player.score += lineScores[rowCount] * player.level;
    player.lines += rowCount;
    if (player.lines / 10 >= player.level && player.level < LEVEL_SPEEDS.length) {
      player.level += 1;
    }
    updateSpeed();
    updateScore();
  }
}

function updateSpeed() {
  const nextSpeed = LEVEL_SPEEDS[player.level - 1] || LEVEL_SPEEDS[LEVEL_SPEEDS.length - 1];
  player.dropInterval = nextSpeed;
}

const arena = createMatrix(COLS, ROWS);

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  score: 0,
  level: 1,
  lines: 0,
  dropInterval: LEVEL_SPEEDS[0],
  dropBuffer: 0,
  queue: [],
};

let lastTime = 0;
let dropCounter = 0;
let paused = true;

function playerReset() {
  if (player.queue.length < 5) {
    fillQueue();
  }
  const nextType = player.queue.shift();
  player.matrix = JSON.parse(JSON.stringify(TETROMINOES[nextType]));
  player.pos.y = 0;
  player.pos.x = ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);

  if (collide(arena, player)) {
    gameOver();
  }
  updateNextPreview();
}

function fillQueue() {
  const bag = Object.keys(TETROMINOES);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  player.queue.push(...bag);
}

function playerDrop() {
  player.pos.y += 1;
  if (collide(arena, player)) {
    player.pos.y -= 1;
    merge(arena, player);
    arenaSweep();
    playerReset();
  }
  dropCounter = 0;
}

function hardDrop() {
  while (!collide(arena, player)) {
    player.pos.y += 1;
  }
  player.pos.y -= 1;
  merge(arena, player);
  arenaSweep();
  playerReset();
  dropCounter = 0;
  draw();
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function updateScore() {
  scoreEl.textContent = player.score.toLocaleString();
  levelEl.textContent = player.level.toString();
  linesEl.textContent = player.lines.toString();
}

function updateNextPreview() {
  nextContext.fillStyle = '#030712';
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (player.queue.length === 0) return;
  const nextType = player.queue[0];
  const matrix = TETROMINOES[nextType];
  const offset = {
    x: Math.floor((4 - matrix[0].length) / 2),
    y: Math.floor((4 - matrix.length) / 2),
  };
  drawMatrix(matrix, offset, nextContext);
}

function update(time = 0) {
  if (paused) {
    return;
  }
  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > player.dropInterval) {
    playerDrop();
  }
  draw();
  requestAnimationFrame(update);
}

function resetGame() {
  for (let y = 0; y < arena.length; y += 1) {
    arena[y].fill(0);
  }
  player.score = 0;
  player.level = 1;
  player.lines = 0;
  player.dropInterval = LEVEL_SPEEDS[0];
  player.queue = [];
  updateScore();
  playerReset();
}

function togglePause(force) {
  if (force === true) {
    paused = false;
  } else if (force === false) {
    paused = true;
  } else {
    paused = !paused;
  }

  if (paused) {
    overlay.classList.remove('hidden');
    overlayTitle.textContent = '일시정지';
    overlayMessage.textContent = 'P를 누르면 계속 진행합니다';
  } else {
    overlay.classList.add('hidden');
    overlayTitle.textContent = '게임 시작';
  }

  if (!paused) {
    lastTime = performance.now();
    requestAnimationFrame(update);
  }
}

function startGame() {
  resetGame();
  overlay.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  requestAnimationFrame(update);
}

function gameOver() {
  overlay.classList.remove('hidden');
  overlayTitle.textContent = '게임 오버';
  overlayMessage.textContent = `최종 점수: ${player.score.toLocaleString()}\nSpace 키로 다시 시작`;
  paused = true;
}

document.addEventListener('keydown', (event) => {
  if (paused && event.code === 'Space' && overlayTitle.textContent !== '일시정지') {
    startGame();
    return;
  }

  if (paused && overlayTitle.textContent === '일시정지' && event.code === 'KeyP') {
    togglePause();
    return;
  }

  if (paused) {
    return;
  }

  switch (event.code) {
    case 'ArrowLeft':
      playerMove(-1);
      break;
    case 'ArrowRight':
      playerMove(1);
      break;
    case 'ArrowDown':
      playerDrop();
      break;
    case 'ArrowUp':
      playerRotate(1);
      break;
    case 'Space':
      hardDrop();
      break;
    case 'KeyP':
      togglePause();
      break;
    default:
      break;
  }
  draw();
});

draw();
overlay.classList.remove('hidden');
overlayTitle.textContent = '게임 시작';
overlayMessage.textContent = 'Space 키를 눌러 시작하세요';

