const crypto = require('crypto');

/**
 * Request Tracing Middleware
 * Injects X-Request-Id and attaches high-resolution X-Response-Time header before headers are flushed
 */
const requestTracer = (req, res, next) => {
  const reqId = req.headers['x-request-id'] || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);

  const start = process.hrtime.bigint();

  const originalEnd = res.end;
  res.end = function (...args) {
    if (!res.headersSent) {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;
      res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    }
    return originalEnd.apply(this, args);
  };

  next();
};

module.exports = requestTracer;
