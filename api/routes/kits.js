import express from 'express';
import Kit from '../models/Kit.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Normalize kit IDs so they always match the ESP32 firmware topics.
// - trims spaces and uppercases
// - in the last segment, letter "O" is converted to digit "0" if the result is all digits
//   e.g. "funaab-kit-OO1" -> "FUNAAB-KIT-001"
function normalizeKitId(raw) {
  const id = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  const parts = id.split('-');
  const last = parts.pop() || '';
  const fixed = last.replace(/O/g, '0');
  parts.push(/^\d+$/.test(fixed) ? fixed : last);
  return parts.join('-');
}

// Middleware to verify token
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_funaab_key_2026');
    req.user = decoded.user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/kits - Fetch all kits (Admin)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const kits = await Kit.find().sort({ created_at: -1 });
    const formattedKits = kits.map(k => ({
      ...k._doc,
      kit_id: k.kitId
    }));
    res.json(formattedKits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch kits' });
  }
});

// POST /api/kits - Create a new kit (Admin)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const { name } = req.body;
    const kit_id = normalizeKitId(req.body.kit_id);
    if (!/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(kit_id)) {
      return res.status(400).json({ error: 'Kit ID may only contain letters, digits and hyphens (e.g. FUNAAB-KIT-001)' });
    }

    let kit = await Kit.findOne({ kitId: kit_id });
    if (kit) return res.status(400).json({ error: 'Kit already exists' });
    
    kit = new Kit({ 
      kitId: kit_id, 
      kit_id: kit_id, // Satisfy orphaned MongoDB index
      name: name || 'FUNAAB SMART FARM SYSTEM' 
    });
    await kit.save();
    
    // Map back for frontend
    res.json({ ...kit._doc, kit_id: kit.kitId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create kit', details: error.message });
  }
});

// PUT /api/kits/:id - Assign kit to user (Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const { owner_id } = req.body;
    const kit = await Kit.findByIdAndUpdate(
      req.params.id, 
      { owner_id: owner_id || null }, 
      { new: true }
    );
    if (!kit) return res.status(404).json({ error: 'Kit not found' });
    res.json(kit);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update kit' });
  }
});

// DELETE /api/kits/:id - Delete a kit (Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await Kit.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete kit' });
  }
});

// GET /api/kits/my-kits - Fetch kits for logged in client
router.get('/my-kits', auth, async (req, res) => {
  try {
    const kits = await Kit.find({ owner_id: req.user.id });
    // Make sure we map kit_id to kitId for the frontend backwards compatibility if needed
    const formattedKits = kits.map(k => ({
      ...k._doc,
      kitId: k.kit_id
    }));
    res.json(formattedKits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch your kits' });
  }
});

export default router;
