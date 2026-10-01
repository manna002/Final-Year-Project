import mongoose from 'mongoose';

const KitSchema = new mongoose.Schema({
  kitId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: 'FUNAAB IMS'
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.Kit || mongoose.model('Kit', KitSchema);
