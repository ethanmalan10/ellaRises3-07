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
   Survey helpers (DB-backed)
----------------------------- */
async function getParticipantById(id) {
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT participantid,
            participantfirstname,
            participantlastname,
            participantemail
     FROM participant
     WHERE participantid = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findParticipantByEmail(email) {
  if (!email) return null;
  const { rows } = await pool.query(
    `SELECT participantid,
            participantfirstname,
            participantlastname,
            participantemail
     FROM participant
     WHERE LOWER(participantemail) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findParticipantForUser(user) {
  if (!user) return null;
  if (user.participantid) {
    const byId = await getParticipantById(user.participantid);
    if (byId) return byId;
  }

  const byEmail = await findParticipantByEmail(user.username);
  if (byEmail) return byEmail;

  const maybeId = Number(user.username);
  if (!Number.isNaN(maybeId)) {
    const byNumeric = await getParticipantById(maybeId);
    if (byNumeric) return byNumeric;
  }

  return null;
}

async function getRecentPastEventsForSurvey() {
  const { rows } = await pool.query(
    `SELECT eo.eventoccurrenceid,
            et.eventname,
            eo.eventdatetimestart,
            eo.eventdatetimeend
     FROM eventoccurrence eo
     JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
     WHERE eo.eventdatetimeend < NOW()
       AND eo.eventdatetimeend >= NOW() - INTERVAL '1 month'
     ORDER BY eo.eventdatetimestart DESC`
  );
  return rows;
}

async function getSurveysForParticipant(participantId) {
  const { rows } = await pool.query(
    `SELECT s.surveyid AS id,
            s.participantid,
            s.eventoccurrenceid,
            s.surveysatisfactionscore AS satisfaction,
            s.surveyusefulnessscore AS usefulness,
            s.surveyinstructorscore AS instructor,
            s.surveyrecommendationscore AS recommendation,
            s.surveyoverallscore AS overall,
            s.surveynpsbucket AS npsBucket,
            s.surveycomments AS comments,
            s.surveysubmissiondate AS submittedAt,
            TRIM(BOTH ' ' FROM COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantName,
            et.eventname AS eventName
     FROM survey s
     LEFT JOIN participant p ON s.participantid = p.participantid
     LEFT JOIN eventoccurrence eo ON s.eventoccurrenceid = eo.eventoccurrenceid
     LEFT JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
     WHERE s.participantid = $1
     ORDER BY s.surveysubmissiondate DESC`,
    [participantId]
  );
  return rows;
}

async function getAllSurveys() {
  const { rows } = await pool.query(
    `SELECT s.surveyid AS id,
            s.participantid,
            s.eventoccurrenceid,
            s.surveysatisfactionscore AS satisfaction,
            s.surveyusefulnessscore AS usefulness,
            s.surveyinstructorscore AS instructor,
            s.surveyrecommendationscore AS recommendation,
            s.surveyoverallscore AS overall,
            s.surveynpsbucket AS npsBucket,
            s.surveycomments AS comments,
            s.surveysubmissiondate AS submittedAt,
            TRIM(BOTH ' ' FROM COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantName,
            et.eventname AS eventName
     FROM survey s
     LEFT JOIN participant p ON s.participantid = p.participantid
     LEFT JOIN eventoccurrence eo ON s.eventoccurrenceid = eo.eventoccurrenceid
     LEFT JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
     ORDER BY s.surveysubmissiondate DESC`
  );
  return rows;
}

async function getSurveyById(id) {
  const { rows } = await pool.query(
    `SELECT s.surveyid AS id,
            s.participantid,
            s.eventoccurrenceid,
            s.surveysatisfactionscore AS satisfaction,
            s.surveyusefulnessscore AS usefulness,
            s.surveyinstructorscore AS instructor,
            s.surveyrecommendationscore AS recommendation,
            s.surveyoverallscore AS overall,
            s.surveynpsbucket AS npsBucket,
            s.surveycomments AS comments,
            s.surveysubmissiondate AS submittedAt,
            TRIM(BOTH ' ' FROM COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantName,
            et.eventname AS eventName
     FROM survey s
     LEFT JOIN participant p ON s.participantid = p.participantid
     LEFT JOIN eventoccurrence eo ON s.eventoccurrenceid = eo.eventoccurrenceid
     LEFT JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
     WHERE s.surveyid = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function insertSurvey({
  participantId,
  eventoccurrenceid,
  satisfaction,
  usefulness,
  instructor,
  recommendation,
  comments,
}) {
  const overall = Number(((satisfaction + usefulness + instructor + recommendation) / 4).toFixed(2));
  const npsBucket =
    recommendation >= 4 ? 'Promoter' : recommendation === 3 ? 'Passive' : 'Detractor';

  await pool.query(
    `INSERT INTO survey (
        participantid,
        eventoccurrenceid,
        surveysatisfactionscore,
        surveyusefulnessscore,
        surveyinstructorscore,
        surveyrecommendationscore,
        surveyoverallscore,
        surveynpsbucket,
        surveycomments,
        surveysubmissiondate
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
    [
      participantId,
      eventoccurrenceid,
      satisfaction,
      usefulness,
      instructor,
      recommendation,
      overall,
      npsBucket,
      comments || null,
    ]
  );
}

async function updateSurveyRecord(id, { satisfaction, usefulness, instructor, recommendation, comments }) {
  const overall = Number(((satisfaction + usefulness + instructor + recommendation) / 4).toFixed(2));
  const npsBucket =
    recommendation >= 4 ? 'Promoter' : recommendation === 3 ? 'Passive' : 'Detractor';

  await pool.query(
    `UPDATE survey
     SET surveysatisfactionscore = $1,
         surveyusefulnessscore = $2,
         surveyinstructorscore = $3,
         surveyrecommendationscore = $4,
         surveyoverallscore = $5,
         surveynpsbucket = $6,
         surveycomments = $7
     WHERE surveyid = $8`,
    [satisfaction, usefulness, instructor, recommendation, overall, npsBucket, comments || null, id]
  );
}

async function deleteSurveyRecord(id) {
  await pool.query('DELETE FROM survey WHERE surveyid = $1', [id]);
}

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

function isManagerUser(user) {
  if (!user) return false;
  const r = mapRole(user.role);
  return r === 'manager' || r === 'admin';
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
app.get('/events', async (req, res) => {
  try {
    const upcomingQuery = `
      SELECT
        eo.eventoccurrenceid,
        eo.eventtemplateid,
        eo.eventdatetimestart,
        eo.eventdatetimeend,
        eo.eventlocation,
        eo.eventcapacity,
        eo.eventregistrationdeadline,
        et.eventname,
        et.eventdescription,
        et.eventrecurrencepattern,
        COALESCE(regs.count, 0) AS registrations_count
      FROM eventoccurrence eo
      JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
      LEFT JOIN (
        SELECT eventoccurrenceid, COUNT(*) AS count
        FROM registration
        GROUP BY eventoccurrenceid
      ) regs ON regs.eventoccurrenceid = eo.eventoccurrenceid
      WHERE eo.eventdatetimeend >= NOW()
      ORDER BY eo.eventdatetimestart ASC;
    `;

    const pastQuery = `
      SELECT
        eo.eventoccurrenceid,
        eo.eventtemplateid,
        eo.eventdatetimestart,
        eo.eventdatetimeend,
        eo.eventlocation,
        eo.eventcapacity,
        eo.eventregistrationdeadline,
        et.eventname,
        et.eventdescription,
        et.eventrecurrencepattern,
        COALESCE(regs.count, 0) AS registrations_count
      FROM eventoccurrence eo
      JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
      LEFT JOIN (
        SELECT eventoccurrenceid, COUNT(*) AS count
        FROM registration
        GROUP BY eventoccurrenceid
      ) regs ON regs.eventoccurrenceid = eo.eventoccurrenceid
      WHERE eo.eventdatetimeend < NOW()
      ORDER BY eo.eventdatetimestart DESC;
    `;

    const [upcomingResult, pastResult] = await Promise.all([
      pool.query(upcomingQuery),
      pool.query(pastQuery),
    ]);

    const isManager = isManagerUser(req.session.user);

    return res.render(path.join('events', 'events'), {
      title: 'Events',
      upcomingEvents: upcomingResult.rows,
      pastEvents: [], // past events now shown on separate page
      message: req.query.msg || null,
      error: req.query.err || null,
      isManager,
    });
  } catch (err) {
    console.error('Events list error:', err);
    return res.status(500).send('Could not load events');
  }
});

// /surveys -> user submission form (auth required)
app.get('/surveys', requireAuth, async (req, res) => {
  try {
    const participant = await findParticipantForUser(req.session.user);
    if (!participant) {
      return res.status(400).render(path.join('milestones', 'userMilestones'), {
        title: 'Surveys',
        surveys: [],
        events: [],
        error: 'No participant record found for your account. Please contact support.',
        formValues: {},
      });
    }

    const [events, surveys] = await Promise.all([
      getRecentPastEventsForSurvey(),
      getSurveysForParticipant(participant.participantid),
    ]);

    return res.render(path.join('milestones', 'userMilestones'), {
      title: 'Surveys',
      surveys,
      events,
      error: null,
      formValues: {},
    });
  } catch (err) {
    console.error('Survey form load error:', err);
    return res.status(500).send('Could not load survey form');
  }
});

// Submit a survey -> DB
app.post('/surveys', requireAuth, async (req, res) => {
  const { eventoccurrenceid, satisfaction, usefulness, instructor, recommendation, comments } =
    req.body;

  try {
    const participant = await findParticipantForUser(req.session.user);
    if (!participant) {
      return res.status(400).render(path.join('milestones', 'userMilestones'), {
        title: 'Surveys',
        surveys: [],
        events: [],
        error: 'No participant record found for your account. Please contact support.',
        formValues: {},
      });
    }

    const events = await getRecentPastEventsForSurvey();
    const eventId = Number(eventoccurrenceid);
    const sat = Number(satisfaction);
    const use = Number(usefulness);
    const instr = Number(instructor);
    const rec = Number(recommendation);

    const invalid =
      !eventId ||
      Number.isNaN(sat) ||
      Number.isNaN(use) ||
      Number.isNaN(instr) ||
      Number.isNaN(rec);

    const eventIsValid = events.some((ev) => ev.eventoccurrenceid === eventId);

    if (invalid || !eventIsValid) {
      const surveys = await getSurveysForParticipant(participant.participantid);
      return res.status(400).render(path.join('milestones', 'userMilestones'), {
        title: 'Surveys',
        surveys,
        events,
        error: 'Please select a valid recent event and provide scores for all questions.',
        formValues: { eventoccurrenceid, satisfaction, usefulness, instructor, recommendation, comments },
      });
    }

    await insertSurvey({
      participantId: participant.participantid,
      eventoccurrenceid: eventId,
      satisfaction: Math.max(1, Math.min(5, sat)),
      usefulness: Math.max(1, Math.min(5, use)),
      instructor: Math.max(1, Math.min(5, instr)),
      recommendation: Math.max(1, Math.min(5, rec)),
      comments: (comments || '').trim(),
    });

    return res.redirect('/surveys');
  } catch (err) {
    console.error('Survey submit error:', err);
    return res.status(500).send('Could not submit survey');
  }
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
      SELECT participantid, username, password, level
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

    let participantId = null;
    try {
      const participant = await findParticipantForUser({ username: user.username });
      if (participant) participantId = participant.participantid;
    } catch (e) {
      console.warn('Could not map participant for user on login:', e);
    }

    req.session.user = {
      id: user.participantid,
      username: user.username,
      role: mapRole(user.level),
      participantid: participantId,
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
       RETURNING participantid, username, level`,
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
app.get('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    return res.redirect('/');
  });
});

app.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    return res.redirect('/');
  });
});

/* -----------------------------
   EVENTS (list + RSVP + manager CRUD)
----------------------------- */

// RSVP (auth required; username treated as email to find participant)
app.post('/events/:id/rsvp', requireAuth, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!eventId) return res.redirect('/events?err=bad-event');

  try {
    const email = req.session.user.username;
    const participantRes = await pool.query(
      'SELECT participantid FROM participant WHERE participantemail = $1 LIMIT 1',
      [email]
    );

    if (participantRes.rows.length === 0) {
      return res.redirect('/events?err=noparticipant');
    }

    const participantId = participantRes.rows[0].participantid;

    const existing = await pool.query(
      `SELECT registrationid
       FROM registration
       WHERE participantid = $1 AND eventoccurrenceid = $2
       LIMIT 1`,
      [participantId, eventId]
    );

    if (existing.rows.length > 0) {
      return res.redirect('/events?msg=already');
    }

    await pool.query(
      `INSERT INTO registration (
        participantid,
        eventoccurrenceid,
        registrationstatus,
        registrationattendedflag,
        registrationcheckintime,
        registrationcreatedat
      ) VALUES ($1, $2, 'registered', 0, NULL, NOW())`,
      [participantId, eventId]
    );

    return res.redirect('/events?msg=registered');
  } catch (err) {
    console.error('RSVP error:', err);
    return res.redirect('/events?err=rsvp');
  }
});

