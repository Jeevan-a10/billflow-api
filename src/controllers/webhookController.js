const crypto = require('crypto');
const { verifySignature, computeSignature } = require('../services/webhookService');
const { findInvoiceInternal } = require('./invoiceController');
const { findCustomerInternal } = require('./customerController');
const { getAllSubscriptionsInternal } = require('./subscriptionController');

let inMemoryEvents = [];
const processedEventIds = new Set();

const handleIncomingWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-signature'];
    const payload = req.body;

    if (!payload || !payload.id || !payload.type) {
      return res.status(400).json({
        success: false,
        error: 'InvalidPayload',
        message: 'Webhook payload must include "id" and "type"',
      });
    }

    // Verify HMAC signature
    const isValid = verifySignature(payload, signature);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'InvalidSignature',
        message: 'Cryptographic HMAC signature verification failed',
      });
    }

    // Idempotency / Replay protection
    if (processedEventIds.has(payload.id)) {
      return res.status(200).json({
        success: true,
        idempotentReplay: true,
        message: `Event ${payload.id} already processed`,
      });
    }

    processedEventIds.add(payload.id);

    let actionTaken = 'logged';

    // Dispatch event actions
    switch (payload.type) {
      case 'payment_intent.succeeded': {
        const { invoiceId, customerId } = payload.data || {};
        if (invoiceId) {
          const inv = findInvoiceInternal(invoiceId);
          if (inv) {
            inv.status = 'paid';
            inv.paidAt = new Date();
            actionTaken = `invoice_${invoiceId}_marked_paid`;
          }
        }
        if (customerId) {
          const cus = findCustomerInternal(customerId);
          if (cus) cus.delinquent = false;
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const { customerId, subscriptionId } = payload.data || {};
        if (customerId) {
          const cus = findCustomerInternal(customerId);
          if (cus) cus.delinquent = true;
          actionTaken = `customer_${customerId}_flagged_delinquent`;
        }
        if (subscriptionId) {
          const allSubs = getAllSubscriptionsInternal();
          const sub = allSubs.find((s) => s.subscriptionId === subscriptionId);
          if (sub) sub.status = 'past_due';
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const { subscriptionId } = payload.data || {};
        if (subscriptionId) {
          const allSubs = getAllSubscriptionsInternal();
          const sub = allSubs.find((s) => s.subscriptionId === subscriptionId);
          if (sub) {
            sub.status = 'canceled';
            sub.canceledAt = new Date();
            actionTaken = `subscription_${subscriptionId}_canceled`;
          }
        }
        break;
      }

      default:
        actionTaken = 'unhandled_event_type_acknowledged';
    }

    const eventRecord = {
      eventId: payload.id,
      eventType: payload.type,
      actionTaken,
      processedAt: new Date(),
      status: 'processed',
    };

    inMemoryEvents.unshift(eventRecord);

    res.status(200).json({
      success: true,
      received: true,
      actionTaken,
      eventId: payload.id,
    });
  } catch (err) {
    next(err);
  }
};

const getWebhookEvents = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      count: inMemoryEvents.length,
      data: inMemoryEvents,
    });
  } catch (err) {
    next(err);
  }
};

const simulateWebhookPayload = async (req, res, next) => {
  try {
    const { type, data } = req.body;
    const payload = {
      id: `evt_${crypto.randomBytes(8).toString('hex')}`,
      type: type || 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: data || {},
    };
    const signature = computeSignature(payload);

    res.status(200).json({
      success: true,
      payload,
      signature,
      instructions: 'Send POST to /api/v1/webhooks/receive with header x-signature and this payload body',
    });
  } catch (err) {
    next(err);
  }
};

const resetInMemoryWebhooks = () => {
  inMemoryEvents = [];
  processedEventIds.clear();
};

module.exports = {
  handleIncomingWebhook,
  getWebhookEvents,
  simulateWebhookPayload,
  resetInMemoryWebhooks,
};
