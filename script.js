const { useState, useEffect, useCallback, useRef } = React;
const h = React.createElement;

/* ============================================
   Game constants
   ============================================ */

const ROWS = 9;
const COLS = 9;
const TOTAL_MINES = 10;
const MINE = -1;

/* ============================================
   Pure game logic
   ============================================ */

function createEmptyGrid(rows, cols, fillValue) {
  return Array.from({ length: rows }, () => Array(cols).fill(fillValue));
}

function getNeighbors(row, col) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        neighbors.push({ row: nr, col: nc });
      }
    }
  }
  return neighbors;
}

function buildSafeZone(safeRow, safeCol) {
  const zone = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      zone.add(`${safeRow + dr},${safeCol + dc}`);
    }
  }
  return zone;
}

function generateBoard(safeRow, safeCol) {
  const grid = createEmptyGrid(ROWS, COLS, 0);
  const safeZone = buildSafeZone(safeRow, safeCol);
  const mines = [];

  let placed = 0;
  while (placed < TOTAL_MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (grid[r][c] === MINE || safeZone.has(`${r},${c}`)) continue;
    grid[r][c] = MINE;
    mines.push({ row: r, col: c });
    placed++;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === MINE) continue;
      let count = 0;
      for (const { row: nr, col: nc } of getNeighbors(r, c)) {
        if (grid[nr][nc] === MINE) count++;
      }
      grid[r][c] = count;
    }
  }

  return { grid, mines };
}

function floodReveal(grid, revealedGrid, startRow, startCol) {
  const next = revealedGrid.map((r) => [...r]);
  const stack = [{ row: startRow, col: startCol }];

  while (stack.length > 0) {
    const { row, col } = stack.pop();
    if (next[row][col]) continue;
    next[row][col] = true;

    if (grid[row][col] === 0) {
      for (const neighbor of getNeighbors(row, col)) {
        if (!next[neighbor.row][neighbor.col]) {
          stack.push(neighbor);
        }
      }
    }
  }

  return next;
}

function countRevealed(revealedGrid) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (revealedGrid[r][c]) count++;
    }
  }
  return count;
}

/* ============================================
   Game over overlay
   ============================================ */

function GameOverlay({ isWin, timeElapsed, onRestart }) {
  return h('div', { className: 'game-overlay' },
    h('div', { className: 'overlay-card' },
      h('div', { className: 'overlay-icon' }, isWin ? '🏆' : '💥'),
      h('div', { className: 'overlay-title ' + (isWin ? 'win' : 'lose') },
        isWin ? 'Победа!' : 'Проигрыш!'
      ),
      h('div', { className: 'overlay-subtitle' },
        isWin ? 'Время: ' + timeElapsed + ' сек.' : 'Попробуй ещё раз'
      ),
      h('button', { className: 'overlay-button', onClick: onRestart }, 'Играть снова')
    )
  );
}

/* ============================================
   Cell component
   ============================================ */

function Cell({ value, isRevealed, isFlagged, isMine, isMineSource, onClick, onContextMenu, revealDelay }) {
  let className = 'cell';
  let content = null;

  if (isMineSource) {
    className += ' cell-mine-source';
    content = '✦';
  } else if (isMine) {
    className += ' cell-mine';
    content = '✦';
  } else if (isFlagged) {
    className += ' cell-flagged';
    content = '⚑';
  } else if (isRevealed) {
    className += ' cell-revealed';
    if (value > 0) {
      className += ' count-' + value;
      content = value;
    }
  } else {
    className += ' cell-hidden';
  }

  const style = {};
  if ((isRevealed || isMine) && revealDelay > 0) {
    style.animationDelay = revealDelay + 'ms';
  }

  return h('div', { className: className, style: style, onClick: onClick, onContextMenu: onContextMenu }, content);
}

/* ============================================
   Main App
   ============================================ */

