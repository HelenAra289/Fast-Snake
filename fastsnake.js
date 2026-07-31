// Hace uso de variables para la información del tablero, mostrando la serpiente, puntuación, tiempo y colores.
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const timerEl = document.getElementById('timer');
const joystickArea = document.getElementById('joystick-area');

const startModal = document.getElementById('start-modal');
const gameoverModal = document.getElementById('gameover-modal');

// Tablero
const gridSize = 20;
let tileCountX, tileCountY;

// Estado del juego
let snake = [];
let snakeLength = 5;
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 0, y: 0, color: '#ffe600' };

let score = 0;
let foodEaten = 0;
let lives = 3;
let secondsElapsed = 0;

let gameLoopInterval = null;
let timerInterval = null;
let isMobile = false;
let isPlaying = false;

// Colores para la comida
const foodColors = ['#ffe600', '#ff007f', '#00f2fe'];

// Genera los efectos de sonido para cuando la serpiente avanzar, comer, perder y jugar de nuevo.
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Sonido de Avanzar 
function playMoveSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.04);

  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.04);
}

// Sonido de Comer
function playEatSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

// Sonido de Perder Vida
function playGameOverSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
}

function resizeCanvas() {
  const container = document.getElementById('game-container');
  const hudHeight = document.getElementById('hud').offsetHeight;
  const joystickHeight = isMobile ? joystickArea.offsetHeight : 0;

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight - hudHeight - joystickHeight;

  tileCountX = Math.floor(canvas.width / gridSize);
  tileCountY = Math.floor(canvas.height / gridSize);
}

window.addEventListener('resize', () => {
  if (isPlaying) resizeCanvas();
});

// Prepara el entorno del juego e inicia los intervalos del temporizador y el menú principal.
function startGame(device) {
  initAudio(); 
  isMobile = (device === 'mobile');
  if (isMobile) {
    joystickArea.style.display = 'flex';
  } else {
    joystickArea.style.display = 'none';
  }

  startModal.classList.add('hidden');
  gameoverModal.classList.add('hidden');

  resizeCanvas();
  initGameValues();

  window.addEventListener('keydown', handleKeyPress);
  setupMobileControls();

  isPlaying = true;
  gameLoopInterval = setInterval(gameUpdate, 100);
  timerInterval = setInterval(updateTimer, 1000);
}

function initGameValues() {
  score = 0;
  foodEaten = 0;
  lives = 3;
  secondsElapsed = 0;
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };

  updateHUD();

  const startX = Math.floor(tileCountX / 4);
  const startY = Math.floor(tileCountY / 2);
  snake = [];
  for (let i = 4; i >= 0; i--) {
    snake.push({ x: startX - i, y: startY });
  }

  spawnFood();
}

// Calcula aleatoriamente una posición en el tablero en la que no esté la serpiente y asigna un color aleatorio para la comida.
function spawnFood() {
  let valid = false;
  while (!valid) {
    food.x = Math.floor(Math.random() * tileCountX);
    food.y = Math.floor(Math.random() * tileCountY);
    
    valid = !snake.some(segment => segment.x === food.x && segment.y === food.y);
  }
  food.color = foodColors[Math.floor(Math.random() * foodColors.length)];
}

// Se encarga de mover la serpiente, comprueba los choques, comida y genera efectos de sonido.
function gameUpdate() {
  direction = { ...nextDirection };

  const head = { x: snake[snake.length - 1].x + direction.x, y: snake[snake.length - 1].y + direction.y };

  // Detecta la colisión.
  if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
    handleCollision();
    return;
  }

  // Detecta la colisión con la misma serpiente. 
  if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
    handleCollision();
    return;
  }

  snake.push(head);

  if (head.x === food.x && head.y === food.y) {
    playEatSound(); // <--- SONIDO AL COMER
    score += 10;
    foodEaten++;
    updateHUD();
    spawnFood();
  } else {
    playMoveSound(); // <--- SONIDO AL AVANZAR
    snake.shift();
  }

  draw();
}

