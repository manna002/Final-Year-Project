import express from 'express';
import Kit from '../models/Kit.js';

const router = express.Router();

// Get kits for the authenticated user
router.get('/my-kits', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    // This would typically use the auth middleware to get req.user.id
    // But we are simplifying to match the current frontend implementation
    import('jsonwebtoken').then(({ default: jwt }) => {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_funaab_key_2026');
      const userId = decoded.user.id;

      Kit.find({ ownerId: userId })
        .then(kits => {
          res.json(kits);
        })
        .catch(err => {
          console.error(err);
          res.status(500).json({ error: 'Failed to fetch kits' });
        });
    });
  } catch (error) {
    console.error('Error fetching kits:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Assign kit to a user
router.post('/assign', async (req, res) => {
  try {
    const { kitId, ownerId } = req.body;
    
    // Check if kit exists, if not create it
    let kit = await Kit.findOne({ kitId });
    
    if (kit) {
      kit.ownerId = ownerId;
      kit.status = 'active';
      await kit.save();
    } else {
      kit = new Kit({
        kitId,
        ownerId,
        status: 'active'
      });
      await kit.save();
    }
    
    res.json({ message: 'Kit assigned successfully', kit });
  } catch (error) {
    console.error('Error assigning kit:', error);
    res.status(500).json({ error: 'Failed to assign kit' });
  }
});

export default router;
