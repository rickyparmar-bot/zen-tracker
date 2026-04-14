const timerDisplay = document.getElementById("timer");
const timerLabel = document.getElementById("timerLabel");
const startPauseBtn = document.getElementById("startPauseBtn");
const timerMinutesInput = document.getElementById("timerMinutesInput");
const applyTimerBtn = document.getElementById("applyTimerBtn");
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
const browserNotificationToggle = document.getElementById("browserNotificationToggle");
const notificationPermissionHint = document.getElementById("notificationPermissionHint");
const lofiMusicToggle = document.getElementById("lofiMusicToggle");
const lofiMusicHint = document.getElementById("lofiMusicHint");
const ambientSoundSelect = document.getElementById("ambientSoundSelect");
const ambientSoundHint = document.getElementById("ambientSoundHint");
const themeSelect = document.getElementById("themeSelect");
const themeHint = document.getElementById("themeHint");
const focusMinutesValue = document.getElementById("focusMinutesValue");
const sessionsTodayValue = document.getElementById("sessionsTodayValue");
const currentStreakValue = document.getElementById("currentStreakValue");
const bestStreakValue = document.getElementById("bestStreakValue");
const historySummary = document.getElementById("historySummary");
const sessionHistoryList = document.getElementById("sessionHistoryList");
const inAppNotification = document.getElementById("inAppNotification");
const terminalInput = document.getElementById("terminalInput");
const terminalOutput = document.getElementById("terminalOutput");

const STORAGE_KEYS = {
  session: "zen-tracker-session",
  tasks: "zen-tracker-tasks",
  browserNotifications: "zen-tracker-browser-notifications",
  lofiMusic: "zen-tracker-lofi-music",
  ambientMode: "zen-tracker-ambient-mode",
  theme: "zen-tracker-theme",
  timerState: "zen-tracker-timer-state",
  sessionHistory: "zen-tracker-session-history",
};

const AMBIENT_MODES = {
  lofi: "Lofi beat",
  rain: "Rain",
  fire: "Fire",
  forest: "Forest",
};

const THEME_LABELS = {
  violet: "Violet",
  ocean: "Ocean",
  ember: "Ember",
  forest: "Forest",
  mono: "Mono",
};

const DEFAULT_SESSION_LENGTH_SECONDS = 25 * 60;

let sessionLengthSeconds = loadStoredSessionLength();
let timerState = loadStoredTimerState(sessionLengthSeconds);
sessionLengthSeconds = timerState.sessionLengthSeconds;
let timeLeft = timerState.timeLeft;
let timerInterval = null;
let isRunning = timerState.isRunning;
let timerStartedAt = timerState.startedAt;
let alarmAudioContext = null;
let lofiAudioContext = null;
let lofiMasterGainNode = null;
let lofiHighpassFilter = null;
let lofiLowpassFilter = null;
let lofiBaseGainNode = null;
let lofiBaseNoiseSource = null;
let lofiLoopTimerId = null;
let lofiDriftTimerId = null;
let lofiResumePending = false;
let taskRecords = loadStoredTasks();
let sessionHistoryRecords = loadStoredSessionHistory();
let notificationTimeoutId = null;
let browserNotificationsEnabled = loadStoredNotificationPreference();
let lofiMusicEnabled = loadStoredLofiPreference();
let ambientMode = loadStoredAmbientMode();
let themeName = loadStoredTheme();
let ambientAudioPrimed = false;
// Keeps the shell output feeling like a tiny transcript instead of one dead line.
const terminalHistory = ['$ ready. type "help" for commands.'];

renderTaskList();
updateTimerDisplay();
updateTimerLabel();
syncBrowserNotificationUI();
syncLofiMusicUI();
applyTheme(themeName);
syncThemeUI();
renderSessionHistory();
updateFocusMetrics();
hydrateTimerFromStorage();
initCustomCursor();
initAmbientAudioPrimer();

function initAmbientAudioPrimer() {
  const unlock = () => {
    if (ambientAudioPrimed) {
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    if (!lofiAudioContext) {
      lofiAudioContext = new AudioCtx();
    }

    if (lofiAudioContext.state === "suspended") {
      lofiAudioContext.resume().catch(() => {
        // Browser may still block audio until another user action.
      });
    }

    ambientAudioPrimed = true;
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function initCustomCursor() {
  try {
    const mediaQuery = window.matchMedia("(pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!mediaQuery.matches || reducedMotion) {
      return;
    }

    const dot = document.createElement("div");
    dot.className = "zen-cursor-dot";

    const ring = document.createElement("div");
    ring.className = "zen-cursor-ring";

    document.body.append(dot, ring);
    document.body.classList.add("cursor-enhanced");

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId = null;

    const interactiveSelector = "button, a, input, select, textarea, [role='button'], .task-item";

    const render = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;

      dot.style.transform = `translate(${mouseX - 5}px, ${mouseY - 5}px)`;
      ring.style.transform = `translate(${ringX - 17}px, ${ringY - 17}px)`;

      rafId = window.requestAnimationFrame(render);
    };

    const handleMove = (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!document.body.classList.contains("cursor-visible")) {
        document.body.classList.add("cursor-visible");
      }
    };

    const handleHoverState = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const isInteractive = Boolean(target.closest(interactiveSelector));
      document.body.classList.toggle("cursor-hover", isInteractive);
    };

    const handleLeaveWindow = () => {
      document.body.classList.remove("cursor-visible");
      document.body.classList.remove("cursor-hover");
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mousemove", handleHoverState);
    window.addEventListener("mouseout", (event) => {
      if (!event.relatedTarget) {
        handleLeaveWindow();
      }
    });

    rafId = window.requestAnimationFrame(render);

    const handleMediaQueryChange = (event) => {
      if (event.matches) {
        return;
      }

      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      dot.remove();
      ring.remove();
      document.body.classList.remove("cursor-enhanced", "cursor-visible", "cursor-hover");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaQueryChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleMediaQueryChange);
    }
  } catch {
    // Cursor effects are optional; never let them block core app features.
  }
}

