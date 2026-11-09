const validatePlan = (req, res, next) => {
  const { name, code, monthlyPriceCents } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Plan name is required and must be a non-empty string',
    });
  }

  if (!code || typeof code !== 'string' || !/^[a-z0-9_-]+$/i.test(code)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Plan code is required and must contain only alphanumeric characters, dashes, or underscores',
    });
  }

  if (typeof monthlyPriceCents !== 'number' || monthlyPriceCents < 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Plan monthlyPriceCents must be a non-negative number',
    });
  }

  next();
};

const validateCustomer = (req, res, next) => {
  const { name, email } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Customer name is required',
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Valid customer email is required',
    });
  }

  next();
};

const validateSubscription = (req, res, next) => {
  const { customerId, planCode, billingInterval } = req.body;

  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'customerId is required',
    });
  }

  if (!planCode || typeof planCode !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'planCode is required',
    });
  }

  if (billingInterval && !['monthly', 'yearly'].includes(billingInterval)) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'billingInterval must be either "monthly" or "yearly"',
    });
  }

  next();
};

const validateUsageRecord = (req, res, next) => {
  const { customerId, metricName, quantity } = req.body;

  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'customerId is required',
    });
  }

  if (!metricName || typeof metricName !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'metricName is required (e.g., api_calls, compute_minutes, storage_gb)',
    });
  }

  if (typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'quantity must be a positive number',
    });
  }

  next();
};

const validateCoupon = (req, res, next) => {
  const { code, discountPercent, discountAmountCents } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Coupon code is required',
    });
  }

  const hasPercent = typeof discountPercent === 'number' && discountPercent > 0 && discountPercent <= 100;
  const hasAmount = typeof discountAmountCents === 'number' && discountAmountCents > 0;

  if (!hasPercent && !hasAmount) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Coupon must specify either a valid discountPercent (1-100) or discountAmountCents (>0)',
    });
  }

  next();
};

module.exports = {
  validatePlan,
  validateCustomer,
  validateSubscription,
  validateUsageRecord,
  validateCoupon,
};
