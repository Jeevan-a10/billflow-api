const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const subscriptionController = require('../src/controllers/subscriptionController');
const customerController = require('../src/controllers/customerController');
const planController = require('../src/controllers/planController');
const invoiceController = require('../src/controllers/invoiceController');
const { calculateProration } = require('../src/services/prorationService');

const mockResponse = () => {
  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.body = data;
    return this;
  };
  return res;
};

describe('Subscriptions & Proration Engine Suite', () => {
  let customerId;

  beforeEach(async () => {
    planController.resetInMemoryPlans();
    customerController.resetInMemoryCustomers();
    subscriptionController.resetInMemorySubscriptions();
    invoiceController.resetInMemoryInvoices();

    // Create a customer for tests
    const req = { body: { name: 'SaaS Founder', email: 'founder@saas.io' } };
    const res = mockResponse();
    await customerController.createCustomer(req, res, () => {});
    customerId = res.body.data.customerId;
  });

  test('calculateProration: accurately computes unused credit and charge for mid-cycle upgrade', () => {
    const periodStart = new Date('2026-11-01T00:00:00Z');
    const periodEnd = new Date('2026-12-01T00:00:00Z'); // 30 days
    const changeDate = new Date('2026-11-16T00:00:00Z'); // exactly 15 days in (50%)

    const result = calculateProration({
      oldUnitPriceCents: 2900, // Starter $29/mo
      newUnitPriceCents: 9900, // Pro $99/mo
      periodStart,
      periodEnd,
      changeDate,
      oldSeats: 1,
      newSeats: 1,
    });

    assert.equal(result.totalDurationDays, 30);
    assert.equal(result.remainingDays, 15);
    assert.equal(result.fractionRemaining, 0.5);
    assert.equal(result.unusedCreditCents, 1450); // half of $29
    assert.equal(result.newChargeCents, 4950); // half of $99
    assert.equal(result.netAdjustmentCents, 3500); // 4950 - 1450 = $35.00
  });

  test('createSubscription: provisions active subscription and automatically generates initial invoice', async () => {
    const req = {
      body: {
        customerId,
        planCode: 'pro',
        billingInterval: 'monthly',
        seats: 2,
      },
    };
    const res = mockResponse();

    await subscriptionController.createSubscription(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.subscriptionId.startsWith('sub_'));
    assert.equal(res.body.data.planCode, 'pro');
    assert.equal(res.body.data.seats, 2);
    assert.equal(res.body.data.status, 'active');

    // Check auto-generated invoice
    assert.ok(res.body.invoice);
    assert.equal(res.body.invoice.status, 'open');
    assert.equal(res.body.invoice.lineItems.length, 1);
    assert.equal(res.body.invoice.subtotalCents, 19800); // 9900 * 2 seats = $198.00
  });

  test('upgradeSubscription (preview): computes prorated quote without modifying subscription', async () => {
    const createReq = { body: { customerId, planCode: 'starter', seats: 1 } };
    const createRes = mockResponse();
    await subscriptionController.createSubscription(createReq, createRes, () => {});
    const subId = createRes.body.data.subscriptionId;

    const previewReq = {
      params: { id: subId },
      body: { newPlanCode: 'pro', previewOnly: true },
    };
    const previewRes = mockResponse();
    await subscriptionController.upgradeSubscription(previewReq, previewRes, () => {});

    assert.equal(previewRes.statusCode, 200);
    assert.equal(previewRes.body.preview, true);
    assert.equal(previewRes.body.currentPlan, 'starter');
    assert.equal(previewRes.body.targetPlan, 'pro');
    assert.ok(previewRes.body.proration.netAdjustmentCents > 0);
  });

  test('upgradeSubscription (apply): applies upgrade and generates prorated invoice', async () => {
    const createReq = { body: { customerId, planCode: 'starter', seats: 1 } };
    const createRes = mockResponse();
    await subscriptionController.createSubscription(createReq, createRes, () => {});
    const subId = createRes.body.data.subscriptionId;

    const upgradeReq = {
      params: { id: subId },
      body: { newPlanCode: 'pro', previewOnly: false },
    };
    const upgradeRes = mockResponse();
    await subscriptionController.upgradeSubscription(upgradeReq, upgradeRes, () => {});

    assert.equal(upgradeRes.statusCode, 200);
    assert.equal(upgradeRes.body.data.planCode, 'pro');
    assert.ok(upgradeRes.body.invoice);
    assert.equal(upgradeRes.body.invoice.lineItems[0].type, 'proration');
  });

  test('cancelSubscription: supports end-of-period cancellation and immediate termination', async () => {
    const createReq = { body: { customerId, planCode: 'starter' } };
    const createRes = mockResponse();
    await subscriptionController.createSubscription(createReq, createRes, () => {});
    const subId = createRes.body.data.subscriptionId;

    // Soft cancel (end of period)
    const softReq = { params: { id: subId }, body: { immediately: false } };
    const softRes = mockResponse();
    await subscriptionController.cancelSubscription(softReq, softRes, () => {});
    assert.equal(softRes.body.data.cancelAtPeriodEnd, true);
    assert.equal(softRes.body.data.status, 'active');

    // Immediate cancel
    const immReq = { params: { id: subId }, body: { immediately: true } };
    const immRes = mockResponse();
    await subscriptionController.cancelSubscription(immReq, immRes, () => {});
    assert.equal(immRes.body.data.status, 'canceled');
    assert.ok(immRes.body.data.canceledAt);
  });
});
