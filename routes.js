const express = require('express');
const path = require('path');
const router = express.Router();

// Import the utils module (assuming it's in index.js in the same directory)
const utils = require('./index.js');

// Public routes (no authentication required)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

router.get('/load', (req, res) => {
    res.render('loading.ejs');
});

// Protected routes (authentication required)
router.get('/dashboard', utils.ensureLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// You can add more protected routes here
// router.get('/profile', utils.ensureLoggedIn, (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'profile.html'));
// });

module.exports = router;
