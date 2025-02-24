// app.js - Rewritten for Enhanced Session Management, Cookie Security, and Token Handling

require('dotenv').config(); // Load environment variables from .env file
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
const axios = require('axios');
const { google } = require('googleapis');  // Google APIs

const app = express();

// --------------------------------------------------------------------------
// 1. Environment Configuration (CRUCIAL)
// --------------------------------------------------------------------------

console.log("Starting app.js");
const PORT = process.env.PORT || 3000;
console.log("PORT:", PORT);
const NODE_ENV = process.env.NODE_ENV;
console.log("NODE_ENV:", NODE_ENV);
const IS_PRODUCTION = NODE_ENV === 'production';
const BASE_URL = process.env.BASE_URL;
console.log("BASE_URL:", BASE_URL);

// Ensure critical environment variables are set
if (!process.env.MONGODB_URI || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.SESSION_SECRET || !process.env.FRONTEND_URL) {
    console.error("Critical environment variables are missing.  Check your .env file.");
    process.exit(1);
}

// --------------------------------------------------------------------------
// 2. Database Configuration
// --------------------------------------------------------------------------

const mongoURI = process.env.MONGODB_URI;
console.log("MongoDB URI:", mongoURI);

mongoose.connect(mongoURI)
    .then(() => {
        console.log('MongoDB connected successfully');
        app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        console.error('Make sure MongoDB is running and the URI is correct!');
        process.exit(1);
    });

// --------------------------------------------------------------------------
// 3. Middleware Configuration
// --------------------------------------------------------------------------

app.set('trust proxy', 1);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
    origin: IS_PRODUCTION ? process.env.FRONTEND_URL : '*',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
};
console.log("CORS Options:", corsOptions);
app.use(cors(corsOptions));

// --------------------------------------------------------------------------
// 4. Session Configuration (Critical for Cookie Management)
// --------------------------------------------------------------------------

const sessionSecret = process.env.SESSION_SECRET;
console.log("Session Secret Source:", sessionSecret === 'your-default-secret' ? 'DEFAULT' : 'Environment Variable');

const sessionConfig = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: mongoURI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60,
        autoRemove: 'native',
    }),
    cookie: {
        secure: IS_PRODUCTION,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
};
console.log("Session Configuration:", sessionConfig);

app.use(session(sessionConfig));

// --------------------------------------------------------------------------
// 5. Passport Configuration (Authentication)
// --------------------------------------------------------------------------

app.use(passport.initialize());
app.use(passport.session());

// Google Authentication Strategy

