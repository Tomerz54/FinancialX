//librarys - packages:
require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const app = express();
const port = 3001;
const User = require('./models/User');
const crypto = require('crypto');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser')
const validator = require('validator');
const methodOverride = require('method-override');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const dataCache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

 // Ensure this matches your database name
 // Set up MongoDB connection
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


//testing code


// Define routes
app.get('/', (req, res) => {
  res.render('index');
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

app.get('/login', (req, res) => {
  res.render('login-page');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Log values for debugging
  console.log('Request Body:', { email, password });
  console.log('Session:', req.session);

  try {
    // Validate email
    if (!email || !validator.isEmail(email)) {
      return res.render('login-page', { error: 'Invalid email address' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('login-page', { error: 'No user found with that email' });
    }

    // Check password
    if (password !== user.password) {
      return res.render('login-page', { error: 'Incorrect password' });
    }

    // Store the user's name in the session
    req.session.userName = user.name;

    // Redirect to the main page
    setTimeout(() => 
      {
      res.redirect(`/main?name=${encodeURIComponent(user.name)}`);
    } , 3000);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Login error. Please try again later.');
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
app.get('/api/crypto-data', async (req, res) => {
  const API_KEY = '95A17BB6-ACE2-4A84-9FF7-CD34924AF213'; // Market Data API key
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





//DONT TOUCH TILL YOU FINISH THE PROJECT
app.get('/email-verify', async (req, res) => {
  res.render('email-verification-page');
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});
/*
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('forgot-password', { error: 'No account with that email address exists.' });
    }
    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetToken = resetToken;
    await user.save();

    // Configure Nodemailer dynamically
    const transporter = nodemailer.createTransport({
      service: user.emailCredentials.service,
      auth: {
        user: user.emailCredentials.user,
        pass: user.emailCredentials.pass
      }
    });

    const mailOptions = {
      to: user.email,
      from: user.emailCredentials.user,
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
      Please click on the following link, or paste this into your browser to complete the process:\n\n
      http://${req.headers.host}/reset-password/${resetToken}\n\n
      If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    await transporter.sendMail(mailOptions);

    res.render('forgot-password', { message: 'An e-mail has been sent to ' + user.email + ' with further instructions.' });

  } catch (error) {
    console.error('Error:', error);
    res.render('forgot-password', { error: 'Error processing request.' });
  }
});
*/
app.get('/reset-password/:token', async (req, res) => {
  try {
      const user = await User.findOne({
          resetToken: req.params.token,
          resetTokenExpires: { $gt: Date.now() }
      });

      if (!user) {
          return res.render('reset-password', { error: 'Password reset token is invalid or has expired.', token: req.params.token });
      }

      res.render('reset-password', { token: req.params.token });
  } catch (error) {
      console.error('Error rendering reset password form:', error);
      res.render('reset-password', { error: 'An error occurred. Please try again later.', token: req.params.token });
  }
});
/*
app.post('/reset-password/:token', async (req, res) => {
  const { password } = req.body;
  try {
      const user = await User.findOne({
          resetToken: req.params.token,
          resetTokenExpires: { $gt: Date.now() }
      });

      if (!user) {
          return res.render('reset-password', { error: 'Password reset token is invalid or has expired.', token: req.params.token });
      }

      user.password = password;
      user.resetToken = undefined;
      user.resetTokenExpires = undefined;
      await user.save();

      res.redirect('/login'); // Redirect to login page or a success page
  } catch (error) {
      console.error('Error resetting password:', error);
      res.render('reset-password', { error: 'An error occurred. Please try again later.', token: req.params.token });
  }
});*/
//SMTP
app.get('/update-email', (req, res) => {
  // Ensure the user is authenticated
  if (!req.user) return res.redirect('/login');
  
  res.render('update-email', { emailCredentials: req.user.emailCredentials });
});
/*
app.post('/update-email', async (req, res) => {
  // Ensure the user is authenticated
  if (!req.user) return res.redirect('/login');
  
  const { service, user, pass } = req.body;
  try {
      const currentUser = await User.findById(req.user._id);
      currentUser.emailCredentials.service = service;
      currentUser.emailCredentials.user = user;
      currentUser.emailCredentials.pass = pass;
      await currentUser.save();

      res.redirect('/dashboard'); // Redirect to a dashboard or another page
  } catch (error) {
      console.error('Error updating email credentials:', error);
      res.status(500).send('Error updating email credentials.');
  }
});*/

module.exports = mongoose;


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});