function loadStoredNotificationPreference() {
  if (!("Notification" in window)) {
    return false;
  }

  return readStorageItem(STORAGE_KEYS.browserNotifications) === "true" && Notification.permission === "granted";
}

function saveNotificationPreference(enabled) {
  writeStorageItem(STORAGE_KEYS.browserNotifications, String(enabled));
}

function loadStoredLofiPreference() {
  const storedValue = readStorageItem(STORAGE_KEYS.lofiMusic);
  if (storedValue === null) {
    return false;
  }

  return storedValue === "true";
}

function saveLofiPreference(enabled) {
  writeStorageItem(STORAGE_KEYS.lofiMusic, String(enabled));
}

function loadStoredAmbientMode() {
  const storedMode = readStorageItem(STORAGE_KEYS.ambientMode);
  if (storedMode && Object.prototype.hasOwnProperty.call(AMBIENT_MODES, storedMode)) {
    return storedMode;
  }

  return "lofi";
}

function saveAmbientMode(mode) {
  writeStorageItem(STORAGE_KEYS.ambientMode, mode);
}

function loadStoredTheme() {
  const storedTheme = readStorageItem(STORAGE_KEYS.theme);
  if (storedTheme && Object.prototype.hasOwnProperty.call(THEME_LABELS, storedTheme)) {
    return storedTheme;
  }

  return "violet";
}

function saveTheme(theme) {
  writeStorageItem(STORAGE_KEYS.theme, theme);
}

function loadStoredTimerState(defaultSessionLengthSeconds) {
  const rawState = readStorageItem(STORAGE_KEYS.timerState);
  if (!rawState) {
    return {
      sessionLengthSeconds: defaultSessionLengthSeconds,
      timeLeft: defaultSessionLengthSeconds,
      isRunning: false,
      startedAt: null,
    };
  }

  try {
    const parsedState = JSON.parse(rawState);
    const storedSessionLength = Number.parseInt(parsedState.sessionLengthSeconds, 10);
    const storedTimeLeft = Number.parseInt(parsedState.timeLeft, 10);
    const storedStartedAt = Number.parseInt(parsedState.startedAt, 10);
    const sessionLength = Number.isNaN(storedSessionLength) || storedSessionLength < 1 || storedSessionLength > 180 * 60
      ? defaultSessionLengthSeconds
      : storedSessionLength;

    return {
      sessionLengthSeconds: sessionLength,
      timeLeft: Number.isNaN(storedTimeLeft) || storedTimeLeft < 0 || storedTimeLeft > sessionLength
        ? sessionLength
        : storedTimeLeft,
      isRunning: Boolean(parsedState.isRunning),
      startedAt: Number.isNaN(storedStartedAt) ? null : storedStartedAt,
    };
  } catch {
    return {
      sessionLengthSeconds: defaultSessionLengthSeconds,
      timeLeft: defaultSessionLengthSeconds,
      isRunning: false,
      startedAt: null,
    };
  }
}

function saveTimerState() {
  writeStorageItem(
    STORAGE_KEYS.timerState,
    JSON.stringify({
      sessionLengthSeconds,
      timeLeft,
      isRunning,
      startedAt: timerStartedAt,
    }),
  );
}

function loadStoredSessionHistory() {
  const rawHistory = readStorageItem(STORAGE_KEYS.sessionHistory);
  if (!rawHistory) {
    return [];
  }

  try {
    const parsedHistory = JSON.parse(rawHistory);
    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .filter((entry) => entry && Number.isFinite(Number(entry.completedAt)) && Number.isFinite(Number(entry.minutes)))
      .map((entry) => ({
        completedAt: Number(entry.completedAt),
        minutes: Math.max(1, Number(entry.minutes)),
      }))
      .sort((left, right) => left.completedAt - right.completedAt);
  } catch {
    return [];
  }
}

function saveSessionHistory() {
  writeStorageItem(STORAGE_KEYS.sessionHistory, JSON.stringify(sessionHistoryRecords));
}

function getDayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSessionTime(timestamp) {
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadStoredFocusTotals() {
  const totalMinutes = sessionHistoryRecords.reduce((sum, entry) => sum + entry.minutes, 0);
  const todayKey = getDayKey(Date.now());
  const sessionsToday = sessionHistoryRecords.filter((entry) => getDayKey(entry.completedAt) === todayKey).length;
  const activeDays = Array.from(new Set(sessionHistoryRecords.map((entry) => getDayKey(entry.completedAt)))).sort();

  let currentStreak = 0;
  let bestStreak = 0;

  if (activeDays.length) {
    let streak = 1;
    bestStreak = 1;

    for (let i = 1; i < activeDays.length; i += 1) {
      const previousDay = new Date(`${activeDays[i - 1]}T00:00:00`);
      const currentDay = new Date(`${activeDays[i]}T00:00:00`);
      const dayDelta = Math.round((currentDay - previousDay) / 86400000);

      if (dayDelta === 1) {
        streak += 1;
      } else {
        streak = 1;
      }

      bestStreak = Math.max(bestStreak, streak);
    }

    const lastDay = activeDays[activeDays.length - 1];
    const today = todayKey;
    if (lastDay === today) {
      currentStreak = 1;

      for (let i = activeDays.length - 1; i > 0; i -= 1) {
        const currentDay = new Date(`${activeDays[i]}T00:00:00`);
        const previousDay = new Date(`${activeDays[i - 1]}T00:00:00`);
        const dayDelta = Math.round((currentDay - previousDay) / 86400000);

        if (dayDelta === 1) {
          currentStreak += 1;
        } else {
          break;
        }
      }
    }
  }

  return {
    totalMinutes,
    sessionsToday,
    currentStreak,
    bestStreak,
  };
}

function renderSessionHistory() {
  if (!sessionHistoryList) {
    return;
  }

  if (!sessionHistoryRecords.length) {
    sessionHistoryList.innerHTML = '<li class="history-empty">No sessions logged yet.</li>';
    historySummary.textContent = "No sessions logged yet.";
    return;
  }

  const recentSessions = [...sessionHistoryRecords].slice(-5).reverse();
  sessionHistoryList.innerHTML = "";

  recentSessions.forEach((entry) => {
    const historyItem = document.createElement("li");
    historyItem.className = "history-item";

    const historyMain = document.createElement("div");
    historyMain.className = "history-main";

    const historyTitle = document.createElement("span");
    historyTitle.className = "history-title";
    historyTitle.textContent = `Focus session • ${entry.minutes} min`;

    const historyMeta = document.createElement("span");
    historyMeta.className = "history-meta";
    historyMeta.textContent = formatSessionTime(entry.completedAt);

    const historyDuration = document.createElement("span");
    historyDuration.className = "history-duration";
    historyDuration.textContent = `${entry.minutes} min`;

    historyMain.append(historyTitle, historyMeta);
    historyItem.append(historyMain, historyDuration);
    sessionHistoryList.appendChild(historyItem);
  });

  const totals = loadStoredFocusTotals();
  historySummary.textContent = `${totals.sessionsToday} session(s) today, ${totals.totalMinutes} minute(s) logged.`;
}

function updateFocusMetrics() {
  const totals = loadStoredFocusTotals();

  if (focusMinutesValue) {
    focusMinutesValue.textContent = String(totals.totalMinutes);
  }

  if (sessionsTodayValue) {
    sessionsTodayValue.textContent = String(totals.sessionsToday);
  }

  if (currentStreakValue) {
    currentStreakValue.textContent = String(totals.currentStreak);
  }

  if (bestStreakValue) {
    bestStreakValue.textContent = String(totals.bestStreak);
  }
}

function recordCompletedSession(minutes) {
  sessionHistoryRecords = [
    ...sessionHistoryRecords,
    {
      completedAt: Date.now(),
      minutes,
    },
  ];

  saveSessionHistory();
  renderSessionHistory();
  updateFocusMetrics();
}

function syncTimerTimeLeft() {
  if (!isRunning || !timerStartedAt) {
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
  timeLeft = Math.max(0, sessionLengthSeconds - elapsedSeconds);
  updateTimerDisplay();
}

function handleTimerCompletion(options = {}) {
  const { fromRestore = false } = options;

  clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  timerStartedAt = null;
  startPauseBtn.textContent = "[ RUN ]";
  timeLeft = sessionLengthSeconds;
  updateTimerDisplay();
  stopLofiMusic();
  saveTimerState();

  if (!fromRestore) {
    playTimesUpAlarm();
    setTerminalOutput("time's up. session complete.");
    showInAppNotification("Session complete. Take a breather and come back swinging.", "success");
    sendBrowserNotification("Zen Tracker", {
      body: "Session complete. Take a breather and come back swinging.",
    });
  }

  recordCompletedSession(Math.max(1, Math.round(sessionLengthSeconds / 60)));
}

function hydrateTimerFromStorage() {
  if (!isRunning) {
    saveTimerState();
    return;
  }

  if (!timerStartedAt) {
    timerStartedAt = Date.now() - (sessionLengthSeconds - timeLeft) * 1000;
  }

  syncTimerTimeLeft();

  if (timeLeft <= 0) {
    handleTimerCompletion({ fromRestore: true });
    return;
  }

  startPauseBtn.textContent = "[ PAUSE ]";
  startLofiMusic();

  clearInterval(timerInterval);
  timerInterval = window.setInterval(() => {
    syncTimerTimeLeft();

    if (timeLeft <= 0) {
      handleTimerCompletion();
      return;
    }

    saveTimerState();
  }, 1000);
}

function readStorageItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in some browser contexts, so fail silently.
  }
}

function loadStoredSessionLength() {
  const storedMinutes = Number.parseInt(readStorageItem(STORAGE_KEYS.session), 10);
  if (Number.isNaN(storedMinutes) || storedMinutes < 1 || storedMinutes > 180) {
    return DEFAULT_SESSION_LENGTH_SECONDS;
  }

  timerMinutesInput.value = String(storedMinutes);
  return storedMinutes * 60;
}

function saveSessionLength() {
  writeStorageItem(STORAGE_KEYS.session, String(Math.floor(sessionLengthSeconds / 60)));
}

function loadStoredTasks() {
  const rawTasks = readStorageItem(STORAGE_KEYS.tasks);
  if (!rawTasks) {
    return [];
  }

  try {
    const parsedTasks = JSON.parse(rawTasks);
    if (!Array.isArray(parsedTasks)) {
      return [];
    }

    return parsedTasks
      .filter((task) => task && typeof task.text === "string")
      .map((task) => ({
        text: task.text.trim(),
        priority: ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "Medium",
      }))
      .filter((task) => task.text);
  } catch {
    return [];
  }
}

function saveTasks() {
  writeStorageItem(STORAGE_KEYS.tasks, JSON.stringify(taskRecords));
}

function renderTaskList() {
  if (!taskRecords.length) {
    renderEmptyState();
    return;
  }

  taskList.innerHTML = "";
  taskRecords.forEach((task) => {
    taskList.appendChild(createTaskItem(task));
  });
}