// Function to refresh the access token
async function refreshAccessToken(refreshToken) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${BASE_URL}/auth/google/callback` // Replace with your redirect URI
    );
    oauth2Client.setCredentials({
        refresh_token: refreshToken
    });

    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        const newAccessToken = credentials.access_token;
        const newExpiryDate = new Date(Date.now() + (credentials.expiry_date - Date.now()));  // Calculate remaining lifespan of new token
        return { accessToken: newAccessToken, expiryDate: newExpiryDate };
    } catch (error) {
        console.error('Error refreshing access token:', error);
        throw error;
    }
}
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
                        isConfirmed: true,
                        accessToken: accessToken,
                        refreshToken: refreshToken,
                        tokenExpiration: new Date(Date.now() + 3600000), // 1 hour from now
                    });
                } else {
                    user.accessToken = accessToken;
                    user.refreshToken = refreshToken;
                    user.tokenExpiration = new Date(Date.now() + 3600000);
                }
                await user.save();
                req.session.email = email;
                await req.session.save();
                return done(null, user);
            } catch (error) {
                console.error("Google login error:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        if (!user) {
            console.error("Failed to deserialize user: User not found");
            return done(null, false);
        }
        return done(null, user);
    } catch (error) {
        console.error("Error during deserialization:", error);
        done(error, null);
    }
});

// --------------------------------------------------------------------------
// 6. Authentication Routes
// --------------------------------------------------------------------------

app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email", "https://www.googleapis.com/auth/gmail.readonly"],
        accessType: 'offline',
        prompt: 'consent'
    })
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

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const user = new User({
            username: username,
            email: email,
            password: password,
            registrationDate: new Date(),
            isConfirmed: false
        });

        await user.save();

        const emailToken = jwt.sign(
            { email },
            process.env.SESSION_SECRET,
            { expiresIn: '1d' }
        );

        const url = `${BASE_URL}/confirmation/${emailToken}`;
        // Transport is now outside the route handler to persist
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
        const { email } = jwt.verify(req.params.token, process.env.SESSION_SECRET);
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

        const email = emails[0];

        User.findOne({ email: email })
            .then(present => {
                if (present == null || present.isConfirmed) {
                    return res.status(400).json({ error: 'Email address not found or already confirmed.' });
                }

                const emailToken = jwt.sign(
                    { email },
                    process.env.SESSION_SECRET,
                    { expiresIn: '1d' }
                );

                const url = `${BASE_URL}/confirmation/${emailToken}`;
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

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
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
        if (!req.session.email) {
            return res.status(401).json({ error: 'User not logged in' });
        }

        const user = await User.findOne({ email: req.session.email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            campaigns: user.campaigns,
            totalCampaigns: user.campaigns.length
        });

    } catch (error) {
        console.error('Error fetching campaign data:', error);
        res.status(500).json({ error: 'An error occurred while fetching campaign data' });
    }
});

function getMessageBody(payload) {
    let body = '';

    if (payload.mimeType === 'text/plain' && payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.mimeType === 'text/html' && payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.mimeType.startsWith('multipart/')) {
        if (payload.parts) {
            for (let part of payload.parts) {
                body += getMessageBody(part);
            }
        }
    }

    return body;
}


// GET emails with pagination
app.get('/api/getEmails', async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 emails per page
    const startIndex = (page - 1) * limit;

    try {
        // 1. Check if the user is authenticated (using Passport.js)
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: 'Unauthorized: User has to connect Google email' });
        }

        // 2. Retrieve the user object (it should be attached by Passport)
        const user = req.user;

        // 3. Check if the access token needs to be refreshed
        if (user.tokenExpiration <= new Date()) {
            try {
                // Refresh the access token
                const { accessToken: newAccessToken, expiryDate: newExpiryDate } = await refreshAccessToken(user.refreshToken);

                // Update the user's access token and expiry date in the database
                user.accessToken = newAccessToken;
                user.tokenExpiration = newExpiryDate;
                await user.save();
                console.log('Access token refreshed successfully');
            } catch (refreshError) {
                console.error('Error refreshing token in /api/getEmails:', refreshError);
                return res.status(401).json({ error: 'Unauthorized: Could not refresh access token' });
            }
        }

        // 4. Retrieve the access token from the user model (after potential refresh)
        const accessToken = user.accessToken;

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token not found for user' });
        }

        // 5. Fetch email message IDs from the Gmail API with pagination
        try {
            const response = await axios.get('https://www.googleapis.com/gmail/v1/users/me/messages', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                params: {
                    maxResults: limit, // Use the limit from the query parameters
                    pageToken: req.query.pageToken // Add pageToken support for fetching next page
                }
            });

            const messages = response.data.messages;
            const nextPageToken = response.data.nextPageToken;

            if (!messages) {
                return res.json({ emails: [], nextPageToken: null }); // Return empty array if no messages
            }

            // 6. Fetch email details for each message ID (efficiently)
            const emails = await Promise.all(messages.map(async (message) => {
                try {
                    const messageDetails = await axios.get(`https://www.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        },
                        params: {
                            format: 'full'
                        }
                    });

                    const emailData = messageDetails.data;
                    const body = getMessageBody(emailData.payload);
                    const subject = emailData.payload.headers.find(header => header.name === 'Subject')?.value || '(No Subject)';
                    const from = emailData.payload.headers.find(header => header.name === 'From')?.value || 'Unknown Sender';
                    const snippet = emailData.snippet;
                    const date = emailData.payload.headers.find(header => header.name === 'Date')?.value || 'Unknown Date';

                    return {
                        id: message.id,
                        subject,
                        sender: from,
                        date,
                        snippet,
                        body: body
                    };
                } catch (error) {
                    console.error(`Error fetching email details for message ${message.id}: ${error.message}`);
                    return null; // Return null for failed email fetches
                }
            }));

            // Filter out null results in case of individual email fetch failures
            const validEmails = emails.filter(email => email);

            // 7. Return the emails and the nextPageToken
            return res.json({ emails: validEmails, nextPageToken: nextPageToken });
        } catch (error) {
            console.error('Gmail API error:', error);
            return res.status(500).json({ error: 'Failed to fetch emails from Gmail API' });
        }
    } catch (error) {
        console.error('Error in /api/getEmails route:', error);
        return res.status(500).json({ error: 'Internal server error' });
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
