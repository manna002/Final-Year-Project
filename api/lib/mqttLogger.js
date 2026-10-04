import mqtt from 'mqtt';
import cron from 'node-cron';
import SensorLog from '../models/SensorLog.js';
import Kit from '../models/Kit.js';

// In-memory store for the latest readings from all kits
// Structure: { "FUNAAB-KIT-001": { temperature: 32.5, humidity: 60, moisture: 45, totalLitres: 120.5 } }
const latestReadings = {};

export function startMqttLogger() {
  const BROKER = process.env.MQTT_BROKER || 'wss://broker.hivemq.com:8884/mqtt';
  const USERNAME = process.env.MQTT_USERNAME || '';
  const PASSWORD = process.env.MQTT_PASSWORD || '';

  const options = {
    clientId: 'FUNAAB_BACKEND_' + Math.random().toString(16).slice(2, 8),
    clean: true,
  };

  if (USERNAME && PASSWORD) {
    options.username = USERNAME;
    options.password = PASSWORD;
  }

  console.log('[MQTT Logger] Connecting to broker:', BROKER);
  const client = mqtt.connect(BROKER, options);

  client.on('connect', () => {
    console.log('[MQTT Logger] Connected successfully.');
    // Subscribe to wildcard topics to catch all kits
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
      const sensorType = parts[2]; // temperature, humidity, moisture, totalflow

      if (!latestReadings[kitId]) {
        latestReadings[kitId] = { temperature: 0, humidity: 0, moisture: 0, totalLitres: 0 };
      }

      if (sensorType === 'temperature') latestReadings[kitId].temperature = parseFloat(msg);
      if (sensorType === 'humidity') latestReadings[kitId].humidity = parseFloat(msg);
      if (sensorType === 'moisture') latestReadings[kitId].moisture = parseFloat(msg);
      if (sensorType === 'totalflow') latestReadings[kitId].totalLitres = parseFloat(msg);
    }
  });

  client.on('error', (err) => console.error('[MQTT Logger] Error:', err));

  // Schedule Cron Jobs for 6 AM, 8 AM, 10 AM, 12 PM, 2 PM, 4 PM, 6 PM
  // "0 6,8,10,12,14,16,18 * * *" means minute 0 of those specific hours, every day.
  cron.schedule('0 6,8,10,12,14,16,18 * * *', async () => {
    const hour = new Date().getHours();
    const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
    console.log(`[Cron] Executing scheduled logging for time slot: ${timeSlot}`);

    try {
      // Get all active kits from DB
      const kits = await Kit.find({});
      
      for (const kit of kits) {
        const kitId = kit.kitId || kit.kit_id;
        const data = latestReadings[kitId];
        
        if (data) {
          await SensorLog.create({
            kitId,
            timeSlot,
            temperature: data.temperature,
            humidity: data.humidity,
            moisture: data.moisture,
            totalLitres: data.totalLitres
          });
          console.log(`[Cron] Logged data for ${kitId} at ${timeSlot}`);
        } else {
          console.log(`[Cron] No recent MQTT data in memory for ${kitId}. Skipping.`);
        }
      }
    } catch (err) {
      console.error('[Cron] Error saving scheduled logs:', err);
    }
  });

  console.log('[MQTT Logger] Cron schedules initialized (6am - 6pm bi-hourly).');
}
