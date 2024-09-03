//librarys - packages:
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import ejs from 'ejs';
import User from './models/User.js';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import bodyParser from 'body-parser';
import validator from 'validator';
import methodOverride from 'method-override';
import fetch from 'node-fetch';
import NodeCache from 'node-cache'; // Cache for 5 minutes
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
dotenv.config();

const app = express();
const port = 3001;
const dataCache = new NodeCache({ stdTTL: 300 });

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Function to send email
async function sendEmail(to, subject, text, html) {
  try {
    let info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: to,
      subject: subject,
      text: text,
      html: html || text, // Use HTML if provided, otherwise use text
    });
    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

const mongodbUrl = 'mongodb://localhost:27017/userdatabase';

// Connect to MongoDB using Mongoose
mongoose.connect(mongodbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const sessionStore = MongoStore.create({
  mongoUrl: mongodbUrl, // Correct option for the MongoDB URL
  collectionName: 'sessions', // Session collection name
});

app.use(session({
  secret: process.env.SESSION_SECRET, // Your session secret
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
}));

// Serve static files from the "public" directory
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

//normal script for methods
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}



// Define routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/about', (req, res) => {
  res.render('About');
});

app.post('/register', async (req, res) => {
  const { email, password, name, emailUser, emailPass } = req.body;

  console.log('Received POST request to /register with data:', { email, password, name, emailUser, emailPass });

  try {
    const newUser = new User({
      name,
      email,
      password,
    });

    // Only add email credentials if both emailUser and emailPass are provided
    if (emailUser && emailPass) {
      newUser.emailCredentials = {
        user: emailUser,
        pass: emailPass
      };
    }

    await newUser.save();

    // Send welcome email
    await sendWelcomeEmail(email, name, req);

    // Store user information in session
    req.session.userName = newUser.name;
    req.session.userEmail = newUser.email;

    res.redirect('/verify-email');
  } catch (error) {
    console.error('Error processing registration:', error);
    res.status(500).render('index', { error: 'Error processing registration. Please try again.' });
  }
});


async function sendWelcomeEmail(email, name, req) {
  const mainPageLink = `http://${req.headers.host}/main`;
  await sendEmail(
    email,
    'Welcome to Our App',
    `Welcome to FinancialX, ${name}!\n\nVisit your dashboard: ${mainPageLink}`,
    `
      <h1>Welcome to FinancialX!</h1>
      <p>Hello ${name},</p>
      <p>We're excited to have you on board. Click the link below to visit your dashboard:</p>
      <p><a href="${mainPageLink}">Go to My Dashboard</a></p>
    `
  );
}
//resend verification email
app.get('/resend-verification', async (req, res) => {
  if (!req.session.userEmail || !req.session.userName) {
    return res.redirect('/login');
  }

  try {
    await sendWelcomeEmail(req.session.userEmail, req.session.userName, req);
    res.render('verify-email', {
      email: req.session.userEmail,
      name: req.session.userName,
      message: 'Verification email resent. Please check your inbox.'
    });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).send('Error resending verification email. Please try again.');
  }
});




app.get('/verify-email', (req, res) => {
  // Check if user is in session
  if (!req.session.userEmail || !req.session.userName) {
    return res.redirect('/login');
  }

  res.render('verify-email', {
    email: req.session.userEmail,
    name: req.session.userName
  });
});




app.get('/settings', async (req,res ) => {
  const name = req.session.userName;
  const email = req.session.email;
  const accountBalance = req.session.accountBalance || 0;
  const totalExpenses = req.session.totalExpenses || 0;
  const totalIncome = req.session.totalIncome || 0;
  if (!name) {
    return res.redirect('/login');
  }
  if(accountBalance === null){
    accountBalance = 0;
  }
  if(totalExpenses === null){
    totalExpenses = 0;
  }
  if(totalIncome === null){
    totalIncome = 0;
  }

  try {
    // Assuming `name` is unique for users
    const user = await User.findOne({ name });

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Pass user details to the template
    res.render('settings', {
      name: user.name,
      email: user.email,
      accountBalance: user.accountBalance,
      totalExpenses: user.totalExpenses,
      totalIncome: user.totalIncome,
      
    });
  } catch (error) {
    console.error('Error loading user data:', error);
    res.status(500).send('Error loading user data');
  }
})




//admin logic with databases

app.get('/admin/admin-login', (req,res)=> {
  res.render('admin/admin-login')
})




app.post('/admin/admin-login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, role: 'admin' });

    if (!user) {
      return res.render('admin/admin-login', { error: 'No admin found with that email' });
    }

    if (user.password !== password) {
      return res.render('admin/admin-login', { error: 'Incorrect password' });
    }

    // Store admin session
    req.session.userName = user.name;
    req.session.role = 'admin';

    // Redirect to the admin users page
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).send('Admin login error. Please try again later.');
  }
});

