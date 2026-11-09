const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const { getStatus } = require('../config/db');
const { calculateProration } = require('../services/prorationService');
const { buildInvoice } = require('../services/invoiceService');
const { findPlanInternal } = require('./planController');
const { findCustomerInternal } = require('./customerController');
const { recordInvoiceInternal } = require('./invoiceController');

let inMemorySubscriptions = [];

const getSubscriptions = async (req, res, next) => {
  try {
    const { customerId, status } = req.query;
    const { mode } = getStatus();

    if (mode === 'mongodb') {
      const query = {};
      if (customerId) query.customerId = customerId;
      if (status) query.status = status;
      const list = await Subscription.find(query).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: list.length, data: list });
    }

    let filtered = [...inMemorySubscriptions];
    if (customerId) filtered = filtered.filter((s) => s.customerId === customerId);
    if (status) filtered = filtered.filter((s) => s.status === status);

    res.status(200).json({ success: true, count: filtered.length, data: filtered });
  } catch (err) {
    next(err);
  }
};

const getSubscriptionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mode } = getStatus();

    if (mode === 'mongodb') {
      const sub = await Subscription.findOne({ subscriptionId: id });
      if (!sub) {
        return res.status(404).json({ success: false, error: 'SubscriptionNotFound', message: `Subscription ${id} not found` });
      }
      return res.status(200).json({ success: true, data: sub });
    }

    const sub = inMemorySubscriptions.find((s) => s.subscriptionId === id);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'SubscriptionNotFound', message: `Subscription ${id} not found` });
    }

    res.status(200).json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
};

const createSubscription = async (req, res, next) => {
  try {
    const { customerId, planCode, billingInterval = 'monthly', seats = 1, trialDays = 0 } = req.body;
    const plan = findPlanInternal(planCode);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'PlanNotFound', message: `Plan ${planCode} not found` });
    }

    const customer = findCustomerInternal(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${customerId} not found` });
    }

    const subscriptionId = `sub_${crypto.randomBytes(8).toString('hex')}`;
    const unitPriceCents = billingInterval === 'yearly' ? plan.yearlyPriceCents : plan.monthlyPriceCents;
    const durationDays = billingInterval === 'yearly' ? 365 : 30;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    let trialEnd = null;
    let initialStatus = 'active';
    if (trialDays > 0) {
      trialEnd = new Date(startDate);
      trialEnd.setDate(trialEnd.getDate() + trialDays);
      initialStatus = 'trialing';
    }

    const newSub = {
      subscriptionId,
      customerId,
      planCode: plan.code,
      billingInterval,
      status: initialStatus,
      seats: Number(seats) || 1,
      unitPriceCents,
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      cancelAtPeriodEnd: false,
      trialEnd,
      createdAt: new Date(),
    };

    inMemorySubscriptions.unshift(newSub);

    // Automatically generate first subscription invoice (unless trialing)
    let firstInvoice = null;
    if (initialStatus === 'active') {
      const lineItem = {
        description: `${plan.name} (${billingInterval}) - ${seats} seat(s)`,
        amountCents: unitPriceCents * seats,
        quantity: seats,
        unitPriceCents,
        type: 'subscription',
      };

      firstInvoice = buildInvoice({
        customerId,
        subscriptionId,
        currency: customer.currency || 'USD',
        lineItems: [lineItem],
        customerCountry: customer.billingAddress?.country || 'US',
        customerState: customer.billingAddress?.state || 'CA',
      });

      recordInvoiceInternal(firstInvoice);
    }

    res.status(201).json({
      success: true,
      data: newSub,
      invoice: firstInvoice,
    });
  } catch (err) {
    next(err);
  }
};

const upgradeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPlanCode, newSeats, previewOnly = false } = req.body;

    const sub = inMemorySubscriptions.find((s) => s.subscriptionId === id);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'SubscriptionNotFound', message: `Subscription ${id} not found` });
    }

    const targetPlanCode = newPlanCode || sub.planCode;
    const targetPlan = findPlanInternal(targetPlanCode);
    if (!targetPlan) {
      return res.status(404).json({ success: false, error: 'PlanNotFound', message: `Plan ${targetPlanCode} not found` });
    }

    const targetSeats = newSeats !== undefined ? Number(newSeats) : sub.seats;
    const targetUnitPriceCents = sub.billingInterval === 'yearly'
      ? targetPlan.yearlyPriceCents
      : targetPlan.monthlyPriceCents;

    // Proration calculation
    const proration = calculateProration({
      oldUnitPriceCents: sub.unitPriceCents,
      newUnitPriceCents: targetUnitPriceCents,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      changeDate: new Date(),
      oldSeats: sub.seats,
      newSeats: targetSeats,
    });

    if (previewOnly) {
      return res.status(200).json({
        success: true,
        preview: true,
        subscriptionId: sub.subscriptionId,
        currentPlan: sub.planCode,
        targetPlan: targetPlan.code,
        currentSeats: sub.seats,
        targetSeats,
        proration,
      });
    }

    // Apply upgrade
    sub.planCode = targetPlan.code;
    sub.seats = targetSeats;
    sub.unitPriceCents = targetUnitPriceCents;

    let prorationInvoice = null;
    if (proration.netAdjustmentCents > 0) {
      const customer = findCustomerInternal(sub.customerId);
      const lineItem = {
        description: `Proration adjustment: upgrade to ${targetPlan.name} (${proration.remainingDays} days remaining)`,
        amountCents: proration.netAdjustmentCents,
        quantity: 1,
        unitPriceCents: proration.netAdjustmentCents,
        type: 'proration',
      };

      prorationInvoice = buildInvoice({
        customerId: sub.customerId,
        subscriptionId: sub.subscriptionId,
        currency: customer?.currency || 'USD',
        lineItems: [lineItem],
        customerCountry: customer?.billingAddress?.country || 'US',
        customerState: customer?.billingAddress?.state || 'CA',
      });

      recordInvoiceInternal(prorationInvoice);
    }

    res.status(200).json({
      success: true,
      message: 'Subscription successfully updated',
      data: sub,
      proration,
      invoice: prorationInvoice,
    });
  } catch (err) {
    next(err);
  }
};

const cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { immediately = false } = req.body;

    const sub = inMemorySubscriptions.find((s) => s.subscriptionId === id);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'SubscriptionNotFound', message: `Subscription ${id} not found` });
    }

    if (immediately) {
      sub.status = 'canceled';
      sub.canceledAt = new Date();
      sub.cancelAtPeriodEnd = false;
    } else {
      sub.cancelAtPeriodEnd = true;
    }

    res.status(200).json({
      success: true,
      message: immediately
        ? 'Subscription canceled immediately'
        : 'Subscription set to cancel at end of current period',
      data: sub,
    });
  } catch (err) {
    next(err);
  }
};

const resetInMemorySubscriptions = () => {
  inMemorySubscriptions = [];
};

const getAllSubscriptionsInternal = () => {
  return inMemorySubscriptions;
};

module.exports = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  resetInMemorySubscriptions,
  getAllSubscriptionsInternal,
};
