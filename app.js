// Simple Notes / Diary App with Date Functionality

const STORAGE_KEY = "myNotesApp";

let notes = [];
let currentlyEditingId = null;

// Elements
const noteTitleEl = document.getElementById("noteTitle");
const noteContentEl = document.getElementById("noteContent");
const noteDateEl = document.getElementById("noteDate");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const notesContainer = document.getElementById("notesContainer");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const filterDateSelect = document.getElementById("filterDateSelect");
const emptyStateEl = document.getElementById("emptyState");

// Load notes from localStorage
function loadNotes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    notes = stored ? JSON.parse(stored) : [];
    renderNotes();
  } catch (e) {
    console.error("Failed to load notes:", e);
    notes = [];
    renderNotes();
  }
}

// Save notes to localStorage
function saveNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error("Failed to save notes:", e);
    alert("Failed to save notes. Storage may be full.");
  }
}

// Initialize date input with today's date
noteDateEl.value = new Date().toISOString().split('T')[0];

function clearEditor() {
  noteTitleEl.value = "";
  noteContentEl.value = "";
  noteDateEl.value = new Date().toISOString().split('T')[0];
  currentlyEditingId = null;
  saveBtn.textContent = "Save Note";
}

function createNote(title, content, taskDate) {
  const now = new Date().toISOString();
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: title.trim(),
    content: content.trim(),
    taskDate: taskDate || new Date().toISOString().split('T')[0],
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
  };
}

// Note: updates and deletes are sent to the server. UI refreshes from server.

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTaskDate(dateString) {
  if (!dateString) return "No date";
  const d = new Date(dateString + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(d);
  taskDate.setHours(0, 0, 0, 0);
  
  const diffTime = taskDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0) return `In ${diffDays} days`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function isDateInRange(dateString, range) {
  if (!dateString || !range) return true;
  
  const taskDate = new Date(dateString + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (range === "today") {
    return taskDate.getTime() === today.getTime();
  }
  
  if (range === "thisWeek") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return taskDate >= weekStart && taskDate <= weekEnd;
  }
  
  if (range === "thisMonth") {
    return taskDate.getMonth() === today.getMonth() && 
           taskDate.getFullYear() === today.getFullYear();
  }
  
  return true;
}

function renderNotes() {
  const query = searchInput.value.toLowerCase().trim();
  const sortBy = sortSelect.value;
  const dateFilter = filterDateSelect.value;

  let filtered = notes.filter((n) => {
    const target = (n.title + " " + n.content).toLowerCase();
    const matchesSearch = target.includes(query);
    const matchesDateFilter = isDateInRange(n.taskDate, dateFilter);
    return matchesSearch && matchesDateFilter;
  });

  if (sortBy === "latest") {
    filtered.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } else if (sortBy === "oldest") {
    filtered.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } else if (sortBy === "title") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "taskDate") {
    filtered.sort((a, b) => {
      const dateA = a.taskDate ? new Date(a.taskDate).getTime() : 0;
      const dateB = b.taskDate ? new Date(b.taskDate).getTime() : 0;
      return dateA - dateB;
    });
  } else if (sortBy === "taskDateDesc") {
    filtered.sort((a, b) => {
      const dateA = a.taskDate ? new Date(a.taskDate).getTime() : 0;
      const dateB = b.taskDate ? new Date(b.taskDate).getTime() : 0;
      return dateB - dateA;
    });
  }

  // Pinned first, then others
  filtered.sort((a, b) => Number(b.pinned) - Number(a.pinned));

  notesContainer.innerHTML = "";

  if (filtered.length === 0) {
    emptyStateEl.style.display = "block";
    return;
  }

  emptyStateEl.style.display = "none";

  for (const note of filtered) {
    const card = document.createElement("article");
    card.className = "note-card";
    if (note.pinned) card.classList.add("pinned");
    if (note.archived) card.classList.add("archived");

    const titleEl = document.createElement("div");
    titleEl.className = "note-card-title";
    titleEl.textContent = note.title || "Untitled";

    const contentEl = document.createElement("div");
    contentEl.className = "note-card-content";
    contentEl.textContent = note.content || "(Empty note)";

    const footer = document.createElement("div");
    footer.className = "note-card-footer";

    const meta = document.createElement("div");
    meta.className = "note-card-meta";
    const taskDateEl = document.createElement("div");
    taskDateEl.className = "task-date-badge";
    taskDateEl.textContent = formatTaskDate(note.taskDate);
    const updatedEl = document.createElement("span");
    updatedEl.className = "note-updated";
    updatedEl.textContent = formatDate(note.updatedAt);
    meta.appendChild(taskDateEl);
    meta.appendChild(updatedEl);

    const actions = document.createElement("div");
    actions.className = "note-card-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "icon-btn";
    pinBtn.textContent = note.pinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      note.pinned = !note.pinned;
      saveNotes();
      renderNotes();
    });

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "icon-btn";
    archiveBtn.textContent = note.archived ? "Unarchive" : "Archive";
    archiveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      note.archived = !note.archived;
      saveNotes();
      renderNotes();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm("Delete this note?")) return;
      notes = notes.filter(n => n.id !== note.id);
      saveNotes();
      renderNotes();
    });

    actions.appendChild(pinBtn);
    actions.appendChild(archiveBtn);
    actions.appendChild(deleteBtn);

    footer.appendChild(meta);
    footer.appendChild(actions);

    card.appendChild(titleEl);
    card.appendChild(contentEl);
    card.appendChild(footer);

    card.addEventListener("click", () => {
      currentlyEditingId = note.id;
      noteTitleEl.value = note.title || "";
      noteContentEl.value = note.content || "";
      noteDateEl.value = note.taskDate || new Date().toISOString().split('T')[0];
      saveBtn.textContent = "Update Note";
      noteTitleEl.focus();
    });

    notesContainer.appendChild(card);
  }
}

function handleSave() {
  const title = noteTitleEl.value.trim();
  const content = noteContentEl.value.trim();
  const taskDate = noteDateEl.value;

  if (!title && !content) {
    alert("Write something before saving.");
    return;
  }

  if (currentlyEditingId) {
    const note = notes.find(n => n.id === currentlyEditingId);
    if (note) {
      note.title = title;
      note.content = content;
      note.taskDate = taskDate;
      note.updatedAt = new Date().toISOString();
    }
  } else {
    const newNote = createNote(title, content, taskDate);
    notes.push(newNote);
  }
  
  saveNotes();
  clearEditor();
  renderNotes();
}

// Event listeners
saveBtn.addEventListener("click", handleSave);

clearBtn.addEventListener("click", () => {
  clearEditor();
});

searchInput.addEventListener("input", () => {
  renderNotes();
});

sortSelect.addEventListener("change", () => {
  renderNotes();
});

filterDateSelect.addEventListener("change", () => {
  renderNotes();
});

noteContentEl.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    handleSave();
  }
});

// Init — load from localStorage
loadNotes();


