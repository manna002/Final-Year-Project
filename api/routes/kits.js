const express = require('express');
const Kit = require('../models/Kit');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify admin token
const adminMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_funaab_key_2026');
    if (decoded.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Middleware to verify standard user token
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

// GET logged-in user's kits
router.get('/my-kits', authMiddleware, async (req, res) => {
  try {
    const kits = await Kit.find({ owner_id: req.user.id }).sort({ createdAt: -1 });
    res.json(kits);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET all kits (Admin only)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const kits = await Kit.find().populate('owner_id', 'email displayName').sort({ createdAt: -1 });
    res.json(kits);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST register a new kit
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { kit_id, name } = req.body;
    
    let kit = await Kit.findOne({ kit_id });
    if (kit) {
      return res.status(400).json({ error: 'Kit ID already exists' });
    }

    kit = new Kit({
      kit_id,
      name: name || 'FUNAAB IMS'
    });

    await kit.save();
    res.json(kit);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT update kit owner
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { owner_id } = req.body;
    const kit = await Kit.findByIdAndUpdate(
      req.params.id,
      { owner_id: owner_id || null },
      { new: true }
    ).populate('owner_id', 'email displayName');
    
    if (!kit) return res.status(404).json({ error: 'Kit not found' });
    res.json(kit);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE a kit
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await Kit.findByIdAndDelete(req.params.id);
    res.json({ message: 'Kit removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
