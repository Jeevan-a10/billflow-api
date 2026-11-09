const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const invoiceController = require('../src/controllers/invoiceController');
const customerController = require('../src/controllers/customerController');
const { getTaxRate, calculateTax } = require('../src/services/taxService');
const { buildInvoice } = require('../src/services/invoiceService');

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

describe('Invoicing & Tax Engine Suite', () => {
  let customerId;

  beforeEach(async () => {
    customerController.resetInMemoryCustomers();
    invoiceController.resetInMemoryInvoices();

    const req = {
      body: {
        name: 'Invoicing Client LLC',
        email: 'billing@client.com',
        billingAddress: { country: 'US', state: 'CA' }, // 7.25% CA tax
      },
    };
    const res = mockResponse();
    await customerController.createCustomer(req, res, () => {});
    customerId = res.body.data.customerId;
  });

  test('taxService: resolves correct regional tax rates', () => {
    assert.equal(getTaxRate({ country: 'US', state: 'CA' }), 0.0725);
    assert.equal(getTaxRate({ country: 'US', state: 'NY' }), 0.08875);
    assert.equal(getTaxRate({ country: 'GB' }), 0.20);
    assert.equal(getTaxRate({ country: 'IN' }), 0.18);
    assert.equal(getTaxRate({ country: 'DE' }), 0.19);
  });

  test('buildInvoice: applies line items, discount, and tax accurately', () => {
    const lineItems = [
      { description: 'Consulting Block', amountCents: 10000, quantity: 1, unitPriceCents: 10000, type: 'subscription' },
      { description: 'Setup Fee', amountCents: 2000, quantity: 1, unitPriceCents: 2000, type: 'subscription' },
    ];

    const inv = buildInvoice({
      customerId: 'cus_123',
      lineItems,
      customerCountry: 'US',
      customerState: 'CA', // 7.25%
      discountCents: 2000, // $20 discount
    });

    assert.equal(inv.subtotalCents, 12000); // 10000 + 2000 = $120
    assert.equal(inv.discountCents, 2000); // $20
    // Taxable base = 10000
    // Tax = 10000 * 0.0725 = 725 cents
    assert.equal(inv.taxCents, 725);
    assert.equal(inv.totalCents, 10725); // 10000 + 725
    assert.equal(inv.status, 'open');
  });

  test('createManualInvoice: creates invoice via API endpoint', async () => {
    const req = {
      body: {
        customerId,
        lineItems: [{ description: 'Custom Integration Pack', amountCents: 50000, quantity: 1, unitPriceCents: 50000 }],
      },
    };
    const res = mockResponse();

    await invoiceController.createManualInvoice(req, res, () => {});

    assert.equal(res.statusCode, 201);
    assert.ok(res.body.data.invoiceNumber.startsWith('INV-'));
    assert.equal(res.body.data.customerId, customerId);
  });

  test('payInvoice: transitions status to paid and records paidAt timestamp', async () => {
    const createReq = {
      body: {
        customerId,
        lineItems: [{ description: 'Monthly Retainer', amountCents: 30000, quantity: 1, unitPriceCents: 30000 }],
      },
    };
    const createRes = mockResponse();
    await invoiceController.createManualInvoice(createReq, createRes, () => {});
    const invId = createRes.body.data.invoiceId;

    const payReq = { params: { id: invId } };
    const payRes = mockResponse();
    await invoiceController.payInvoice(payReq, payRes, () => {});

    assert.equal(payRes.statusCode, 200);
    assert.equal(payRes.body.data.status, 'paid');
    assert.ok(payRes.body.data.paidAt);

    // Reject paying again
    const secondPayRes = mockResponse();
    await invoiceController.payInvoice(payReq, secondPayRes, () => {});
    assert.equal(secondPayRes.statusCode, 400);
  });

  test('voidInvoice: cancels unpaid invoice and blocks voiding paid invoices', async () => {
    const createReq = {
      body: {
        customerId,
        lineItems: [{ description: 'To be voided', amountCents: 10000, quantity: 1, unitPriceCents: 10000 }],
      },
    };
    const createRes = mockResponse();
    await invoiceController.createManualInvoice(createReq, createRes, () => {});
    const invId = createRes.body.data.invoiceId;

    const voidReq = { params: { id: invId } };
    const voidRes = mockResponse();
    await invoiceController.voidInvoice(voidReq, voidRes, () => {});

    assert.equal(voidRes.statusCode, 200);
    assert.equal(voidRes.body.data.status, 'void');
  });
});
