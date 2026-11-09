const { buildInvoice } = require('../services/invoiceService');
const { getStatus } = require('../config/db');
const { findCustomerInternal } = require('./customerController');

let inMemoryInvoices = [];

const getInvoices = async (req, res, next) => {
  try {
    const { customerId, status } = req.query;

    let filtered = [...inMemoryInvoices];
    if (customerId) filtered = filtered.filter((i) => i.customerId === customerId);
    if (status) filtered = filtered.filter((i) => i.status === status);

    res.status(200).json({ success: true, count: filtered.length, data: filtered });
  } catch (err) {
    next(err);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = inMemoryInvoices.find((i) => i.invoiceId === id || i.invoiceNumber === id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'InvoiceNotFound', message: `Invoice ${id} not found` });
    }

    res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

const createManualInvoice = async (req, res, next) => {
  try {
    const { customerId, lineItems, discountCents = 0 } = req.body;

    const customer = findCustomerInternal(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${customerId} not found` });
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ success: false, error: 'ValidationError', message: 'lineItems must be a non-empty array' });
    }

    const invoice = buildInvoice({
      customerId,
      currency: customer.currency || 'USD',
      lineItems,
      customerCountry: customer.billingAddress?.country || 'US',
      customerState: customer.billingAddress?.state || 'CA',
      discountCents,
    });

    inMemoryInvoices.unshift(invoice);
    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
};

const payInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = inMemoryInvoices.find((i) => i.invoiceId === id || i.invoiceNumber === id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'InvoiceNotFound', message: `Invoice ${id} not found` });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, error: 'AlreadyPaid', message: 'Invoice is already paid' });
    }

    invoice.status = 'paid';
    invoice.paidAt = new Date();

    res.status(200).json({ success: true, message: 'Invoice marked as paid', data: invoice });
  } catch (err) {
    next(err);
  }
};

const voidInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = inMemoryInvoices.find((i) => i.invoiceId === id || i.invoiceNumber === id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'InvoiceNotFound', message: `Invoice ${id} not found` });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ success: false, error: 'InvalidState', message: 'Cannot void an already paid invoice' });
    }

    invoice.status = 'void';
    res.status(200).json({ success: true, message: 'Invoice marked as void', data: invoice });
  } catch (err) {
    next(err);
  }
};

const recordInvoiceInternal = (inv) => {
  inMemoryInvoices.unshift(inv);
};

const findInvoiceInternal = (id) => {
  return inMemoryInvoices.find((i) => i.invoiceId === id || i.invoiceNumber === id) || null;
};

const resetInMemoryInvoices = () => {
  inMemoryInvoices = [];
};

module.exports = {
  getInvoices,
  getInvoiceById,
  createManualInvoice,
  payInvoice,
  voidInvoice,
  recordInvoiceInternal,
  findInvoiceInternal,
  resetInMemoryInvoices,
};