app.get('/admin/users', async (req, res) => {
  if (req.session.role !== 'admin') {
    return res.redirect('/admin/admin-login');
  }

  // Fetch all users to display on the admin users page
  try {
    const users = await User.find({});
    res.render('admin/users', { users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error fetching users.');
  }
});

app.get('/admin/update-user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Calculate totals
    const totalIncome = user.income.reduce((total, item) => total + item.amount, 0);
    const totalExpenses = user.expenses.reduce((total, item) => total + item.amount, 0);

    res.render('admin/update-user', {
      user,
      totalIncome,
      totalExpenses
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send('Server error');
  }
});



//DELETE and PUT methods:
app.delete('/admin/delete-user/:id', async (req, res) => {
  try {
      await User.findByIdAndDelete(req.params.id);
      res.status(200).send(); // Respond with success status
  } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).send('Server error');
  }
});

app.put('/admin/update-user/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const { name, email, role, password, income, expenses } = req.body;

      // Find user by ID and update details
      const user = await User.findById(id);
      if (!user) {
          return res.status(404).send('User not found');
      }

      // Update user fields
      user.name = name;
      user.email = email;
      user.role = role;
      if (password) user.password = password; // Assuming you hash the password elsewhere
      // Assuming income and expenses are arrays or objects to be updated as needed
      // Update logic depends on your schema design

      await user.save();
      res.redirect('/admin/users'); // Redirect to the users page after update
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
});


//-----------------------------------------------------

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error logging out. Please try again later.');
    }

    // Redirect to the login page after successful logout
    res.redirect('/login');
  });
});


//expenses and income dashboard
app.get('/add-expenses', (req, res) => {
  const userName = req.session.userName; // Get the user's name from the session
  if (!userName) {
    return res.redirect('/'); // Redirect if the user is not logged in
  }
  res.render('add-expenses', { name: userName });
});

app.get('/add-income', (req, res) => {
  const userName = req.session.userName; // Get the user's name from the session
  if (!userName) {
    return res.redirect('/'); // Redirect if the user is not logged in
  }
  res.render('add-income', { name: userName });
});

//expenses and income functionality:
app.post('/add-expense', async (req, res) => {
  const { date, description, amount, name } = req.body;

  try {
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.expenses.push({ date, description, amount });
    await user.save();

    res.redirect('/main');
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).send('Error adding expense');
  }
});

app.post('/add-income', async (req, res) => {
  const { date, description, amount, name } = req.body;

  try {
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.income.push({ date, description, amount });
    await user.save();

    res.redirect('/main');
  } catch (error) {
    console.error('Error adding income:', error);
    res.status(500).send('Error adding income');
  }
});

//main page
app.get('/main', async (req, res) => {
  
  const name = req.session.userName;
  const verified = req.query.verified;
  if (!name) {
    return res.redirect('/login');
  }

  try {
    // Assuming `name` is unique for users
    const user = await User.findOne({ name });

    if (!user) {
      return res.status(404).send('User not found');
    }

    const totalIncome = user.income.reduce((sum, income) => sum + income.amount, 0);
    const totalExpenses = user.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const accountBalance = totalIncome - totalExpenses;


    // Pass user details to the template
    res.render('main', {
      name: user.name, // Pass the user name to the template
      verified: verified,
      incomes: user.income,
      expenses: user.expenses,
      accountBalance, 
      totalInvestments: 5000,
      totalIncome,  // Pass total income
      totalExpenses,  // Pass total expenses  // Pass calculated account balance // Pass calculated account balance
 // This could be calculated or set as a fixed value
    });
  } catch (error) {
    console.error('Error loading user data:', error);
    res.status(500).send('Error loading user data');
  }
});


