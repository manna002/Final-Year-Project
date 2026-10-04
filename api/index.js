import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import connectDB from './lib/mongodb.js';
import { startMqttLogger } from './lib/mqttLogger.js';

const app = express();
app.use(cors());
app.use(express.json());

// Ensure DB is connected before handling any requests
let dbConnected = false;
app.use(async (req, res, next) => {
  try {
    if (!dbConnected) {
      await connectDB();
      dbConnected = true;
      // Start the MQTT logger once DB is connected
      startMqttLogger();
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

// Import routes
import authRoutes from './routes/auth.js';
import kitRoutes from './routes/kits.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';

app.use('/api/auth', authRoutes);
app.use('/api/kits', kitRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', hasMongoURI: !!process.env.MONGODB_URI });
});

// Start server locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
