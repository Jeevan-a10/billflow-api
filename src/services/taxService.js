/**
 * Jurisdiction Tax Rate Determination Service
 */

const JURISDICTION_RATES = {
  US: {
    CA: 0.0725,
    NY: 0.08875,
    TX: 0.0625,
    WA: 0.065,
    DEFAULT: 0.05,
  },
  GB: 0.20, // UK VAT
  DE: 0.19, // German VAT
  FR: 0.20, // French VAT
  IN: 0.18, // Indian GST
  CA: 0.13, // Canada HST average
  AU: 0.10, // Australia GST
};

const getTaxRate = ({ country = 'US', state = '' } = {}) => {
  const normCountry = (country || 'US').toUpperCase();
  const normState = (state || '').toUpperCase();

  if (normCountry === 'US') {
    const usRates = JURISDICTION_RATES.US;
    return usRates[normState] !== undefined ? usRates[normState] : usRates.DEFAULT;
  }

  if (JURISDICTION_RATES[normCountry] !== undefined) {
    return JURISDICTION_RATES[normCountry];
  }

  return 0.0;
};

const calculateTax = ({ amountCents, country, state }) => {
  const rate = getTaxRate({ country, state });
  const taxCents = Math.round(amountCents * rate);
  return {
    rate,
    taxCents,
  };
};

module.exports = { getTaxRate, calculateTax };
