const { useState, useEffect, useMemo, useCallback, useRef } = React;
const h = React.createElement;

const MINE = -1;
const BEST_TIMES_KEY = 'minesweeper_best_times_v3';
const STREAK_KEY = 'minesweeper_streak_v2';

const DIFFICULTY_PRESETS = {
  rookie: {
    label: 'Новичок',
    rows: 9,
    cols: 9,
    mines: 10,
    hint: 'Классический комфортный темп',
  },
  tactical: {
    label: 'Тактик',
    rows: 12,
    cols: 12,
    mines: 26,
    hint: 'Больше пространства и плотнее риск',
  },
  elite: {
    label: 'Элита',
    rows: 16,
    cols: 16,
    mines: 52,
    hint: 'Максимальная концентрация',
  },
};

function createEmptyGrid(rows, cols, fillValue) {
  return Array.from({ length: rows }, function () {
    return Array(cols).fill(fillValue);
  });
}

function getNeighbors(row, col, rows, cols) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push({ row: nr, col: nc });
      }
    }
  }
  return neighbors;
}

function buildSafeZone(safeRow, safeCol, rows, cols) {
  const zone = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeRow + dr;
      const nc = safeCol + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        zone.add(nr + ',' + nc);
      }
    }
  }
  return zone;
}

function generateBoard(safeRow, safeCol, config) {
  const rows = config.rows;
  const cols = config.cols;
  const totalMines = config.mines;

  const grid = createEmptyGrid(rows, cols, 0);
  const safeZone = buildSafeZone(safeRow, safeCol, rows, cols);
  const mines = [];

  while (mines.length < totalMines) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);
    const key = row + ',' + col;
    if (grid[row][col] === MINE || safeZone.has(key)) continue;

    grid[row][col] = MINE;
    mines.push({ row: row, col: col });
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] === MINE) continue;

      let count = 0;
      const neighbors = getNeighbors(row, col, rows, cols);
      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        if (grid[n.row][n.col] === MINE) {
          count += 1;
        }
      }
      grid[row][col] = count;
    }
  }

  return { grid: grid, mines: mines };
}

function floodReveal(grid, revealedGrid, flaggedGrid, startRow, startCol, rows, cols) {
  const next = revealedGrid.map(function (line) { return line.slice(); });
  const stack = [{ row: startRow, col: startCol }];

  while (stack.length > 0) {
    const current = stack.pop();
    const row = current.row;
    const col = current.col;

    if (next[row][col] || flaggedGrid[row][col]) continue;

    next[row][col] = true;

    if (grid[row][col] !== 0) continue;

    const neighbors = getNeighbors(row, col, rows, cols);
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (!next[neighbor.row][neighbor.col] && !flaggedGrid[neighbor.row][neighbor.col]) {
        stack.push(neighbor);
      }
    }
  }

  return next;
}

function countRevealed(revealedGrid, rows, cols) {
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (revealedGrid[row][col]) count += 1;
    }
  }
  return count;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function getBoardCellSize(rows, cols) {
  const maxSide = Math.max(rows, cols);
  if (maxSide >= 16) return 30;
  if (maxSide >= 12) return 35;
  return 42;
}

function readBestTimes() {
  try {
    const raw = localStorage.getItem(BEST_TIMES_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const safe = {};
    const keys = Object.keys(DIFFICULTY_PRESETS);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = parsed[key];
      if (Number.isFinite(value) && value > 0) {
        safe[key] = value;
      }
    }

    return safe;
  } catch (error) {
    return {};
  }
}

function persistBestTimes(next) {
  try {
    localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(next));
  } catch (error) {
    // storage can be unavailable in private mode
  }
}

function readStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch (error) {
    return 0;
  }
}

function persistStreak(next) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch (error) {
    // storage can be unavailable in private mode
  }
}

