const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// User Signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, displayName, accountType, adminCode } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }

    // Verify admin code if they want to be an admin
    let finalRole = 'client';
    if (accountType === 'admin') {
      const validCodes = ['FUNAAB-2026', 'ADM-001'];
      if (!validCodes.includes(adminCode)) {
        return res.status(400).json({ error: 'Invalid Admin Access Code' });
      }
      finalRole = 'admin';
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword,
      displayName,
      role: finalRole,
      adminCode: finalRole === 'admin' ? adminCode : ''
    });

    await newUser.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during signup', details: error.message, stack: error.stack });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Create JWT
    const payload = {
      user: {
        id: user._id,
        role: user.role,
        displayName: user.displayName,
        email: user.email
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'super_secret_funaab_key_2026',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: payload.user });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login', details: error.message });
  }
});

// Middleware to verify token
const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_funaab_key_2026');
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