function createTaskItem(task) {
  const taskItem = document.createElement("li");
  taskItem.className = "task-item";

  const taskMeta = document.createElement("div");
  taskMeta.className = "task-meta";

  const taskLabel = document.createElement("span");
  taskLabel.textContent = task.text;

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `priority-badge priority-${task.priority.toLowerCase()}`;
  priorityBadge.textContent = task.priority;

  const doneBtn = document.createElement("button");
  doneBtn.className = "secondary-btn";
  doneBtn.textContent = "Done";
  doneBtn.style.width = "auto";
  doneBtn.style.padding = "10px 14px";

  doneBtn.addEventListener("click", () => {
    taskRecords = taskRecords.filter((storedTask) => storedTask !== task);
    saveTasks();
    renderTaskList();
  });

  taskMeta.append(taskLabel, priorityBadge);
  taskItem.append(taskMeta, doneBtn);
  return taskItem;
}

function syncBrowserNotificationUI() {
  if (browserNotificationToggle) {
    browserNotificationToggle.checked = browserNotificationsEnabled;
  }

  updateNotificationHint(getBrowserNotificationStatusText());
}

function syncLofiMusicUI() {
  if (lofiMusicToggle) {
    lofiMusicToggle.checked = lofiMusicEnabled;
  }

  if (ambientSoundSelect) {
    ambientSoundSelect.value = ambientMode;
  }

  updateLofiHint(getLofiStatusText());
  updateAmbientHint(getAmbientModeText());
}

function getLofiStatusText() {
  const modeLabel = getAmbientModeLabel(ambientMode);

  if (!lofiMusicEnabled) {
    return `${modeLabel} is off. Turn it on to play background sound while tracking.`;
  }

  return isRunning
    ? `${modeLabel} is on while the timer runs.`
    : `${modeLabel} is armed and will start when tracking begins.`;
}

function updateLofiHint(message) {
  lofiMusicHint.textContent = message;
}

function getAmbientModeLabel(mode) {
  return AMBIENT_MODES[mode] || AMBIENT_MODES.lofi;
}

function getAmbientModeText() {
  return `Current sound: ${getAmbientModeLabel(ambientMode)}.`;
}

function updateAmbientHint(message) {
  ambientSoundHint.textContent = message;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (document.body) {
    document.body.dataset.theme = theme;
  }
  themeName = theme;
}

function syncThemeUI() {
  if (themeSelect) {
    themeSelect.value = themeName;
  }

  updateThemeHint(`Theme set to ${THEME_LABELS[themeName] || THEME_LABELS.violet}.`);
}

function updateThemeHint(message) {
  themeHint.textContent = message;
}

function getBrowserNotificationStatusText() {
  if (!("Notification" in window)) {
    return "Browser notifications are not supported in this browser.";
  }

  if (!browserNotificationsEnabled) {
    return "In-app notifications are always on. Enable browser notifications for system-level alerts.";
  }

  if (Notification.permission === "granted") {
    return "Browser notifications are enabled.";
  }

  if (Notification.permission === "denied") {
    return "Browser notifications are blocked in browser settings.";
  }

  return "Browser notifications will ask for permission when enabled.";
}

function updateNotificationHint(message) {
  notificationPermissionHint.textContent = message;
}

function showInAppNotification(message, tone = "success") {
  if (notificationTimeoutId) {
    clearTimeout(notificationTimeoutId);
  }

  inAppNotification.textContent = message;
  inAppNotification.className = `in-app-notification is-${tone}`;
  inAppNotification.hidden = false;

  notificationTimeoutId = window.setTimeout(() => {
    inAppNotification.hidden = true;
    inAppNotification.textContent = "";
  }, 5000);
}

function createSoftNoiseBuffer(audioContext, durationSeconds = 2) {
  const sampleRate = audioContext.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i += 1) {
    channelData[i] = (Math.random() * 2 - 1) * 0.03;
  }

  return buffer;
}

function scheduleLofiPattern(audioContext, startAt) {
  const masterGain = lofiMasterGainNode;
  if (!masterGain) {
    return;
  }

  const chordProgression = [
    [261.63, 329.63, 392.0],
    [220.0, 277.18, 329.63],
    [196.0, 246.94, 293.66],
    [174.61, 220.0, 261.63],
  ];
  const progressionIndex = Math.floor(startAt / 8) % chordProgression.length;
  const chord = chordProgression[progressionIndex];
  const barStart = startAt + 0.05;

  chord.forEach((frequency, noteIndex) => {
    const oscillator = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, barStart);
    oscillator.detune.setValueAtTime(-8 + noteIndex * 3, barStart);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520 + noteIndex * 45, barStart);
    filter.Q.setValueAtTime(0.8, barStart);

    noteGain.gain.setValueAtTime(0.0001, barStart);
    noteGain.gain.linearRampToValueAtTime(0.025, barStart + 0.2);
    noteGain.gain.linearRampToValueAtTime(0.015, barStart + 1.75);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, barStart + 3.6);

    oscillator.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(masterGain);

    oscillator.start(barStart);
    oscillator.stop(barStart + 3.8);
  });

  const bassOscillator = audioContext.createOscillator();
  const bassGain = audioContext.createGain();
  const bassFilter = audioContext.createBiquadFilter();

  bassOscillator.type = "sine";
  bassOscillator.frequency.setValueAtTime(chord[0] / 2, barStart);

  bassFilter.type = "lowpass";
  bassFilter.frequency.setValueAtTime(180, barStart);
  bassFilter.Q.setValueAtTime(0.7, barStart);

  bassGain.gain.setValueAtTime(0.0001, barStart);
  bassGain.gain.linearRampToValueAtTime(0.045, barStart + 0.14);
  bassGain.gain.linearRampToValueAtTime(0.028, barStart + 1.95);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, barStart + 3.8);

  bassOscillator.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(masterGain);
  bassOscillator.start(barStart);
  bassOscillator.stop(barStart + 3.85);

  const hihatOscillator = audioContext.createOscillator();
  const hihatGain = audioContext.createGain();
  const hihatFilter = audioContext.createBiquadFilter();

  hihatOscillator.type = "square";
  hihatOscillator.frequency.setValueAtTime(7600, barStart + 1.9);

  hihatFilter.type = "highpass";
  hihatFilter.frequency.setValueAtTime(5200, barStart + 1.9);

  hihatGain.gain.setValueAtTime(0.0001, barStart + 1.9);
  hihatGain.gain.linearRampToValueAtTime(0.01, barStart + 1.92);
  hihatGain.gain.exponentialRampToValueAtTime(0.0001, barStart + 2.0);

  hihatOscillator.connect(hihatFilter);
  hihatFilter.connect(hihatGain);
  hihatGain.connect(masterGain);
  hihatOscillator.start(barStart + 1.9);
  hihatOscillator.stop(barStart + 2.05);
}

