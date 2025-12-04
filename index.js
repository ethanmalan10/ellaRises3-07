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
     LEFT JOIN eventoccurrence eo ON eo.eventoccurrenceid = s.eventoccurrenceid
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
     LEFT JOIN eventoccurrence eo ON eo.eventoccurrenceid = s.eventoccurrenceid
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
     LEFT JOIN eventoccurrence eo ON eo.eventoccurrenceid = s.eventoccurrenceid
     LEFT JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
     WHERE s.surveyid = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getSurveysForParticipant(participantId) {
  const { rows } = await pool.query(
    `SELECT s.surveyid AS id,
            s.participantid,
            s.eventoccurrenceid AS eventoccurrenceid,
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
     LEFT JOIN eventoccurrence eo ON eo.eventoccurrenceid = s.eventoccurrenceid
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
            s.eventoccurrenceid AS eventoccurrenceid,
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
     LEFT JOIN eventoccurrence eo ON eo.eventoccurrenceid = s.eventoccurrenceid
     LEFT JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
     ORDER BY s.surveysubmissiondate DESC`
  );
  return rows;
}

async function getSurveyById(id) {
  const { rows } = await pool.query(
    `SELECT s.surveyid AS id,
            s.participantid,
            s.eventoccurrenceid AS eventoccurrenceid,
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
     LEFT JOIN eventoccurrence eo ON eo.eventoccurrenceid = s.eventoccurrenceid
     LEFT JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
     WHERE s.surveyid = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function surveyExists(participantId, eventoccurrenceid) {
  const { rows } = await pool.query(
    `SELECT 1 FROM survey WHERE participantid = $1 AND eventoccurrenceid = $2 LIMIT 1`,
    [participantId, eventoccurrenceid]
  );
  return rows.length > 0;
}

async function getNextDonationId() {
  const { rows } = await pool.query(`SELECT COALESCE(MAX(donationid), 0) + 1 AS nextid FROM donation`);
  return rows[0]?.nextid ? Number(rows[0].nextid) : 1;
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

  // Manually generate the next surveyid (integer) to avoid sequence usage
  let nextId = 1;
  const nextRes = await pool.query(`SELECT COALESCE(MAX(surveyid), 0) + 1 AS nextid FROM survey`);
  if (nextRes.rows.length) nextId = Number(nextRes.rows[0].nextid) || 1;

  const values = [
    nextId,
    participantId,
    eventoccurrenceid,
    satisfaction,
    usefulness,
    instructor,
    recommendation,
    overall,
    npsBucket,
    comments || null,
  ];

  // Try insert; if PK conflict, bump id and retry a couple of times
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await pool.query(
        `INSERT INTO survey (
            surveyid,
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
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
        values
      );
      return;
    } catch (err) {
      if (err.code === '23505') {
        if (err.constraint === 'survey_participantid_eventoccurrenceid_key') {
          const dupe = new Error('DUP_SURVEY');
          dupe.code = 'DUP_SURVEY';
          throw dupe;
        }
        // PK conflict: bump id and retry
        values[0] = values[0] + 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Could not insert survey after retries.');
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
   Milestone helpers
----------------------------- */
async function listMilestoneCatalog() {
  const { rows } = await pool.query(
    `SELECT milestonecatalogid AS id,
            milestonetitle AS title
     FROM milestonecatalog
     ORDER BY milestonetitle ASC`
  );
  return rows;
}

async function getMilestoneCatalogItem(id) {
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT milestonecatalogid AS id,
            milestonetitle AS title
     FROM milestonecatalog
     WHERE milestonecatalogid = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createMilestoneCatalog(title) {
  if (!title || !title.trim()) throw new Error('Milestone title is required');
  await pool.query(
    `INSERT INTO milestonecatalog (milestonetitle)
     VALUES ($1)`,
    [title.trim()]
  );
}

async function updateMilestoneCatalog(id, title) {
  if (!id) throw new Error('Missing milestone catalog id');
  if (!title || !title.trim()) throw new Error('Milestone title is required');
  await pool.query(
    `UPDATE milestonecatalog
     SET milestonetitle = $1
     WHERE milestonecatalogid = $2`,
    [title.trim(), id]
  );
}

async function deleteMilestoneCatalog(id) {
  if (!id) throw new Error('Missing milestone catalog id');
  await pool.query('DELETE FROM milestonecatalog WHERE milestonecatalogid = $1', [id]);
}

async function listParticipantsBasic() {
  const { rows } = await pool.query(
    `SELECT participantid,
            TRIM(COALESCE(participantfirstname,'') || ' ' || COALESCE(participantlastname,'')) AS name,
            participantemail,
            participantdob
     FROM participant
     ORDER BY COALESCE(participantfirstname,'') || ' ' || COALESCE(participantlastname,'')`
  );
  return rows;
}

async function listAllMilestoneAssignments() {
  const { rows } = await pool.query(
    `SELECT m.milestoneid,
            m.participantid,
            m.milestonecatalogid,
            m.milestonedate,
            m.milestoneno,
            mc.milestonetitle AS title,
            TRIM(COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantname,
            p.participantemail AS participantemail
     FROM milestone m
     JOIN milestonecatalog mc ON mc.milestonecatalogid = m.milestonecatalogid
     LEFT JOIN participant p ON p.participantid = m.participantid
     ORDER BY m.milestonedate DESC NULLS LAST, m.milestoneid DESC`
  );
  return rows;
}

async function getMilestoneAssignment(id) {
  const { rows } = await pool.query(
    `SELECT m.milestoneid,
            m.participantid,
            m.milestonecatalogid,
            m.milestonedate,
            m.milestoneno,
            mc.milestonetitle,
            TRIM(COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantname,
            p.participantemail,
            p.participantcity,
            p.participantstate
     FROM milestone m
     JOIN milestonecatalog mc ON mc.milestonecatalogid = m.milestonecatalogid
     LEFT JOIN participant p ON p.participantid = m.participantid
     WHERE m.milestoneid = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listMilestonesForParticipant(participantId) {
  if (!participantId) return [];
  const { rows } = await pool.query(
    `SELECT m.milestoneid,
            m.milestonedate,
            m.milestoneno,
            mc.milestonetitle AS title
     FROM milestone m
     JOIN milestonecatalog mc ON mc.milestonecatalogid = m.milestonecatalogid
     WHERE m.participantid = $1
     ORDER BY m.milestonedate DESC NULLS LAST, m.milestoneid DESC`,
    [participantId]
  );
  return rows;
}

async function addMilestoneAssignment({ participantId, milestoneCatalogId, achievedDate, milestoneNo }) {
  if (!participantId || !milestoneCatalogId) {
    throw new Error('Participant and milestone are required.');
  }
  await pool.query(
    `INSERT INTO milestone (participantid, milestonecatalogid, milestonedate, milestoneno)
     VALUES ($1, $2, $3, $4)`,
    [participantId, milestoneCatalogId, achievedDate || null, milestoneNo || null]
  );
}

async function updateMilestoneAssignment(id, { participantId, milestoneCatalogId, achievedDate, milestoneNo }) {
  if (!id) throw new Error('Missing milestone id');
  if (!participantId || !milestoneCatalogId) {
    throw new Error('Participant and milestone are required.');
  }
  await pool.query(
    `UPDATE milestone
     SET participantid = $1,
         milestonecatalogid = $2,
         milestonedate = $3,
         milestoneno = $4
     WHERE milestoneid = $5`,
    [participantId, milestoneCatalogId, achievedDate || null, milestoneNo || null, id]
  );
}

async function deleteMilestoneAssignment(id) {
  if (!id) throw new Error('Missing milestone id');
  await pool.query('DELETE FROM milestone WHERE milestoneid = $1', [id]);
}

async function listParticipantsWithUsers() {
  const { rows } = await pool.query(
    `SELECT p.participantid,
            p.participantfirstname,
            p.participantlastname,
            p.participantdob,
            p.participantcity,
            u.username,
            u.password,
            u.level
     FROM participant p
     LEFT JOIN users u ON u.participantid = p.participantid
     ORDER BY p.participantlastname, p.participantfirstname`
  );
  return rows;
}

async function listUsersWithParticipants() {
  const { rows } = await pool.query(
    `SELECT
        u.userid,
        u.username,
        u.level,
        u.participantid,
        p.participantfirstname,
        p.participantlastname,
        p.participantemail,
        p.participantcity,
        p.participantstate
     FROM users u
     LEFT JOIN participant p ON p.participantid = u.participantid
     ORDER BY LOWER(u.username)`
  );
  return rows;
}

async function getParticipantDetail(id) {
  const participantRes = await pool.query(
    `SELECT p.*,
            u.username,
            u.password,
            u.level
     FROM participant p
     LEFT JOIN users u ON u.participantid = p.participantid
     WHERE p.participantid = $1
     LIMIT 1`,
    [id]
  );
  if (!participantRes.rows.length) return null;
  const milestonesRes = await pool.query(
    `SELECT m.milestoneid,
            m.milestonecatalogid,
            m.milestonedate,
            m.milestoneno,
            mc.milestonetitle
     FROM milestone m
     JOIN milestonecatalog mc ON mc.milestonecatalogid = m.milestonecatalogid
     WHERE m.participantid = $1
     ORDER BY m.milestonedate DESC NULLS LAST, m.milestoneid DESC`,
    [id]
  );
  return { participant: participantRes.rows[0], milestones: milestonesRes.rows };
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

function normalizeUserLevel(input) {
  const v = (input || '').toString().trim().toLowerCase();
  if (v === 'm' || v === 'manager') return 'm';
  if (v === 'a' || v === 'admin') return 'a';
  return 'u';
}

const PAGE_SIZE_OPTIONS = [25, 50, 75, 100];
const CATALOG_PAGE_SIZES = [10, 25, 50];

function resolvePagination(req, key, allowedSizes = PAGE_SIZE_OPTIONS, defaultSize = 50) {
  const sessionSizes = req.session.pageSizes || {};
  let pageSize = Number(sessionSizes[key]) || defaultSize;
  const requestedSize = Number(req.query.pageSize);
  if (allowedSizes.includes(requestedSize)) {
    pageSize = requestedSize;
    req.session.pageSizes = { ...sessionSizes, [key]: pageSize };
  } else {
    req.session.pageSizes = sessionSizes;
  }

  let page = Number(req.query.page);
  if (Number.isNaN(page) || page < 1) page = 1;

  return { page, pageSize };
}

function buildPagination(total, page, pageSize) {
  const safeTotal = Number(total) || 0;
  const totalPages = safeTotal > 0 ? Math.ceil(safeTotal / pageSize) : 1;
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const offset = (currentPage - 1) * pageSize;
  return {
    total: safeTotal,
    totalPages,
    page: currentPage,
    pageSize,
    offset,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}

function isManagerUser(user) {
  if (!user) return false;
  const r = mapRole(user.role);
  return r === 'manager' || r === 'admin';
}

function normalizeCapitalize(str) {
  if (!str) return null;
  const s = str.toString().trim();
  if (!s) return null;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

function normalizeDigits(str, maxLen) {
  if (!str) return null;
  const digits = str.replace(/\D/g, '');
  return maxLen ? digits.slice(0, maxLen) : digits;
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
  const { donated, thanks, donor, amount, donorName, donorAmount } = req.query || {};

  // Surface possible donation flash params to the view
  res.render('index', {
    title: 'Ella Rises',
    donated,
    thanks,
    donor,
    amount,
    donorName,
    donorAmount,
  });
});

// /donations -> views/donations/donations.ejs
app.get('/donations', (req, res) => {
  res.render(path.join('donations', 'donations'), { title: 'Donations' });
});

// Handle donation submit -> redirect home with a thank-you toast
app.post('/donations', async (req, res) => {
  const { firstName, lastName, donationAmount, email } = req.body || {};
  const donorFirst = (firstName || '').trim();
  const donorLast = (lastName || '').trim();
  const donorEmail = (email || '').trim().toLowerCase();
  const amount = Number(donationAmount);

  if (!donorFirst || !donorEmail || !donationAmount || Number.isNaN(amount)) {
    return res.redirect('/donations?err=invalid');
  }

  try {
    // Ensure we have (or create) a participant to satisfy the FK on donation.participantid
    const { rows: participantRows } = await pool.query(
      `INSERT INTO participant (participantemail, participantfirstname, participantlastname, participantrole)
       VALUES ($1, $2, $3, 'Donor')
       ON CONFLICT (participantemail)
       DO UPDATE SET participantfirstname = EXCLUDED.participantfirstname,
                     participantlastname = EXCLUDED.participantlastname
       RETURNING participantid`,
      [donorEmail, donorFirst, donorLast || null]
    );
    const participantId = participantRows[0]?.participantid;

    let nextId = await getNextDonationId();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await pool.query(
          `INSERT INTO donation (donationid, participantid, donationamount, donationdate, donorfirstname, donorlastname, donationno)
           VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)`,
          [nextId, participantId, amount, donorFirst, donorLast || null, 1]
        );
        break;
      } catch (err) {
        if (err.code === '23505') {
          nextId += 1;
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    console.error('Public donation insert error:', err);
    return res.redirect('/donations?err=db');
  }

  const params = new URLSearchParams();
  params.set('donated', '1');
  const donorDisplay = donorLast ? `${donorFirst} ${donorLast}` : donorFirst;
  params.set('donor', donorDisplay);
  params.set('amount', amount.toString());

  return res.redirect(`/?${params.toString()}`);
});

/* -----------------------------
   Donations (Manager)
----------------------------- */
async function listDonations() {
  const { rows } = await pool.query(
    `SELECT d.donationid AS id,
            d.participantid,
            d.donationamount AS amount,
            d.donationdate AS date,
            CASE
              WHEN d.participantid IS NOT NULL THEN TRIM(BOTH ' ' FROM COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,''))
              WHEN COALESCE(d.donorfirstname,'') <> '' OR COALESCE(d.donorlastname,'') <> ''
                THEN TRIM(BOTH ' ' FROM COALESCE(d.donorfirstname,'') || ' ' || COALESCE(d.donorlastname,''))
              ELSE 'Anonymous'
            END AS displayname,
            d.donorfirstname,
            d.donorlastname,
            TRIM(BOTH ' ' FROM COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantname
     FROM donation d
     LEFT JOIN participant p ON d.participantid = p.participantid
     ORDER BY d.donationdate DESC NULLS LAST, d.donationid DESC
     LIMIT 200`
  );
  return rows;
}

async function getDonation(id) {
  const { rows } = await pool.query(
    `SELECT d.donationid AS id,
            d.participantid,
            d.donationamount AS amount,
            d.donationdate AS date,
            CASE
              WHEN d.participantid IS NOT NULL THEN TRIM(BOTH ' ' FROM COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,''))
              WHEN COALESCE(d.donorfirstname,'') <> '' OR COALESCE(d.donorlastname,'') <> ''
                THEN TRIM(BOTH ' ' FROM COALESCE(d.donorfirstname,'') || ' ' || COALESCE(d.donorlastname,''))
              ELSE 'Anonymous'
            END AS displayname,
            d.donorfirstname,
            d.donorlastname,
            TRIM(BOTH ' ' FROM COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantname
     FROM donation d
     LEFT JOIN participant p ON d.participantid = p.participantid
     WHERE d.donationid = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

app.get('/admin/donations', requireManager, async (_req, res) => {
  try {
    const donations = await listDonations();
    res.render(path.join('donations', 'adminList'), {
      title: 'Manage Donations',
      donations,
    });
  } catch (err) {
    console.error('Admin donations list error:', err);
    res.status(500).send('Could not load donations');
  }
});

app.get('/admin/donations/new', requireManager, (req, res) => {
  res.render(path.join('donations', 'adminAdd'), {
    title: 'Add Donation',
    error: null,
    formValues: {},
  });
});

app.post('/admin/donations/new', requireManager, async (req, res) => {
  const { donorfirstname, donorlastname, participantid, amount, donationdate } = req.body;
  const pid = Number(participantid);
  const amt = Number(amount);
  const date = donationdate ? new Date(donationdate) : null;
  const donorFirst = (donorfirstname || '').trim();
  const donorLast = (donorlastname || '').trim();

  try {
    if (!donorFirst && !donorLast && (!pid || Number.isNaN(pid))) {
      return res.status(400).render(path.join('donations', 'adminAdd'), {
        title: 'Add Donation',
        error: 'Provide a donor name or participant ID.',
        formValues: { donorfirstname, donorlastname, participantid, amount, donationdate },
      });
    }

    if (!amt || Number.isNaN(amt)) {
      return res.status(400).render(path.join('donations', 'adminAdd'), {
        title: 'Add Donation',
        error: 'Amount is required.',
        formValues: { donorfirstname, donorlastname, participantid, amount, donationdate },
      });
    }

    // Resolve participant id: use provided id or create a donor participant so the FK is satisfied
    let participantId = (pid && !Number.isNaN(pid)) ? pid : null;
    if (!participantId) {
      const fallbackFirst = donorFirst || 'Anonymous';
      const fallbackEmail = `donor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ella.local`;
      const { rows } = await pool.query(
        `INSERT INTO participant (participantemail, participantfirstname, participantlastname, participantrole)
         VALUES ($1, $2, $3, 'Donor')
         RETURNING participantid`,
        [fallbackEmail, fallbackFirst, donorLast || null]
      );
      participantId = rows[0]?.participantid;
      if (!participantId) throw new Error('Could not resolve participant for donation');
    }

    let nextId = await getNextDonationId();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await pool.query(
          `INSERT INTO donation (donationid, participantid, donationamount, donationdate, donorfirstname, donorlastname, donationno)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            nextId,
            participantId,
            amt,
            date && !Number.isNaN(date.valueOf()) ? date : CURRENT_DATE,
            donorFirst || null,
            donorLast || null,
            1
          ]
        );
        break;
      } catch (err) {
        if (err.code === '23505') {
          nextId += 1;
          continue;
        }
        throw err;
      }
    }

    res.redirect('/admin/donations');
  } catch (err) {
    console.error('Admin donation add error:', err);
    res.status(500).render(path.join('donations', 'adminAdd'), {
      title: 'Add Donation',
      error: 'Could not add donation.',
      formValues: { participantid, amount, donationdate },
    });
  }
});

app.get('/admin/donations/:id/edit', requireManager, async (req, res) => {
  try {
    const donation = await getDonation(req.params.id);
    if (!donation) return res.status(404).send('Donation not found');
    // normalize date to Date for template
    donation.date = donation.date ? new Date(donation.date) : null;
    res.render(path.join('donations', 'adminEdit'), {
      title: 'Edit Donation',
      donation,
      error: null,
    });
  } catch (err) {
    console.error('Admin donation edit load error:', err);
    res.status(500).send('Could not load donation');
  }
});

app.post('/admin/donations/:id/edit', requireManager, async (req, res) => {
  const { amount, donationdate, donorfirstname, donorlastname } = req.body;
  const amt = Number(amount);
  const date = donationdate ? new Date(donationdate) : null;
  const donorFirst = (donorfirstname || '').trim();
  const donorLast = (donorlastname || '').trim();

  try {
    if (!amount || Number.isNaN(amt)) {
      const donation = await getDonation(req.params.id);
      if (!donation) return res.status(404).send('Donation not found');
      donation.date = donation.date ? new Date(donation.date) : null;
      return res.status(400).render(path.join('donations', 'adminEdit'), {
        title: 'Edit Donation',
        donation,
        error: 'Amount is required.',
      });
    }

    await pool.query(
      `UPDATE donation
       SET donationamount = $1,
           donationdate = $2,
           donorfirstname = $3,
           donorlastname = $4
       WHERE donationid = $5`,
      [amt, date && !Number.isNaN(date.valueOf()) ? date : null, donorFirst || null, donorLast || null, req.params.id]
    );

    res.redirect('/admin/donations');
  } catch (err) {
    console.error('Admin donation edit submit error:', err);
    res.status(500).send('Could not update donation');
  }
});

app.get('/admin/donations/:id/delete', requireManager, async (req, res) => {
  try {
    const donation = await getDonation(req.params.id);
    if (!donation) return res.status(404).send('Donation not found');
    res.render(path.join('donations', 'adminDelete'), {
      title: 'Delete Donation',
      donation,
    });
  } catch (err) {
    console.error('Admin donation delete load error:', err);
    res.status(500).send('Could not load donation');
  }
});

app.post('/admin/donations/:id/delete', requireManager, async (req, res) => {
  try {
    await pool.query('DELETE FROM donation WHERE donationid = $1', [req.params.id]);
    res.redirect('/admin/donations');
  } catch (err) {
    console.error('Admin donation delete error:', err);
    res.status(500).send('Could not delete donation');
  }
});

// /events -> views/events/events.ejs
app.get('/events', async (req, res) => {
  try {
    let participantId = req.session.user?.participantid || null;
    if (!participantId && req.session.user?.username) {
      try {
        const p = await findParticipantByEmail(req.session.user.username);
        if (p) {
          participantId = p.participantid;
          req.session.user.participantid = participantId;
        }
      } catch (e) {
        console.warn('Could not resolve participant for session user:', e);
      }
    }

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

    let registeredEventIds = [];
    if (participantId) {
      try {
        const r = await pool.query(
          'SELECT eventoccurrenceid FROM registration WHERE participantid = $1',
          [participantId]
        );
        registeredEventIds = r.rows.map(row => Number(row.eventoccurrenceid));
      } catch (e) {
        console.warn('Could not load registrations for participant:', e);
      }
    }

    return res.render(path.join('events', 'events'), {
      title: 'Events',
      upcomingEvents: upcomingResult.rows,
      pastEvents: [], // past events now shown on separate page
      message: req.query.msg || null,
      error: req.query.err || null,
      isManager,
      registeredEventIds,
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
      return res.status(400).render(path.join('Surveys', 'userSurveys'), {
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

    return res.render(path.join('Surveys', 'userSurveys'), {
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

  let participant = null;
  let events = [];
  try {
    participant = await findParticipantForUser(req.session.user);
    if (!participant) {
      return res.status(400).render(path.join('Surveys', 'userSurveys'), {
        title: 'Surveys',
        surveys: [],
        events: [],
        error: 'No participant record found for your account. Please contact support.',
        formValues: {},
      });
    }

    events = await getRecentPastEventsForSurvey();
    const eventId = Number(eventoccurrenceid);
    const sat = Number(satisfaction);
    const use = Number(usefulness);
    const instr = Number(instructor);
    const rec = Number(recommendation);

    // Prevent duplicate submissions for same participant/event
    if (await surveyExists(participant.participantid, eventId)) {
      const surveys = await getSurveysForParticipant(participant.participantid);
      return res.status(400).render(path.join('Surveys', 'userSurveys'), {
        title: 'Surveys',
        surveys,
        events,
        error: 'You already submitted a survey for this event.',
        formValues: { eventoccurrenceid, satisfaction, usefulness, instructor, recommendation, comments },
      });
    }

    const invalid =
      !eventId ||
      Number.isNaN(sat) ||
      Number.isNaN(use) ||
      Number.isNaN(instr) ||
      Number.isNaN(rec);

    const eventIsValid = events.some((ev) => ev.eventoccurrenceid === eventId);

    if (invalid || !eventIsValid) {
      const surveys = await getSurveysForParticipant(participant.participantid);
      return res.status(400).render(path.join('Surveys', 'userSurveys'), {
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
    const surveys = await getSurveysForParticipant(
      req.session.user?.participantid || participant?.participantid
    );
    const errorMsg =
      err.code === 'DUP_SURVEY'
        ? 'You already submitted a survey for this event.'
        : 'Could not submit survey. Please try again or contact support.';
    return res.status(500).render(path.join('Surveys', 'userSurveys'), {
      title: 'Surveys',
      surveys,
      events,
      error: errorMsg,
      formValues: { eventoccurrenceid, satisfaction, usefulness, instructor, recommendation, comments },
    });
  }
});

// /milestones -> logged-in user milestone list
app.get('/milestones', requireAuth, async (req, res) => {
  try {
    const participantId = req.session.user?.participantid || null;
    if (!participantId) {
      return res.render(path.join('milestones', 'userMilestones'), {
        title: 'My Milestones',
        milestones: [],
        error: 'No participant record is linked to your account.',
      });
    }

    const milestones = await listMilestonesForParticipant(participantId);

    res.render(path.join('milestones', 'userMilestones'), {
      title: 'My Milestones',
      milestones,
      error: milestones.length ? null : 'No milestones assigned yet.',
    });
  } catch (err) {
    console.error('Load user milestones error:', err);
    res.status(500).render(path.join('milestones', 'userMilestones'), {
      title: 'My Milestones',
      milestones: [],
      error: 'Could not load milestones right now.',
    });
  }
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
  const { email, password } = req.body;
  try {
    const q = `
      SELECT userid, participantid, username, password, level
      FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [email]);

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
          error: 'Invalid email or password',
          created: undefined,
        });
      }

    let participantId = null;
    try {
      participantId = user.participantid || null;
      if (!participantId) {
        const participant = await findParticipantForUser({ username: user.username });
        if (participant) participantId = participant.participantid;
      }
    } catch (e) {
      console.warn('Could not map participant for user on login:', e);
    }

    req.session.user = {
      id: user.userid,
      username: user.username,
      role: mapRole(user.level),
      level: user.level,
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
  res.render(path.join('login', 'register'), { title: 'Create Account', error: null, formData: {} });
});

// POST /register
app.post('/register', async (req, res) => {
  const {
    password,
    confirmPassword,
    firstName,
    lastName,
    email,
    dob,
    affiliationType,
    affiliationName,
    phone,
    city,
    state,
    zipcode,
    interest,
  } = req.body;

  const normFirst = normalizeCapitalize(firstName);
  const normLast = normalizeCapitalize(lastName);
  const normCity = normalizeCapitalize(city);
  const normAffType = (affiliationType && affiliationType.trim()) ? affiliationType.trim() : null;
  const normAffName = (affiliationName && affiliationName.trim()) ? affiliationName.trim() : null;
  const normPhone = normalizeDigits(phone, 10);
  const normZip = normalizeDigits(zipcode, 10);

  const fieldOfInterest = interest || null;

  let client;
  try {
    const username = email && email.trim();

    if (!username) {
      return res.render(path.join('login', 'register'), {
        title: 'Create Account',
        error: 'Email is required.',
        formData: req.body,
      });
    }

    if (!password) {
      return res.render(path.join('login', 'register'), {
        title: 'Create Account',
        error: 'Password is required.',
        formData: req.body,
      });
    }

    if (password !== confirmPassword) {
      return res.render(path.join('login', 'register'), {
        title: 'Create Account',
        error: 'Passwords do not match.',
        formData: req.body,
      });
    }

    const requiredFields = [
      { value: normFirst, msg: 'First name is required.' },
      { value: normLast, msg: 'Last name is required.' },
      { value: dob, msg: 'Date of birth is required.' },
      { value: normAffType, msg: 'Affiliation type is required.' },
      { value: normAffName, msg: 'Affiliation name is required.' },
      { value: normPhone, msg: 'Phone number is required.' },
      { value: normCity, msg: 'City is required.' },
      { value: state, msg: 'State is required.' },
      { value: normZip, msg: 'Zipcode is required.' },
      { value: fieldOfInterest, msg: 'Interest selection is required.' },
    ];
    const missing = requiredFields.find(f => !f.value);
    if (missing) {
      return res.render(path.join('login', 'register'), {
        title: 'Create Account',
        error: missing.msg,
        formData: req.body,
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const participantInsert = await client.query(
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING participantid`,
      [
        email || null,
        normFirst || null,
        normLast || null,
        dob || null,
        'participant',
        normPhone || null,
        normCity || null,
        state || null,
        normZip || null,
        normAffType,
        normAffName,
        fieldOfInterest,
        0,
      ]
    );

    const participantId = participantInsert.rows[0]?.participantid;
    if (!participantId) throw new Error('Could not create participant record');

    await client.query(
      `INSERT INTO users (username, password, level, participantid)
       VALUES ($1, $2, $3, $4)`,
      [username, password, 'u', participantId] // TODO: bcrypt hash
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
    if (err.code === '23505') {
      const c = err.constraint || '';
      if (c.includes('participantemail') || c.includes('users_username') || c.includes('users_pkey')) {
        msg = 'Email already exists.';
      } else if (c.includes('participant')) {
        msg = 'Account could not be created (duplicate participant id). Please contact support to reseed IDs.';
      }
    }
    return res.render(path.join('login', 'register'), {
      title: 'Create Account',
      error: msg,
      formData: req.body,
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
    let participantId = req.session.user.participantid || null;
    if (!participantId) {
      const email = req.session.user.username;
      const participantRes = await pool.query(
        'SELECT participantid FROM participant WHERE LOWER(participantemail) = LOWER($1) LIMIT 1',
        [email]
      );
      if (participantRes.rows.length === 0) {
        return res.redirect('/events?err=noparticipant');
      }
      participantId = participantRes.rows[0].participantid;
    }

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

// Cancel RSVP
app.post('/events/:id/unrsvp', requireAuth, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!eventId) return res.redirect('/events?err=bad-event');

  try {
    let participantId = req.session.user.participantid || null;
    if (!participantId) {
      const email = req.session.user.username;
      const participantRes = await pool.query(
        'SELECT participantid FROM participant WHERE LOWER(participantemail) = LOWER($1) LIMIT 1',
        [email]
      );
      if (participantRes.rows.length === 0) {
        return res.redirect('/events?err=noparticipant');
      }
      participantId = participantRes.rows[0].participantid;
      req.session.user.participantid = participantId;
    }

    await pool.query(
      'DELETE FROM registration WHERE participantid = $1 AND eventoccurrenceid = $2',
      [participantId, eventId]
    );

    return res.redirect('/events?msg=unrsvped');
  } catch (err) {
    console.error('Un-RSVP error:', err);
    return res.redirect('/events?err=unrsvp');
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
app.get('/events/past', requireManager, async (req, res) => {
  try {
    const { page, pageSize } = resolvePagination(req, 'pastEvents');
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM eventoccurrence WHERE eventdatetimeend < NOW()`
    );
    const total = Number(countRes.rows[0]?.count || 0);
    const pagination = buildPagination(total, page, pageSize);

    const eventsRes = await pool.query(
      `SELECT
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
        etype.eventtypename,
        stats.survey_count,
        stats.avg_satisfaction,
        stats.avg_overall,
        tpl_stats.template_survey_count,
        tpl_stats.template_avg_satisfaction,
        tpl_stats.template_avg_overall
       FROM eventoccurrence eo
       JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
       LEFT JOIN eventtype etype ON et.eventtypeid = etype.eventtypeid
       LEFT JOIN (
         SELECT eventoccurrenceid, COUNT(*) AS count
         FROM registration
         GROUP BY eventoccurrenceid
       ) regs ON regs.eventoccurrenceid = eo.eventoccurrenceid
       LEFT JOIN (
         SELECT
           eventoccurrenceid,
           COUNT(*) AS survey_count,
           ROUND(AVG(surveysatisfactionscore)::numeric, 2) AS avg_satisfaction,
           ROUND(AVG(surveyoverallscore)::numeric, 2) AS avg_overall
         FROM survey
         GROUP BY eventoccurrenceid
       ) stats ON stats.eventoccurrenceid = eo.eventoccurrenceid
       LEFT JOIN (
         SELECT
           et.eventtemplateid,
           COUNT(s.*) AS template_survey_count,
           ROUND(AVG(s.surveysatisfactionscore)::numeric, 2) AS template_avg_satisfaction,
           ROUND(AVG(s.surveyoverallscore)::numeric, 2) AS template_avg_overall
         FROM eventtemplate et
         LEFT JOIN eventoccurrence eo2 ON eo2.eventtemplateid = et.eventtemplateid
         LEFT JOIN survey s ON s.eventoccurrenceid = eo2.eventoccurrenceid
         GROUP BY et.eventtemplateid
       ) tpl_stats ON tpl_stats.eventtemplateid = eo.eventtemplateid
       WHERE eo.eventdatetimeend < NOW()
       ORDER BY eo.eventdatetimestart DESC
       LIMIT $1 OFFSET $2`,
      [pagination.pageSize, pagination.offset]
    );

    return res.render(path.join('events', 'events_past'), {
      title: 'Past Events',
      events: eventsRes.rows,
      pagination,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
    });
  } catch (err) {
    console.error('Past events error:', err);
    return res.status(500).send('Could not load past events');
  }
});

// Manager: event stats (occurrence + template rollups)
app.get('/events/stats', requireManager, async (_req, res) => {
  try {
    const occurrenceStats = await pool.query(
      `SELECT
         eo.eventoccurrenceid,
         eo.eventtemplateid,
         eo.eventdatetimestart,
         eo.eventdatetimeend,
         et.eventname,
         et.eventtypeid,
         etype.eventtypename,
         COUNT(s.*) AS survey_count,
         ROUND(AVG(s.surveysatisfactionscore)::numeric, 2) AS avg_satisfaction,
         ROUND(AVG(s.surveyoverallscore)::numeric, 2) AS avg_overall
       FROM eventoccurrence eo
       JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
       LEFT JOIN eventtype etype ON etype.eventtypeid = et.eventtypeid
       LEFT JOIN survey s ON s.eventoccurrenceid = eo.eventoccurrenceid
       WHERE eo.eventdatetimeend < NOW()
       GROUP BY eo.eventoccurrenceid, eo.eventtemplateid, eo.eventdatetimestart, eo.eventdatetimeend, et.eventname, et.eventtypeid, etype.eventtypename
       ORDER BY eo.eventdatetimestart DESC
       LIMIT 300`
    );

    const templateStats = await pool.query(
      `SELECT
         et.eventtemplateid,
         et.eventname,
         et.eventtypeid,
         etype.eventtypename,
         COUNT(s.*) AS survey_count,
         ROUND(AVG(s.surveysatisfactionscore)::numeric, 2) AS avg_satisfaction,
         ROUND(AVG(s.surveyoverallscore)::numeric, 2) AS avg_overall,
         COUNT(DISTINCT eo.eventoccurrenceid) AS occurrences
       FROM eventtemplate et
       LEFT JOIN eventtype etype ON etype.eventtypeid = et.eventtypeid
       LEFT JOIN eventoccurrence eo ON eo.eventtemplateid = et.eventtemplateid
       LEFT JOIN survey s ON s.eventoccurrenceid = eo.eventoccurrenceid
       GROUP BY et.eventtemplateid, et.eventname, et.eventtypeid, etype.eventtypename
       ORDER BY avg_satisfaction DESC NULLS LAST, et.eventname ASC
       LIMIT 300`
    );

    res.render(path.join('events', 'events_stats'), {
      title: 'Event Statistics',
      occurrenceStats: occurrenceStats.rows,
      templateStats: templateStats.rows,
    });
  } catch (err) {
    console.error('Event stats error:', err);
    res.status(500).send('Could not load event stats');
  }
});

// Dashboard with basic KPIs
app.get('/dashboard', requireManager, async (_req, res) => {
  const embedUrl =
    'https://public.tableau.com/views/RegionalSampleWorkbook/College?:language=en-US&publish=yes&:showVizHome=no';

  try {
    const [
      participantCount,
      eventCount,
      milestoneCount,
      satisfactionAvg,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM participant'),
      pool.query('SELECT COUNT(*)::int AS count FROM eventoccurrence'),
      pool.query('SELECT COUNT(*)::int AS count FROM milestone'),
      pool.query('SELECT ROUND(AVG(surveyoverallscore)::numeric, 2) AS avg FROM survey'),
    ]);

    const stats = {
      participants: participantCount.rows[0]?.count ?? 0,
      events: eventCount.rows[0]?.count ?? 0,
      milestones: milestoneCount.rows[0]?.count ?? 0,
      avgSatisfaction:
        satisfactionAvg.rows[0]?.avg !== null && satisfactionAvg.rows[0]?.avg !== undefined
          ? Number(satisfactionAvg.rows[0].avg).toFixed(2)
          : null,
    };

    res.render(path.join('dashboard', 'dashboard'), {
      title: 'Dashboard',
      embedUrl,
      stats,
    });
  } catch (err) {
    console.error('Dashboard load error:', err);
    res.status(500).send('Could not load dashboard');
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
   ACCOUNT
----------------------------- */

// Helper: load participant by email (username treated as email)
async function findParticipantByEmail(email) {
  if (!email) return null;
  const res = await pool.query(
    `SELECT *
     FROM participant
     WHERE participantemail = $1
     LIMIT 1`,
    [email]
  );
  return res.rows[0] || null;
}

// GET /my-account
app.get('/my-account', requireAuth, async (req, res) => {
  try {
    const email = req.session.user?.username;
    const participant = await findParticipantByEmail(email);
    return res.render(path.join('account', 'account'), {
      title: 'My Account',
      participant,
      user: req.session.user,
    });
  } catch (err) {
    console.error('My account load error:', err);
    return res.status(500).send('Could not load account');
  }
});

// GET /my-account/edit
app.get('/my-account/edit', requireAuth, async (req, res) => {
  try {
    const email = req.session.user?.username;
    const participant = await findParticipantByEmail(email);
    return res.render(path.join('account', 'account_edit'), {
      title: 'Edit Account',
      participant,
      user: req.session.user,
      error: null,
    });
  } catch (err) {
    console.error('My account edit load error:', err);
    return res.status(500).send('Could not load account');
  }
});

// POST /my-account/edit
app.post('/my-account/edit', requireAuth, async (req, res) => {
  const email = req.session.user?.username;
  if (!email) return res.redirect('/login');

  const {
    participantfirstname,
    participantlastname,
    participantphone,
    participantcity,
    participantstate,
    participantzip,
    participantaffiliationtype,
    participantaffiliationname,
    participantfieldofinterest,
    participantdob,
  } = req.body;

  try {
    const participant = await findParticipantByEmail(email);
    if (!participant) {
      return res.render(path.join('account', 'account_edit'), {
        title: 'Edit Account',
        participant: null,
        user: req.session.user,
        error: 'No participant record found.',
      });
    }

    const normFirst = normalizeCapitalize(participantfirstname);
    const normLast = normalizeCapitalize(participantlastname);
    const normCity = normalizeCapitalize(participantcity);
    const normPhone = normalizeDigits(participantphone, 10);
    const normZip = normalizeDigits(participantzip, 10);
    const normAffName = participantaffiliationname ? participantaffiliationname.trim() : null;
    const normAffType = participantaffiliationtype ? participantaffiliationtype.trim() : null;
    const normField = participantfieldofinterest ? participantfieldofinterest.trim() : null;

    await pool.query(
      `UPDATE participant
       SET participantfirstname = $1,
           participantlastname = $2,
           participantphone = $3,
           participantcity = $4,
           participantstate = $5,
           participantzip = $6,
           participantaffiliationtype = $7,
           participantaffiliationname = $8,
           participantfieldofinterest = $9,
           participantdob = $10
       WHERE participantid = $11`,
      [
        normFirst || null,
        normLast || null,
        normPhone || null,
        normCity || null,
        participantstate || null,
        normZip || null,
        normAffType,
        normAffName,
        normField,
        participantdob || null,
        participant.participantid,
      ]
    );

    return res.redirect('/my-account');
  } catch (err) {
    console.error('My account edit save error:', err);
    return res.render(path.join('account', 'account_edit'), {
      title: 'Edit Account',
      participant: await findParticipantByEmail(email),
      user: req.session.user,
      error: 'Could not save changes.',
    });
  }
});

// Manager: view attendees for an event occurrence
app.get('/events/:id/attendees', requireManager, async (req, res) => {
  const eventId = Number(req.params.id);
  if (!eventId) return res.redirect('/events?err=bad-event');

  try {
    const eventRes = await pool.query(
      `SELECT eo.eventoccurrenceid,
              eo.eventdatetimestart,
              eo.eventdatetimeend,
              et.eventname
       FROM eventoccurrence eo
       JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
       WHERE eo.eventoccurrenceid = $1
       LIMIT 1`,
      [eventId]
    );
    if (eventRes.rows.length === 0) return res.redirect('/events?err=notfound');

    const attendeesRes = await pool.query(
      `SELECT
         p.participantid,
         p.participantfirstname,
         p.participantlastname,
         p.participantcity,
         p.participantdob
       FROM registration r
       JOIN participant p ON p.participantid = r.participantid
       WHERE r.eventoccurrenceid = $1
       ORDER BY p.participantlastname, p.participantfirstname`,
      [eventId]
    );

    return res.render(path.join('events', 'events_attendees'), {
      title: 'Event Attendees',
      event: eventRes.rows[0],
      attendees: attendeesRes.rows,
    });
  } catch (err) {
    console.error('Attendees load error:', err);
    return res.status(500).send('Could not load attendees');
  }
});

/* -----------------------------
   AUTHENTICATED PAGES
----------------------------- */

// /my-account -> views/account/account.ejs (populated below with participant data)

/* -------- Optional manager routes based on your files -------- */

/* -----------------------------
   PARTICIPANTS (manager)
----------------------------- */

// List participants
app.get('/participants', requireManager, async (req, res) => {
  try {
    const { page, pageSize } = resolvePagination(req, 'participants');
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM participant');
    const total = Number(countRes.rows[0]?.count || 0);
    const pagination = buildPagination(total, page, pageSize);

    const sortByParam = (req.query.sortBy || '').toString().trim().toLowerCase();
    const sortBy = ['events', 'surveys', 'milestones', 'name'].includes(sortByParam)
      ? sortByParam
      : 'name';
    const sortDirParamRaw = (req.query.sortDir || '').toString().trim().toLowerCase();
    const sortDirParam = sortDirParamRaw === 'asc' ? 'asc' : sortDirParamRaw === 'desc' ? 'desc' : 'desc';
    const sortDir = sortDirParam === 'asc' ? 'ASC' : 'DESC';
    const eventTemplateId = req.query.eventTemplateId ? Number(req.query.eventTemplateId) : null;
    const eventTypeId = req.query.eventTypeId ? Number(req.query.eventTypeId) : null;
    const milestoneCatalogId = req.query.milestoneCatalogId ? Number(req.query.milestoneCatalogId) : null;

    const params = [];
    const addParam = (v) => { params.push(v); return `$${params.length}`; };

    const eventFilters = [];
    if (eventTemplateId) eventFilters.push(`eo.eventtemplateid = ${addParam(eventTemplateId)}`);
    if (eventTypeId) eventFilters.push(`et.eventtypeid = ${addParam(eventTypeId)}`);
    const eventWhere = eventFilters.length ? `WHERE ${eventFilters.join(' AND ')}` : '';

    const surveyFilters = [];
    if (eventTemplateId) surveyFilters.push(`eo2.eventtemplateid = ${addParam(eventTemplateId)}`);
    if (eventTypeId) surveyFilters.push(`et2.eventtypeid = ${addParam(eventTypeId)}`);
    const surveyWhere = surveyFilters.length ? `WHERE ${surveyFilters.join(' AND ')}` : '';

    const milestoneFilters = [];
    if (milestoneCatalogId) milestoneFilters.push(`m.milestonecatalogid = ${addParam(milestoneCatalogId)}`);
    const milestoneWhere = milestoneFilters.length ? `WHERE ${milestoneFilters.join(' AND ')}` : '';
    const q = (req.query.q || '').toString();
    const participantFilters = [];
    if (q.trim()) {
      const likeParam = addParam(`%${q.trim().toLowerCase()}%`);
      participantFilters.push(`(LOWER(p.participantfirstname) LIKE ${likeParam}
        OR LOWER(p.participantlastname) LIKE ${likeParam}
        OR LOWER(p.participantemail) LIKE ${likeParam}
        OR LOWER(p.participantcity) LIKE ${likeParam}
        OR LOWER(p.participantstate) LIKE ${likeParam})`);
    }
    const participantWhere = participantFilters.length ? `WHERE ${participantFilters.join(' AND ')}` : '';

    let sortClause = `p.participantlastname ${sortDir}, p.participantfirstname ${sortDir}`;
    if (sortBy === 'events') sortClause = `events_attended ${sortDir}, p.participantlastname ASC`;
    else if (sortBy === 'surveys') sortClause = `surveys_completed ${sortDir}, p.participantlastname ASC`;
    else if (sortBy === 'milestones') sortClause = `milestones_completed ${sortDir}, p.participantlastname ASC`;

    const [eventTemplatesRes, eventTypesRes, milestoneCatalogRes, participantsRes] = await Promise.all([
      pool.query('SELECT eventtemplateid, eventname FROM eventtemplate ORDER BY eventname'),
      pool.query('SELECT eventtypeid, eventtypename FROM eventtype ORDER BY eventtypename'),
      pool.query('SELECT milestonecatalogid, milestonetitle FROM milestonecatalog ORDER BY milestonetitle'),
      pool.query(
        `SELECT p.participantid,
                p.participantfirstname,
                p.participantlastname,
                p.participantdob,
                p.participantcity,
                u.username,
                u.password,
                u.level,
                COALESCE(reg_counts.events_attended, 0) AS events_attended,
                COALESCE(surv_counts.surveys_completed, 0) AS surveys_completed,
                COALESCE(ms_counts.milestones_completed, 0) AS milestones_completed
         FROM participant p
         LEFT JOIN users u ON u.participantid = p.participantid
         LEFT JOIN (
           SELECT r.participantid, COUNT(DISTINCT r.eventoccurrenceid) AS events_attended
           FROM registration r
           JOIN eventoccurrence eo ON eo.eventoccurrenceid = r.eventoccurrenceid
           JOIN eventtemplate et ON et.eventtemplateid = eo.eventtemplateid
           ${eventWhere}
           GROUP BY r.participantid
         ) reg_counts ON reg_counts.participantid = p.participantid
         LEFT JOIN (
           SELECT s.participantid, COUNT(*) AS surveys_completed
           FROM survey s
           JOIN eventoccurrence eo2 ON eo2.eventoccurrenceid = s.eventoccurrenceid
           JOIN eventtemplate et2 ON et2.eventtemplateid = eo2.eventtemplateid
           ${surveyWhere}
           GROUP BY s.participantid
         ) surv_counts ON surv_counts.participantid = p.participantid
         LEFT JOIN (
           SELECT m.participantid, COUNT(*) AS milestones_completed
           FROM milestone m
           ${milestoneWhere}
           GROUP BY m.participantid
         ) ms_counts ON ms_counts.participantid = p.participantid
         ${participantWhere}
         ORDER BY ${sortClause}
         LIMIT ${addParam(pagination.pageSize)} OFFSET ${addParam(pagination.offset)}`,
        params
      )
    ]);

    return res.render(path.join('allParticipants', 'index'), {
      title: 'All Participants',
      participants: participantsRes.rows,
      pagination,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      filters: {
        sortBy,
        sortDir: sortDirParam,
        eventTemplateId,
        eventTypeId,
        milestoneCatalogId,
        q,
      },
      eventTemplates: eventTemplatesRes.rows,
      eventTypes: eventTypesRes.rows,
      milestoneCatalog: milestoneCatalogRes.rows,
    });
  } catch (err) {
    console.error('Participants list error:', err);
    return res.status(500).send('Could not load participants');
  }
});

// Export participants (CSV) with current filters/sorting
app.get('/participants/export', requireManager, async (req, res) => {
  try {
    const sortByParam = (req.query.sortBy || '').toString().trim().toLowerCase();
    const sortBy = ['events', 'surveys', 'milestones', 'name'].includes(sortByParam)
      ? sortByParam
      : 'name';
    const sortDirParamRaw = (req.query.sortDir || '').toString().trim().toLowerCase();
    const sortDirParam = sortDirParamRaw === 'asc' ? 'asc' : 'desc';
    const sortDir = sortDirParam === 'asc' ? 'ASC' : 'DESC';
    const eventTemplateId = req.query.eventTemplateId ? Number(req.query.eventTemplateId) : null;
    const eventTypeId = req.query.eventTypeId ? Number(req.query.eventTypeId) : null;
    const milestoneCatalogId = req.query.milestoneCatalogId ? Number(req.query.milestoneCatalogId) : null;
    const q = (req.query.q || '').toString();

    const params = [];
    const addParam = (v) => { params.push(v); return `$${params.length}`; };

    const eventFilters = [];
    if (eventTemplateId) eventFilters.push(`eo.eventtemplateid = ${addParam(eventTemplateId)}`);
    if (eventTypeId) eventFilters.push(`et.eventtypeid = ${addParam(eventTypeId)}`);
    const eventWhere = eventFilters.length ? `WHERE ${eventFilters.join(' AND ')}` : '';

    const surveyFilters = [];
    if (eventTemplateId) surveyFilters.push(`eo2.eventtemplateid = ${addParam(eventTemplateId)}`);
    if (eventTypeId) surveyFilters.push(`et2.eventtypeid = ${addParam(eventTypeId)}`);
    const surveyWhere = surveyFilters.length ? `WHERE ${surveyFilters.join(' AND ')}` : '';

    const milestoneFilters = [];
    if (milestoneCatalogId) milestoneFilters.push(`m.milestonecatalogid = ${addParam(milestoneCatalogId)}`);
    const milestoneWhere = milestoneFilters.length ? `WHERE ${milestoneFilters.join(' AND ')}` : '';

    const participantFilters = [];
    if (q.trim()) {
      const likeParam = addParam(`%${q.trim().toLowerCase()}%`);
      participantFilters.push(`(LOWER(p.participantfirstname) LIKE ${likeParam}
        OR LOWER(p.participantlastname) LIKE ${likeParam}
        OR LOWER(p.participantemail) LIKE ${likeParam}
        OR LOWER(p.participantcity) LIKE ${likeParam}
        OR LOWER(p.participantstate) LIKE ${likeParam})`);
    }
    const participantWhere = participantFilters.length ? `WHERE ${participantFilters.join(' AND ')}` : '';

    let sortClause = `p.participantlastname ${sortDir}, p.participantfirstname ${sortDir}`;
    if (sortBy === 'events') sortClause = `events_attended ${sortDir}, p.participantlastname ASC`;
    else if (sortBy === 'surveys') sortClause = `surveys_completed ${sortDir}, p.participantlastname ASC`;
    else if (sortBy === 'milestones') sortClause = `milestones_completed ${sortDir}, p.participantlastname ASC`;

    const { rows } = await pool.query(
      `SELECT p.participantid,
              p.participantfirstname,
              p.participantlastname,
              p.participantdob,
              p.participantcity,
              p.participantstate,
              u.username,
              COALESCE(reg_counts.events_attended, 0) AS events_attended,
              COALESCE(surv_counts.surveys_completed, 0) AS surveys_completed,
              COALESCE(ms_counts.milestones_completed, 0) AS milestones_completed
       FROM participant p
       LEFT JOIN users u ON u.participantid = p.participantid
       LEFT JOIN (
         SELECT r.participantid, COUNT(DISTINCT r.eventoccurrenceid) AS events_attended
         FROM registration r
         JOIN eventoccurrence eo ON eo.eventoccurrenceid = r.eventoccurrenceid
         JOIN eventtemplate et ON et.eventtemplateid = eo.eventtemplateid
         ${eventWhere}
         GROUP BY r.participantid
       ) reg_counts ON reg_counts.participantid = p.participantid
       LEFT JOIN (
         SELECT s.participantid, COUNT(*) AS surveys_completed
         FROM survey s
         JOIN eventoccurrence eo2 ON eo2.eventoccurrenceid = s.eventoccurrenceid
         JOIN eventtemplate et2 ON et2.eventtemplateid = eo2.eventtemplateid
         ${surveyWhere}
         GROUP BY s.participantid
       ) surv_counts ON surv_counts.participantid = p.participantid
       LEFT JOIN (
         SELECT m.participantid, COUNT(*) AS milestones_completed
         FROM milestone m
         ${milestoneWhere}
         GROUP BY m.participantid
       ) ms_counts ON ms_counts.participantid = p.participantid
       ${participantWhere}
       ORDER BY ${sortClause}`,
      params
    );

    const headers = [
      'Participant ID',
      'First Name',
      'Last Name',
      'City',
      'State',
      'DOB',
      'Username',
      'Events Attended',
      'Surveys Completed',
      'Milestones Completed',
    ];

    const escapeCsv = (val) => {
      const v = val === null || typeof val === 'undefined' ? '' : String(val);
      if (v.includes('"') || v.includes(',') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };

    const csvRows = [
      headers.join(','),
      ...rows.map(r =>
        [
          r.participantid,
          r.participantfirstname || '',
          r.participantlastname || '',
          r.participantcity || '',
          r.participantstate || '',
          r.participantdob ? new Date(r.participantdob).toISOString().slice(0, 10) : '',
          r.username || '',
          r.events_attended || 0,
          r.surveys_completed || 0,
          r.milestones_completed || 0,
        ].map(escapeCsv).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
    return res.send(csvRows);
  } catch (err) {
    console.error('Participants export error:', err);
    return res.status(500).send('Could not export participants');
  }
});

// New participant form
app.get('/participants/new', requireManager, async (_req, res) => {
  try {
    const catalog = await listMilestoneCatalog();
    res.render(path.join('allParticipants', 'add'), {
      title: 'Add Participant',
      participant: {},
      catalog,
      error: null,
    });
  } catch (err) {
    console.error('Participant add form error:', err);
    res.status(500).send('Could not load form');
  }
});

// Create participant (with optional user, milestones)
app.post('/participants/new', requireManager, async (req, res) => {
  const {
    participantfirstname,
    participantlastname,
    participantemail,
    participantdob,
    participantphone,
    participantcity,
    participantstate,
    participantzip,
    participantaffiliationtype,
    participantaffiliationname,
    participantfieldofinterest,
    createUser,
    username,
    password,
    userLevel,
  } = req.body;
  const milestoneIds = Array.isArray(req.body.milestones)
    ? req.body.milestones
    : req.body.milestones ? [req.body.milestones] : [];

  const normFirst = normalizeCapitalize(participantfirstname);
  const normLast = normalizeCapitalize(participantlastname);
  const normCity = normalizeCapitalize(participantcity);
  const normPhone = normalizeDigits(participantphone, 10);
  const normZip = normalizeDigits(participantzip, 10);
  const normAffType = participantaffiliationtype ? participantaffiliationtype.trim() : null;
  const normAffName = participantaffiliationname ? participantaffiliationname.trim() : null;
  const normField = participantfieldofinterest ? participantfieldofinterest.trim() : null;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const pRes = await client.query(
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING participantid`,
      [
        participantemail || null,
        normFirst || null,
        normLast || null,
        participantdob || null,
        'participant',
        normPhone || null,
        normCity || null,
        participantstate || null,
        normZip || null,
        normAffType,
        normAffName,
        normField,
        0,
      ]
    );

    const participantId = pRes.rows[0]?.participantid;
    if (!participantId) throw new Error('Could not create participant');

    if (milestoneIds.length > 0) {
      for (const mid of milestoneIds) {
        await client.query(
          `INSERT INTO milestone (participantid, milestonecatalogid, milestonedate, milestoneno)
           VALUES ($1, $2, NULL, NULL)`,
          [participantId, Number(mid)]
        );
      }
    }

    const newUserLevel = normalizeUserLevel(userLevel);

    if (createUser && username && password) {
      await client.query(
        `INSERT INTO users (username, password, level, participantid)
         VALUES ($1, $2, $3, $4)`,
        [username.trim(), password, newUserLevel, participantId]
      );
    }

    await client.query('COMMIT');
    return res.redirect('/participants');
  } catch (err) {
    console.error('Create participant error:', err);
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    const catalog = await listMilestoneCatalog();
    return res.render(path.join('allParticipants', 'add'), {
      title: 'Add Participant',
      participant: req.body,
      catalog,
      error: err.message || 'Could not create participant.',
    });
  } finally {
    if (client) client.release();
  }
});

// View participant
app.get('/participants/:id', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/participants');
  try {
    const detail = await getParticipantDetail(id);
    if (!detail) return res.redirect('/participants');

    const fromAssignments = req.query.from === 'assignments';
    let backUrl = '/participants';
    if (fromAssignments) {
      const page = req.query.page || 1;
      const pageSize = req.query.pageSize || 50;
      const q = req.query.q ? `&q=${encodeURIComponent(req.query.q)}` : '';
      backUrl = `/admin/milestones/assignments?page=${page}&pageSize=${pageSize}${q}`;
    }

    return res.render(path.join('allParticipants', 'view'), {
      title: 'Participant Detail',
      participant: detail.participant,
      milestones: detail.milestones,
      backUrl,
    });
  } catch (err) {
    console.error('View participant error:', err);
    return res.status(500).send('Could not load participant');
  }
});

// Edit participant form
app.get('/participants/:id/edit', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/participants');
  try {
    const detail = await getParticipantDetail(id);
    if (!detail) return res.redirect('/participants');
    const catalog = await listMilestoneCatalog();
    const milestoneIds = detail.milestones.map(m => m.milestonecatalogid);
    return res.render(path.join('allParticipants', 'edit'), {
      title: 'Edit Participant',
      participant: detail.participant,
      milestones: detail.milestones,
      catalog,
      milestoneIds,
      error: null,
    });
  } catch (err) {
    console.error('Edit participant load error:', err);
    return res.status(500).send('Could not load participant');
  }
});

// Edit participant submit
app.post('/participants/:id/edit', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/participants');

  const {
    participantfirstname,
    participantlastname,
    participantemail,
    participantdob,
    participantphone,
    participantcity,
    participantstate,
    participantzip,
    participantaffiliationtype,
    participantaffiliationname,
    participantfieldofinterest,
    username,
    password,
    userLevel,
  } = req.body;
  const milestoneIds = Array.isArray(req.body.milestones)
    ? req.body.milestones
    : req.body.milestones ? [req.body.milestones] : [];

  const normFirst = normalizeCapitalize(participantfirstname);
  const normLast = normalizeCapitalize(participantlastname);
  const normCity = normalizeCapitalize(participantcity);
  const normPhone = normalizeDigits(participantphone, 10);
  const normZip = normalizeDigits(participantzip, 10);
  const normAffType = participantaffiliationtype ? participantaffiliationtype.trim() : null;
  const normAffName = participantaffiliationname ? participantaffiliationname.trim() : null;
  const normField = participantfieldofinterest ? participantfieldofinterest.trim() : null;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    await client.query(
      `UPDATE participant
       SET participantfirstname = $1,
           participantlastname = $2,
           participantemail = $3,
           participantdob = $4,
           participantphone = $5,
           participantcity = $6,
           participantstate = $7,
           participantzip = $8,
           participantaffiliationtype = $9,
           participantaffiliationname = $10,
           participantfieldofinterest = $11
       WHERE participantid = $12`,
      [
        normFirst || null,
        normLast || null,
        participantemail || null,
        participantdob || null,
        normPhone || null,
        normCity || null,
        participantstate || null,
        normZip || null,
        normAffType,
        normAffName,
        normField,
        id,
      ]
    );

    await client.query('DELETE FROM milestone WHERE participantid = $1', [id]);
    if (milestoneIds.length > 0) {
      for (const mid of milestoneIds) {
        await client.query(
          `INSERT INTO milestone (participantid, milestonecatalogid, milestonedate, milestoneno)
           VALUES ($1, $2, NULL, NULL)`,
          [id, Number(mid)]
        );
      }
    }

    const normalizedLevel = normalizeUserLevel(userLevel);

    if (username) {
      const userRes = await client.query(
        'SELECT userid FROM users WHERE participantid = $1',
        [id]
      );
      if (userRes.rows.length > 0) {
        await client.query(
          'UPDATE users SET username = $1, password = COALESCE($2,password), level = $3 WHERE participantid = $4',
          [username.trim(), password || null, normalizedLevel, id]
        );
      } else if (password) {
        await client.query(
          'INSERT INTO users (username, password, level, participantid) VALUES ($1,$2,$3,$4)',
          [username.trim(), password, normalizedLevel, id]
        );
      }
    }

    await client.query('COMMIT');
    return res.redirect('/participants');
  } catch (err) {
    console.error('Edit participant save error:', err);
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    const catalog = await listMilestoneCatalog();
    return res.render(path.join('allParticipants', 'edit'), {
      title: 'Edit Participant',
      participant: { participantid: id, participantfirstname, participantlastname, participantemail, participantdob, participantphone, participantcity, participantstate, participantzip, participantaffiliationtype, participantaffiliationname, participantfieldofinterest, username, userLevel },
      milestones: [],
      catalog,
      milestoneIds,
      error: err.message || 'Could not update participant.',
    });
  } finally {
    if (client) client.release();
  }
});

// Delete participant
app.post('/participants/:id/delete', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/participants');
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM users WHERE participantid = $1', [id]);
    await client.query('DELETE FROM registration WHERE participantid = $1', [id]);
    await client.query('DELETE FROM survey WHERE participantid = $1', [id]);
    await client.query('DELETE FROM donation WHERE participantid = $1', [id]);
    await client.query('DELETE FROM milestone WHERE participantid = $1', [id]);
    await client.query('DELETE FROM participant WHERE participantid = $1', [id]);
    await client.query('COMMIT');
    return res.redirect('/participants');
  } catch (err) {
    console.error('Delete participant error:', err);
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    return res.redirect('/participants');
  } finally {
    if (client) client.release();
  }
});

// All Users (manager)
app.get('/admin/users', requireManager, async (req, res) => {
  try {
    const { page, pageSize } = resolvePagination(req, 'adminUsers');
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM users');
    const total = Number(countRes.rows[0]?.count || 0);
    const pagination = buildPagination(total, page, pageSize);

    const usersRes = await pool.query(
      `SELECT
          u.userid,
          u.username,
          u.level,
          u.participantid,
          p.participantfirstname,
          p.participantlastname,
          p.participantemail,
          p.participantcity,
          p.participantstate
       FROM users u
       LEFT JOIN participant p ON p.participantid = u.participantid
       ORDER BY LOWER(u.username)
       LIMIT $1 OFFSET $2`,
      [pagination.pageSize, pagination.offset]
    );

    return res.render(path.join('allUsers', 'allUsers'), {
      title: 'All Users',
      users: usersRes.rows,
      pagination,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
    });
  } catch (err) {
    console.error('All users load error:', err);
    return res.status(500).send('Could not load users');
  }
});

// Render: add user
app.get('/admin/users/add', requireManager, (_req, res) => {
  res.render(path.join('allUsers', 'allUsers_add'), {
    title: 'Add User',
    error: null,
    formData: {},
  });
});

// Create user
app.post('/admin/users/add', requireManager, async (req, res) => {
  const { username, password, level, participantid } = req.body || {};
  const cleanUsername = (username || '').trim();
  const cleanPassword = (password || '').trim();
  const participantIdNumber = participantid ? Number(participantid) : null;
  const normalizedLevel = normalizeUserLevel(level);

  if (!cleanUsername || !cleanPassword) {
    return res.render(path.join('allUsers', 'allUsers_add'), {
      title: 'Add User',
      error: 'Username and password are required.',
      formData: { username: cleanUsername, level: normalizedLevel, participantid },
    });
  }

  try {
    await pool.query(
      `INSERT INTO users (username, password, level, participantid)
       VALUES ($1, $2, $3, $4)`,
      [cleanUsername, cleanPassword, normalizedLevel, participantIdNumber || null]
    );
    return res.redirect('/admin/users');
  } catch (err) {
    console.error('Add user error:', err);
    let error = 'Could not create user.';
    if (err.code === '23505') {
      error = 'Username already exists.';
    }
    return res.render(path.join('allUsers', 'allUsers_add'), {
      title: 'Add User',
      error,
      formData: { username: cleanUsername, level: normalizedLevel, participantid },
    });
  }
});

// Render: edit user
app.get('/admin/users/:id/edit', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/admin/users');
  try {
    const { rows } = await pool.query(
      `SELECT userid, username, level, participantid
       FROM users
       WHERE userid = $1
       LIMIT 1`,
      [id]
    );
    const user = rows[0];
    if (!user) return res.redirect('/admin/users');
    res.render(path.join('allUsers', 'allUsers_edit'), {
      title: 'Edit User',
      user,
      error: null,
    });
  } catch (err) {
    console.error('Load edit user error:', err);
    return res.redirect('/admin/users');
  }
});

// Save: edit user
app.post('/admin/users/:id/edit', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/admin/users');

  const { username, password, level, participantid } = req.body || {};
  const cleanUsername = (username || '').trim();
  const cleanPassword = (password || '').trim();
  const participantIdNumber = participantid ? Number(participantid) : null;
  const normalizedLevel = normalizeUserLevel(level);

  if (!cleanUsername) {
    return res.render(path.join('allUsers', 'allUsers_edit'), {
      title: 'Edit User',
      user: { userid: id, username: cleanUsername, level: normalizedLevel, participantid },
      error: 'Username is required.',
    });
  }

  try {
    if (cleanPassword) {
      await pool.query(
        `UPDATE users
         SET username = $1,
             password = $2,
             level = $3,
             participantid = $4
         WHERE userid = $5`,
        [cleanUsername, cleanPassword, normalizedLevel, participantIdNumber || null, id]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET username = $1,
             level = $2,
             participantid = $3
         WHERE userid = $4`,
        [cleanUsername, normalizedLevel, participantIdNumber || null, id]
      );
    }
    return res.redirect('/admin/users');
  } catch (err) {
    console.error('Edit user save error:', err);
    let error = 'Could not update user.';
    if (err.code === '23505') {
      error = 'Username already exists.';
    }
    return res.render(path.join('allUsers', 'allUsers_edit'), {
      title: 'Edit User',
      user: { userid: id, username: cleanUsername, level: normalizedLevel, participantid },
      error,
    });
  }
});

// Delete user
app.post('/admin/users/:id/delete', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/admin/users');

  // Prevent a manager/admin from deleting their own account
  const currentUserId = Number(req.session?.user?.id);
  if (currentUserId && currentUserId === id) {
    return res.redirect('/admin/users?err=cannot-delete-self');
  }

  try {
    await pool.query('DELETE FROM users WHERE userid = $1', [id]);
    return res.redirect('/admin/users?msg=user-deleted');
  } catch (err) {
    console.error('Delete user error:', err);
    return res.redirect('/admin/users?err=user-delete');
  }
});

// /admin/milestones -> catalog + assignment management
app.get('/admin/milestones', requireManager, async (req, res) => {
  try {
    const { page, pageSize } = resolvePagination(req, 'milestoneCatalog', CATALOG_PAGE_SIZES, 10);
    const catalogSearch = (req.query.catalogSearch || '').toString().trim();
    const hasSearch = catalogSearch.length > 0;
    const where = hasSearch ? 'WHERE LOWER(milestonetitle) LIKE $1' : '';
    const params = hasSearch ? [`%${catalogSearch.toLowerCase()}%`] : [];

    const [catalogCountRes, catalogRes, countsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM milestonecatalog ${where}`, params),
      pool.query(
        `SELECT milestonecatalogid AS id, milestonetitle AS title
         FROM milestonecatalog
         ${where}
         ORDER BY milestonetitle ASC
         LIMIT $${hasSearch ? 2 : 1} OFFSET $${hasSearch ? 3 : 2}`,
        hasSearch ? [...params, pageSize, (page - 1) * pageSize] : [pageSize, (page - 1) * pageSize]
      ),
      pool.query('SELECT milestonecatalogid, COUNT(*)::int AS count FROM milestone GROUP BY milestonecatalogid'),
    ]);

    const countMap = {};
    countsRes.rows.forEach(r => {
      countMap[r.milestonecatalogid] = Number(r.count) || 0;
    });

    const msgMap = {
      'milestone-added': 'Milestone added.',
      'milestone-updated': 'Milestone updated.',
      'milestone-deleted': 'Milestone deleted.',
      'assignment-added': 'Milestone assigned.',
      'assignment-updated': 'Milestone updated for user.',
      'assignment-deleted': 'Milestone removed from user.',
      'assignment-error': 'Could not complete that milestone action.',
    };

    const message = msgMap[req.query.msg] || null;

    res.render(path.join('milestones', 'manMilestones'), {
      title: 'Manage Milestones',
      catalog: catalogRes.rows,
      catalogPagination: buildPagination(Number(catalogCountRes.rows[0]?.count || 0), page, pageSize),
      catalogPageSizeOptions: CATALOG_PAGE_SIZES,
      milestoneCounts: countMap,
      message,
      error: null,
      catalogSearch: (req.query.catalogSearch || '').toString(),
    });
  } catch (err) {
    console.error('Admin milestones load error:', err);
    res.status(500).send('Could not load milestones admin page');
  }
});

// Admin: paginated participant milestones view
app.get('/admin/milestones/assignments', requireManager, async (req, res) => {
  try {
    const { page, pageSize } = resolvePagination(req, 'milestoneAssignments');
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const hasSearch = q.length > 0;
    const searchClause = hasSearch
      ? `WHERE
           (LOWER(COALESCE(p.participantfirstname,'')) || ' ' || LOWER(COALESCE(p.participantlastname,''))) LIKE $1
           OR LOWER(COALESCE(p.participantemail,'')) LIKE $1
           OR CAST(p.participantid AS TEXT) LIKE $1`
      : '';

    const countParams = hasSearch ? [`%${q}%`] : [];
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM milestone m
       JOIN milestonecatalog mc ON mc.milestonecatalogid = m.milestonecatalogid
       LEFT JOIN participant p ON p.participantid = m.participantid
       ${searchClause}`,
      countParams
    );

    const total = Number(countRes.rows[0]?.count || 0);
    const pagination = buildPagination(total, page, pageSize);

    const dataParams = hasSearch
      ? [`%${q}%`, pagination.pageSize, pagination.offset]
      : [pagination.pageSize, pagination.offset];

    const assignmentsRes = await pool.query(
      `SELECT m.milestoneid,
              m.participantid,
              m.milestonecatalogid,
              m.milestonedate,
              m.milestoneno,
              mc.milestonetitle,
              p.participantfirstname,
              p.participantlastname,
              p.participantdob,
              TRIM(COALESCE(p.participantfirstname,'') || ' ' || COALESCE(p.participantlastname,'')) AS participantname,
              p.participantemail,
              p.participantcity,
              p.participantstate
       FROM milestone m
       JOIN milestonecatalog mc ON mc.milestonecatalogid = m.milestonecatalogid
       LEFT JOIN participant p ON p.participantid = m.participantid
       ${searchClause}
       ORDER BY LOWER(COALESCE(p.participantfirstname,'')), LOWER(COALESCE(p.participantlastname,'')), m.milestoneid DESC
       LIMIT $${hasSearch ? 2 : 1} OFFSET $${hasSearch ? 3 : 2}`,
      dataParams
    );

    const [participants, catalog] = await Promise.all([
      listParticipantsBasic(),
      listMilestoneCatalog(),
    ]);

    res.render(path.join('milestones', 'manMilestones_assignments'), {
      title: 'Participant Milestones',
      assignments: assignmentsRes.rows,
      participants,
      catalog,
      pagination,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      searchTerm: q,
      fromPage: 'assignments',
    });
  } catch (err) {
    console.error('Admin milestones assignments error:', err);
    res.status(500).send('Could not load participant milestones');
  }
});

// Admin: edit a specific milestone assignment (form)
app.get('/admin/milestones/assignments/:id/edit', requireManager, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.redirect('/admin/milestones/assignments');
  try {
    const assignment = await getMilestoneAssignment(id);
    if (!assignment) return res.redirect('/admin/milestones/assignments');

    const [participants, catalog] = await Promise.all([
      listParticipantsBasic(),
      listMilestoneCatalog(),
    ]);

    res.render(path.join('milestones', 'manMilestones_assignment_edit'), {
      title: 'Edit Participant Milestone',
      assignment,
      participants,
      catalog,
      error: null,
      fromPage: 'assignments',
    });
  } catch (err) {
    console.error('Load assignment edit error:', err);
    res.status(500).send('Could not load assignment');
  }
});

// Catalog: add
app.get('/admin/milestones/add', requireManager, (_req, res) => {
  res.render(path.join('milestones', 'manMilestones_add'), {
    title: 'Add Milestone',
    error: null,
  });
});

app.post('/admin/milestones/add', requireManager, async (req, res) => {
  try {
    const { title } = req.body;
    await createMilestoneCatalog(title);
    res.redirect('/admin/milestones?msg=milestone-added');
  } catch (err) {
    console.error('Add milestone catalog error:', err);
    res.status(400).render(path.join('milestones', 'manMilestones_add'), {
      title: 'Add Milestone',
      error: err.message || 'Could not add milestone.',
    });
  }
});

// Catalog: edit
app.get('/admin/milestones/:id/edit', requireManager, async (req, res) => {
  try {
    const item = await getMilestoneCatalogItem(req.params.id);
    if (!item) return res.status(404).send('Milestone not found');
    res.render(path.join('milestones', 'manMilestones_edit'), {
      title: 'Edit Milestone',
      item,
      error: null,
    });
  } catch (err) {
    console.error('Load milestone edit error:', err);
    res.status(500).send('Could not load milestone');
  }
});

app.post('/admin/milestones/:id/edit', requireManager, async (req, res) => {
  try {
    const { title } = req.body;
    await updateMilestoneCatalog(req.params.id, title);
    res.redirect('/admin/milestones?msg=milestone-updated');
  } catch (err) {
    console.error('Update milestone catalog error:', err);
    res.status(400).render(path.join('milestones', 'manMilestones_edit'), {
      title: 'Edit Milestone',
      item: { id: req.params.id, title: req.body.title },
      error: err.message || 'Could not update milestone.',
    });
  }
});

// Catalog: delete
app.get('/admin/milestones/:id/delete', requireManager, async (req, res) => {
  try {
    const item = await getMilestoneCatalogItem(req.params.id);
    if (!item) return res.status(404).send('Milestone not found');
    res.render(path.join('milestones', 'manMilestones_delete'), {
      title: 'Delete Milestone',
      item,
      error: null,
    });
  } catch (err) {
    console.error('Load milestone delete error:', err);
    res.status(500).send('Could not load milestone');
  }
});

app.post('/admin/milestones/:id/delete', requireManager, async (req, res) => {
  try {
    await deleteMilestoneCatalog(req.params.id);
    res.redirect('/admin/milestones?msg=milestone-deleted');
  } catch (err) {
    console.error('Delete milestone catalog error:', err);
    const item = await getMilestoneCatalogItem(req.params.id);
    res.status(400).render(path.join('milestones', 'manMilestones_delete'), {
      title: 'Delete Milestone',
      item,
      error:
        err.code === '23503'
          ? 'This milestone is assigned to users. Remove assignments first.'
          : err.message || 'Could not delete milestone.',
    });
  }
});

// Assignment add
app.post('/admin/milestones/assign', requireManager, async (req, res) => {
  try {
    const participantId = Number(req.body.participantid);
    const milestoneCatalogId = Number(req.body.milestonecatalogid);
    const achievedDate = req.body.achieveddate || null;
    const milestoneNo = req.body.milestoneno ? Number(req.body.milestoneno) : null;

    await addMilestoneAssignment({
      participantId,
      milestoneCatalogId,
      achievedDate,
      milestoneNo,
    });

    res.redirect('/admin/milestones/assignments?msg=assignment-added');
  } catch (err) {
    console.error('Add milestone assignment error:', err);
    res.redirect('/admin/milestones/assignments?msg=assignment-error');
  }
});

// Assignment edit
app.post('/admin/milestones/assign/:id/edit', requireManager, async (req, res) => {
  try {
    const participantId = Number(req.body.participantid);
    const milestoneCatalogId = Number(req.body.milestonecatalogid);
    const achievedDate = req.body.achieveddate || null;
    const milestoneNo = req.body.milestoneno ? Number(req.body.milestoneno) : null;

    await updateMilestoneAssignment(req.params.id, {
      participantId,
      milestoneCatalogId,
      achievedDate,
      milestoneNo,
    });

    res.redirect('/admin/milestones/assignments?msg=assignment-updated');
  } catch (err) {
    console.error('Edit milestone assignment error:', err);
    res.redirect('/admin/milestones/assignments?msg=assignment-error');
  }
});

// Assignment delete
app.post('/admin/milestones/assign/:id/delete', requireManager, async (req, res) => {
  try {
    await deleteMilestoneAssignment(req.params.id);
    res.redirect('/admin/milestones/assignments?msg=assignment-deleted');
  } catch (err) {
    console.error('Delete milestone assignment error:', err);
    res.redirect('/admin/milestones/assignments?msg=assignment-error');
  }
});

// Manager survey list
app.get('/admin/surveys', requireManager, async (req, res) => {
  try {
    const { page, pageSize } = resolvePagination(req, 'adminSurveys');
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM survey');
    const total = Number(countRes.rows[0]?.count || 0);
    const pagination = buildPagination(total, page, pageSize);

    const surveysRes = await pool.query(
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
       LEFT JOIN eventoccurrence eo ON eo.eventoccurrenceid = s.eventoccurrenceid
       LEFT JOIN eventtemplate et ON eo.eventtemplateid = et.eventtemplateid
       ORDER BY s.surveysubmissiondate DESC
       LIMIT $1 OFFSET $2`,
      [pagination.pageSize, pagination.offset]
    );

    res.render(path.join('Surveys', 'manSurveys'), {
      title: 'Manage Surveys',
      surveys: surveysRes.rows,
      pagination,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
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
    res.render(path.join('Surveys', 'manSurveys_edit'), {
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
    res.render(path.join('Surveys', 'manSurveys_delete'), {
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
  console.log(`✅ Ella Rises running → http://localhost:${PORT}`);
});
