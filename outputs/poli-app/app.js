const STORAGE_KEY = "poli-productivity-state-v1";

const defaultRoutines = [
  {
    id: "morning",
    title: "Morning start",
    steps: ["Drink water", "Check calendar", "Choose one first task"]
  },
  {
    id: "work",
    title: "Work entry",
    steps: ["Clear desk area", "Open only needed tabs", "Start a five minute timer"]
  },
  {
    id: "reset",
    title: "Overwhelm reset",
    steps: ["Unclench shoulders", "Name the room you are in", "Pick the smallest visible action"]
  }
];

const defaultChores = [
  {
    id: "kitchen",
    title: "Kitchen reset",
    minutes: 10,
    steps: ["Clear one counter", "Put dishes in sink or dishwasher", "Take out visible trash"]
  },
  {
    id: "laundry",
    title: "Laundry starter",
    minutes: 5,
    steps: ["Gather one basket", "Start one load", "Put basket where you will see it"]
  },
  {
    id: "bathroom",
    title: "Bathroom quick pass",
    minutes: 7,
    steps: ["Put items back in place", "Wipe sink area", "Replace towel or empty bin"]
  },
  {
    id: "bedroom",
    title: "Bedroom landing pad",
    minutes: 8,
    steps: ["Clear bed surface", "Put clothes in one pile", "Move cups or dishes out"]
  }
];

const state = loadState();
let activeFilter = "all";
let selectedTaskId = state.selectedTaskId || null;
let timerSeconds = state.timerMinutes * 60;
let timerInterval = null;

const appShell = document.querySelector(".app-shell");
const taskForm = document.querySelector("#taskForm");
const taskTitle = document.querySelector("#taskTitle");
const taskEnergy = document.querySelector("#taskEnergy");
const taskTime = document.querySelector("#taskTime");
const taskList = document.querySelector("#taskList");
const taskCount = document.querySelector("#taskCount");
const nextCard = document.querySelector("#nextCard");
const poliNote = document.querySelector("#poliNote");
const tinySteps = document.querySelector("#tinySteps");
const pickTaskButton = document.querySelector("#pickTaskButton");
const overwhelmButton = document.querySelector("#overwhelmButton");
const makeTinyButton = document.querySelector("#makeTinyButton");
const startFocusButton = document.querySelector("#startFocusButton");
const timerDisplay = document.querySelector("#timerDisplay");
const timerToggleButton = document.querySelector("#timerToggleButton");
const resetTimerButton = document.querySelector("#resetTimerButton");
const clearDoneButton = document.querySelector("#clearDoneButton");
const motionToggle = document.querySelector("#motionToggle");
const contrastToggle = document.querySelector("#contrastToggle");
const routineList = document.querySelector("#routineList");
const progressGrid = document.querySelector("#progressGrid");
const progressBarFill = document.querySelector("#progressBarFill");
const progressMessage = document.querySelector("#progressMessage");
const choreList = document.querySelector("#choreList");
const pickChoreButton = document.querySelector("#pickChoreButton");
const resetChoresButton = document.querySelector("#resetChoresButton");

document.addEventListener("DOMContentLoaded", () => {
  render();
  bindEvents();
});

function loadState() {
  const fallback = {
    tasks: [],
    timerMinutes: 5,
    selectedTaskId: null,
    routines: defaultRoutines,
    routineProgress: {},
    chores: defaultChores,
    choreProgress: {},
    focusMinutesDone: 0,
    reducedMotion: false,
    highContrast: false
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...fallback,
      ...saved,
      routines: saved?.routines?.length ? saved.routines : defaultRoutines,
      chores: saved?.chores?.length ? saved.chores : defaultChores
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  state.selectedTaskId = selectedTaskId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindEvents() {
  taskForm.addEventListener("submit", addTask);

  document.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip === button));
      renderTasks();
    });
  });

  pickTaskButton.addEventListener("click", pickNextTask);
  overwhelmButton.addEventListener("click", enterOverwhelmMode);
  makeTinyButton.addEventListener("click", renderTinySteps);
  startFocusButton.addEventListener("click", startTimer);
  timerToggleButton.addEventListener("click", toggleTimer);
  resetTimerButton.addEventListener("click", resetTimer);
  clearDoneButton.addEventListener("click", clearDoneTasks);
  pickChoreButton.addEventListener("click", pickChore);
  resetChoresButton.addEventListener("click", resetChores);

  document.querySelectorAll(".timer-options button").forEach((button) => {
    button.addEventListener("click", () => {
      state.timerMinutes = Number(button.dataset.minutes);
      timerSeconds = state.timerMinutes * 60;
      stopTimer();
      saveState();
      updateTimerOptions();
      renderTimer();
      setNote(`A ${state.timerMinutes} minute container is ready.`);
    });
  });

  motionToggle.addEventListener("change", () => {
    state.reducedMotion = motionToggle.checked;
    saveState();
    applyPreferences();
  });

  contrastToggle.addEventListener("change", () => {
    state.highContrast = contrastToggle.checked;
    saveState();
    applyPreferences();
  });

  document.querySelectorAll(".section-tabs a").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".section-tabs a").forEach((item) => item.classList.toggle("active", item === link));
    });
  });
}

