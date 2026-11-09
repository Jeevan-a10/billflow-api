const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const customerController = require('../src/controllers/customerController');
const { validateCustomer } = require('../src/middleware/validate');

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

describe('Customers API Suite', () => {
  beforeEach(() => {
    customerController.resetInMemoryCustomers();
  });

  test('validateCustomer: rejects invalid email', () => {
    const req = { body: { name: 'Acme Corp', email: 'not-an-email' } };
    const res = mockResponse();
    let nextCalled = false;

    validateCustomer(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /valid customer email/i);
  });

  test('createCustomer: provisions new customer profile with unique ID', async () => {
    const req = {
      body: {
        name: 'Stripe Merchant Co',
        email: 'billing@stripemerchant.io',
        currency: 'USD',
        billingAddress: { country: 'US', state: 'NY', city: 'New York' },
      },
    };
    const res = mockResponse();

    await customerController.createCustomer(req, res, (err) => { if (err) throw err; });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.customerId.startsWith('cus_'));
    assert.equal(res.body.data.email, 'billing@stripemerchant.io');
    assert.equal(res.body.data.balanceCents, 0);

    // Verify duplicate email is blocked
    const dupRes = mockResponse();
    await customerController.createCustomer(req, dupRes, (err) => { if (err) throw err; });
    assert.equal(dupRes.statusCode, 409);
  });

  test('getCustomerById: retrieves existing customer or returns 404', async () => {
    // Provision customer
    const createReq = { body: { name: 'Vercel User', email: 'dev@vercel.com' } };
    const createRes = mockResponse();
    await customerController.createCustomer(createReq, createRes, () => {});
    const customerId = createRes.body.data.customerId;

    // Retrieve
    const getReq = { params: { id: customerId } };
    const getRes = mockResponse();
    await customerController.getCustomerById(getReq, getRes, () => {});
    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.body.data.customerId, customerId);

    // Retrieve unknown
    const notFoundReq = { params: { id: 'cus_nonexistent' } };
    const notFoundRes = mockResponse();
    await customerController.getCustomerById(notFoundReq, notFoundRes, () => {});
    assert.equal(notFoundRes.statusCode, 404);
  });

  test('adjustCustomerBalance: applies credit or debt adjustment', async () => {
    const createReq = { body: { name: 'Balance Test', email: 'balance@test.com' } };
    const createRes = mockResponse();
    await customerController.createCustomer(createReq, createRes, () => {});
    const customerId = createRes.body.data.customerId;

    // Apply credit (-$50)
    const adjReq = { params: { id: customerId }, body: { deltaCents: -5000, reason: 'Promotional credit' } };
    const adjRes = mockResponse();
    await customerController.adjustCustomerBalance(adjReq, adjRes, () => {});

    assert.equal(adjRes.statusCode, 200);
    assert.equal(adjRes.body.data.balanceCents, -5000);
  });
});
