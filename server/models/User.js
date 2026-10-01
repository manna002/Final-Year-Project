const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  role: { type: String, enum: ['client', 'admin'], default: 'client' },
  adminCode: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
