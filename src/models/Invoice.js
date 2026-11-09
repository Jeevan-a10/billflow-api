const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amountCents: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    unitPriceCents: { type: Number, required: true },
    type: {
      type: String,
      enum: ['subscription', 'proration', 'metered_overage', 'discount', 'credit'],
      default: 'subscription',
    },
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: String,
      required: true,
      ref: 'Customer',
      index: true,
    },
    subscriptionId: {
      type: String,
      ref: 'Subscription',
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
      default: 'draft',
      index: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    lineItems: [LineItemSchema],
    subtotalCents: {
      type: Number,
      required: true,
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxCents: {
      type: Number,
      default: 0,
    },
    discountCents: {
      type: Number,
      default: 0,
    },
    totalCents: {
      type: Number,
      required: true,
      default: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
