const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const incomeSchema = new Schema({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
});

const expenseSchema = new Schema({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
});

const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  role: { type: String, default: 'user' },
  emailCredentials: {
    service: { type: String, default: 'gmail' },
    user: { type: String, required: false },
    pass: { type: String, required: false }
  },
  income: [incomeSchema],
  expenses: [expenseSchema],
  resetToken: { type: String },
  resetTokenExpires: { type: Date } // Add this field to track expiration

});


const User = mongoose.model('User', userSchema);

module.exports = User;