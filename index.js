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
app.set('layout', path.join('partials', 'layout')); // views/partials/layout.ejs

// parse bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// static assets (CSS, images, client JS)
app.use(express.static(path.join(__dirname, 'public')));

/* -----------------------------
   Sessions
----------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

/* -----------------------------
   Template locals (fixes user/isManager undefined)
----------------------------- */
app.use((req, res, next) => {
  const user = req.session.user || null; // { id, email, role }
  res.locals.user = user;
  res.locals.isManager = !!(user && user.role === 'manager');
  res.locals.title = 'Ella Rises'; // default title
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
  if (!req.session.user || req.session.user.role !== 'manager') {
    return res.status(403).send('Forbidden (manager only)');
  }
  next();
}

/* -----------------------------
   Routes: Landing + Public
----------------------------- */
app.get('/', (req, res) => {
  res.render('index'); // title provided by res.locals
});

app.get('/participants', (req, res) => res.render('participants', { title: 'Participants' }));
app.get('/events', (req, res) => res.render('events', { title: 'Events' }));
app.get('/surveys', (req, res) => res.render('surveys', { title: 'Surveys' }));
app.get('/milestones', (req, res) => res.render('milestones', { title: 'Milestones' }));
app.get('/donations', (req, res) => res.render('donations', { title: 'Donations' }));

/* -----------------------------
   Auth: Login / Register / Logout
----------------------------- */
// Login page
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login', error: null, created: undefined });
});

// Handle login  (NOTE: replace with bcrypt compare soon)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const q = 'SELECT userid, email, passwordhash, role FROM "User" WHERE email = $1 LIMIT 1';
    const { rows } = await pool.query(q, [email]);

    if (rows.length === 0) {
      return res.render('login', { title: 'Login', error: 'Invalid email or password', created: undefined });
    }
    const user = rows[0];

    // TODO: bcrypt.compare(password, user.passwordhash)
    const ok = user.passwordhash === password;
    if (!ok) {
      return res.render('login', { title: 'Login', error: 'Invalid email or password', created: undefined });
    }

    req.session.user = { id: user.userid, email: user.email, role: user.role || 'user' };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { title: 'Login', error: 'Unexpected error. Please try again.', created: undefined });
  }
});

// Register page -> views/users/addusers.ejs
app.get('/register', (req, res) => {
  res.render(path.join('users', 'addusers'), {
    title: 'Create Account',
    error: null,
    created: undefined,
  });
});

// Handle register (simple demo insert)
app.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, role } = req.body;
  try {
    const q =
      'INSERT INTO "User"(firstname, lastname, email, passwordhash, role) VALUES ($1,$2,$3,$4,$5) RETURNING userid, email, role';
    const { rows } = await pool.query(q, [
      firstName || null,
      lastName || null,
      email,
      password, // TODO: bcrypt hash
      role || 'user',
    ]);

    res.render('login', {
      title: 'Login',
      error: null,
      created: `Account created for ${rows[0].email}. You can log in now.`,
    });
  } catch (err) {
    console.error('Register error:', err);
    let msg = 'Could not create account.';
    if (err.code === '23505') msg = 'Email already exists.';
    res.render(path.join('users', 'addusers'), {
      title: 'Create Account',
      error: msg,
      created: undefined,
    });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* -----------------------------
   Authenticated pages
----------------------------- */
app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { title: 'Dashboard' });
});

// Manager-only
app.get('/admin/milestones', requireManager, (req, res) => {
  res.render('admin/milestones', { title: 'Manage Milestones' });
});
app.get('/admin/users', requireManager, (req, res) => {
  res.render('admin/users', { title: 'Manage Users' });
});

/* -----------------------------
   Health
----------------------------- */
app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.send('ok');
  } catch {
    res.status(500).send('db error');
  }
});

/* -----------------------------
   Start
----------------------------- */
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`✅ Ella Rises running → http://localhost:${PORT}`);
});