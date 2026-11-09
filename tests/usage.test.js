const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const usageController = require('../src/controllers/usageController');
const customerController = require('../src/controllers/customerController');
const subscriptionController = require('../src/controllers/subscriptionController');
const planController = require('../src/controllers/planController');
const { validateUsageRecord } = require('../src/middleware/validate');

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

describe('Metered Usage & Overage Billing Suite', () => {
  let customerId;

  beforeEach(async () => {
    planController.resetInMemoryPlans();
    customerController.resetInMemoryCustomers();
    subscriptionController.resetInMemorySubscriptions();
    usageController.resetInMemoryUsage();

    const req = { body: { name: 'Metered User', email: 'metered@cloud.io' } };
    const res = mockResponse();
    await customerController.createCustomer(req, res, () => {});
    customerId = res.body.data.customerId;
  });

  test('validateUsageRecord: rejects missing metric or negative quantity', () => {
    const req1 = { body: { customerId, metricName: '', quantity: 100 } };
    const res1 = mockResponse();
    let next1 = false;
    validateUsageRecord(req1, res1, () => { next1 = true; });
    assert.equal(next1, false);
    assert.equal(res1.statusCode, 400);

    const req2 = { body: { customerId, metricName: 'api_calls', quantity: -5 } };
    const res2 = mockResponse();
    let next2 = false;
    validateUsageRecord(req2, res2, () => { next2 = true; });
    assert.equal(next2, false);
    assert.equal(res2.statusCode, 400);
  });

  test('recordUsage: registers usage event and safely handles idempotent replay', async () => {
    const key = 'idem_req_abc_123';
    const req = {
      body: {
        customerId,
        metricName: 'api_calls',
        quantity: 500,
        idempotencyKey: key,
      },
    };
    const res1 = mockResponse();
    await usageController.recordUsage(req, res1, () => {});

    assert.equal(res1.statusCode, 201);
    assert.equal(res1.body.data.quantity, 500);

    // Replay with exact same idempotency key
    const res2 = mockResponse();
    await usageController.recordUsage(req, res2, () => {});

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.idempotentReplay, true);
    assert.equal(res2.body.data.quantity, 500);
  });

  test('getCustomerUsageSummary: calculates overage when exceeding plan allowances', async () => {
    // Subscribe customer to 'starter' plan (includes 10,000 api_calls, overage rate = 1 cent / unit)
    const subReq = { body: { customerId, planCode: 'starter' } };
    const subRes = mockResponse();
    await subscriptionController.createSubscription(subReq, subRes, () => {});

    // Ingest 15,000 api_calls across two events
    await usageController.recordUsage({ body: { customerId, metricName: 'api_calls', quantity: 9000 } }, mockResponse(), () => {});
    await usageController.recordUsage({ body: { customerId, metricName: 'api_calls', quantity: 6000 } }, mockResponse(), () => {});

    // Fetch summary
    const sumReq = { params: { customerId } };
    const sumRes = mockResponse();
    await usageController.getCustomerUsageSummary(sumReq, sumRes, () => {});

    assert.equal(sumRes.statusCode, 200);
    assert.equal(sumRes.body.customerId, customerId);

    const apiMetric = sumRes.body.metrics.find((m) => m.metricName === 'api_calls');
    assert.ok(apiMetric);
    assert.equal(apiMetric.totalUnits, 15000);
    assert.equal(apiMetric.includedUnits, 10000);
    assert.equal(apiMetric.overageUnits, 5000); // 15000 - 10000
    assert.equal(apiMetric.overageCents, 5000); // 5000 * 1 cent = $50.00
    assert.equal(apiMetric.overageUsd, 50.0);
    assert.equal(sumRes.body.totalOverageCents, 5000);
  });
});
