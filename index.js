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
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT || 5432),
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

/* -----------------------------
   EJS + Layouts + Static
----------------------------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);
// Global layout: views/partials/layout.ejs
app.set('layout', path.join('partials', 'layout'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static assets (CSS, images, JS in /public)
app.use(express.static(path.join(__dirname, 'public')));

/* -----------------------------
   Sessions + View locals
----------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

// Make the logged-in user available to all EJS views as `currentUser`
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null; // { id, email, role }
  next();
});

/* -----------------------------
   Auth helpers
----------------------------- */
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireManager(req, res, next) {
  const u = req.session.user;
  if (!u || (u.role !== 'manager' && u.role !== 'admin')) {
    return res.status(403).send('Forbidden (manager only)');
  }
  next();
}

/* -----------------------------
   PUBLIC PAGES (match your folders)
----------------------------- */

// Landing page -> views/index.ejs
app.get('/', (req, res) => {
  res.render('index', { title: 'Ella Rises' });
});

// Donations -> views/donations/index.ejs (or adjust if you have a different file)
app.get('/donations', (req, res) => {
  res.render(path.join('donations', 'index'), { title: 'Donations' });
});

// Events -> views/events/index.ejs
app.get('/events', (req, res) => {
  res.render(path.join('events', 'index'), { title: 'Events' });
});

// Surveys -> views/Surveys/index.ejs  (note the capital “S” in your tree)
app.get('/surveys', (req, res) => {
  res.render(path.join('Surveys', 'index'), { title: 'Surveys' });
});

// Milestones -> views/milestones/index.ejs
app.get('/milestones', (req, res) => {
  res.render(path.join('milestones', 'index'), { title: 'Milestones' });
});

/* -----------------------------
   AUTH (Login / Register / Logout)
----------------------------- */

// Login page -> views/login/login.ejs
app.get('/login', (req, res) => {
  res.render(path.join('login', 'login'), { title: 'Login', error: null, created: undefined });
});

// Handle Login (simple demo; replace with bcrypt later)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Example schema: "User"(userid, email, passwordhash, role)
    const q =
      'SELECT userid, email, passwordhash, role FROM "User" WHERE email = $1 LIMIT 1';
    const { rows } = await pool.query(q, [email]);

    if (rows.length === 0) {
      return res.render(path.join('login', 'login'), {
        title: 'Login',
        error: 'Invalid email or password',
        created: undefined
      });
    }

    const user = rows[0];
    // TODO: bcrypt compare
    const ok = user.passwordhash === password;
    if (!ok) {
      return res.render(path.join('login', 'login'), {
        title: 'Login',
        error: 'Invalid email or password',
        created: undefined
      });
    }

    req.session.user = { id: user.userid, email: user.email, role: user.role || 'user' };
    return res.redirect('/my-account');
  } catch (err) {
    console.error('Login error:', err);
    return res.render(path.join('login', 'login'), {
      title: 'Login',
      error: 'Unexpected error. Please try again.',
      created: undefined
    });
  }
});

// Register page -> views/login/register.ejs
app.get('/register', (req, res) => {
  res.render(path.join('login', 'register'), { title: 'Create Account', error: null });
});

// Handle Register -> inserts, then shows login success note
app.post('/register', async (req, res) => {
  const {
    firstName, lastName, email, password, confirmPassword,
    dob, schoolOrJob, phone, city, state, zipcode,
    interest_arts, interest_stem, interest_both
  } = req.body;

  try {
    if (password !== confirmPassword) {
      return res.render(path.join('login', 'register'), {
        title: 'Create Account',
        error: 'Passwords do not match.',
      });
    }

    const q = `
      INSERT INTO "User" (
        firstname, lastname, email, passwordhash, dob,
        school_or_job, phone, city, state, zipcode,
        interest_arts, interest_stem, interest_both, role
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING userid, email, role
    `;
    const params = [
      firstName || null,
      lastName  || null,
      email,
      password, // TODO: bcrypt hash
      dob       || null,
      schoolOrJob || null,
      phone     || null,
      city      || null,
      state     || null,
      zipcode   || null,
      !!interest_arts,
      !!interest_stem,
      !!interest_both,
      'user'
    ];

    await pool.query(q, params);

    // Show success ribbon on login screen
    return res.render(path.join('login', 'login'), {
      title: 'Login',
      error: null,
      created: true
    });
  } catch (err) {
    console.error('Register error:', err);
    let msg = 'Could not create account.';
    if (err.code === '23505') msg = 'Email already exists.';
    return res.render(path.join('login', 'register'), {
      title: 'Create Account',
      error: msg,
    });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* -----------------------------
   AUTHENTICATED PAGES
----------------------------- */

// My Account -> views/account/index.ejs
app.get('/my-account', requireAuth, (req, res) => {
  res.render(path.join('account', 'index'), { title: 'My Account' });
});

// Manager/Admin pages
// All Users -> views/allUsers/index.ejs
app.get('/admin/users', requireManager, (req, res) => {
  res.render(path.join('allUsers', 'index'), { title: 'All Users' });
});

// Manage Milestones (admin) -> views/milestones/manage.ejs (if you have it)
app.get('/admin/milestones', requireManager, (req, res) => {
  res.render(path.join('milestones', 'manage'), { title: 'Manage Milestones' });
});

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

// 404
app.use((req, res) => {
  res.status(404).render('partials/404', { title: 'Not Found' });
});

/* -----------------------------
   Start
----------------------------- */
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Ella Rises running → http://localhost:${PORT}`);
});