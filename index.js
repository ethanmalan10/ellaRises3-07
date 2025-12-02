// index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const app = express();

// ---------- Core middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (CSS, images, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(expressLayouts);

// DEFAULT LAYOUT (DO NOT REMOVE)
app.set('layout', 'partials/layout');  
// This means every EJS view will automatically use views/partials/layout.ejs

// ---------- Routes ----------
app.get('/', (req, res) => {
  res.render('index');  // No layout() needed inside index.ejs
});

app.get('/login',        (req, res) => res.render('login'));
app.get('/participants', (req, res) => res.render('participants'));
app.get('/events',       (req, res) => res.render('events'));
app.get('/surveys',      (req, res) => res.render('surveys'));
app.get('/milestones',   (req, res) => res.render('milestones'));
app.get('/donations',    (req, res) => res.render('donations'));
app.get('/users',        (req, res) => res.render('users'));
app.get('/register',     (req, res) => res.render('register'));

// DB connection for local enviornment testing (delete this code when actually deploying to elastic beanstock)
const knex = require("knex")({
    client: "pg",
    connection: {
        host: process.env.RDS_HOSTNAME || "localhost",
        user: process.env.RDS_USERNAME || "postgres",
        password: process.env.RDS_PASSWORD || "rootuser123",
        database: process.env.RDS_DB_NAME || "ellarises",
        port: process.env.RDS_PORT || 5432,
        ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false,
    }
});

// DB connection for elastic beanstock env (uncomment this code when actually deploying)
// const knex = require("knex")({
//     client: "pg",
//     connection: {
//         host: process.env.RDS_HOSTNAME || "database-1.ccpw0keo684z.us-east-1.rds.amazonaws.com",
//         user: process.env.RDS_USERNAME || "postgres",
//         password: process.env.RDS_PASSWORD || "rootuser123",
//         database: process.env.RDS_DB_NAME || "postgres",
//         port: process.env.RDS_PORT || 5432,
//         ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false,
//     }
// });

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ella Rises running at http://localhost:${PORT}`);
});