function WinBurst({ seed }) {
  const particles = useMemo(function () {
    if (!seed) return [];

    return Array.from({ length: 44 }, function (_, index) {
      const angle = Math.floor((360 / 44) * index + Math.random() * 6);
      const distance = 110 + Math.floor(Math.random() * 140);
      const delay = Math.floor(Math.random() * 130);
      const hue = 170 + Math.floor(Math.random() * 58);
      return {
        id: seed + '-' + index,
        angle: angle + 'deg',
        distance: distance + 'px',
        delay: delay + 'ms',
        hue: hue,
      };
    });
  }, [seed]);

  if (!seed || particles.length === 0) {
    return null;
  }

  return h(
    'div',
    { className: 'win-burst', 'aria-hidden': true },
    particles.map(function (particle) {
      return h('span', {
        key: particle.id,
        className: 'burst-particle',
        style: {
          '--angle': particle.angle,
          '--distance': particle.distance,
          '--delay': particle.delay,
          '--hue': particle.hue,
        },
      });
    })
  );
}

function GameOverlay({ isWin, timeElapsed, difficultyLabel, bestTime, onRestart }) {
  const title = isWin ? 'Победа' : 'Поражение';
  const subtitle = isWin
    ? (bestTime === timeElapsed ? 'Новый рекорд на уровне ' + difficultyLabel : 'Чистая партия. Отличная работа.')
    : 'Мины раскрыты. Перезапусти и собери поле заново.';

  return h(
    'div',
    { className: 'game-overlay' },
    h(
      'div',
      { className: 'overlay-card' },
      h('div', { className: 'overlay-icon', 'aria-hidden': true }, isWin ? '✦' : '✹'),
      h('h2', { className: 'overlay-title ' + (isWin ? 'win' : 'lose') }, title),
      h('p', { className: 'overlay-subtitle' }, subtitle),
      h(
        'div',
        { className: 'overlay-stats' },
        h('div', { className: 'overlay-stat' },
          h('span', null, 'Время'),
          h('strong', null, formatTime(timeElapsed))
        ),
        h('div', { className: 'overlay-stat' },
          h('span', null, 'Рекорд'),
          h('strong', null, bestTime ? formatTime(bestTime) : '—')
        )
      ),
      h('button', { className: 'overlay-button', onClick: onRestart, type: 'button' }, 'Новая партия')
    )
  );
}

