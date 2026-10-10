import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Assuming run from project root, load env
dotenv.config({ path: './api/.env' });

const sensorLogSchema = new mongoose.Schema({
  kitId: String,
  timestamp: Date,
  timeSlot: String,
  temperature: Number,
  humidity: Number,
  moisture: Number,
  totalLitres: Number
});

const SensorLog = mongoose.models.SensorLog || mongoose.model('SensorLog', sensorLogSchema);

const KIT_ID = 'FUNAAB-KIT-001';

const generateTestData = () => {
  const data = [];
  const timeSlots = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
  let cumulativeWater = 120.5; // Start at 120.5 Liters

  // Generate for the last 5 days
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    timeSlots.forEach((slot, index) => {
      // Simulate realistic daily variations
      // Morning is cool and humid, afternoon is hot and dry
      const isMorning = index < 2;
      const isMidday = index >= 2 && index <= 4;
      
      const temp = isMorning ? 22 + Math.random() * 3 : (isMidday ? 30 + Math.random() * 5 : 26 + Math.random() * 3);
      const hum = isMorning ? 75 + Math.random() * 15 : (isMidday ? 40 + Math.random() * 15 : 60 + Math.random() * 10);
      
      // Moisture drops during the day, spikes when irrigated
      const moisture = isMorning ? 60 - Math.random() * 5 : (isMidday ? 35 + Math.random() * 10 : 50 + Math.random() * 10);

      // Add a bit of water usage randomly, especially mid-day
      const waterUsed = isMidday ? (Math.random() * 20) : (Math.random() * 5);
      cumulativeWater += waterUsed;

      // Set exact timestamp for the record
      const [hours, minutes] = slot.split(':');
      const timestamp = new Date(date);
      timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      data.push({
        kitId: KIT_ID,
        timestamp,
        timeSlot: slot,
        temperature: parseFloat(temp.toFixed(1)),
        humidity: parseFloat(hum.toFixed(1)),
        moisture: parseFloat(moisture.toFixed(1)),
        totalLitres: parseFloat(cumulativeWater.toFixed(1))
      });
    });
  }
  return data;
};

async function run() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    console.log('Clearing old test data...');
    await SensorLog.deleteMany({ kitId: KIT_ID });

    console.log('Generating realistic weather and water usage data...');
    const testData = generateTestData();
    
    await SensorLog.insertMany(testData);
    console.log(`Successfully inserted ${testData.length} records!`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
    console.log('Done.');
  }
}

run();
