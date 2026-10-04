import express from 'express';
import SensorLog from '../models/SensorLog.js';

const router = express.Router();

// Get weekly reports for a specific kit
// Example: GET /api/reports/water/:kitId?days=7
router.get('/water/:kitId', async (req, res) => {
  try {
    const { kitId } = req.params;
    const days = parseInt(req.query.days) || 7;
    
    // Calculate the date X days ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const logs = await SensorLog.find({
      kitId: kitId,
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Server error fetching reports' });
  }
});

export default router;
