import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Get all users (Admin only)
router.get('/', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_funaab_key_2026');
    
    // Basic check if user is admin
    if (decoded.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    User.find({ role: 'client' }).select('-password')
      .then(users => res.json(users))
      .catch(err => res.status(500).json({ error: 'Failed to fetch users' }));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
