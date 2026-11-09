const crypto = require('crypto');

const DEFAULT_SECRET = process.env.WEBHOOK_SIGNING_SECRET || 'whsec_billflow_production_key_mock_99182';

const computeSignature = (payload, secret = DEFAULT_SECRET) => {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
};

const verifySignature = (payload, signature, secret = DEFAULT_SECRET) => {
  if (!signature || typeof signature !== 'string') return false;
  try {
    const expected = computeSignature(payload, secret);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (err) {
    return false;
  }
};

module.exports = {
  computeSignature,
  verifySignature,
};
