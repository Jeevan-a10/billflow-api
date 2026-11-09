const crypto = require('crypto');
const { calculateTax } = require('./taxService');

let invoiceCounter = 1000;

const generateInvoiceNumber = () => {
  invoiceCounter += 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(invoiceCounter).padStart(5, '0')}`;
};

const buildInvoice = ({
  customerId,
  subscriptionId = null,
  currency = 'USD',
  lineItems = [],
  customerCountry = 'US',
  customerState = '',
  discountCents = 0,
  dueInDays = 14,
}) => {
  const invoiceId = `inv_${crypto.randomBytes(8).toString('hex')}`;
  const invoiceNumber = generateInvoiceNumber();

  // Calculate subtotal from items
  const subtotalCents = lineItems.reduce((acc, item) => {
    return acc + (item.amountCents || (item.quantity || 1) * (item.unitPriceCents || 0));
  }, 0);

  // Apply discount (cannot reduce subtotal below 0)
  const taxableAmountCents = Math.max(0, subtotalCents - (discountCents || 0));

  // Compute tax
  const { rate: taxRate, taxCents } = calculateTax({
    amountCents: taxableAmountCents,
    country: customerCountry,
    state: customerState,
  });

  const totalCents = taxableAmountCents + taxCents;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueInDays);

  return {
    invoiceId,
    invoiceNumber,
    customerId,
    subscriptionId,
    status: 'open',
    currency,
    lineItems,
    subtotalCents,
    discountCents: discountCents || 0,
    taxRate,
    taxCents,
    totalCents,
    dueDate,
    paidAt: null,
    createdAt: new Date(),
  };
};

module.exports = {
  buildInvoice,
  generateInvoiceNumber,
};