function scheduleRainPattern(audioContext, startAt) {
  const burstCount = 24;

  for (let i = 0; i < burstCount; i += 1) {
    const burstStart = startAt + Math.random() * 3.9;
    const noise = audioContext.createBufferSource();
    const highpass = audioContext.createBiquadFilter();
    const lowpass = audioContext.createBiquadFilter();
    const burstGain = audioContext.createGain();

    noise.buffer = createSoftNoiseBuffer(audioContext, 0.09 + Math.random() * 0.2);

    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(700 + Math.random() * 1200, burstStart);

    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(3600 + Math.random() * 1800, burstStart);

    burstGain.gain.setValueAtTime(0.0001, burstStart);
    burstGain.gain.linearRampToValueAtTime(0.008 + Math.random() * 0.01, burstStart + 0.015);
    burstGain.gain.exponentialRampToValueAtTime(0.0001, burstStart + 0.14 + Math.random() * 0.16);

    noise.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(burstGain);
    burstGain.connect(lofiMasterGainNode);

    noise.start(burstStart);
    noise.stop(burstStart + 0.26);
  }

  // Occasional heavier droplets to avoid static white-noise feel.
  for (let i = 0; i < 4; i += 1) {
    const dropStart = startAt + Math.random() * 3.8;
    const dropOsc = audioContext.createOscillator();
    const dropFilter = audioContext.createBiquadFilter();
    const dropGain = audioContext.createGain();

    dropOsc.type = "sine";
    dropOsc.frequency.setValueAtTime(420 + Math.random() * 240, dropStart);
    dropOsc.frequency.exponentialRampToValueAtTime(160 + Math.random() * 70, dropStart + 0.12);

    dropFilter.type = "lowpass";
    dropFilter.frequency.setValueAtTime(700, dropStart);

    dropGain.gain.setValueAtTime(0.0001, dropStart);
    dropGain.gain.linearRampToValueAtTime(0.01, dropStart + 0.02);
    dropGain.gain.exponentialRampToValueAtTime(0.0001, dropStart + 0.14);

    dropOsc.connect(dropFilter);
    dropFilter.connect(dropGain);
    dropGain.connect(lofiMasterGainNode);

    dropOsc.start(dropStart);
    dropOsc.stop(dropStart + 0.16);
  }
}

function scheduleFirePattern(audioContext, startAt) {
  const crackleCount = 14;

  for (let i = 0; i < crackleCount; i += 1) {
    const crackleStart = startAt + Math.random() * 3.8;
    const noise = audioContext.createBufferSource();
    const highpass = audioContext.createBiquadFilter();
    const lowpass = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    noise.buffer = createSoftNoiseBuffer(audioContext, 0.05 + Math.random() * 0.08);
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(1600 + Math.random() * 1800, crackleStart);

    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(6000, crackleStart);

    gain.gain.setValueAtTime(0.0001, crackleStart);
    gain.gain.linearRampToValueAtTime(0.016, crackleStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, crackleStart + 0.1);

    noise.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(lofiMasterGainNode);

    noise.start(crackleStart);
    noise.stop(crackleStart + 0.12);
  }
}

