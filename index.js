const dotenv = require('dotenv');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();
dotenv.config();

const crypto = require('crypto');

const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require('passport');

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const User = require('./models/user');

const axios = require('axios');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

// Routes
const routes = require('./routes');
app.use('/', routes);

// Middleware to serve static files from the public folder
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;

const mongoURI = `${process.env.MONGODB_URI}`;
mongoose.connect(mongoURI)
    .then(() => app.listen(PORT, () => console.log('Server started')))
    .catch((err) => console.log(err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allow requests from your frontend domain
app.use(cors({
    origin: '*',  // Allow all origins
    credentials: true // Allow cookies and credentials
}));

// Session setup 
app.use(session({
    secret: process.env.EMAIL_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoURI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60, // 14 days
        autoRemove: 'native',
    }),
    cookie: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Encryption setup 
const ENCRYPTION_KEY = process.env.SECRET;
const IV_LENGTH = 16;

// Function to encrypt data
const encrypt = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Function to decrypt data
const decrypt = (text) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value; // Extract user's email
                const username = profile.name.givenName;

                let user = await User.findOne({ email: email });

                if (!user) {
                    // Create a new user if not found
                    user = new User({
                        username: username,
                        email: email,
                        password: null,
                        registrationDate: new Date(),
                        isConfirmed: true
                    });
                    await user.save();
                }
                return done(null, user.username); // Pass user email for session
            } catch (error) {
                console.error("Google login error:", error);
                return done(error, null);
            }
        }
    )
);


passport.serializeUser((userId, done) => {
    done(null, userId); // Store only the user ID in the session
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findOne({ username : id });
        if (!user) {
            console.error("Failed to deserialize user: User not found");
            return done(null, false);
        }
        return done(null, user); // Pass the full user object
    } catch (error) {
        console.error("Error during deserialization:", error);
        done(error, null);
    }
});