function App() {
  const [grid, setGrid] = useState(function () { return createEmptyGrid(ROWS, COLS, 0); });
  const [revealed, setRevealed] = useState(function () { return createEmptyGrid(ROWS, COLS, false); });
  const [flagged, setFlagged] = useState(function () { return createEmptyGrid(ROWS, COLS, false); });
  const [minePositions, setMinePositions] = useState([]);
  const [gamePhase, setGamePhase] = useState('waiting');
  const [clickedMine, setClickedMine] = useState(null);
  const [revealOrigin, setRevealOrigin] = useState(null);
  const [timer, setTimer] = useState(0);
  const [flagCount, setFlagCount] = useState(0);
  const timerRef = useRef(null);

  var gridRef = useRef(grid);
  var minePositionsRef = useRef(minePositions);
  var gamePhaseRef = useRef(gamePhase);
  var revealedRef = useRef(revealed);
  var flaggedRef = useRef(flagged);

  gridRef.current = grid;
  minePositionsRef.current = minePositions;
  gamePhaseRef.current = gamePhase;
  revealedRef.current = revealed;
  flaggedRef.current = flagged;

  var stopTimer = useCallback(function () {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  var startTimer = useCallback(function () {
    stopTimer();
    timerRef.current = setInterval(function () {
      setTimer(function (prev) { return prev + 1; });
    }, 1000);
  }, [stopTimer]);

  var resetGame = useCallback(function () {
    stopTimer();
    setGrid(createEmptyGrid(ROWS, COLS, 0));
    setRevealed(createEmptyGrid(ROWS, COLS, false));
    setFlagged(createEmptyGrid(ROWS, COLS, false));
    setMinePositions([]);
    setGamePhase('waiting');
    setClickedMine(null);
    setRevealOrigin(null);
    setTimer(0);
    setFlagCount(0);
  }, [stopTimer]);

  useEffect(function () {
    return function () { stopTimer(); };
  }, [stopTimer]);

  var handleCellClick = useCallback(function (row, col) {
    var phase = gamePhaseRef.current;
    if (phase === 'won' || phase === 'lost') return;
    if (flaggedRef.current[row][col]) return;
    if (revealedRef.current[row][col]) return;

    var currentGrid = gridRef.current;
    var currentMines = minePositionsRef.current;

    if (phase === 'waiting') {
      var result = generateBoard(row, col);
      currentGrid = result.grid;
      currentMines = result.mines;
      setGrid(result.grid);
      setMinePositions(result.mines);
      startTimer();
      setGamePhase('playing');
    }

    if (currentGrid[row][col] === MINE) {
      stopTimer();
      setClickedMine({ row: row, col: col });
      setGamePhase('lost');
      var lostRevealed = revealedRef.current.map(function (r) { return r.slice(); });
      for (var i = 0; i < currentMines.length; i++) {
        lostRevealed[currentMines[i].row][currentMines[i].col] = true;
      }
      setRevealed(lostRevealed);
      return;
    }

    setRevealOrigin({ row: row, col: col });
    var nextRevealed = floodReveal(currentGrid, revealedRef.current, row, col);
    setRevealed(nextRevealed);

    if (countRevealed(nextRevealed) === ROWS * COLS - TOTAL_MINES) {
      stopTimer();
      setGamePhase('won');
    }
  }, [startTimer, stopTimer]);

  var handleCellRightClick = useCallback(function (event, row, col) {
    event.preventDefault();
    if (gamePhaseRef.current !== 'playing') return;
    if (revealedRef.current[row][col]) return;

    setFlagged(function (prev) {
      var next = prev.map(function (r) { return r.slice(); });
      next[row][col] = !next[row][col];
      setFlagCount(function (c) { return c + (next[row][col] ? 1 : -1); });
      return next;
    });
  }, []);

  var isGameOver = gamePhase === 'won' || gamePhase === 'lost';

  /* Build cells */
  var cells = [];
  for (var row = 0; row < ROWS; row++) {
    for (var col = 0; col < COLS; col++) {
      var isMineCell = grid[row][col] === MINE && revealed[row][col];
      var isSource = clickedMine && clickedMine.row === row && clickedMine.col === col;

      var delay = 0;
      if (isMineCell && clickedMine) {
        var dist = Math.abs(row - clickedMine.row) + Math.abs(col - clickedMine.col);
        delay = dist * 50;
      } else if (revealed[row][col] && grid[row][col] !== MINE && revealOrigin) {
        var dist = Math.abs(row - revealOrigin.row) + Math.abs(col - revealOrigin.col);
        delay = dist * 30;
      }

      (function (r, c, mine, source, d) {
        cells.push(
          h(Cell, {
            key: r + '-' + c,
            value: grid[r][c],
            isRevealed: revealed[r][c] && grid[r][c] !== MINE,
            isFlagged: flagged[r][c] && !revealed[r][c],
            isMine: mine && !source,
            isMineSource: source,
            revealDelay: d,
            onClick: function () { handleCellClick(r, c); },
            onContextMenu: function (e) { handleCellRightClick(e, r, c); },
          })
        );
      })(row, col, isMineCell, isSource, delay);
    }
  }

  return h(React.Fragment, null,
    h('div', { className: 'app' },
      h('div', { className: 'title' }, 'САПЁР'),

      h('div', { className: 'panel' },
        h('div', { className: 'stat' },
          h('div', { className: 'stat-icon' }, '✦'),
          h('div', { className: 'stat-value' }, TOTAL_MINES - flagCount)
        ),
        h('div', { className: 'divider' }),
        h('button', { className: 'restart-button', onClick: resetGame }, 'Заново'),
        h('div', { className: 'divider' }),
        h('div', { className: 'stat' },
          h('div', { className: 'stat-icon' }, '◷'),
          h('div', { className: 'stat-value' }, timer)
        )
      ),

      h('div', {
        className: 'board',
        style: { gridTemplateColumns: 'repeat(' + COLS + ', var(--cell-size))' },
      }, cells)
    ),

    isGameOver ? h(GameOverlay, {
      isWin: gamePhase === 'won',
      timeElapsed: timer,
      onRestart: resetGame,
    }) : null
  );
}

/* ============================================
   Mount
   ============================================ */

var root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
