const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const requestTracer = require('../src/middleware/requestTracer');
const { createRateLimiter } = require('../src/middleware/rateLimiter');
const { requireApiKey } = require('../src/middleware/auth');
const { notFoundHandler, errorHandler } = require('../src/middleware/errorHandler');

const mockResponse = () => {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    headers,
    setHeader: function (key, val) {
      headers[key.toLowerCase()] = val;
    },
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    },
    on: function (event, cb) {},
  };
  return res;
};

describe('Middleware Suite', () => {
  test('requestTracer: assigns request ID and X-Request-Id header', () => {
    const req = { headers: {} };
    const res = mockResponse();
    let nextCalled = false;

    requestTracer(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.ok(req.id);
    assert.ok(res.headers['x-request-id']);
  });

  test('rateLimiter: enforces max quota and sets rate limit headers', () => {
    const limiter = createRateLimiter({ windowMs: 10000, max: 2 });
    const req = { ip: '192.168.1.1', headers: { 'x-test-rate-limit': '1' } };

    // Request 1: OK
    const res1 = mockResponse();
    limiter(req, res1, () => {});
    assert.equal(res1.headers['x-ratelimit-remaining'], 1);

    // Request 2: OK
    const res2 = mockResponse();
    limiter(req, res2, () => {});
    assert.equal(res2.headers['x-ratelimit-remaining'], 0);

    // Request 3: Blocked with 429
    const res3 = mockResponse();
    limiter(req, res3, () => {});
    assert.equal(res3.statusCode, 429);
    assert.equal(res3.body.error, 'Too many requests');
  });

  test('requireApiKey: allows requests when bypass header or public endpoint', () => {
    const req = { path: '/health', headers: {} };
    const res = mockResponse();
    let nextCalled = false;

    requireApiKey(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('notFoundHandler: returns 404 with structured JSON message', () => {
    const req = { method: 'DELETE', originalUrl: '/api/v1/invalid-route' };
    const res = mockResponse();

    notFoundHandler(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'Not Found');
    assert.match(res.body.message, /cannot delete/i);
  });

  test('errorHandler: catches thrown exceptions and returns 500', () => {
    const err = new Error('Database connection timeout');
    const req = { method: 'GET', url: '/test' };
    const res = mockResponse();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Database connection timeout');
  });
});
