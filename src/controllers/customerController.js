const crypto = require('crypto');
const Customer = require('../models/Customer');
const { getStatus } = require('../config/db');

let inMemoryCustomers = [];

const getCustomers = async (req, res, next) => {
  try {
    const { mode } = getStatus();
    if (mode === 'mongodb') {
      const customers = await Customer.find().sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: customers.length, data: customers });
    }

    res.status(200).json({ success: true, count: inMemoryCustomers.length, data: inMemoryCustomers });
  } catch (err) {
    next(err);
  }
};

const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mode } = getStatus();

    if (mode === 'mongodb') {
      const customer = await Customer.findOne({ customerId: id });
      if (!customer) {
        return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${id} not found` });
      }
      return res.status(200).json({ success: true, data: customer });
    }

    const customer = inMemoryCustomers.find((c) => c.customerId === id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${id} not found` });
    }

    res.status(200).json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
};

const createCustomer = async (req, res, next) => {
  try {
    const { name, email, currency = 'USD', billingAddress, taxId, metadata } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    const customerId = `cus_${crypto.randomBytes(8).toString('hex')}`;
    const { mode } = getStatus();

    if (mode === 'mongodb') {
      const existing = await Customer.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(409).json({ success: false, error: 'DuplicateEmail', message: `Customer with email ${cleanEmail} already exists` });
      }

      const customer = await Customer.create({
        customerId,
        name: name.trim(),
        email: cleanEmail,
        currency: currency.toUpperCase(),
        billingAddress: billingAddress || {},
        taxId: taxId || '',
        metadata: metadata || {},
        balanceCents: 0,
        delinquent: false,
      });

      return res.status(201).json({ success: true, data: customer });
    }

    if (inMemoryCustomers.some((c) => c.email === cleanEmail)) {
      return res.status(409).json({ success: false, error: 'DuplicateEmail', message: `Customer with email ${cleanEmail} already exists` });
    }

    const newCustomer = {
      customerId,
      name: name.trim(),
      email: cleanEmail,
      currency: currency.toUpperCase(),
      billingAddress: billingAddress || { country: 'US', state: 'CA' },
      taxId: taxId || '',
      metadata: metadata || {},
      balanceCents: 0,
      delinquent: false,
      createdAt: new Date(),
    };

    inMemoryCustomers.unshift(newCustomer);
    res.status(201).json({ success: true, data: newCustomer });
  } catch (err) {
    next(err);
  }
};

const adjustCustomerBalance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { deltaCents, reason } = req.body;

    if (typeof deltaCents !== 'number') {
      return res.status(400).json({ success: false, error: 'ValidationError', message: 'deltaCents must be a number' });
    }

    const { mode } = getStatus();
    if (mode === 'mongodb') {
      const customer = await Customer.findOne({ customerId: id });
      if (!customer) {
        return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${id} not found` });
      }
      customer.balanceCents += deltaCents;
      await customer.save();
      return res.status(200).json({ success: true, data: customer, reason: reason || 'Adjustment' });
    }

    const customer = inMemoryCustomers.find((c) => c.customerId === id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${id} not found` });
    }

    customer.balanceCents += deltaCents;
    res.status(200).json({ success: true, data: customer, reason: reason || 'Adjustment' });
  } catch (err) {
    next(err);
  }
};

const resetInMemoryCustomers = () => {
  inMemoryCustomers = [];
};

const findCustomerInternal = (id) => {
  return inMemoryCustomers.find((c) => c.customerId === id) || null;
};

const getAllCustomersInternal = () => {
  return inMemoryCustomers;
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  adjustCustomerBalance,
  resetInMemoryCustomers,
  findCustomerInternal,
  getAllCustomersInternal,
};
