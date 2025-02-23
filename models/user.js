const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: false },
    registrationDate: { type: Date, required: false },
    isConfirmed: { type: Boolean, required: true }
});

const User = mongoose.model('User', userSchema);
module.exports = User;