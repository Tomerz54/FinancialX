//librarys - packages:
const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const app = express();
const port = 3000;
const User = require('./models/User');
const crypto = require('crypto');


const bodyParser = require('body-parser')
;
const validator = require('validator');

const url = 'mongodb://localhost:27017/userdatabase'; // Ensure this matches your database name

// Connect to MongoDB using Mongoose
mongoose.connect(url)
    .then(() => console.log('Connected to MongoDB'))
    .catch(error => console.error('Error connecting to MongoDB:', error));


// Serve static files from the "public" directory
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Define routes
app.get('/', (req, res) => {
  res.render('index');
});



app.get('/login', (req, res) => {
  res.render('login-page');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
      const user = await User.findOne({ email });
      if (!user) {
          return res.render('login-page', { error: 'Account does not exist. Please sign up.' });
      }

      if (password !== user.password) {
          return res.render('login-page', { error: 'Incorrect password.' });
      }

      setTimeout(() => {
        res.redirect(`/main?name=${encodeURIComponent(user.name)}`);
      },3000)
      
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error logging in.');
  }
});

//expenses and income dashboard
app.get('/add-expenses', (req, res) => {
  res.render('add-expenses');
});

app.get('/add-income', (req, res) => {
  res.render('add-income');
});

//expenses and income functionality:
app.post('/add-expenses', (req, res) => {
  const name = req.query.name; // Extract user name from query parameters
  res.render('main', { name });
});

app.post('/add-income', (req, res) => {
  const name = req.query.name; // Extract user name from query parameters
  res.render('main', { name });
});

app.get('/main', (req, res) => {
  const name = req.query.name; // Extract user name from query parameters
  res.render('main', { name });
});

app.post('/main', async (req, res) => {
  const { email, password, name } = req.body;

  try {
      // Validate email
      if (!validator.isEmail(email)) {
          return res.render('index', { error: 'Invalid email address' });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return res.render('main', { error: 'Email already in use' });
      }

      // Create and save a new user
      const newUser = new User({ name, email, password });
      await newUser.save();
      console.log('User saved:', newUser._id);

      // Render the main page with a success message
      setTimeout(() => {
        res.redirect(`/main?name=${encodeURIComponent(name)}`);
      },4000)
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Error submitting user data.');
  }
});

app.get('/email-verify', async (req, res) => {
  res.render('email-verification-page');
});


//forgot password logic:

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

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
});

app.get('/update-email', (req, res) => {
  // Ensure the user is authenticated
  if (!req.user) return res.redirect('/login');
  
  res.render('update-email', { emailCredentials: req.user.emailCredentials });
});

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
});

module.exports = mongoose;

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});