// Manager: show create form
app.get('/events/new', requireManager, async (req, res) => {
  try {
    const templates = await pool.query(
      'SELECT eventtemplateid, eventname, eventdefaultcapacity FROM eventtemplate ORDER BY eventname'
    );
    return res.render(path.join('events', 'events_add'), {
      title: 'Create Event',
      templates: templates.rows,
      error: null,
    });
  } catch (err) {
    console.error('Events new error:', err);
    return res.status(500).send('Could not load create form');
  }
});

// Manager: create occurrence
app.post('/events', requireManager, async (req, res) => {
  const templateId = Number(req.body.eventtemplateid);
  const location = req.body.eventlocation || null;
  const start = req.body.eventdatetimestart ? new Date(req.body.eventdatetimestart) : null;
  const end = req.body.eventdatetimeend ? new Date(req.body.eventdatetimeend) : null;
  const deadline = req.body.eventregistrationdeadline
    ? new Date(req.body.eventregistrationdeadline)
    : null;
  const capacityInput = req.body.eventcapacity ? Number(req.body.eventcapacity) : null;

  const invalidDate = d => !d || Number.isNaN(d.getTime());

  try {
    if (!templateId) throw new Error('Template is required.');
    if (invalidDate(start) || invalidDate(end)) throw new Error('Start and end date/time are required.');

    const tpl = await pool.query(
      'SELECT eventdefaultcapacity FROM eventtemplate WHERE eventtemplateid = $1',
      [templateId]
    );
    if (tpl.rows.length === 0) throw new Error('Template not found.');
    const defaultCap = tpl.rows[0].eventdefaultcapacity || null;
    const capacity = capacityInput || defaultCap;

    await pool.query(
      `INSERT INTO eventoccurrence (
        eventtemplateid,
        eventdatetimestart,
        eventdatetimeend,
        eventlocation,
        eventcapacity,
        eventregistrationdeadline
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [templateId, start, end, location, capacity, deadline]
    );

    return res.redirect('/events?msg=created');
  } catch (err) {
    console.error('Create event error:', err);
    try {
      const templates = await pool.query(
        'SELECT eventtemplateid, eventname, eventdefaultcapacity FROM eventtemplate ORDER BY eventname'
      );
      return res.render(path.join('events', 'events_add'), {
        title: 'Create Event',
        templates: templates.rows,
        error: err.message || 'Could not create event.',
      });
    } catch (innerErr) {
      console.error('Create event fallback error:', innerErr);
      return res.status(500).send('Could not create event');
    }
  }
});

// Manager: edit form
app.get('/events/:id/edit', requireManager, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!eventId) return res.redirect('/events?err=bad-event');

  try {
    const [eventRes, templatesRes] = await Promise.all([
      pool.query(
        `SELECT eo.*, et.eventname
         FROM eventoccurrence eo
         JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
         WHERE eo.eventoccurrenceid = $1`,
        [eventId]
      ),
      pool.query(
        'SELECT eventtemplateid, eventname, eventdefaultcapacity FROM eventtemplate ORDER BY eventname'
      ),
    ]);

    if (eventRes.rows.length === 0) return res.redirect('/events?err=notfound');

    return res.render(path.join('events', 'events_edit'), {
      title: 'Edit Event',
      event: eventRes.rows[0],
      templates: templatesRes.rows,
      error: null,
    });
  } catch (err) {
    console.error('Edit event load error:', err);
    return res.status(500).send('Could not load event');
  }
});

// Manager: update occurrence
app.post('/events/:id/edit', requireManager, async (req, res) => {
  const eventId = Number(req.params.id);
  const templateId = Number(req.body.eventtemplateid);
  const location = req.body.eventlocation || null;
  const start = req.body.eventdatetimestart ? new Date(req.body.eventdatetimestart) : null;
  const end = req.body.eventdatetimeend ? new Date(req.body.eventdatetimeend) : null;
  const deadline = req.body.eventregistrationdeadline
    ? new Date(req.body.eventregistrationdeadline)
    : null;
  const capacityInput = req.body.eventcapacity ? Number(req.body.eventcapacity) : null;

  const invalidDate = d => !d || Number.isNaN(d.getTime());

  try {
    if (!eventId) throw new Error('Bad event id.');
    if (!templateId) throw new Error('Template is required.');
    if (invalidDate(start) || invalidDate(end)) throw new Error('Start and end date/time are required.');

    const tpl = await pool.query(
      'SELECT eventdefaultcapacity FROM eventtemplate WHERE eventtemplateid = $1',
      [templateId]
    );
    if (tpl.rows.length === 0) throw new Error('Template not found.');
    const defaultCap = tpl.rows[0].eventdefaultcapacity || null;
    const capacity = capacityInput || defaultCap;

    await pool.query(
      `UPDATE eventoccurrence
       SET eventtemplateid = $1,
           eventdatetimestart = $2,
           eventdatetimeend = $3,
           eventlocation = $4,
           eventcapacity = $5,
           eventregistrationdeadline = $6
       WHERE eventoccurrenceid = $7`,
      [templateId, start, end, location, capacity, deadline, eventId]
    );

    return res.redirect('/events?msg=updated');
  } catch (err) {
    console.error('Update event error:', err);
    try {
      const [eventRes, templatesRes] = await Promise.all([
        pool.query(
          `SELECT eo.*, et.eventname
           FROM eventoccurrence eo
           JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
           WHERE eo.eventoccurrenceid = $1`,
          [eventId]
        ),
        pool.query(
          'SELECT eventtemplateid, eventname, eventdefaultcapacity FROM eventtemplate ORDER BY eventname'
        ),
      ]);

      if (eventRes.rows.length === 0) return res.redirect('/events?err=notfound');

      return res.render(path.join('events', 'events_edit'), {
        title: 'Edit Event',
        event: eventRes.rows[0],
        templates: templatesRes.rows,
        error: err.message || 'Could not update event.',
      });
    } catch (innerErr) {
      console.error('Update event fallback error:', innerErr);
      return res.status(500).send('Could not update event');
    }
  }
});

// Manager: delete occurrence (and registrations)
app.post('/events/:id/delete', requireManager, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!eventId) return res.redirect('/events?err=bad-event');

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM registration WHERE eventoccurrenceid = $1', [eventId]);
    await client.query('DELETE FROM eventoccurrence WHERE eventoccurrenceid = $1', [eventId]);
    await client.query('COMMIT');
    return res.redirect('/events?msg=deleted');
  } catch (err) {
    console.error('Delete event error:', err);
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Delete rollback error:', rollbackErr);
      }
    }
    return res.redirect('/events?err=delete');
  } finally {
    if (client) client.release();
  }
});

// Manager: past events with filters (lazy load)
app.get('/events/past', requireManager, async (_req, res) => {
  const baseQuery = `
    SELECT
      eo.eventoccurrenceid,
      eo.eventtemplateid,
      eo.eventdatetimestart,
      eo.eventdatetimeend,
      eo.eventlocation,
      eo.eventcapacity,
      eo.eventregistrationdeadline,
      et.eventname,
      et.eventdescription,
      et.eventtypeid,
      et.eventrecurrencepattern,
      et.eventdefaultcapacity,
      COALESCE(regs.count, 0) AS registrations_count,
      etype.eventtypename
    FROM eventoccurrence eo
    JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
    LEFT JOIN eventtype etype ON et.eventtypeid = etype.eventtypeid
    LEFT JOIN (
      SELECT eventoccurrenceid, COUNT(*) AS count
      FROM registration
      GROUP BY eventoccurrenceid
    ) regs ON regs.eventoccurrenceid = eo.eventoccurrenceid
    WHERE eo.eventdatetimeend < NOW()
    ORDER BY eo.eventdatetimestart DESC
    LIMIT 500;
  `;

  try {
    const eventsRes = await pool.query(baseQuery);
    return res.render(path.join('events', 'events_past'), {
      title: 'Past Events',
      events: eventsRes.rows,
    });
  } catch (err) {
    console.error('Past events error:', err);
    return res.status(500).send('Could not load past events');
  }
});

// Manager: create event template (form)
app.get('/event-templates/new', requireManager, async (_req, res) => {
  try {
    const types = await pool.query('SELECT eventtypeid, eventtypename FROM eventtype ORDER BY eventtypename');
    return res.render(path.join('events', 'events_template'), {
      title: 'Create Event Template',
      types: types.rows,
      error: null,
    });
  } catch (err) {
    console.error('Template form error:', err);
    return res.status(500).send('Could not load template form');
  }
});

// Manager: create event template (submit)
app.post('/event-templates', requireManager, async (req, res) => {
  const { eventtypeid, eventname, eventdescription, eventrecurrencepattern, eventdefaultcapacity } = req.body;

  try {
    if (!eventtypeid) throw new Error('Event type is required.');
    if (!eventname) throw new Error('Event name is required.');

    await pool.query(
      `INSERT INTO eventtemplate (
        eventtypeid,
        eventname,
        eventdescription,
        eventrecurrencepattern,
        eventdefaultcapacity
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        Number(eventtypeid),
        eventname,
        eventdescription || null,
        eventrecurrencepattern || null,
        eventdefaultcapacity ? Number(eventdefaultcapacity) : null,
      ]
    );

    return res.redirect('/event-templates?msg=template-created');
  } catch (err) {
    console.error('Create template error:', err);
    try {
      const types = await pool.query('SELECT eventtypeid, eventtypename FROM eventtype ORDER BY eventtypename');
      return res.render(path.join('events', 'events_template'), {
        title: 'Create Event Template',
        types: types.rows,
        error: err.message || 'Could not create template.',
      });
    } catch (innerErr) {
      console.error('Create template fallback error:', innerErr);
      return res.status(500).send('Could not create template');
    }
  }
});

