const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "notes.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readNotes() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    console.error("Failed to read notes.json", e);
    return [];
  }
}

function writeNotes(notes) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2), "utf8");
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// API
app.get("/api/notes", (req, res) => {
  const notes = readNotes();
  res.json(notes);
});

app.post("/api/notes", (req, res) => {
  const { title = "", content = "" } = req.body || {};
  const now = new Date().toISOString();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const newNote = {
    id,
    title: String(title).trim(),
    content: String(content).trim(),
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false,
  };
  const notes = readNotes();
  notes.push(newNote);
  writeNotes(notes);
  res.status(201).json(newNote);
});

app.put("/api/notes/:id", (req, res) => {
  const id = req.params.id;
  const updates = req.body || {};
  const notes = readNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  notes[idx] = {
    ...notes[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeNotes(notes);
  res.json(notes[idx]);
});

app.delete("/api/notes/:id", (req, res) => {
  const id = req.params.id;
  let notes = readNotes();
  const before = notes.length;
  notes = notes.filter((n) => n.id !== id);
  if (notes.length === before) return res.status(404).json({ error: "Not found" });
  writeNotes(notes);
  res.status(204).end();
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
