import mongoose from 'mongoose';

const KitSchema = new mongoose.Schema({
  kitId: {
    type: String,
    required: true,
    unique: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.Kit || mongoose.model('Kit', KitSchema);