function Cell({
  value,
  isRevealed,
  isFlagged,
  isMine,
  isMineSource,
  revealDelay,
  onClick,
  onContextMenu,
}) {
  let className = 'cell';
  let content = null;

  if (isMineSource) {
    className += ' cell-mine-source';
    content = '✹';
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

  let ariaLabel = 'Скрытая клетка';
  if (isFlagged) ariaLabel = 'Флажок';
  if (isMine) ariaLabel = 'Мина';
  if (isRevealed && value === 0) ariaLabel = 'Пустая клетка';
  if (isRevealed && value > 0) ariaLabel = 'Рядом мин: ' + value;

  return h(
    'button',
    {
      type: 'button',
      className: className,
      style: { '--reveal-delay': revealDelay + 'ms' },
      onClick: onClick,
      onContextMenu: onContextMenu,
      'aria-label': ariaLabel,
    },
    content
  );
}

function App() {
  const defaultDifficulty = 'rookie';

  const [difficulty, setDifficulty] = useState(defaultDifficulty);
  const [grid, setGrid] = useState(function () {
    const preset = DIFFICULTY_PRESETS[defaultDifficulty];
    return createEmptyGrid(preset.rows, preset.cols, 0);
  });
  const [revealed, setRevealed] = useState(function () {
    const preset = DIFFICULTY_PRESETS[defaultDifficulty];
    return createEmptyGrid(preset.rows, preset.cols, false);
  });
  const [flagged, setFlagged] = useState(function () {
    const preset = DIFFICULTY_PRESETS[defaultDifficulty];
    return createEmptyGrid(preset.rows, preset.cols, false);
  });
  const [minePositions, setMinePositions] = useState([]);
  const [gamePhase, setGamePhase] = useState('waiting');
  const [clickedMine, setClickedMine] = useState(null);
  const [revealOrigin, setRevealOrigin] = useState(null);
  const [timer, setTimer] = useState(0);
  const [flagCount, setFlagCount] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [inputMode, setInputMode] = useState('reveal');
  const [bestTimes, setBestTimes] = useState(readBestTimes);
  const [streak, setStreak] = useState(readStreak);
  const [burstSeed, setBurstSeed] = useState(0);

  const timerRef = useRef(null);
  const timerValueRef = useRef(0);

  const gridRef = useRef(grid);
  const revealedRef = useRef(revealed);
  const flaggedRef = useRef(flagged);
  const minePositionsRef = useRef(minePositions);
  const gamePhaseRef = useRef(gamePhase);
  const difficultyRef = useRef(difficulty);
  const inputModeRef = useRef(inputMode);
  const configRef = useRef(DIFFICULTY_PRESETS[difficulty]);
  const streakRef = useRef(streak);

  gridRef.current = grid;
  revealedRef.current = revealed;
  flaggedRef.current = flagged;
  minePositionsRef.current = minePositions;
  gamePhaseRef.current = gamePhase;
  difficultyRef.current = difficulty;
  inputModeRef.current = inputMode;
  configRef.current = DIFFICULTY_PRESETS[difficulty];
  streakRef.current = streak;

  const config = DIFFICULTY_PRESETS[difficulty];
  const safeCells = config.rows * config.cols - config.mines;

  const stopTimer = useCallback(function () {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(function () {
    stopTimer();
    timerRef.current = setInterval(function () {
      setTimer(function (prev) {
        const next = prev + 1;
        timerValueRef.current = next;
        return next;
      });
    }, 1000);
  }, [stopTimer]);

  const resetForConfig = useCallback(function (preset) {
    stopTimer();
    timerValueRef.current = 0;

    setGrid(createEmptyGrid(preset.rows, preset.cols, 0));
    setRevealed(createEmptyGrid(preset.rows, preset.cols, false));
    setFlagged(createEmptyGrid(preset.rows, preset.cols, false));
    setMinePositions([]);
    setGamePhase('waiting');
    setClickedMine(null);
    setRevealOrigin(null);
    setTimer(0);
    setFlagCount(0);
    setRevealedCount(0);
    setBurstSeed(0);
  }, [stopTimer]);

  const resetGame = useCallback(function () {
    resetForConfig(configRef.current);
  }, [resetForConfig]);

  const handleDifficultyChange = useCallback(function (nextDifficulty) {
    const nextPreset = DIFFICULTY_PRESETS[nextDifficulty];
    if (!nextPreset || nextDifficulty === difficultyRef.current) return;

    difficultyRef.current = nextDifficulty;
    configRef.current = nextPreset;
    setDifficulty(nextDifficulty);
    setInputMode('reveal');
    resetForConfig(nextPreset);
  }, [resetForConfig]);

  const saveStreak = useCallback(function (nextStreak) {
    setStreak(nextStreak);
    persistStreak(nextStreak);
  }, []);

  const saveBestTime = useCallback(function (modeKey, elapsedSeconds) {
    setBestTimes(function (prev) {
      const current = prev[modeKey];
      if (current && current <= elapsedSeconds) {
        return prev;
      }
      const next = Object.assign({}, prev, { [modeKey]: elapsedSeconds });
      persistBestTimes(next);
      return next;
    });
  }, []);

  const toggleFlagAt = useCallback(function (row, col) {
    if (gamePhaseRef.current === 'won' || gamePhaseRef.current === 'lost') return;
    if (revealedRef.current[row][col]) return;

    setFlagged(function (prev) {
      const next = prev.map(function (line) { return line.slice(); });
      const nextValue = !next[row][col];
      next[row][col] = nextValue;
      setFlagCount(function (count) {
        return count + (nextValue ? 1 : -1);
      });
      return next;
    });
  }, []);

  const finishWithLoss = useCallback(function (row, col, mines) {
    stopTimer();
    setTimer(timerValueRef.current);
    setClickedMine({ row: row, col: col });
    setGamePhase('lost');
    saveStreak(0);

    const nextRevealed = revealedRef.current.map(function (line) { return line.slice(); });
    for (let i = 0; i < mines.length; i++) {
      const mine = mines[i];
      nextRevealed[mine.row][mine.col] = true;
    }

    setRevealed(nextRevealed);
    setRevealedCount(countRevealed(revealedRef.current, configRef.current.rows, configRef.current.cols));
  }, [saveStreak, stopTimer]);

  const finishWithWin = useCallback(function (modeKey, openedCells) {
    stopTimer();
    setGamePhase('won');
    setBurstSeed(Date.now());
    setRevealedCount(openedCells);

    const elapsed = timerValueRef.current;
    setTimer(elapsed);
    saveStreak(streakRef.current + 1);
    saveBestTime(modeKey, elapsed);
  }, [saveBestTime, saveStreak, stopTimer]);

  const handleCellClick = useCallback(function (row, col) {
    const phase = gamePhaseRef.current;
    if (phase === 'won' || phase === 'lost') return;

    if (inputModeRef.current === 'flag') {
      toggleFlagAt(row, col);
      return;
    }

    if (flaggedRef.current[row][col]) return;
    if (revealedRef.current[row][col]) return;

    let currentGrid = gridRef.current;
    let currentMines = minePositionsRef.current;
    const activeConfig = configRef.current;

    if (phase === 'waiting') {
      const generated = generateBoard(row, col, activeConfig);
      currentGrid = generated.grid;
      currentMines = generated.mines;

      setGrid(currentGrid);
      setMinePositions(currentMines);
      setGamePhase('playing');
      startTimer();
    }

    if (currentGrid[row][col] === MINE) {
      finishWithLoss(row, col, currentMines);
      return;
    }

    setRevealOrigin({ row: row, col: col });

    const nextRevealed = floodReveal(
      currentGrid,
      revealedRef.current,
      flaggedRef.current,
      row,
      col,
      activeConfig.rows,
      activeConfig.cols
    );

    const openedSafeCells = countRevealed(nextRevealed, activeConfig.rows, activeConfig.cols);

    setRevealed(nextRevealed);
    setRevealedCount(openedSafeCells);

    if (openedSafeCells === activeConfig.rows * activeConfig.cols - activeConfig.mines) {
      finishWithWin(difficultyRef.current, openedSafeCells);
    }
  }, [finishWithLoss, finishWithWin, startTimer, toggleFlagAt]);

  const handleCellRightClick = useCallback(function (event, row, col) {
    event.preventDefault();
    toggleFlagAt(row, col);
  }, [toggleFlagAt]);

  useEffect(function () {
    function onKeyDown(event) {
      const tagName = event.target && event.target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return;
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        resetGame();
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        setInputMode(function (prev) {
          return prev === 'reveal' ? 'flag' : 'reveal';
        });
      }

      if (event.key === '1') handleDifficultyChange('rookie');
      if (event.key === '2') handleDifficultyChange('tactical');
      if (event.key === '3') handleDifficultyChange('elite');
    }

    window.addEventListener('keydown', onKeyDown);
    return function () {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleDifficultyChange, resetGame]);

  useEffect(function () {
    return function () {
      stopTimer();
    };
  }, [stopTimer]);

  const isGameOver = gamePhase === 'won' || gamePhase === 'lost';
  const minesLeft = config.mines - flagCount;
  const progressPercent = Math.max(0, Math.min(100, Math.round((revealedCount / safeCells) * 100)));
  const bestCurrent = bestTimes[difficulty] || null;

  let statusText = 'Первая клетка всегда безопасна. Действуй точно.';
  if (gamePhase === 'playing') statusText = 'Поле активно. Читай паттерны и держи темп.';
  if (gamePhase === 'won') statusText = 'Поле очищено. Прессинг выдержан идеально.';
  if (gamePhase === 'lost') statusText = 'Срыв на мине. Пересобери стратегию и зайди снова.';

  const boardStyle = {
    '--board-cols': String(config.cols),
    '--cell-size-max': getBoardCellSize(config.rows, config.cols) + 'px',
  };

  const cells = [];

  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const isMineCell = grid[row][col] === MINE && revealed[row][col];
      const isSource = clickedMine && clickedMine.row === row && clickedMine.col === col;

      let delay = 0;
      if (isMineCell && clickedMine) {
        const blastDist = Math.abs(row - clickedMine.row) + Math.abs(col - clickedMine.col);
        delay = blastDist * 48;
      } else if (revealed[row][col] && grid[row][col] !== MINE && revealOrigin) {
        const waveDist = Math.abs(row - revealOrigin.row) + Math.abs(col - revealOrigin.col);
        delay = waveDist * 24;
      }

      (function (r, c, mine, source, revealDelay) {
        cells.push(
          h(Cell, {
            key: r + '-' + c,
            value: grid[r][c],
            isRevealed: revealed[r][c] && grid[r][c] !== MINE,
            isFlagged: flagged[r][c] && !revealed[r][c],
            isMine: mine && !source,
            isMineSource: source,
            revealDelay: revealDelay,
            onClick: function () { handleCellClick(r, c); },
            onContextMenu: function (event) { handleCellRightClick(event, r, c); },
          })
        );
      })(row, col, isMineCell, isSource, delay);
    }
  }

  return h(
    React.Fragment,
    null,
    h(
      'main',
      { className: 'app-shell' },
      h(
        'section',
        { className: 'app' },
        h(
          'header',
          { className: 'hero' },
          h(
            'div',
            { className: 'brand' },
            h('div', { className: 'eyebrow' }, 'TACTICAL MINESWEEPER'),
            h('h1', { className: 'title' }, 'Сапёр'),
            h('p', { className: 'subtitle' }, DIFFICULTY_PRESETS[difficulty].hint)
          ),
          h('div', { className: 'meta-pill' }, config.rows + '×' + config.cols + ' • ' + config.mines + ' мин')
        ),

        h(
          'div',
          { className: 'difficulty-switch' },
          Object.keys(DIFFICULTY_PRESETS).map(function (key) {
            const preset = DIFFICULTY_PRESETS[key];
            return h(
              'button',
              {
                key: key,
                type: 'button',
                className: 'difficulty-btn' + (difficulty === key ? ' active' : ''),
                onClick: function () { handleDifficultyChange(key); },
              },
              preset.label
            );
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'mode-toggle' + (inputMode === 'flag' ? ' active' : ''),
              onClick: function () {
                setInputMode(function (prev) {
                  return prev === 'reveal' ? 'flag' : 'reveal';
                });
              },
            },
            inputMode === 'reveal' ? 'Режим: Открытие' : 'Режим: Флажки'
          ),
          h('button', { type: 'button', className: 'restart-button', onClick: resetGame }, 'Перезапуск')
        ),

        h(
          'div',
          { className: 'control-grid' },
          h(
            'div',
            { className: 'stat-card' },
            h('span', { className: 'stat-label' }, 'Мин осталось'),
            h('strong', { className: 'stat-value' }, String(minesLeft).padStart(2, '0'))
          ),
          h(
            'div',
            { className: 'stat-card' },
            h('span', { className: 'stat-label' }, 'Таймер'),
            h('strong', { className: 'stat-value' }, formatTime(timer))
          ),
          h(
            'div',
            { className: 'stat-card' },
            h('span', { className: 'stat-label' }, 'Серия побед'),
            h('strong', { className: 'stat-value' }, streak)
          ),
          h(
            'div',
            { className: 'stat-card' },
            h('span', { className: 'stat-label' }, 'Рекорд'),
            h('strong', { className: 'stat-value' }, bestCurrent ? formatTime(bestCurrent) : '—')
          )
        ),

        h('p', { className: 'status-line status-' + gamePhase }, statusText),

        h(
          'div',
          { className: 'progress-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progressPercent },
          h('div', { className: 'progress-fill', style: { width: progressPercent + '%' } })
        ),

        h(
          'div',
          { className: 'board-shell' },
          h(WinBurst, { seed: burstSeed }),
          h(
            'div',
            { className: 'board', style: boardStyle },
            cells
          )
        ),

        h('p', { className: 'hint-line' }, 'ЛКМ: открыть • ПКМ: флажок • F: переключить режим • R: рестарт • 1/2/3: уровень')
      )
    ),

    isGameOver
      ? h(GameOverlay, {
          isWin: gamePhase === 'won',
          timeElapsed: timer,
          difficultyLabel: DIFFICULTY_PRESETS[difficulty].label,
          bestTime: bestCurrent,
          onRestart: resetGame,
        })
      : null
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
