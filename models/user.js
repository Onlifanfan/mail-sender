const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: false },
    registrationDate: { type: Date, required: false },
    isConfirmed: { type: Boolean, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    tokenExpiration: { type: Date, required: true },
    campaigns: [{
            campaignName: { type: String, required: true },
            businessName: { type: String, required: true },
            industry: { type: String, required: true },
            numberOfFollowUps: { type: String, required: true },
            language: { type: String, required: true },
            targetAudience: { type: String, required: true },
            creationDate: { type: String, required: true }
        }
    ]
});


const User = mongoose.model('User', userSchema);
module.exports = User;
