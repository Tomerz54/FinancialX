const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  emailCredentials: {
    service: { type: String, default: 'gmail' },
    user: { type: String, required: true },
    pass: { type: String, required: true }
  },
  resetToken: { type: String },
  resetTokenExpires: { type: Date } // Add this field to track expiration
});


const User = mongoose.model('User', userSchema);

module.exports = User;