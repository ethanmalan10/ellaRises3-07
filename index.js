// index.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const { Pool } = require('pg');

const app = express();

/* ----------------------------------
   DATABASE
---------------------------------- */
const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST,
  user: process.env.PGUSER || process.env.DB_USER,
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
  database: process.env.PGDATABASE || process.env.DB_NAME,
  port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

/* ----------------------------------
   EJS + STATIC
---------------------------------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', path.join('partials', 'layout'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ----------------------------------
   SESSIONS
---------------------------------- */
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 },
  })
);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

<<<<<<< HEAD
/* -----------------------------
   Auth guards
----------------------------- */
function mapRole(level) {
  const v = (level || 'user').toString().trim().toLowerCase();
  if (v === 'a' || v === 'admin') return 'admin';
  if (v === 'm' || v === 'manager') return 'manager';
  return 'user';
}

=======
/* ----------------------------------
   AUTH GUARDS
---------------------------------- */
>>>>>>> 9a3098b (donations final)
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

<<<<<<< HEAD
function requireManager(req, res, next) {
  const u = req.session.user;
  if (!u) return res.status(403).send('Forbidden (manager only)');
  const r = mapRole(u.role);
  if (r !== 'manager' && r !== 'admin') {
    return res.status(403).send('Forbidden (manager only)');
  }
  next();
}
=======
/* ----------------------------------
   PUBLIC ROUTES
---------------------------------- */
>>>>>>> 9a3098b (donations final)

// HOME (shows toast if returned from donation)
app.get('/', (req, res) => {
  const donated = req.query.donated === '1';
  const donor = req.query.donor || null;
  const amount = req.query.amount || null;
  res.render('index', { title: 'Ella Rises', donated, donor, amount });
});

// DONATIONS
app.get('/donations', (req, res) => {
  res.render(path.join('donations', 'donations'), { title: 'Donations' });
});

// Handle placeholder pledge -> bounce home with query for toast
app.post('/donations/pledge', (req, res) => {
  const { fullName, amount } = req.body;
  const donor = encodeURIComponent((fullName || '').trim());
  const dollars = encodeURIComponent((amount || '').toString().trim());
  return res.redirect(`/?donated=1&donor=${donor}&amount=${dollars}`);
});

// SURVEYS / EVENTS (pointing at existing files)
app.get('/surveys', (req, res) => {
  res.render(path.join('Surveys', 'userSurveys'), { title: 'Surveys' });
});
app.get('/events', (req, res) => {
  res.render(path.join('events', 'events'), { title: 'Events' });
});
app.get('/milestones', (req, res) => {
  res.render(path.join('milestones', 'userMilestones'), { title: 'Milestones' });
});

/* ----------------------------------
   LOGIN / REGISTER (unchanged from your last working version)
---------------------------------- */
app.get('/login', (req, res) => {
  res.render(path.join('login', 'login'), { title: 'Login', error: null, created: undefined });
});
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
<<<<<<< HEAD
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
=======
    const q = `SELECT userid, email, passwordhash, role FROM "User" WHERE email=$1 LIMIT 1`;
    const { rows } = await pool.query(q, [email]);
    if (rows.length === 0) return res.render(path.join('login', 'login'), { title: 'Login', error: 'Invalid email or password', created: undefined });
    const user = rows[0];
    if (user.passwordhash !== password) return res.render(path.join('login', 'login'), { title: 'Login', error: 'Invalid email or password', created: undefined });
    req.session.user = { id: user.userid, email: user.email, role: user.role || 'user' };
    return res.redirect('/my-account');
>>>>>>> 9a3098b (donations final)
  } catch (err) {
    console.error(err);
    return res.render(path.join('login', 'login'), { title: 'Login', error: 'Unexpected error. Try again.', created: undefined });
  }
});

app.get('/register', (req, res) => {
  res.render(path.join('login', 'register'), { title: 'Create Account', error: null });
});
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
<<<<<<< HEAD
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
=======
    if (password !== confirmPassword)
      return res.render(path.join('login', 'register'), { title: 'Create Account', error: 'Passwords do not match.' });

    const q = `
      INSERT INTO "User"(firstname, lastname, email, passwordhash, dob,
        school_or_job, phone, city, state, zipcode,
        interest_arts, interest_stem, interest_both, role)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `;
    const params = [
      firstName, lastName, email, password, dob,
      schoolOrJob, phone, city, state, zipcode,
      !!interest_arts, !!interest_stem, !!interest_both, 'user'
    ];
    await pool.query(q, params);
>>>>>>> 9a3098b (donations final)

    return res.render(path.join('login', 'login'), {
      title: 'Login',
      error: null,
      created: 'Your account was created successfully! Please log in.'
    });
  } catch (err) {
<<<<<<< HEAD
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
=======
    console.error(err);
    let msg = 'Could not create account.';
    if (err.code === '23505') msg = 'Email already exists.';
    return res.render(path.join('login', 'register'), { title: 'Create Account', error: msg });
>>>>>>> 9a3098b (donations final)
  }
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

/* ----------------------------------
   AUTH PAGES
---------------------------------- */
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
app.get('/my-account', requireAuth, (req, res) => {
  res.render(path.join('account', 'account'), { title: 'My Account' });
});

/* ----------------------------------
   HEALTH + 404
---------------------------------- */
app.get('/healthz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.send('ok'); }
  catch { res.status(500).send('db error'); }
});
app.use((req, res) => res.status(404).send('Not Found'));

/* ----------------------------------
   START
---------------------------------- */
const PORT = Number(process.env.PORT || 3000);
<<<<<<< HEAD
app.listen(PORT, () => {
  console.log(`Ella Rises running → http://localhost:${PORT}`);
});
=======
app.listen(PORT, () => console.log(`Ella Rises Running → http://localhost:${PORT}`));
>>>>>>> 9a3098b (donations final)
