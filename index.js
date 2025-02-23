// app.js - Rewritten for Enhanced Session Management and Cookie Security

// Load environment variables from .env file (if present)
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const nodemailer = require('nodemailer');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');  // For encryption
const User = require('./models/user'); // Import your User model

const app = express();

// --------------------------------------------------------------------------
// 1. Environment Configuration (CRUCIAL)
// --------------------------------------------------------------------------

// Log environment variables EARLY to verify they are set correctly
console.log("Starting app.js"); // First line of defense

// Set the port based on environment variable, default to 3000 if not set
const PORT = process.env.PORT || 3000;
console.log("PORT:", PORT);

// Check NODE_ENV (important for cookie security)
const NODE_ENV = process.env.NODE_ENV;
console.log("NODE_ENV:", NODE_ENV);
const IS_PRODUCTION = NODE_ENV === 'production'; // Boolean for easy checks

// Set the base URL, used for redirects and email confirmations
const BASE_URL = process.env.BASE_URL;
console.log("BASE_URL:", BASE_URL);

// --------------------------------------------------------------------------
// 2. Database Configuration
// --------------------------------------------------------------------------

const mongoURI = process.env.MONGODB_URI; // Get MongoDB URI from env
console.log("MongoDB URI:", mongoURI);

mongoose.connect(mongoURI)
    .then(() => {
        console.log('MongoDB connected successfully');
        app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        console.error('Make sure MongoDB is running and the URI is correct!');
        process.exit(1); // Exit if the database connection fails (critical)
    });

// --------------------------------------------------------------------------
// 3. Middleware Configuration
// --------------------------------------------------------------------------

// Trust proxy (required if behind a reverse proxy like Nginx or Heroku)
// This is *essential* for proper cookie handling in production
app.set('trust proxy', 1); // Trust first proxy

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration (Important for cross-origin requests)
const corsOptions = {
    origin: IS_PRODUCTION ? process.env.FRONTEND_URL : '*', // Production: specific origin, Development: allow all
    credentials: true,             // Allow cookies to be sent
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Specify allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
    optionsSuccessStatus: 204       // Some legacy browsers choke on 204
};
console.log("CORS Options:", corsOptions);  // Log the CORS config
app.use(cors(corsOptions));

// --------------------------------------------------------------------------
// 4. Session Configuration (Critical for Cookie Management)
// --------------------------------------------------------------------------

const sessionSecret = process.env.SESSION_SECRET || 'your-default-secret';
console.log("Session Secret Source:", sessionSecret === 'your-default-secret' ? 'DEFAULT' : 'Environment Variable');

const sessionConfig = {
    secret: sessionSecret,                // Use a strong, randomly generated secret
    resave: false,                           // Don't save session if unmodified
    saveUninitialized: false,              // Don't create session until something stored
    store: MongoStore.create({               // Store session data in MongoDB
        mongoUrl: mongoURI,               // MongoDB connection URI
        collectionName: 'sessions',         // Collection name for sessions
        ttl: 14 * 24 * 60 * 60,           // Session TTL (14 days)
        autoRemove: 'native',            // Automatically remove expired sessions
    }),
    cookie: {
        secure: IS_PRODUCTION,               // Only send over HTTPS in production
        httpOnly: true,                  // Cookie cannot be accessed by client-side JavaScript
        sameSite: 'lax',                   // Control cross-site cookie behavior
        maxAge: 24 * 60 * 60 * 1000        // Session duration (1 day)
    }
};
console.log("Session Configuration:", sessionConfig); // Log session config

app.use(session(sessionConfig)); // Apply session middleware

// --------------------------------------------------------------------------
// 5. Passport Configuration (Authentication)
// --------------------------------------------------------------------------

app.use(passport.initialize());
app.use(passport.session());

// Google Authentication Strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${BASE_URL}/auth/google/callback`,
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;
                const username = profile.name.givenName;

                let user = await User.findOne({ email: email });

                if (!user) {
                    user = new User({
                        username: username,
                        email: email,
                        password: null,
                        registrationDate: new Date(),
                        isConfirmed: true
                    });
                    await user.save();
                }

                // Store the *user object* (or minimal data like ID) in the session
                return done(null, user); // Pass the full user object for session
            } catch (error) {
                console.error("Google login error:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    console.log("Serializing user:", user.email);
    done(null, user.email); // Store only the user ID or essential info
});

passport.deserializeUser(async (email, done) => {
    try {
        console.log("Deserializing user:", email);
        const user = await User.findOne({ email: email });
        if (!user) {
            console.error("Failed to deserialize user: User not found");
            return done(null, false); // Indicate user not found
        }
        return done(null, user); // Pass the full user object
    } catch (error) {
        console.error("Error during deserialization:", error);
        done(error, null);
    }
});

// --------------------------------------------------------------------------
// 6. Authentication Routes
// --------------------------------------------------------------------------

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
            console.log("Google callback triggered");
            console.log("req.user:", req.user); // Log the user object
            console.log("req.session:", req.session); // Log the session object
            console.log("req.sessionID:", req.sessionID); //Log the Session Id object

            //Check if the user is already logged in based on information stored in the session.
            if (req.user) {
                console.log("User authenticated, setting session...");
                req.session.email = req.user.email; // Access email from user object
                console.log("Session email is:" + req.session.email);

                await req.session.save(); // Save the session

                console.log("Session saved, redirecting to dashboard...");
                res.redirect("/dashboard");
            } else {
                console.error("Authentication failed: req.user is undefined or login denied.");
                res.redirect("/error");
            }
        } catch (error) {
            console.error("Error during Google auth callback:", error);
            res.redirect("/error");
        }
    }
);