function scheduleForestPattern(audioContext, startAt) {
  // Wind-like swells from filtered noise.
  for (let i = 0; i < 3; i += 1) {
    const gustStart = startAt + Math.random() * 3.2;
    const gust = audioContext.createBufferSource();
    const lowpass = audioContext.createBiquadFilter();
    const highpass = audioContext.createBiquadFilter();
    const gustGain = audioContext.createGain();

    gust.buffer = createSoftNoiseBuffer(audioContext, 0.8 + Math.random() * 0.8);

    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(900 + Math.random() * 500, gustStart);

    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(120 + Math.random() * 120, gustStart);

    gustGain.gain.setValueAtTime(0.0001, gustStart);
    gustGain.gain.linearRampToValueAtTime(0.006 + Math.random() * 0.005, gustStart + 0.25);
    gustGain.gain.exponentialRampToValueAtTime(0.0001, gustStart + 1.0 + Math.random() * 0.5);

    gust.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gustGain);
    gustGain.connect(lofiMasterGainNode);

    gust.start(gustStart);
    gust.stop(gustStart + 1.4);
  }

  // Light foliage rustle.
  for (let i = 0; i < 5; i += 1) {
    const rustleStart = startAt + Math.random() * 3.9;
    const rustle = audioContext.createBufferSource();
    const rustleFilter = audioContext.createBiquadFilter();
    const rustleGain = audioContext.createGain();

    rustle.buffer = createSoftNoiseBuffer(audioContext, 0.18 + Math.random() * 0.2);
    rustleFilter.type = "bandpass";
    rustleFilter.frequency.setValueAtTime(500 + Math.random() * 800, rustleStart);
    rustleFilter.Q.setValueAtTime(0.7, rustleStart);

    rustleGain.gain.setValueAtTime(0.0001, rustleStart);
    rustleGain.gain.linearRampToValueAtTime(0.004 + Math.random() * 0.004, rustleStart + 0.05);
    rustleGain.gain.exponentialRampToValueAtTime(0.0001, rustleStart + 0.22 + Math.random() * 0.2);

    rustle.connect(rustleFilter);
    rustleFilter.connect(rustleGain);
    rustleGain.connect(lofiMasterGainNode);

    rustle.start(rustleStart);
    rustle.stop(rustleStart + 0.45);
  }

  // Sparse bird chirps so it reads as forest and not pure wind.
  const chirpCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < chirpCount; i += 1) {
    const chirpStart = startAt + 0.6 + Math.random() * 2.8;
    const oscillator = audioContext.createOscillator();
    const chirpFilter = audioContext.createBiquadFilter();
    const chirpGain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1200 + Math.random() * 900, chirpStart);
    oscillator.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 1100, chirpStart + 0.08);

    chirpFilter.type = "highpass";
    chirpFilter.frequency.setValueAtTime(900, chirpStart);

    chirpGain.gain.setValueAtTime(0.0001, chirpStart);
    chirpGain.gain.linearRampToValueAtTime(0.006, chirpStart + 0.03);
    chirpGain.gain.exponentialRampToValueAtTime(0.0001, chirpStart + 0.16);

    oscillator.connect(chirpFilter);
    chirpFilter.connect(chirpGain);
    chirpGain.connect(lofiMasterGainNode);

    oscillator.start(chirpStart);
    oscillator.stop(chirpStart + 0.18);
  }
}

function scheduleAmbientPattern(audioContext, startAt) {
  if (ambientMode === "rain") {
    scheduleRainPattern(audioContext, startAt);
    return;
  }

  if (ambientMode === "fire") {
    scheduleFirePattern(audioContext, startAt);
    return;
  }

  if (ambientMode === "forest") {
    scheduleForestPattern(audioContext, startAt);
    return;
  }

  scheduleLofiPattern(audioContext, startAt);
}

function getAmbientProfile(mode) {
  if (mode === "rain") {
    return { highpass: 350, lowpass: 7800, bedGain: 0.03, masterGain: 0.18 };
  }

  if (mode === "fire") {
    return { highpass: 350, lowpass: 4200, bedGain: 0.024, masterGain: 0.15 };
  }

  if (mode === "forest") {
    return { highpass: 80, lowpass: 2200, bedGain: 0.013, masterGain: 0.16 };
  }

  return { highpass: 500, lowpass: 1800, bedGain: 0.014, masterGain: 0.14 };
}

function startLofiMusic() {
  if (!lofiMusicEnabled) {
    return;
  }

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      updateLofiHint("This browser does not support audio playback for the lofi track.");
      return;
    }

    if (!lofiAudioContext) {
      lofiAudioContext = new AudioCtx();
    }

    if (lofiAudioContext.state === "suspended") {
      if (lofiResumePending) {
        return;
      }

      lofiResumePending = true;
      lofiAudioContext.resume()
        .then(() => {
          lofiResumePending = false;
          if (isRunning && lofiMusicEnabled) {
            startLofiMusic();
          }
        })
        .catch(() => {
          lofiResumePending = false;
          showInAppNotification("Audio is blocked. Click anywhere once, then run again.", "warning");
        });
      return;
    }

    if (lofiAudioContext.state !== "running") {
      window.setTimeout(() => {
        if (isRunning && lofiMusicEnabled) {
          startLofiMusic();
        }
      }, 120);
      return;
    }

    if (!lofiMasterGainNode) {
      lofiMasterGainNode = lofiAudioContext.createGain();
      lofiMasterGainNode.gain.value = 0.14;
      lofiMasterGainNode.connect(lofiAudioContext.destination);

      lofiBaseNoiseSource = lofiAudioContext.createBufferSource();
      lofiBaseNoiseSource.buffer = createSoftNoiseBuffer(lofiAudioContext, 2);
      lofiBaseNoiseSource.loop = true;

      lofiHighpassFilter = lofiAudioContext.createBiquadFilter();
      lofiHighpassFilter.type = "highpass";

      lofiLowpassFilter = lofiAudioContext.createBiquadFilter();
      lofiLowpassFilter.type = "lowpass";

      lofiBaseGainNode = lofiAudioContext.createGain();

      lofiBaseNoiseSource.connect(lofiHighpassFilter);
      lofiHighpassFilter.connect(lofiLowpassFilter);
      lofiLowpassFilter.connect(lofiBaseGainNode);
      lofiBaseGainNode.connect(lofiMasterGainNode);
      lofiBaseNoiseSource.start();
    }

    const profile = getAmbientProfile(ambientMode);
    lofiHighpassFilter.frequency.setValueAtTime(profile.highpass, lofiAudioContext.currentTime);
    lofiLowpassFilter.frequency.setValueAtTime(profile.lowpass, lofiAudioContext.currentTime);
    lofiBaseGainNode.gain.setTargetAtTime(profile.bedGain, lofiAudioContext.currentTime, 0.04);
    lofiMasterGainNode.gain.setTargetAtTime(profile.masterGain, lofiAudioContext.currentTime, 0.04);

    if (lofiLoopTimerId || lofiDriftTimerId) {
      return;
    }

    const pumpPattern = () => {
      if (!lofiAudioContext || !lofiMasterGainNode) {
        return;
      }

      const now = lofiAudioContext.currentTime;
      scheduleAmbientPattern(lofiAudioContext, now + 0.15);
    };

    pumpPattern();
    lofiLoopTimerId = window.setInterval(pumpPattern, 4000);
    lofiDriftTimerId = window.setInterval(() => {
      if (lofiAudioContext && lofiAudioContext.state === "running") {
        updateLofiHint("Lofi music is on while the timer runs.");
      }
    }, 12000);
  } catch {
    lofiMusicEnabled = false;
    saveLofiPreference(false);
    syncLofiMusicUI();
    stopLofiMusic();
    showInAppNotification("Lofi audio could not start, so it was turned off.", "warning");
  }
}