app.post('/main', async (req, res) => {
  const { email, password, name, emailUser, emailPass } = req.body;

  console.log('Received POST request to /main with data:', { email, password, name, emailUser, emailPass });

  try {
    if (!email || !validator.isEmail(email)) {
      console.log('Invalid email:', email);
      return res.render('index', { error: 'Invalid email address' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.render('index', { error: 'Email already in use' });
    }

    const newUser = new User({
      name,
      email,
      password, // Storing plaintext password (for testing)
      emailCredentials: {
        user: emailUser,
        pass: emailPass
      }
    });
    await newUser.save();
    console.log('New user saved:', newUser);

    req.session.userName = newUser.name;

    res.redirect(`/main?name=${encodeURIComponent(newUser.name)}`);
  } catch (error) {
    console.error('Error processing registration:', error);
    res.status(500).send('Error processing registration.');
  }
});

//cryptocurrency page


/* REMOVE THIS WHEN YOU FINISH THE PROJECT
app.get('/api/crypto-data', async (req, res) => {
  const API_KEY = process.env.API_KEY; // Market Data API key
  const cryptos = ['BTC', 'ETH', 'LTC', 'XRP', 'ADA']; // List of cryptocurrencies to fetch

  try {
    console.log('Fetching crypto data...');
    
    const response = await fetch(`https://rest.coinapi.io/v1/exchangerate/USD?filter_asset_id=${cryptos.join(',')}`, {
      headers: { 'X-CoinAPI-Key': API_KEY }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const formattedData = {
      rates: data.rates.map(rate => ({
        asset_id_base: rate.asset_id_base,
        rate: rate.rate // Use the rate as is, don't invert it
      }))
    };

    console.log('Received data:', formattedData);
    res.json(formattedData);
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message });
  }
});
*/



//DONT TOUCH TILL YOU FINISH THE PROJECT


//SMTP
app.get('/update-email', (req, res) => {
  // Ensure the user is authenticated
  if (!req.user) return res.redirect('/login');
  
  res.render('update-email', { emailCredentials: req.user.emailCredentials });
});



app.put('/admin/update-user/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const { name, email, role, password, income, expenses } = req.body;

      // Find user by ID and update details
      const user = await User.findById(id);
      if (!user) {
          return res.status(404).send('User not found');
      }

      // Update user fields
      user.name = name;
      user.email = email;
      user.role = role;
      if (password) user.password = password; // Assuming you hash the password elsewhere
      // Assuming income and expenses are arrays or objects to be updated as needed
      // Update logic depends on your schema design

      await user.save();
      res.redirect('/admin/users'); // Redirect to the users page after update
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
});


//-----------------------------------------------------

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error logging out. Please try again later.');
    }

    // Redirect to the login page after successful logout
    res.redirect('/login');
  });
});



app.get('/login', (req, res) => {
  const message = req.session.flashMessage || null;
  req.session.flashMessage = null; // Clear the message after use
  res.render('login-page', { error: null, message: message });
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Log values for debugging
  console.log('--- Login Attempt ---');
  console.log('Email:', email);
  console.log('Password received:', password ? '[REDACTED]' : 'No password provided');
  console.log('Session:', req.session);

  try {
    // Validate email
    if (!email || !validator.isEmail(email)) {
      console.log('Invalid email address:', email);
      return res.render('login-page', { error: 'Invalid email address', message: null });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('No user found for email:', email);
      return res.render('login-page', { error: 'No user found with that email', message: null });
    }

    console.log('User found:', user.email);

    // Check password
    if (password !== user.password) {
      console.log('Incorrect password for user:', email);
      return res.render('login-page', { error: 'Incorrect password', message: null });
    }

    // Store the user's name in the session
    req.session.userName = user.name;

    console.log('Login successful for user:', user.email);

    // Redirect to the main page
    setTimeout(() => {
      res.redirect(`/main?name=${encodeURIComponent(user.name)}`);
    }, 3000);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login-page', { error: 'Login error. Please try again later.', message: null });
  } finally {
    console.log('--- End of Login Attempt ---');
  }
});

//expenses and income dashboard
app.get('/add-expenses', (req, res) => {
  const userName = req.session.userName; // Get the user's name from the session
  if (!userName) {
    return res.redirect('/'); // Redirect if the user is not logged in
  }
  res.render('add-expenses', { name: userName });
});

app.get('/add-income', (req, res) => {
  const userName = req.session.userName; // Get the user's name from the session
  if (!userName) {
    return res.redirect('/'); // Redirect if the user is not logged in
  }
  res.render('add-income', { name: userName });
});

//expenses and income functionality:
app.post('/add-expense', async (req, res) => {
  const { date, description, amount, name } = req.body;

  try {
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.expenses.push({ date, description, amount });
    await user.save();

    res.redirect('/main');
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).send('Error adding expense');
  }
});

app.post('/add-income', async (req, res) => {
  const { date, description, amount, name } = req.body;

  try {
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(404).send('User not found');
    }

    user.income.push({ date, description, amount });
    await user.save();

    res.redirect('/main');
  } catch (error) {
    console.error('Error adding income:', error);
    res.status(500).send('Error adding income');
  }
});

