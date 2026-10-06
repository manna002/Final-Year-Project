import express from 'express';
import mqtt from 'mqtt';
import SensorLog from '../models/SensorLog.js';
import Kit from '../models/Kit.js';

const router = express.Router();

// GET /api/reports/water/:kitId
router.get('/water/:kitId', async (req, res) => {
  try {
    const { kitId } = req.params;
    const { from, to, days } = req.query;
    
    let startDate = new Date();
    let endDate = new Date();
    
    if (from && to) {
      startDate = new Date(from);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const d = parseInt(days) || 7;
      startDate.setDate(startDate.getDate() - d);
      startDate.setHours(0, 0, 0, 0);
    }

    const logs = await SensorLog.find({
      kitId: kitId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Server error fetching reports' });
  }
});

// GET /api/reports/capture - Triggered by Vercel Cron
router.get('/capture', async (req, res) => {
  // Optional: Verify Vercel Cron Secret in production
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized CRON trigger' });
    }
  }

  const BROKER = process.env.MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt';
  const USERNAME = process.env.MQTT_USERNAME || '';
  const PASSWORD = process.env.MQTT_PASSWORD || '';

  const options = {
    clientId: 'FUNAAB_CRON_' + Math.random().toString(16).slice(2, 8),
    clean: true,
  };
  if (USERNAME && PASSWORD) {
    options.username = USERNAME;
    options.password = PASSWORD;
  }

  const latestReadings = {};

  try {
    const client = mqtt.connect(BROKER, options);
    
    client.on('connect', () => {
      console.log('[Cron] Connected to MQTT for snapshot');
      client.subscribe('+/sensor/temperature');
      client.subscribe('+/sensor/humidity');
      client.subscribe('+/sensor/moisture');
      client.subscribe('+/sensor/totalflow');
    });

    client.on('message', (topic, payload) => {
      const msg = payload.toString();
      const parts = topic.split('/');
      if (parts.length >= 3) {
        const kitId = parts[0];
        const sensorType = parts[2];

        if (!latestReadings[kitId]) {
          latestReadings[kitId] = { temperature: 0, humidity: 0, moisture: 0, totalLitres: 0 };
        }

        if (sensorType === 'temperature') latestReadings[kitId].temperature = parseFloat(msg);
        if (sensorType === 'humidity') latestReadings[kitId].humidity = parseFloat(msg);
        if (sensorType === 'moisture') latestReadings[kitId].moisture = parseFloat(msg);
        if (sensorType === 'totalflow') latestReadings[kitId].totalLitres = parseFloat(msg);
      }
    });

    // The ESP32 publishes every 3 seconds. Wait 4 seconds to capture data, then save.
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Disconnect safely so Vercel can close the function
    client.end();
    console.log('[Cron] Disconnected from MQTT. Saving to DB...');

    // Save to DB
    const kits = await Kit.find({});
    const hour = new Date().getHours();
    const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
    
    const savedLogs = [];

    for (const kit of kits) {
      const kitId = kit.kitId || kit.kit_id;
      const data = latestReadings[kitId];
      
      if (data) {
        const log = await SensorLog.create({
          kitId,
          timeSlot,
          temperature: data.temperature,
          humidity: data.humidity,
          moisture: data.moisture,
          totalLitres: data.totalLitres
        });
        savedLogs.push(log);
      }
    }

    res.json({ success: true, message: `Snapshot saved for ${savedLogs.length} kits`, data: savedLogs });
  } catch (error) {
    console.error('[Cron] Error during capture:', error);
    res.status(500).json({ error: 'Capture failed', details: error.message });
  }
});

export default router;