function addTask(event) {
  event.preventDefault();

  const title = taskTitle.value.trim();
  if (!title) return;

  const task = {
    id: createId(),
    title,
    energy: taskEnergy.value,
    minutes: Number(taskTime.value),
    done: false,
    createdAt: Date.now()
  };

  state.tasks.unshift(task);
  selectedTaskId = task.id;
  taskForm.reset();
  taskEnergy.value = "medium";
  taskTime.value = "15";
  tinySteps.hidden = true;
  saveState();
  render();
  setNote("New task added. I made it the current next step.");
}

function render() {
  applyPreferences();
  updateTimerOptions();
  renderTasks();
  renderNextCard();
  renderTimer();
  renderRoutines();
  renderChores();
  renderDashboard();
}

function applyPreferences() {
  appShell.classList.toggle("reduced-motion", state.reducedMotion);
  appShell.classList.toggle("high-contrast", state.highContrast);
  motionToggle.checked = state.reducedMotion;
  contrastToggle.checked = state.highContrast;
}

function renderTasks() {
  const visibleTasks = getFilteredTasks();
  const openCount = state.tasks.filter((task) => !task.done).length;
  taskCount.textContent = `${openCount} ${openCount === 1 ? "task" : "tasks"}`;
  taskList.innerHTML = "";

  if (!visibleTasks.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = getEmptyText();
    taskList.append(empty);
    return;
  }

  visibleTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.done ? " done" : ""}`;
    item.dataset.id = task.id;

    item.innerHTML = `
      <div class="task-main">
        <input type="checkbox" ${task.done ? "checked" : ""} aria-label="Mark ${escapeHtml(task.title)} complete">
        <div>
          <p class="task-title">${escapeHtml(task.title)}</p>
          <div class="task-meta">
            <span class="pill">${task.energy} energy</span>
            <span class="pill">${task.minutes} min</span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button type="button" data-action="select">Set as next</button>
        <button type="button" data-action="tiny">Tiny steps</button>
        <button type="button" data-action="delete">Remove</button>
      </div>
    `;

    item.querySelector("input").addEventListener("change", (event) => toggleTask(task.id, event.target.checked));
    item.querySelector('[data-action="select"]').addEventListener("click", () => selectTask(task.id));
    item.querySelector('[data-action="tiny"]').addEventListener("click", () => {
      selectTask(task.id);
      renderTinySteps();
    });
    item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteTask(task.id));
    taskList.append(item);
  });
}

function getFilteredTasks() {
  const tasks = [...state.tasks].sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt - a.createdAt);
  if (activeFilter === "low") return tasks.filter((task) => task.energy === "low" && !task.done);
  if (activeFilter === "quick") return tasks.filter((task) => task.minutes <= 10 && !task.done);
  if (activeFilter === "done") return tasks.filter((task) => task.done);
  return tasks;
}

function getEmptyText() {
  if (activeFilter === "low") return "No low-energy tasks yet. Add one gentle option for future you.";
  if (activeFilter === "quick") return "No quick tasks yet. A five minute task can be enough.";
  if (activeFilter === "done") return "No completed tasks yet.";
  return "Your task space is clear. Add anything that is taking up attention.";
}

function renderNextCard() {
  const task = getSelectedTask();
  if (!task) {
    nextCard.innerHTML = `
      <p>No task selected yet.</p>
      <small>Poli works best when the next action is small enough to begin in two minutes.</small>
    `;
    return;
  }

  nextCard.innerHTML = `
    <p>${escapeHtml(task.title)}</p>
    <small>${task.energy} energy / about ${task.minutes} minutes / ${task.done ? "completed" : "ready"}</small>
  `;
}

function renderRoutines() {
  routineList.innerHTML = "";

  state.routines.forEach((routine) => {
    const card = document.createElement("article");
    card.className = "routine";
    card.innerHTML = `<h3>${escapeHtml(routine.title)}</h3>`;

    routine.steps.forEach((step, index) => {
      const id = `${routine.id}-${index}`;
      const label = document.createElement("label");
      label.innerHTML = `
        <input type="checkbox" ${state.routineProgress[id] ? "checked" : ""}>
        <span>${escapeHtml(step)}</span>
      `;
      label.querySelector("input").addEventListener("change", (event) => {
        state.routineProgress[id] = event.target.checked;
        saveState();
      });
      card.append(label);
    });

    routineList.append(card);
  });
}

function toggleTask(id, done) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.done = done;
  task.completedAt = done ? Date.now() : null;
  if (done && selectedTaskId === id) selectedTaskId = null;
  saveState();
  render();
  setNote(done ? "That counts. You completed a step." : "Task returned to the list.");
}

function selectTask(id) {
  selectedTaskId = id;
  tinySteps.hidden = true;
  saveState();
  renderNextCard();
  setNote("This is your next step. You only need to begin.");
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  if (selectedTaskId === id) selectedTaskId = null;
  saveState();
  render();
  setNote("Task removed.");
}

function clearDoneTasks() {
  state.tasks = state.tasks.filter((task) => !task.done);
  saveState();
  render();
  setNote("Completed tasks cleared.");
}

function renderDashboard() {
  const openTasks = state.tasks.filter((task) => !task.done).length;
  const doneToday = state.tasks.filter((task) => task.done && isToday(task.completedAt)).length;
  const choreTotals = getChoreTotals();
  const chorePercent = choreTotals.total ? Math.round((choreTotals.done / choreTotals.total) * 100) : 0;
  const totalActions = state.tasks.length + choreTotals.total;
  const completedActions = state.tasks.filter((task) => task.done).length + choreTotals.done;
  const overallPercent = totalActions ? Math.round((completedActions / totalActions) * 100) : 0;

  progressGrid.innerHTML = `
    <div class="stat-card">
      <strong>${openTasks}</strong>
      <span>open task${openTasks === 1 ? "" : "s"}</span>
    </div>
    <div class="stat-card">
      <strong>${doneToday}</strong>
      <span>task${doneToday === 1 ? "" : "s"} completed today</span>
    </div>
    <div class="stat-card">
      <strong>${chorePercent}%</strong>
      <span>household progress</span>
    </div>
    <div class="stat-card">
      <strong>${state.focusMinutesDone}</strong>
      <span>focus minutes completed</span>
    </div>
  `;

  progressBarFill.style.width = `${overallPercent}%`;
  progressMessage.textContent = getProgressMessage(overallPercent, completedActions);
}

function renderChores() {
  choreList.innerHTML = "";

  state.chores.forEach((chore) => {
    const doneCount = chore.steps.filter((_, index) => state.choreProgress[`${chore.id}-${index}`]).length;
    const card = document.createElement("article");
    card.className = "chore-card";
    card.innerHTML = `
      <div class="chore-card-header">
        <div>
          <h3>${escapeHtml(chore.title)}</h3>
          <small>${chore.minutes} minute room reset / ${doneCount} of ${chore.steps.length} done</small>
        </div>
        <span class="pill">${Math.round((doneCount / chore.steps.length) * 100)}%</span>
      </div>
    `;

    chore.steps.forEach((step, index) => {
      const id = `${chore.id}-${index}`;
      const label = document.createElement("label");
      label.innerHTML = `
        <input type="checkbox" ${state.choreProgress[id] ? "checked" : ""}>
        <span>${escapeHtml(step)}</span>
      `;
      label.querySelector("input").addEventListener("change", (event) => {
        state.choreProgress[id] = event.target.checked;
        saveState();
        renderChores();
        renderDashboard();
        setNote(event.target.checked ? "Household progress counts, even one checkbox at a time." : "Chore step returned.");
      });
      card.append(label);
    });

    choreList.append(card);
  });
}

function pickChore() {
  const remaining = [];
  state.chores.forEach((chore) => {
    chore.steps.forEach((step, index) => {
      const id = `${chore.id}-${index}`;
      if (!state.choreProgress[id]) remaining.push({ chore, step, id });
    });
  });

  if (!remaining.length) {
    setNote("All household steps are checked off. That is enough for now.");
    return;
  }

  const next = remaining[0];
  const task = {
    id: createId(),
    title: `${next.chore.title}: ${next.step}`,
    energy: "low",
    minutes: Math.min(next.chore.minutes, 10),
    done: false,
    createdAt: Date.now(),
    source: "chore"
  };
  state.tasks.unshift(task);
  selectedTaskId = task.id;
  saveState();
  render();
  setNote(`I added one chore step to Today: ${task.title}.`);
}

function resetChores() {
  state.choreProgress = {};
  saveState();
  renderChores();
  renderDashboard();
  setNote("Household chores reset.");
}

function pickNextTask() {
  const openTasks = state.tasks.filter((task) => !task.done);
  if (!openTasks.length) {
    setNote("Add one task first. Even a messy brain dump is enough.");
    taskTitle.focus();
    return;
  }

  const energyScore = { low: 0, medium: 1, high: 2 };
  const [bestTask] = openTasks.sort((a, b) => {
    if (energyScore[a.energy] !== energyScore[b.energy]) return energyScore[a.energy] - energyScore[b.energy];
    return a.minutes - b.minutes;
  });

  selectedTaskId = bestTask.id;
  tinySteps.hidden = true;
  saveState();
  renderNextCard();
  setNote(`Try this: ${bestTask.title}. Start with the first visible part.`);
}

function enterOverwhelmMode() {
  activeFilter = "low";
  document.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === "low"));
  const lowTask = state.tasks.find((task) => !task.done && task.energy === "low");
  if (lowTask) selectedTaskId = lowTask.id;
  saveState();
  renderTasks();
  renderNextCard();
  renderTinySteps(true);
  document.querySelector(".next-panel").scrollIntoView({ behavior: state.reducedMotion ? "auto" : "smooth", block: "start" });
  setNote("Screen simplified. Take one breath, then choose only the first tiny action.");
}

function renderTinySteps(isOverwhelm = false) {
  const task = getSelectedTask();
  if (!task) {
    setNote("Choose a task first, then I can make it smaller.");
    return;
  }

  const steps = buildTinySteps(task.title, isOverwhelm);
  tinySteps.hidden = false;
  tinySteps.innerHTML = `
    <p>Tiny version</p>
    <ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
  `;
}

function buildTinySteps(title, isOverwhelm) {
  const base = [
    "Open or gather only what this task needs.",
    `Do the smallest first piece of "${title}".`,
    "Stop after two minutes or continue if it feels okay."
  ];

  if (isOverwhelm) {
    return ["Put both feet on the floor.", "Lower the task to one visible movement.", ...base.slice(1)];
  }

  if (/email|message|reply|send/i.test(title)) {
    return ["Open the message.", "Write one imperfect sentence.", "Send it or save the draft."];
  }

  if (/clean|tidy|laundry|dishes|trash/i.test(title)) {
    return ["Pick one small area.", "Move five items only.", "Pause and decide whether to continue."];
  }

  if (/call|appointment|book|schedule/i.test(title)) {
    return ["Find the phone number or booking page.", "Write the first sentence before starting.", "Make the call or choose one appointment slot."];
  }

  return base;
}

function getSelectedTask() {
  return state.tasks.find((task) => task.id === selectedTaskId && !task.done) || null;
}

function setNote(text) {
  poliNote.textContent = text;
}

function toggleTimer() {
  if (timerInterval) {
    stopTimer();
    setNote("Timer paused. Pauses are allowed.");
  } else {
    startTimer();
  }
}

function startTimer() {
  if (timerInterval) return;
  timerToggleButton.textContent = "Pause";
  setNote("Focus started. Just stay with the next tiny action.");
  timerInterval = setInterval(() => {
    timerSeconds -= 1;
    renderTimer();
    if (timerSeconds <= 0) {
      stopTimer();
      state.focusMinutesDone += state.timerMinutes;
      saveState();
      timerSeconds = state.timerMinutes * 60;
      renderTimer();
      renderDashboard();
      setNote("Focus complete. Mark the task done, take a break, or choose another tiny step.");
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerToggleButton.textContent = "Start";
}

function resetTimer() {
  stopTimer();
  timerSeconds = state.timerMinutes * 60;
  renderTimer();
  setNote("Timer reset.");
}

function renderTimer() {
  const minutes = Math.floor(timerSeconds / 60).toString().padStart(2, "0");
  const seconds = (timerSeconds % 60).toString().padStart(2, "0");
  timerDisplay.textContent = `${minutes}:${seconds}`;
}

function updateTimerOptions() {
  document.querySelectorAll(".timer-options button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === state.timerMinutes);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getChoreTotals() {
  const total = state.chores.reduce((sum, chore) => sum + chore.steps.length, 0);
  const done = Object.values(state.choreProgress).filter(Boolean).length;
  return { total, done };
}

function getProgressMessage(percent, completedActions) {
  if (!completedActions) return "No pressure. One checkbox or five minutes is a valid start.";
  if (percent < 35) return "You have started. That matters more than finishing everything.";
  if (percent < 75) return "There is visible progress now. Keep the next step small.";
  return "Most of today's visible work is handled. Consider stopping before burnout.";
}

function isToday(timestamp) {
  if (!timestamp) return false;
  const date = new Date(timestamp);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
}