// Manager: manage templates list
app.get('/event-templates', requireManager, async (req, res) => {
  const msg = req.query.msg || null;
  try {
    const templates = await pool.query(
      `SELECT
         et.eventtemplateid,
         et.eventtypeid,
         et.eventname,
         et.eventdescription,
         et.eventrecurrencepattern,
         et.eventdefaultcapacity,
         t.eventtypename,
         COALESCE(o.count, 0) AS occurrences_count
       FROM eventtemplate et
       LEFT JOIN eventtype t ON et.eventtypeid = t.eventtypeid
       LEFT JOIN (
         SELECT eventtemplateid, COUNT(*) AS count
         FROM eventoccurrence
         GROUP BY eventtemplateid
       ) o ON o.eventtemplateid = et.eventtemplateid
       ORDER BY et.eventname`
    );

    return res.render(path.join('events', 'events_templates'), {
      title: 'Manage Event Templates',
      templates: templates.rows,
      message: msg,
    });
  } catch (err) {
    console.error('Templates list error:', err);
    return res.status(500).send('Could not load templates');
  }
});

// Manager: edit template form
app.get('/event-templates/:id/edit', requireManager, async (req, res) => {
  const templateId = Number(req.params.id);
  if (!templateId) return res.redirect('/event-templates?msg=bad-template');

  try {
    const [tplRes, typesRes] = await Promise.all([
      pool.query('SELECT * FROM eventtemplate WHERE eventtemplateid = $1', [templateId]),
      pool.query('SELECT eventtypeid, eventtypename FROM eventtype ORDER BY eventtypename'),
    ]);

    if (tplRes.rows.length === 0) return res.redirect('/event-templates?msg=notfound');

    return res.render(path.join('events', 'events_template_edit'), {
      title: 'Edit Event Template',
      template: tplRes.rows[0],
      types: typesRes.rows,
      error: null,
    });
  } catch (err) {
    console.error('Template edit load error:', err);
    return res.status(500).send('Could not load template');
  }
});

