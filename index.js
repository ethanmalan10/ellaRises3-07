// index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const layouts = require('express-ejs-layouts');

const app = express();

// ---------- Core middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (CSS, client JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(layouts);
app.set('layout', 'partials/layout'); // views/partials/layout.ejs

// ---------- Routes ----------
app.get('/', (req, res) => res.render('index'));

// Simple test pages you already created (optional)
app.get('/login',        (req,res)=>res.render('login'));
app.get('/participants', (req,res)=>res.render('participants'));
app.get('/events',       (req,res)=>res.render('events'));
app.get('/surveys',      (req,res)=>res.render('surveys'));
app.get('/milestones',   (req,res)=>res.render('milestones'));
app.get('/donations',    (req,res)=>res.render('donations'));
app.get('/users',        (req,res)=>res.render('users'));

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ella Rises running at http://localhost:${PORT}`);
});
