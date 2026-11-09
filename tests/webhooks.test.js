const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const webhookController = require('../src/controllers/webhookController');
const customerController = require('../src/controllers/customerController');
const invoiceController = require('../src/controllers/invoiceController');
const subscriptionController = require('../src/controllers/subscriptionController');
const { computeSignature, verifySignature } = require('../src/services/webhookService');

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

describe('Webhooks & Cryptographic Signature Suite', () => {
  beforeEach(() => {
    webhookController.resetInMemoryWebhooks();
    customerController.resetInMemoryCustomers();
    invoiceController.resetInMemoryInvoices();
    subscriptionController.resetInMemorySubscriptions();
  });

  test('webhookService: verifies authentic HMAC-SHA256 signatures and rejects forged ones', () => {
    const payload = { id: 'evt_101', type: 'charge.succeeded', amount: 5000 };
    const sig = computeSignature(payload);

    assert.equal(verifySignature(payload, sig), true);
    assert.equal(verifySignature(payload, 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'), false);
    assert.equal(verifySignature(payload, ''), false);
    assert.equal(verifySignature(payload, null), false);
  });

  test('handleIncomingWebhook: rejects request with invalid signature', async () => {
    const payload = { id: 'evt_bad_sig', type: 'charge.succeeded' };
    const req = {
      headers: { 'x-signature': 'invalid_signature_hex' },
      body: payload,
    };
    const res = mockResponse();

    await webhookController.handleIncomingWebhook(req, res, () => {});

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /signature verification failed/i);
  });

  test('handleIncomingWebhook: marks invoice paid on payment_intent.succeeded', async () => {
    // Setup customer and invoice
    const cusReq = { body: { name: 'Paid User', email: 'paid@user.io' } };
    const cusRes = mockResponse();
    await customerController.createCustomer(cusReq, cusRes, () => {});
    const customerId = cusRes.body.data.customerId;

    const invReq = {
      body: {
        customerId,
        lineItems: [{ description: 'Cloud Cluster', amountCents: 5000, quantity: 1, unitPriceCents: 5000 }],
      },
    };
    const invRes = mockResponse();
    await invoiceController.createManualInvoice(invReq, invRes, () => {});
    const invoiceId = invRes.body.data.invoiceId;

    // Simulate webhook
    const payload = {
      id: 'evt_pay_success_1',
      type: 'payment_intent.succeeded',
      data: { invoiceId, customerId },
    };
    const signature = computeSignature(payload);

    const webhookReq = {
      headers: { 'x-signature': signature },
      body: payload,
    };
    const webhookRes = mockResponse();
    await webhookController.handleIncomingWebhook(webhookReq, webhookRes, () => {});

    assert.equal(webhookRes.statusCode, 200);
    assert.equal(webhookRes.body.success, true);

    // Verify invoice was transitioned to paid
    const checkInvReq = { params: { id: invoiceId } };
    const checkInvRes = mockResponse();
    await invoiceController.getInvoiceById(checkInvReq, checkInvRes, () => {});
    assert.equal(checkInvRes.body.data.status, 'paid');
  });

  test('handleIncomingWebhook: flags delinquent customer on payment_intent.payment_failed', async () => {
    const cusReq = { body: { name: 'Failed User', email: 'fail@user.io' } };
    const cusRes = mockResponse();
    await customerController.createCustomer(cusReq, cusRes, () => {});
    const customerId = cusRes.body.data.customerId;

    const payload = {
      id: 'evt_pay_failed_1',
      type: 'payment_intent.payment_failed',
      data: { customerId },
    };
    const signature = computeSignature(payload);

    const req = {
      headers: { 'x-signature': signature },
      body: payload,
    };
    const res = mockResponse();
    await webhookController.handleIncomingWebhook(req, res, () => {});

    assert.equal(res.statusCode, 200);

    // Verify customer is flagged delinquent
    const checkCus = customerController.findCustomerInternal(customerId);
    assert.equal(checkCus.delinquent, true);
  });

  test('handleIncomingWebhook: safely handles duplicate replay with 200 idempotent response', async () => {
    const payload = {
      id: 'evt_replay_test',
      type: 'generic.ping',
      data: {},
    };
    const signature = computeSignature(payload);

    const req = { headers: { 'x-signature': signature }, body: payload };
    const res1 = mockResponse();
    await webhookController.handleIncomingWebhook(req, res1, () => {});
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.received, true);

    const res2 = mockResponse();
    await webhookController.handleIncomingWebhook(req, res2, () => {});
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.idempotentReplay, true);
  });
});
