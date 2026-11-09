const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const planController = require('../src/controllers/planController');
const { validatePlan } = require('../src/middleware/validate');

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

describe('Plans API Suite', () => {
  beforeEach(() => {
    planController.resetInMemoryPlans();
  });

  test('validatePlan: rejects missing name', () => {
    const req = { body: { code: 'scale', monthlyPriceCents: 4900 } };
    const res = mockResponse();
    let nextCalled = false;

    validatePlan(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /name is required/i);
  });

  test('validatePlan: rejects invalid code format', () => {
    const req = { body: { name: 'Scale Plan', code: 'scale plan invalid!', monthlyPriceCents: 4900 } };
    const res = mockResponse();
    let nextCalled = false;

    validatePlan(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /alphanumeric/i);
  });

  test('validatePlan: rejects negative monthlyPriceCents', () => {
    const req = { body: { name: 'Scale Plan', code: 'scale', monthlyPriceCents: -500 } };
    const res = mockResponse();
    let nextCalled = false;

    validatePlan(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /non-negative/i);
  });

  test('getPlans: returns default seeding plans (starter, pro, enterprise)', async () => {
    const req = {};
    const res = mockResponse();

    await planController.getPlans(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 3);
    const codes = res.body.data.map((p) => p.code);
    assert.ok(codes.includes('starter'));
    assert.ok(codes.includes('pro'));
    assert.ok(codes.includes('enterprise'));
  });

  test('getPlanByCode: returns single plan details', async () => {
    const req = { params: { code: 'pro' } };
    const res = mockResponse();

    await planController.getPlanByCode(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.code, 'pro');
    assert.equal(res.body.data.monthlyPriceCents, 9900);
  });

  test('getPlanByCode: returns 404 for unknown code', async () => {
    const req = { params: { code: 'nonexistent-tier' } };
    const res = mockResponse();

    await planController.getPlanByCode(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
  });

  test('createPlan: provisions a new plan tier', async () => {
    const req = {
      body: {
        code: 'growth',
        name: 'Growth Tier',
        monthlyPriceCents: 14900,
        yearlyPriceCents: 149000,
        features: ['500k API calls', '20 seats'],
      },
    };
    const res = mockResponse();

    await planController.createPlan(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.code, 'growth');

    // Reject duplicate creation
    const dupRes = mockResponse();
    await planController.createPlan(req, dupRes, (err) => { if (err) throw err; });
    assert.equal(dupRes.statusCode, 409);
  });
});
