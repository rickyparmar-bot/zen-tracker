const timerDisplay = document.getElementById("timer");
const startPauseBtn = document.getElementById("startPauseBtn");
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
const terminalInput = document.getElementById("terminalInput");
const terminalOutput = document.getElementById("terminalOutput");

const pomodoroLength = 25 * 60;
let timeLeft = pomodoroLength;
let timerInterval = null;
let isRunning = false;
// Keeps the shell output feeling like a tiny transcript instead of one dead line.
const terminalHistory = ['$ ready. type "help" for commands.'];

renderEmptyState();
updateTimerDisplay();

function updateTimerDisplay() {
  // Plain math, because the timer does not need to be clever.
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft -= 1;
      updateTimerDisplay();
      return;
    }

    // Timer hit zero. Reset it and let the user know without being dramatic.
    clearInterval(timerInterval);
    isRunning = false;
    startPauseBtn.textContent = "[ RUN ]";
    timeLeft = pomodoroLength;
    updateTimerDisplay();
    alert("Pomodoro done. Take a breather and come back swinging.");
  }, 1000);
}

function toggleTimer() {
  if (isRunning) {
    clearInterval(timerInterval);
    isRunning = false;
    startPauseBtn.textContent = "[ RUN ]";
    return;
  }

  isRunning = true;
  startPauseBtn.textContent = "[ PAUSE ]";
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

  const taskItem = document.createElement("li");
  taskItem.className = "task-item";

  const taskMeta = document.createElement("div");
  taskMeta.className = "task-meta";

  const taskLabel = document.createElement("span");
  taskLabel.textContent = taskText;

  const priorityBadge = document.createElement("span");
  priorityBadge.className = `priority-badge priority-${priority.toLowerCase()}`;
  priorityBadge.textContent = priority;

  const doneBtn = document.createElement("button");
  doneBtn.className = "secondary-btn";
  doneBtn.textContent = "Done";
  doneBtn.style.width = "auto";
  doneBtn.style.padding = "10px 14px";

  doneBtn.addEventListener("click", () => {
    // Clean removal. No flourish needed.
    taskItem.remove();

    if (!taskList.children.length) {
      renderEmptyState();
    }
  });

  taskMeta.append(taskLabel, priorityBadge);
  taskItem.append(taskMeta, doneBtn);

  clearEmptyState();
  taskList.appendChild(taskItem);
  taskInput.value = "";
  prioritySelect.value = "Medium";
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
    setTerminalOutput("commands: run | pause | reset | add <task> [high|medium|low]");
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

    timeLeft = pomodoroLength;
    startPauseBtn.textContent = "[ RUN ]";
    updateTimerDisplay();
    setTerminalOutput("timer reset to 25:00");
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
