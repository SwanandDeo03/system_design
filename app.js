// Simple Notes / Diary App using backend API

const API_BASE = "/api/notes";

let notes = [];
let currentlyEditingId = null;

// Elements
const noteTitleEl = document.getElementById("noteTitle");
const noteContentEl = document.getElementById("noteContent");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const notesContainer = document.getElementById("notesContainer");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const emptyStateEl = document.getElementById("emptyState");

async function fetchNotes() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    notes = await res.json();
    renderNotes();
  } catch (e) {
    console.error("Failed to load notes from API:", e);
    notes = [];
    renderNotes();
  }
}

function clearEditor() {
  noteTitleEl.value = "";
  noteContentEl.value = "";
  currentlyEditingId = null;
  saveBtn.textContent = "Save Note";
}

function createNote(title, content) {
  const now = new Date().toISOString();
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    title: title.trim(),
    content: content.trim(),
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

function renderNotes() {
  const query = searchInput.value.toLowerCase().trim();
  const sortBy = sortSelect.value;

  let filtered = notes.filter((n) => {
    const target = (n.title + " " + n.content).toLowerCase();
    return target.includes(query);
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

    const meta = document.createElement("span");
    meta.textContent = formatDate(note.updatedAt);

    const actions = document.createElement("div");
    actions.className = "note-card-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "icon-btn";
    pinBtn.textContent = note.pinned ? "Unpin" : "Pin";
    pinBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await fetch(`${API_BASE}/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: !note.pinned }),
        });
        await fetchNotes();
      } catch (err) {
        console.error(err);
      }
    });

    const archiveBtn = document.createElement("button");
    archiveBtn.className = "icon-btn";
    archiveBtn.textContent = note.archived ? "Unarchive" : "Archive";
    archiveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await fetch(`${API_BASE}/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: !note.archived }),
        });
        await fetchNotes();
      } catch (err) {
        console.error(err);
      }
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this note?")) return;
      try {
        await fetch(`${API_BASE}/${note.id}`, { method: "DELETE" });
        await fetchNotes();
      } catch (err) {
        console.error(err);
      }
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
      noteTitleEl.value = note.title;
      noteContentEl.value = note.content;
      saveBtn.textContent = "Update Note";
      noteTitleEl.focus();
    });

    notesContainer.appendChild(card);
  }
}

async function handleSave() {
  const title = noteTitleEl.value.trim();
  const content = noteContentEl.value.trim();

  if (!title && !content) {
    alert("Write something before saving.");
    return;
  }

  try {
    if (currentlyEditingId) {
      await fetch(`${API_BASE}/${currentlyEditingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
    } else {
      await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
    }
    clearEditor();
    await fetchNotes();
  } catch (err) {
    console.error("Save failed:", err);
    alert("Failed to save note. See console for details.");
  }
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

noteContentEl.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "Enter") {
    handleSave();
  }
});

// Init — load from backend
fetchNotes();


