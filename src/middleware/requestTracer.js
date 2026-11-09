const crypto = require('crypto');

const requestTracer = (req, res, next) => {
  const reqId = req.headers['x-request-id'] || `req_${crypto.randomBytes(8).toString('hex')}`;
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
  });

  next();
};

module.exports = requestTracer;
