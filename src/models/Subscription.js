const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    customerId: {
      type: String,
      required: true,
      ref: 'Customer',
      index: true,
    },
    planCode: {
      type: String,
      required: true,
      ref: 'Plan',
    },
    billingInterval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'paused', 'canceled'],
      default: 'active',
      index: true,
    },
    seats: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPriceCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    trialEnd: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
