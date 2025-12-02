// index.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const { Pool } = require('pg');

const app = express();

/* -----------------------------
   Database (Postgres)
----------------------------- */
const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST,
  user: process.env.PGUSER || process.env.DB_USER,
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
  database: process.env.PGDATABASE || process.env.DB_NAME,
  port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

/* -----------------------------
   EJS + Layouts + Static
----------------------------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
// Global layout file: views/partials/layout.ejs
app.set('layout', path.join('partials', 'layout'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Public assets (/public/css, /public/images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

/* -----------------------------
   Sessions + expose user to views
----------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// available in all EJS as `currentUser`
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null; // { id, email, role }
  next();
});

/* -----------------------------
   Auth guards
----------------------------- */
function mapRole(level) {
  const v = (level || 'user').toString().trim().toLowerCase();
  if (v === 'a' || v === 'admin') return 'admin';
  if (v === 'm' || v === 'manager') return 'manager';
  return 'user';
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireManager(req, res, next) {
  const u = req.session.user;
  if (!u) return res.status(403).send('Forbidden (manager only)');
  const r = mapRole(u.role);
  if (r !== 'manager' && r !== 'admin') {
    return res.status(403).send('Forbidden (manager only)');
  }
  next();
}

/* -----------------------------
   PUBLIC PAGES  (match your /views tree exactly)
----------------------------- */

// / -> views/index.ejs
app.get('/', (req, res) => {
  res.render('index', { title: 'Ella Rises' });
});

// /donations -> views/donations/donations.ejs
app.get('/donations', (req, res) => {
  res.render(path.join('donations', 'donations'), { title: 'Donations' });
});

// /events -> views/events/events.ejs
app.get('/events', (req, res) => {
  res.render(path.join('events', 'events'), { title: 'Events' });
});

// /surveys -> views/Surveys/userSurveys.ejs   (capital S in your folder)
app.get('/surveys', (req, res) => {
  res.render(path.join('Surveys', 'userSurveys'), { title: 'Surveys' });
});

// /milestones (public) -> views/milestones/userMilestones.ejs
app.get('/milestones', (req, res) => {
  res.render(path.join('milestones', 'userMilestones'), { title: 'Milestones' });
});

/* -----------------------------
   AUTH (Login / Register / Logout)
----------------------------- */

// GET /login -> views/login/login.ejs
app.get('/login', (req, res) => {
  res.render(path.join('login', 'login'), {
    title: 'Login',
    error: null,
    created: undefined,
  });
});

// POST /login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const q = `
      SELECT userid, username, password, level
      FROM users
      WHERE username = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [username]);

    if (rows.length === 0) {
      return res.render(path.join('login', 'login'), {
        title: 'Login',
        error: 'Invalid username or password',
        created: undefined,
      });
    }

    const user = rows[0];
    // TODO: replace with bcrypt.compare(...)
    const ok = user.password === password;
    if (!ok) {
      return res.render(path.join('login', 'login'), {
        title: 'Login',
        error: 'Invalid username or password',
        created: undefined,
      });
    }

    req.session.user = {
      id: user.userid,
      username: user.username,
      role: mapRole(user.level),
    };
    return res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    return res.render(path.join('login', 'login'), {
      title: 'Login',
      error: 'Unexpected error. Please try again.',
      created: undefined,
    });
  }
});

// Accept legacy link /login/register -> redirect to /register
app.get('/login/register', (_req, res) => res.redirect('/register'));

// GET /register -> views/login/register.ejs
app.get('/register', (req, res) => {
  res.render(path.join('login', 'register'), { title: 'Create Account', error: null });
});

// POST /register
app.post('/register', async (req, res) => {
  const {
    username,
    password,
    confirmPassword,
    firstName,
    lastName,
    email,
    dob,
    schoolOrJob,
    phone,
    city,
    state,
    zipcode,
    interest_arts,
    interest_stem,
    interest_both,
  } = req.body;

  const fieldOfInterest = interest_both
    ? 'both'
    : interest_arts
    ? 'arts'
    : interest_stem
    ? 'stem'
    : null;

  const affiliationType = schoolOrJob ? 'school_or_job' : null;

  let client;
  try {
    if (!username) {
      return res.render(path.join('login', 'register'), {
        title: 'Create Account',
        error: 'Username is required.',
      });
    }

    if (password !== confirmPassword) {
      return res.render(path.join('login', 'register'), {
        title: 'Create Account',
        error: 'Passwords do not match.',
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const authInsert = await client.query(
      `INSERT INTO users (username, password, level)
       VALUES ($1, $2, $3)
       RETURNING userid, username, level`,
      [username, password, 'u'] // TODO: bcrypt hash
    );

    await client.query(
      `INSERT INTO participant (
        participantemail,
        participantfirstname,
        participantlastname,
        participantdob,
        participantrole,
        participantphone,
        participantcity,
        participantstate,
        participantzip,
        participantaffiliationtype,
        participantaffiliationname,
        participantfieldofinterest,
        totaldonations
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        email || null,
        firstName || null,
        lastName || null,
        dob || null,
        'participant',
        phone || null,
        city || null,
        state || null,
        zipcode || null,
        affiliationType,
        schoolOrJob || null,
        fieldOfInterest,
        0,
      ]
    );

    await client.query('COMMIT');

    // Show success ribbon on login screen
    return res.render(path.join('login', 'login'), {
      title: 'Login',
      error: null,
      created: 'Your account was created successfully. Please log in.',
    });
  } catch (err) {
    console.error('Register error:', err);
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }

    let msg = 'Could not create account.';
    if (err.code === '23505') msg = 'Username already exists.';
    return res.render(path.join('login', 'register'), {
      title: 'Create Account',
      error: msg,
    });
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseErr) {
        console.error('Release error:', releaseErr);
      }
    }
  }
});

// Allow GET /logout from navbar and POST /logout from forms
app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));
app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

/* -----------------------------
   AUTHENTICATED PAGES
----------------------------- */

// /my-account -> views/account/account.ejs
app.get('/my-account', requireAuth, (req, res) => {
  res.render(path.join('account', 'account'), { title: 'My Account' });
});

/* -------- Optional manager routes based on your files -------- */

// /admin/milestones -> views/milestones/manMilestones.ejs
app.get('/admin/milestones', requireManager, (req, res) => {
  res.render(path.join('milestones', 'manMilestones'), { title: 'Manage Milestones' });
});

// If you later add an “all users” page, point it at the real file:
// app.get('/admin/users', requireManager, (req, res) => {
//   res.render(path.join('allUsers', 'index'), { title: 'All Users' });
// });

/* -----------------------------
   Health & 404
----------------------------- */
app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send('ok');
  } catch {
    res.status(500).send('db error');
  }
});

// Simple 404 so we don't depend on a missing partial
app.use((_req, res) => {
  res.status(404).send('Not Found');
});

/* -----------------------------
   Start
----------------------------- */
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Ella Rises running → http://localhost:${PORT}`);
});