// Google Authentication Initiation
app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
        try {
            if (req.user) {
                req.session.username = req.user; // Save the username to the session
                await req.session.save(); // Ensure the session is saved
                res.redirect("/"); // Redirect to the homepage
            } else {
                console.error("Authentication failed: req.user is undefined or login denied.");
                res.redirect("/error"); // Redirect to an error page
            }
        } catch (error) {
            console.error("Error during Google auth callback:", error);
            res.redirect("/error"); // Redirect to an error page
        }
    }
);

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if email is already in use
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ error: 'Email vec postoji' });
        }

        // Store username and device information
        const user = new User({
            username: username,
            email: email,
            password: password,
            registrationDate: new Date(),
            isConfirmed: false
        });

        await user.save(); // Save the user to the database

        // Generate email token
        const emailToken = jwt.sign(
            { username }, // Store username instead of user object
            process.env.SECRET,
            { expiresIn: '1d' }
        );

        const url = `${process.env.BASE_URL}/confirmation/${emailToken}`;

        // Send confirmation email
        transporter.sendMail({
            from: '"Mail-sender" <your-email@gmail.com>',
            to: email,
            subject: 'Potvrda e-mail adrese',
            html: `
<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:logo" style="max-width: 150px;">
    </div>
    <h2 style="text-align: center; color: #007bff;">Potvrdite svoju e-mail adresu</h2>
    <p>Poštovani,</p>
    <p>Hvala što ste se registrirali! Kako bismo dovršili postupak registracije, molimo Vas da potvrdite svoju e-mail adresu klikom na donji gumb:</p>
    <div style="text-align: center; margin: 20px 0;">
        <a href="${url}" style="background-color: #007bff; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">Potvrdi e-mail</a>
    </div>
    <p>Ako ne možete kliknuti na gumb, kopirajte i zalijepite sljedeći link u svoj preglednik:</p>
    <p style="word-break: break-word; text-align: center; color: #555;">${url}</p>
    <p>Za dodatne informacije slobodno nas kontaktirajte.</p>
    <p>S poštovanjem,</p>
    <p><strong>Stat&Mat</strong></p>
</div>
`,
        });

        // Send JSON response
        res.json({
            message: 'Registration successful',
            redirect: '/load'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


app.get('/confirmation/:token', async (req, res) => {
    try {
        // Verify token
        const { username } = jwt.verify(req.params.token, process.env.SECRET);

        // Check if the user exists
        User.findOne({ name: username })
            .then(present => {
                if (present == null) {
                    return res.status(400).send('Invalid or expired token.');
                }
                present.isConfirmed = true;
                present.save();
                res.redirect(`${process.env.BASE_URL}/login`);
            })
            .catch(err => {
                console.error('Email confirmation error:', error);
                res.status(400).send('Invalid or expired token.');
            });

    } catch (error) {
        console.error('Could not verify token', error);
        res.status(400).send('Could not verify token');
    }
});

app.post('/resend-email', async (req, res) => {
    try {
        const { emails } = req.body;

        if (!emails || emails.length === 0) {
            return res.status(400).json({ error: 'Please provide an email address.' });
        }

        const email = emails[0];  // Since we allow only one email

        User.findOne({ email: email })
            .then(present => {
                if (present == null || present.isConfirmed) {
                    return res.status(400).json({ error: 'Email address not found or already confirmed.' });
                }

                username = present.name;
                // Generate email token
                const emailToken = jwt.sign(
                    { username },
                    process.env.SECRET,
                    { expiresIn: '1d' }
                );

                const url = `${process.env.BASE_URL}/confirmation/${emailToken}`;

                // Send confirmation email
                transporter.sendMail({
                    from: '"Mail-sender" <your-email@gmail.com>',
                    to: email,
                    subject: 'Potvrda e-mail adrese',
                    html: `
<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:logo" style="max-width: 150px;">
    </div>
    <h2 style="text-align: center; color: #007bff;">Potvrdite svoju e-mail adresu</h2>
    <p>Poštovani,</p>
    <p>Hvala što ste se registrirali! Kako bismo dovršili postupak registracije, molimo Vas da potvrdite svoju e-mail adresu klikom na donji gumb:</p>
    <div style="text-align: center; margin: 20px 0;">
        <a href="${url}" style="background-color: #007bff; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">Potvrdi e-mail</a>
    </div>
    <p>Ako ne možete kliknuti na gumb, kopirajte i zalijepite sljedeći link u svoj preglednik:</p>
    <p style="word-break: break-word; text-align: center; color: #555;">${url}</p>
    <p>Za dodatne informacije slobodno nas kontaktirajte.</p>
    <p>S poštovanjem,</p>
    <p><strong>Stat&Mat</strong></p>
</div>
`,              });

                res.json({
                    message: 'Confirmation email has been resent.',
                    url: url
                });
            })

    } catch (error) {
        console.error('Error resending email:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


app.post('/api/login', async (req, res) => {
    try {
        const { userInput, password, deviceId } = req.body;

        // Validation
        if (!userInput || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const user = await User.findOne({email: userInput });

        if (!user) {
            return res.status(401).json({ error: 'Wrong email address' });
        }
        if (user.password !== password) {
            return res.status(401).json({ error: 'Wrong password' });
        }
        if (!user.isConfirmed) {
            return res.status(401).json({ error: 'Confirm your email to continue' });
        }
        req.session.username = user.username;
        res.json({ message: 'Login successful', redirect: '/dashboard' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

            
// Middleware to ensure user is logged in
function ensureLoggedIn(req, res, next) {
    if (req.session && req.session.username) {
        return next(); // User is logged in, proceed to the next middleware/route handler
    } else {
        res.redirect('/login'); // Redirect to login page if not authenticated
    }
}


// Logout route to destroy the session
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }

        // Also remove session from the MongoDB store
        req.sessionStore.destroy(req.sessionID, (storeErr) => {
            if (storeErr) {
                return res.status(500).json({ error: 'Could not log out and delete session from database' });
            }

            res.json({ message: 'Logout successful' });
        });
    });
});

app.get('/api/check-login', async (req, res) => {
    if (req.session.username) {
        return res.status(200).json({
            loggedIn: true,
            username: req.session.username
        });
    }
    res.status(401).json({ loggedIn: false });
});
