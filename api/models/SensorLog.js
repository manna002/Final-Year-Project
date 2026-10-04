import mongoose from 'mongoose';

const sensorLogSchema = new mongoose.Schema({
  kitId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  timeSlot: {
    type: String, // e.g. "06:00", "08:00", "14:00"
    required: true
  },
  temperature: {
    type: Number,
    default: 0
  },
  humidity: {
    type: Number,
    default: 0
  },
  moisture: {
    type: Number,
    default: 0
  },
  totalLitres: {
    type: Number,
    default: 0
  }
});

export default mongoose.models.SensorLog || mongoose.model('SensorLog', sensorLogSchema);
