const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  device: { type: String, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

// speeds up "latest readings for a device" queries
readingSchema.index({ device: 1, timestamp: -1 });

module.exports = mongoose.model('Reading', readingSchema);