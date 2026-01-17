// Initialize OpenTelemetry tracing as early as possible
require('./tracing');

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { Pool } = require("pg");
const logger = require("./logger");

const app = express();
const PORT = process.env.PORT || 3001;
const metrics = require('./metrics');

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
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Metrics: instrument requests (skip the /metrics endpoint itself)
app.use((req, res, next) => {
  if (req.path === '/metrics') return next();
  metrics.middleware(req, res, next);
});

// Password hashing helper (same as client-side)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

/* ================================
   Initialize DB Table
================================ */
const initDB = async () => {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create notes table with user_id reference
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        content TEXT,
        pinned BOOLEAN DEFAULT FALSE,
        archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    logger.info("PostgreSQL tables ready ✅");
  } catch (err) {
    logger.error("Failed to initialize database", err);
  }
};

initDB();

/* ================================
   API Routes
================================ */

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: "connected" });
});

// Authentication Routes
// Register
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, passwordConfirm } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  if (password !== passwordConfirm) {
    return res.status(400).json({ error: "Passwords do not match." });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered. Please login." });
    }

    // Hash password
    const hashedPassword = hashPassword(password);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.toLowerCase().trim(), hashedPassword]
    );

    const user = result.rows[0];

    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    logger.info(`User registered: ${user.email} (ID: ${user.id})`);
    res.status(201).json({
      success: true,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    logger.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    // Get user
    const result = await pool.query(
      "SELECT id, name, email, password FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = result.rows[0];

    // Verify password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    logger.info(`User logged in: ${user.email} (ID: ${user.id})`);
    res.json({
      success: true,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    logger.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed." });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user (check session)
app.get("/api/auth/me", (req, res) => {
  if (req.session && req.session.userId) {
    pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [req.session.userId]
    ).then(result => {
      if (result.rows.length > 0) {
        const user = result.rows[0];
        res.json({
          success: true,
          user: {
            id: user.id.toString(),
            name: user.name,
            email: user.email
          }
        });
      } else {
        res.status(401).json({ error: "User not found." });
      }
    }).catch(err => {
      logger.error("Get user error:", err);
      res.status(500).json({ error: "Failed to get user." });
    });
  } else {
    res.status(401).json({ error: "Not authenticated." });
  }
});

// Notes Routes (all require authentication)
// Get all notes for current user
app.get("/api/notes", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC",
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Create a note
app.post("/api/notes", requireAuth, async (req, res) => {
  const { title = "", content = "" } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO notes (user_id, title, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.session.userId, title.trim(), content.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// Update a note (only if user owns it)
app.put("/api/notes/:id", requireAuth, async (req, res) => {
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
      WHERE id = $5 AND user_id = $6
      RETURNING *
      `,
      [
        updates.title,
        updates.content,
        updates.pinned,
        updates.archived,
        id,
        req.session.userId,
      ]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Not found" });

    res.json(result.rows[0]);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

// Delete a note (only if user owns it)
app.delete("/api/notes/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM notes WHERE id = $1 AND user_id = $2",
      [id, req.session.userId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ error: "Not found" });

    res.status(204).end();
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ================================
   Start Server
================================ */
// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  } catch (err) {
    logger.error('Failed to collect metrics', err);
    res.status(500).end();
  }
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