//main page
app.get('/main', async (req, res) => {
  
  const name = req.session.userName;
  const verified = req.query.verified;
  if (!name) {
    return res.redirect('/login');
  }

  try {
    // Assuming `name` is unique for users
    const user = await User.findOne({ name });

    if (!user) {
      return res.status(404).send('User not found');
    }

    const totalIncome = user.income.reduce((sum, income) => sum + income.amount, 0);
    const totalExpenses = user.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const accountBalance = totalIncome - totalExpenses;


    // Pass user details to the template
    res.render('main', {
      name: user.name, // Pass the user name to the template
      verified: verified,
      incomes: user.income,
      expenses: user.expenses,
      accountBalance, 
      totalInvestments: 5000,
      totalIncome,  // Pass total income
      totalExpenses,  // Pass total expenses  // Pass calculated account balance // Pass calculated account balance
 // This could be calculated or set as a fixed value
    });
  } catch (error) {
    console.error('Error loading user data:', error);
    res.status(500).send('Error loading user data');
  }
});


app.post('/main', async (req, res) => {
  const { email, password, name, emailUser, emailPass } = req.body;

  console.log('Received POST request to /main with data:', { email, password, name, emailUser, emailPass });

  try {
    if (!email || !validator.isEmail(email)) {
      console.log('Invalid email:', email);
      return res.render('index', { error: 'Invalid email address' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.render('index', { error: 'Email already in use' });
    }

    const newUser = new User({
      name,
      email,
      password, // Storing plaintext password (for testing)
      emailCredentials: {
        user: emailUser,
        pass: emailPass
      }
    });
    await newUser.save();
    console.log('New user saved:', newUser);

    req.session.userName = newUser.name;

    res.redirect(`/main?name=${encodeURIComponent(newUser.name)}`);
  } catch (error) {
    console.error('Error processing registration:', error);
    res.status(500).send('Error processing registration.');
  }
});

//cryptocurrency page
/*REMOVE THIS WHEN YOU FINISH THE PROJECT
app.get('/api/crypto-data', async (req, res) => {
  const API_KEY = process.env.API_KEY; // Market Data API key
  const cryptos = ['BTC', 'ETH', 'LTC', 'XRP', 'ADA']; // List of cryptocurrencies to fetch

  try {
    console.log('Fetching crypto data...');
    
    const response = await fetch(`https://rest.coinapi.io/v1/exchangerate/USD?filter_asset_id=${cryptos.join(',')}`, {
      headers: { 'X-CoinAPI-Key': API_KEY }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const formattedData = {
      rates: data.rates.map(rate => ({
        asset_id_base: rate.asset_id_base,
        rate: rate.rate // Use the rate as is, don't invert it
      }))
    };

    console.log('Received data:', formattedData);
    res.json(formattedData);
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({ error: error.message });
  }
});
*/

//DONT TOUCH TILL YOU FINISH THE PROJECT

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null, message: null });
});


// Route to handle the forgot password request
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
      const user = await User.findOne({ email });
      if (!user) {
          return res.render('forgot-password', { error: 'No account with that email address exists.', message: null });
      }

      // Generate a password reset token
      const token = crypto.randomBytes(20).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

      await user.save();

      // Send password reset email
      const resetUrl = `http://${req.headers.host}/reset-password/${token}`;
      await sendEmail(
          email,
          'Password Reset Instructions',
          `You have requested to reset your password. Please follow these instructions:

          1. Click on this link: ${resetUrl}
          2. Enter your new password
          3. Confirm your new password
          4. Submit the form to reset your password

          If you did not request this, please ignore this email and your password will remain unchanged.

          This link will expire in 1 hour.`
      );

      res.render('forgot-password', { error: null, message: 'An email has been sent to ' + email + ' with instructions to reset your password.' });
  } catch (error) {
      console.error('Error in forgot password:', error);
      res.render('forgot-password', { error: 'Error processing password reset request.', message: null });
  }
});

// Route to reset password
app.get('/reset-password/:token', async (req, res) => {
  try {
      const user = await User.findOne({
          resetPasswordToken: req.params.token,
          resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
          return res.render('reset-password', { error: 'Password reset token is invalid or has expired.', token: null });
      }

      res.render('reset-password', { error: null, token: req.params.token });
  } catch (error) {
      console.error('Error in reset password get:', error);
      res.render('reset-password', { error: 'An error occurred. Please try again later.', token: null });
  }
});

app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.render('reset-password', { error: 'Password reset token is invalid or has expired.', token: null });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('New hashed password:', hashedPassword);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    console.log('Password reset successful for user:', user.email);
    console.log('New stored password:', user.password);

    // Redirect to login page with a success message
    req.session.flashMessage = 'Your password has been changed successfully. You can now log in with your new password.';
    res.redirect('/login');

  } catch (error) {
    console.error('Error resetting password:', error);
    res.render('reset-password', { error: 'Error resetting password.', token: token });
  }
});

export default mongoose;


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});