// Reduce las vidas al colisionar, posiciona de nuevo a la serpiente o finaliza el juego si ya no quedan vidas.
function handleCollision() {
  playGameOverSound(); // <--- SONIDO AL CHOCAR / PERDER VIDA
  lives--;
  updateHUD();

  if (lives > 0) {
    const startX = Math.floor(tileCountX / 4);
    const startY = Math.floor(tileCountY / 2);
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    
    snake = [];
    for (let i = 4; i >= 0; i--) {
      snake.push({ x: startX - i, y: startY });
    }
  } else {
    endGame();
  }
}

// Muestra los elementos gráficos como la comida y la serpiente.
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Comida
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = food.color;
  ctx.fillStyle = food.color;
  ctx.beginPath();
  ctx.arc(
    food.x * gridSize + gridSize / 2,
    food.y * gridSize + gridSize / 2,
    gridSize / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // Serpiente
  snake.forEach((segment, index) => {
    const isHead = index === snake.length - 1;
    ctx.save();
    
    if (isHead) {
      ctx.fillStyle = '#ff007f';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff007f';
    } else {
      ctx.fillStyle = index % 2 === 0 ? '#00f2fe' : '#8a2be2';
    }

    ctx.beginPath();
    ctx.arc(
      segment.x * gridSize + gridSize / 2,
      segment.y * gridSize + gridSize / 2,
      gridSize / 2 - 1,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (isHead) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(
        segment.x * gridSize + gridSize / 2 + direction.x * 4,
        segment.y * gridSize + gridSize / 2 + direction.y * 4,
        3, 0, Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  });
}

// Detecta las entradas desde el teclado (flechas / WASD) y las interacciones desde celulares para el movimiento, evitando giros de 180° sobre la serpiente.
function handleKeyPress(e) {
  const key = e.key.toLowerCase();

  if ((key === 'arrowup' || key === 'w') && direction.y === 0) {
    nextDirection = { x: 0, y: -1 };
  } else if ((key === 'arrowdown' || key === 's') && direction.y === 0) {
    nextDirection = { x: 0, y: 1 };
  } else if ((key === 'arrowleft' || key === 'a') && direction.x === 0) {
    nextDirection = { x: -1, y: 0 };
  } else if ((key === 'arrowright' || key === 'd') && direction.x === 0) {
    nextDirection = { x: 1, y: 0 };
  }
}

function setupMobileControls() {
  const bindBtn = (id, dirX, dirY) => {
    const btn = document.getElementById(id);
    const trigger = (e) => {
      e.preventDefault();
      if ((dirX !== 0 && direction.x === 0) || (dirY !== 0 && direction.y === 0)) {
        nextDirection = { x: dirX, y: dirY };
      }
    };
    btn.onclick = trigger;
    btn.ontouchstart = trigger;
  };

  bindBtn('btn-up', 0, -1);
  bindBtn('btn-down', 0, 1);
  bindBtn('btn-left', -1, 0);
  bindBtn('btn-right', 1, 0);
}

// Actualiza los textos de puntuación, vidas e incrementa el contador de tiempo.
function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = '❤️'.repeat(lives);
}

function updateTimer() {
  secondsElapsed++;
  const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
  const secs = String(secondsElapsed % 60).padStart(2, '0');
  timerEl.textContent = `${mins}:${secs}`;
}

// Detiene y oculta el juego para reiniciar la partida.
function endGame() {
  isPlaying = false;
  clearInterval(gameLoopInterval);
  clearInterval(timerInterval);

  document.getElementById('final-time').textContent = timerEl.textContent;
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-food').textContent = foodEaten;

  gameoverModal.classList.remove('hidden');
}

function resetGame() {
  initAudio(); // Asegura la activación del audio al reiniciar
  gameoverModal.classList.add('hidden');
  initGameValues();
  isPlaying = true;
  gameLoopInterval = setInterval(gameUpdate, 100);
  timerInterval = setInterval(updateTimer, 1000);
}