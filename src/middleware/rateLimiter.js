const createRateLimiter = ({ windowMs = 60000, max = 120 } = {}) => {
  const hits = new Map();

  return (req, res, next) => {
    // Skip rate limiting during automated test suite runs
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const record = hits.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    record.count += 1;
    hits.set(ip, record);

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: `Rate limit of ${max} requests per ${windowMs / 1000}s exceeded. Try again in ${resetSeconds}s.`,
      });
    }

    next();
  };
};

module.exports = { createRateLimiter };
