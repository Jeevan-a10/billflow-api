const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    balanceCents: {
      type: Number,
      default: 0, // negative represents credits/overpayment, positive represents debt
    },
    billingAddress: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: 'US' },
      postalCode: { type: String, default: '' },
    },
    taxId: {
      type: String,
      default: '',
    },
    delinquent: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
