const mongoose = require('mongoose');

const UsageRecordSchema = new mongoose.Schema(
  {
    recordId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    metricName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    billed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.UsageRecord || mongoose.model('UsageRecord', UsageRecordSchema);