// Manager: update template
app.post('/event-templates/:id/edit', requireManager, async (req, res) => {
  const templateId = Number(req.params.id);
  const { eventtypeid, eventname, eventdescription, eventrecurrencepattern, eventdefaultcapacity } = req.body;

  try {
    if (!templateId) throw new Error('Bad template id.');
    if (!eventtypeid) throw new Error('Event type is required.');
    if (!eventname) throw new Error('Event name is required.');

    await pool.query(
      `UPDATE eventtemplate
       SET eventtypeid = $1,
           eventname = $2,
           eventdescription = $3,
           eventrecurrencepattern = $4,
           eventdefaultcapacity = $5
       WHERE eventtemplateid = $6`,
      [
        Number(eventtypeid),
        eventname,
        eventdescription || null,
        eventrecurrencepattern || null,
        eventdefaultcapacity ? Number(eventdefaultcapacity) : null,
        templateId,
      ]
    );

    return res.redirect('/event-templates?msg=template-updated');
  } catch (err) {
    console.error('Update template error:', err);
    try {
      const types = await pool.query('SELECT eventtypeid, eventtypename FROM eventtype ORDER BY eventtypename');
      return res.render(path.join('events', 'events_template_edit'), {
        title: 'Edit Event Template',
        template: { eventtemplateid: templateId, eventtypeid, eventname, eventdescription, eventrecurrencepattern, eventdefaultcapacity },
        types: types.rows,
        error: err.message || 'Could not update template.',
      });
    } catch (innerErr) {
      console.error('Update template fallback error:', innerErr);
      return res.status(500).send('Could not update template');
    }
  }
});

