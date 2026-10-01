const mongoose = require('mongoose');

const kitSchema = new mongoose.Schema({
  kit_id: { type: String, required: true, unique: true },
  name: { type: String, default: 'FUNAAB IMS' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'OFFLINE' },
}, { timestamps: true });

module.exports = mongoose.model('Kit', kitSchema);
