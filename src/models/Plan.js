const mongoose = require('mongoose');

const PlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    monthlyPriceCents: {
      type: Number,
      required: true,
      min: 0,
    },
    yearlyPriceCents: {
      type: Number,
      required: true,
      min: 0,
    },
    includedUnits: {
      type: Map,
      of: Number,
      default: {
        api_calls: 10000,
        storage_gb: 10,
        seats: 3,
      },
    },
    overageRateCents: {
      type: Map,
      of: Number,
      default: {
        api_calls: 1, // $0.01 per 100 calls or standard unit
        storage_gb: 15, // $0.15 per additional GB
      },
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);
