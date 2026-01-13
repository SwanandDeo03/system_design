const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3001;

/* ================================
   PostgreSQL Connection
================================ */
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/* ================================
   Middleware
================================ */
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

/* ================================
   Initialize DB Table
================================ */
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id UUID PRIMARY KEY,
      title TEXT,
      content TEXT,
      pinned BOOLEAN DEFAULT FALSE,
      archived BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("PostgreSQL tables ready ✅");
};

initDB();

/* ================================
   API Routes
================================ */

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: "connected" });
});

// Get all notes
app.get("/api/notes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notes ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Create a note
app.post("/api/notes", async (req, res) => {
  const { title = "", content = "" } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO notes (id, title, content)
       VALUES (gen_random_uuid(), $1, $2)
       RETURNING *`,
      [title.trim(), content.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// Update a note
app.put("/api/notes/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE notes
      SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        pinned = COALESCE($3, pinned),
        archived = COALESCE($4, archived),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
      `,
      [
        updates.title,
        updates.content,
        updates.pinned,
        updates.archived,
        id,
      ]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// Delete a note
app.delete("/api/notes/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM notes WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Not found" });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ================================
   Start Server
================================ */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