function stopLofiMusic() {
  if (lofiLoopTimerId) {
    clearInterval(lofiLoopTimerId);
    lofiLoopTimerId = null;
  }

  if (lofiDriftTimerId) {
    clearInterval(lofiDriftTimerId);
    lofiDriftTimerId = null;
  }

  if (lofiMasterGainNode && lofiAudioContext) {
    lofiMasterGainNode.gain.setTargetAtTime(0.0001, lofiAudioContext.currentTime, 0.03);
    window.setTimeout(() => {
      if (lofiAudioContext && lofiAudioContext.state !== "closed") {
        lofiAudioContext.suspend().catch(() => {
          // Fallback: if suspension fails, we still stop scheduling new notes.
        });
      }
    }, 100);
  }

  updateLofiHint(getLofiStatusText());
}

async function enableBrowserNotifications() {
  if (!("Notification" in window)) {
    browserNotificationsEnabled = false;
    saveNotificationPreference(false);
    syncBrowserNotificationUI();
    showInAppNotification("Browser notifications are not supported here.", "warning");
    return;
  }

  if (Notification.permission === "granted") {
    browserNotificationsEnabled = true;
    saveNotificationPreference(true);
    syncBrowserNotificationUI();
    showInAppNotification("Browser notifications enabled.", "success");
    return;
  }

  if (Notification.permission === "denied") {
    browserNotificationsEnabled = false;
    saveNotificationPreference(false);
    syncBrowserNotificationUI();
    showInAppNotification("Browser notifications are blocked in settings.", "error");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    browserNotificationsEnabled = permission === "granted";
    saveNotificationPreference(browserNotificationsEnabled);
    syncBrowserNotificationUI();

    if (browserNotificationsEnabled) {
      showInAppNotification("Browser notifications enabled.", "success");
    } else {
      showInAppNotification("Browser notifications were not enabled.", "warning");
    }
  } catch {
    browserNotificationsEnabled = false;
    saveNotificationPreference(false);
    syncBrowserNotificationUI();
    showInAppNotification("Could not enable browser notifications.", "error");
  }
}

function sendBrowserNotification(title, options = {}) {
  if (!browserNotificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification(title, {
      body: options.body || "",
      silent: options.silent ?? false,
      tag: options.tag || "zen-tracker-session",
    });
  } catch {
    // If the notification API fails, the in-app banner still covers the user.
  }
}

function updateTimerDisplay() {
  // Plain math, because the timer does not need to be clever.
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  clearInterval(timerInterval);
  timerStartedAt = Date.now() - (sessionLengthSeconds - timeLeft) * 1000;
  isRunning = true;
  startPauseBtn.textContent = "[ PAUSE ]";
  syncTimerTimeLeft();
  saveTimerState();

  timerInterval = window.setInterval(() => {
    syncTimerTimeLeft();

    if (timeLeft <= 0) {
      handleTimerCompletion();
      return;
    }

    saveTimerState();
  }, 1000);

  startLofiMusic();
}

function playTimesUpAlarm() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  if (!alarmAudioContext) {
    alarmAudioContext = new AudioCtx();
  }

  if (alarmAudioContext.state === "suspended") {
    alarmAudioContext.resume().catch(() => {
      // If browser blocks resume here, alert fallback still notifies the user.
    });
  }

  const now = alarmAudioContext.currentTime;
  const beepCount = 3;

  for (let i = 0; i < beepCount; i += 1) {
    const startAt = now + i * 0.24;
    const oscillator = alarmAudioContext.createOscillator();
    const gainNode = alarmAudioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(920, startAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.12, startAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);

    oscillator.connect(gainNode);
    gainNode.connect(alarmAudioContext.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + 0.17);
  }
}

function updateTimerLabel() {
  const minutes = Math.floor(sessionLengthSeconds / 60);
  timerLabel.textContent = `[ pomodoro:${minutes}m ]`;
}

function applyCustomTimerMinutes() {
  if (isRunning) {
    setTerminalOutput("pause timer before changing minutes");
    return;
  }

  const minutes = Number.parseInt(timerMinutesInput.value, 10);
  if (Number.isNaN(minutes) || minutes < 1 || minutes > 180) {
    alert("Pick a value between 1 and 180 minutes.");
    timerMinutesInput.value = String(Math.floor(sessionLengthSeconds / 60));
    return;
  }

  sessionLengthSeconds = minutes * 60;
  timeLeft = sessionLengthSeconds;
  timerStartedAt = null;
  updateTimerLabel();
  updateTimerDisplay();
  saveSessionLength();
  saveTimerState();
  setTerminalOutput(`timer set to ${minutes} minute(s)`);
}

function toggleTimer() {
  if (isRunning) {
    clearInterval(timerInterval);
    timerInterval = null;
    syncTimerTimeLeft();
    isRunning = false;
    timerStartedAt = null;
    startPauseBtn.textContent = "[ RUN ]";
    saveTimerState();
    stopLofiMusic();
    return;
  }

  startTimer();
}