// Manager: delete template (and linked occurrences/registrations)
app.post('/event-templates/:id/delete', requireManager, async (req, res) => {
  const templateId = Number(req.params.id);
  if (!templateId) return res.redirect('/event-templates?msg=bad-template');

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM registration
       WHERE eventoccurrenceid IN (
         SELECT eventoccurrenceid FROM eventoccurrence WHERE eventtemplateid = $1
       )`,
      [templateId]
    );
    await client.query('DELETE FROM eventoccurrence WHERE eventtemplateid = $1', [templateId]);
    await client.query('DELETE FROM eventtemplate WHERE eventtemplateid = $1', [templateId]);
    await client.query('COMMIT');
    return res.redirect('/event-templates?msg=template-deleted');
  } catch (err) {
    console.error('Delete template error:', err);
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Delete template rollback error:', rollbackErr);
      }
    }
    return res.redirect('/event-templates?msg=template-delete-error');
  } finally {
    if (client) client.release();
  }
});

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

// Manager survey list
app.get('/admin/surveys', requireManager, async (req, res) => {
  try {
    const surveys = await getAllSurveys();
    res.render(path.join('milestones', 'manMilestones'), {
      title: 'Manage Surveys',
      surveys,
    });
  } catch (err) {
    console.error('Admin survey list error:', err);
    res.status(500).send('Could not load surveys');
  }
});

// Edit a survey
app.get('/admin/surveys/:id/edit', requireManager, async (req, res) => {
  try {
    const survey = await getSurveyById(req.params.id);
    if (!survey) return res.status(404).send('Survey not found');
    res.render(path.join('milestones', 'manMilestones_edit'), {
      title: 'Edit Survey',
      survey,
    });
  } catch (err) {
    console.error('Admin survey edit load error:', err);
    res.status(500).send('Could not load survey');
  }
});

app.post('/admin/surveys/:id/edit', requireManager, async (req, res) => {
  try {
    const { satisfaction, usefulness, instructor, recommendation, comments } = req.body;
    const sat = Number(satisfaction);
    const use = Number(usefulness);
    const instr = Number(instructor);
    const rec = Number(recommendation);

    if ([sat, use, instr, rec].some((n) => Number.isNaN(n))) {
      return res.status(400).send('All scores are required');
    }

    await updateSurveyRecord(req.params.id, {
      satisfaction: Math.max(1, Math.min(5, sat)),
      usefulness: Math.max(1, Math.min(5, use)),
      instructor: Math.max(1, Math.min(5, instr)),
      recommendation: Math.max(1, Math.min(5, rec)),
      comments: (comments || '').trim(),
    });

    res.redirect('/admin/surveys');
  } catch (err) {
    console.error('Admin survey edit submit error:', err);
    res.status(500).send('Could not update survey');
  }
});

// Delete a survey
app.get('/admin/surveys/:id/delete', requireManager, async (req, res) => {
  try {
    const survey = await getSurveyById(req.params.id);
    if (!survey) return res.status(404).send('Survey not found');
    res.render(path.join('milestones', 'manMilestones_delete'), {
      title: 'Delete Survey',
      survey,
    });
  } catch (err) {
    console.error('Admin survey delete load error:', err);
    res.status(500).send('Could not load survey');
  }
});

app.post('/admin/surveys/:id/delete', requireManager, async (req, res) => {
  try {
    await deleteSurveyRecord(req.params.id);
    res.redirect('/admin/surveys');
  } catch (err) {
    console.error('Admin survey delete error:', err);
    res.status(500).send('Could not delete survey');
  }
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