// --------------------------------------------------------------------------
// 7. Other Routes (Registration, Login, Logout, etc.)
// --------------------------------------------------------------------------

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
            return res.status(400).json({ error: 'Email already exists' });
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
            { email }, // Store email instead of user object
            process.env.SESSION_SECRET, // Use session secret for token
            { expiresIn: '1d' }
        );

        const url = `${BASE_URL}/confirmation/${emailToken}`;

        // Send confirmation email
        transporter.sendMail({
            from: '"Mail-sender" <your-email@gmail.com>',
            to: email,
            subject: 'Email address confirmation',
            html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="cid:logo" style="max-width: 150px;">
                </div>
                <h2 style="text-align: center; color: #007bff;">Confirm your email address</h2>
                <p>Dear,</p>
                <p>Thank you for registering! To complete the registration process, please confirm your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${url}" style="background-color: #007bff; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">Confirm email</a>
                </div>
                <p>If you cannot click the button, copy and paste the following link into your browser:</p>
                <p style="word-break: break-word; text-align: center; color: #555;">${url}</p>
                <p>For further information, please contact us.</p>
                <p>Sincerely,</p>
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
        const { email } = jwt.verify(req.params.token, process.env.SESSION_SECRET);

        // Check if the user exists
        User.findOne({ email: email })
            .then(present => {
                if (present == null) {
                    return res.status(400).send('Invalid or expired token.');
                }
                present.isConfirmed = true;
                present.save();
                res.redirect(`${BASE_URL}/login`);
            })
            .catch(err => {
                console.error('Email confirmation error:', err);
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

                // Generate email token
                const emailToken = jwt.sign(
                    { email },
                    process.env.SESSION_SECRET,
                    { expiresIn: '1d' }
                );

                const url = `${BASE_URL}/confirmation/${emailToken}`;

                // Send confirmation email
                transporter.sendMail({
                    from: '"Mail-sender" <your-email@gmail.com>',
                    to: email,
                    subject: 'Email address confirmation',
                    html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="cid:logo" style="max-width: 150px;">
                </div>
                <h2 style="text-align: center; color: #007bff;">Confirm your email address</h2>
                <p>Dear,</p>
                <p>Thank you for registering! To complete the registration process, please confirm your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <a href="${url}" style="background-color: #007bff; color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">Confirm email</a>
                </div>
                <p>If you cannot click the button, copy and paste the following link into your browser:</p>
                <p style="word-break: break-word; text-align: center; color: #555;">${url}</p>
                <p>For further information, please contact us.</p>
                <p>Sincerely,</p>
                <p><strong>Stat&Mat</strong></p>
            </div>
            `,
                });

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
        const { userInput, password } = req.body;

        // Validation
        if (!userInput || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const user = await User.findOne({ email: userInput });

        if (!user) {
            return res.status(401).json({ error: 'Wrong email address' });
        }
        if (user.password !== password) {
            return res.status(401).json({ error: 'Wrong password' });
        }
        if (!user.isConfirmed) {
            return res.status(401).json({ error: 'Confirm your email to continue' });
        }
        req.session.email = user.email;
        await req.session.save();
        res.json({ message: 'Login successful', redirect: '/dashboard' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

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
    if (req.session.email) {
        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(401).json({ loggedIn: false });
        }
        return res.status(200).json({
            loggedIn: true,
            username: user.username
        });
    }
    res.status(401).json({ loggedIn: false });
});

app.post('/api/setCampaignData', async (req, res) => {
    try {
        if (!req.session.email) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        const { campaignName, businessName, industry, targetAudience, language, followUpCount } = req.body;

        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newCampaign = {
            campaignName,
            businessName,
            industry: industry,
            numberOfFollowUps: followUpCount,
            targetAudience,
            language,
            creationDate: new Date()
        };

        user.campaigns.push(newCampaign);
        await user.save();

        res.status(200).json({ message: 'Campaign data saved successfully' });
    } catch (error) {
        console.error('Error saving campaign data:', error);
        res.status(500).json({ error: 'An error occurred while saving the campaign data' });
    }
});

app.get('/api/getCampaignData', async (req, res) => {
    try {
        // Check if the user is logged in
        if (!req.session.email) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        // Find the user
        const user = await User.findOne({ email: req.session.email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the campaigns data
        res.status(200).json({
            campaigns: user.campaigns,
            totalCampaigns: user.campaigns.length
        });

    } catch (error) {
        console.error('Error fetching campaign data:', error);
        res.status(500).json({ error: 'An error occurred while fetching campaign data' });
    }
});

// Middleware to ensure user is logged in
module.exports = {
    ensureLoggedIn: function (req, res, next) {
        if (req.session && req.session.email) {
            return next();
        } else {
            res.redirect('/login');
        }
    }
};

// Routes
const routes = require('./routes'); // Import your routes
app.use('/', routes);

// --------------------------------------------------------------------------
// 8. Error Handling (Basic)
// --------------------------------------------------------------------------

// Add a generic error handler to catch any unhandled exceptions
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).send("Internal Server Error");
});