function addTask() {
  // Grab the input before the brain decides to wander off.
  const taskText = taskInput.value.trim();
  const priority = prioritySelect.value;

  if (!taskText) {
    alert("Type a task first. The queue is not psychic yet.");
    return;
  }

  const task = { text: taskText, priority };
  taskRecords = [...taskRecords, task];
  saveTasks();
  renderTaskList();
  showInAppNotification(`Queued task: ${taskText}`, "success");
  taskInput.value = "";
  prioritySelect.value = "Medium";
}

function handleLofiToggleChange() {
  lofiMusicEnabled = lofiMusicToggle.checked;
  saveLofiPreference(lofiMusicEnabled);
  syncLofiMusicUI();

  if (!lofiMusicEnabled) {
    stopLofiMusic();
    showInAppNotification("Lofi music turned off.", "warning");
    return;
  }

  showInAppNotification("Lofi music is ready for your next session.", "success");

  if (isRunning) {
    startLofiMusic();
  }
}

function setAmbientMode(mode) {
  if (!Object.prototype.hasOwnProperty.call(AMBIENT_MODES, mode)) {
    return;
  }

  ambientMode = mode;
  saveAmbientMode(mode);
  syncLofiMusicUI();

  if (isRunning) {
    stopLofiMusic();
    startLofiMusic();
  }

  showInAppNotification(`Focus sound set to ${getAmbientModeLabel(mode)}.`, "success");
}

function handleThemeChange(event) {
  const nextTheme = event.target.value;
  if (!Object.prototype.hasOwnProperty.call(THEME_LABELS, nextTheme)) {
    return;
  }

  applyTheme(nextTheme);
  saveTheme(nextTheme);
  syncThemeUI();
  showInAppNotification(`Theme set to ${THEME_LABELS[nextTheme]}.`, "success");
}

function addTaskFromTerminal(rawTaskText, rawPriority) {
  const taskText = rawTaskText.trim();
  if (!taskText) {
    setTerminalOutput("add command needs task text. example: add finish math high");
    return;
  }

  // Keep the terminal parser forgiving, because humans type sloppy commands.
  const normalized = (rawPriority || "medium").toLowerCase();
  const priority = ["high", "medium", "low"].includes(normalized)
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Medium";

  taskInput.value = taskText;
  prioritySelect.value = priority;
  addTask();
  setTerminalOutput(`queued: ${taskText} [${priority.toLowerCase()}]`);
}

function renderEmptyState() {
  taskList.innerHTML = '<li class="empty-state">No tasks yet. Add one before your brain opens 19 tabs.</li>';
}

function clearEmptyState() {
  const emptyState = taskList.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }
}

function setTerminalOutput(message) {
  // Little transcript buffer so the bottom prompt feels alive.
  terminalHistory.push(`$ ${message}`);
  terminalOutput.textContent = terminalHistory.slice(-4).join("\n");
}

function runTerminalCommand(command) {
  const trimmed = command.trim();
  if (!trimmed) {
    setTerminalOutput("empty command. try: help");
    return;
  }

  setTerminalOutput(`> ${trimmed}`);

  const parts = trimmed.split(/\s+/);
  const action = parts[0].toLowerCase();

  if (action === "help") {
    setTerminalOutput("commands: run | pause | reset | set <minutes> | add <task> [high|medium|low]");
    return;
  }

  if (action === "run" || action === "start") {
    if (!isRunning) {
      toggleTimer();
      setTerminalOutput("timer started");
    } else {
      setTerminalOutput("timer already running");
    }
    return;
  }

  if (action === "pause" || action === "stop") {
    if (isRunning) {
      toggleTimer();
      setTerminalOutput("timer paused");
    } else {
      setTerminalOutput("timer is already paused");
    }
    return;
  }

  if (action === "reset") {
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
    }

    timeLeft = sessionLengthSeconds;
    startPauseBtn.textContent = "[ RUN ]";
    updateTimerDisplay();
    setTerminalOutput(`timer reset to ${String(Math.floor(sessionLengthSeconds / 60)).padStart(2, "0")}:00`);
    return;
  }

  if (action === "set") {
    const minutes = Number.parseInt(parts[1], 10);
    if (Number.isNaN(minutes)) {
      setTerminalOutput("usage: set <minutes>");
      return;
    }

    timerMinutesInput.value = String(minutes);
    applyCustomTimerMinutes();
    return;
  }

  if (action === "add") {
    // Example: add finish notes high
    const maybePriority = parts[parts.length - 1].toLowerCase();
    const hasPriority = ["high", "medium", "low"].includes(maybePriority);
    const taskWords = hasPriority ? parts.slice(1, -1) : parts.slice(1);
    addTaskFromTerminal(taskWords.join(" "), hasPriority ? maybePriority : "medium");
    return;
  }

  setTerminalOutput(`unknown command: ${action}`);
}

startPauseBtn.addEventListener("click", toggleTimer);
addTaskBtn.addEventListener("click", addTask);
browserNotificationToggle.addEventListener("change", () => {
  if (browserNotificationToggle.checked) {
    enableBrowserNotifications();
    return;
  }

  browserNotificationsEnabled = false;
  saveNotificationPreference(false);
  syncBrowserNotificationUI();
  showInAppNotification("Browser notifications turned off.", "warning");
});
lofiMusicToggle.addEventListener("change", handleLofiToggleChange);
ambientSoundSelect.addEventListener("change", (event) => {
  setAmbientMode(event.target.value);
});
themeSelect.addEventListener("change", handleThemeChange);

taskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addTask();
  }
});

terminalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runTerminalCommand(terminalInput.value);
    terminalInput.value = "";
  }
});

applyTimerBtn.addEventListener("click", applyCustomTimerMinutes);

timerMinutesInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applyCustomTimerMinutes();
  }
});
