const timerDisplay = document.getElementById("timer");
const startPauseBtn = document.getElementById("startPauseBtn");
const taskInput = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");

const pomodoroLength = 25 * 60;
let timeLeft = pomodoroLength;
let timerInterval = null;
let isRunning = false;

renderEmptyState();
updateTimerDisplay();

function updateTimerDisplay() {
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

    clearInterval(timerInterval);
    isRunning = false;
    startPauseBtn.textContent = "Start";
    timeLeft = pomodoroLength;
    updateTimerDisplay();
    alert("Pomodoro done. Drink water or take a quick break.");
  }, 1000);
}

function toggleTimer() {
  if (isRunning) {
    clearInterval(timerInterval);
    isRunning = false;
    startPauseBtn.textContent = "Start";
    return;
  }

  isRunning = true;
  startPauseBtn.textContent = "Pause";
  startTimer();
}

function addTask() {
  const taskText = taskInput.value.trim();
  const priority = prioritySelect.value;

  if (!taskText) {
    alert("Type a task first.");
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

function renderEmptyState() {
  taskList.innerHTML = '<li class="empty-state">No tasks yet. Add one before your brain opens 19 tabs.</li>';
}

function clearEmptyState() {
  const emptyState = taskList.querySelector(".empty-state");
  if (emptyState) {
    emptyState.remove();
  }
}

startPauseBtn.addEventListener("click", toggleTimer);
addTaskBtn.addEventListener("click", addTask);

taskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addTask();
  }
});