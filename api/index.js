import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Import routes
import authRoutes from './routes/auth.js';
import kitRoutes from './routes/kits.js';
import userRoutes from './routes/users.js';

app.use('/api/auth', authRoutes);
app.use('/api/kits', kitRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running', hasMongoURI: !!process.env.MONGODB_URI });
});

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('Error connecting to MongoDB:', error));
} else {
  console.error('MONGODB_URI is missing!');
}

// Start server locally
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
