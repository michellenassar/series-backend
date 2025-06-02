require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
 
// Get DB connection string from .env
const connectionString = process.env.DB_URL;

const pool = new Pool({
  connectionString,
});

// Tables creation queries
const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shows (
      ShowId SERIAL PRIMARY KEY,
      Title VARCHAR(255) UNIQUE NOT NULL,
      Poster VARCHAR(500),
      Genre VARCHAR(100),
      Seasons INT,
      Summary TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS watched (
        WatchedId SERIAL PRIMARY KEY,
        Title VARCHAR(255) NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        WatchlistId SERIAL PRIMARY KEY,
        UserId INT NOT NULL,
        ShowId INT NOT NULL REFERENCES shows(ShowId) ON DELETE CASCADE,
        AddedOn TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Title VARCHAR(255) NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        UserId SERIAL PRIMARY KEY,
        Name VARCHAR(255),
        Email VARCHAR(255) UNIQUE NOT NULL,
        Password VARCHAR(255) NOT NULL
      );
    `);

    console.log("All tables created or already exist");
  } catch (err) {
    console.error("Error creating tables", err);
  }
};

// Call the createTables on server start
createTables();

app.get('/', (req, res) => {
  res.json("from db");
});

app.get("/shows", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM shows");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});
app.post('/addShows', async (req, res) => {
  const { Title, Poster, Genre, Seasons, Summary } = req.body;

  if (!Title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  try {
    await pool.query(
      `INSERT INTO shows (Title, Poster, Genre, Seasons, Summary) VALUES ($1, $2, $3, $4, $5)`,
      [Title, Poster || null, Genre || null, Seasons || null, Summary || null]
    );
    res.status(201).json({ message: 'Show added successfully' });
  } catch (err) {
    // Handle duplicate title (unique constraint) or other errors
    if (err.code === '23505') {
      res.status(409).json({ message: 'A show with this title already exists' });
    } else {
      res.status(500).json({ message: 'Error adding show', error: err.message });
    }
  }
});

app.post('/watched', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  try {
    await pool.query("INSERT INTO watched (Title) VALUES ($1)", [title]);
    res.status(201).json({ message: 'Marked as watched successfully' });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get('/watched', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM watched");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get('/shows/genre/:genre', async (req, res) => {
  const { genre } = req.params;
  try {
    const result = await pool.query("SELECT * FROM shows WHERE Genre = $1", [genre]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get('/show/:title', async (req, res) => {
  const { title } = req.params;
  try {
    const result = await pool.query("SELECT * FROM shows WHERE Title = $1", [title]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'TV show not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.delete('/watched/:watchedId', async (req, res) => {
  const { watchedId } = req.params;
  if (!watchedId) return res.status(400).json({ message: 'WatchedId is required' });

  try {
    await pool.query("DELETE FROM watched WHERE WatchedId = $1", [watchedId]);
    res.json({ message: 'Removed from watched successfully' });
  } catch (err) {
    res.status(500).json(err);
  }
});
 
app.get('/watchlist', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM watchlist");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post('/watchlist', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  const userId = 1; // Hardcoded user id as in your original code

  try {
    const showRes = await pool.query("SELECT ShowId FROM shows WHERE Title = $1", [title]);
    if (showRes.rows.length === 0) {
      return res.status(404).json({ message: 'TV show not found' });
    }
    const showId = showRes.rows[0].showid;

    await pool.query(
      "INSERT INTO watchlist (UserId, ShowId, AddedOn, Title) VALUES ($1, $2, NOW(), $3)",
      [userId, showId, title]
    );

    res.status(201).json({ message: 'Added to watchlist successfully' });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.delete('/watchlist/:showId', async (req, res) => {
  const { showId } = req.params;
  if (!showId) return res.status(400).json({ message: 'ShowId is required' });

  try {
    await pool.query("DELETE FROM watchlist WHERE ShowId = $1", [showId]);
    res.json({ message: 'Removed from watchlist successfully' });
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get('/users', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password required' });

  try {
    await pool.query("INSERT INTO users (Name, Email, Password) VALUES ($1, $2, $3)", [name, email, password]);
    res.json({ Status: 'Success' });
  } catch (err) {
    res.status(500).json({ Error: 'Inserting data error', details: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  try {
    const result = await pool.query("SELECT * FROM users WHERE Email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ Error: 'No email existed' });
    }

    const user = result.rows[0];
    if (password === user.password) {
      res.json({ Status: 'Success' });
    } else {
      res.status(401).json({ Error: 'Password not matched' });
    }
  } catch (err) {
    res.status(500).json({ Error: 'Login error in server' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


