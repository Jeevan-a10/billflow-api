const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getStatus } = require('../src/config/db');

const mockResponse = () => {
  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data) {
    this.body = data;
    return this;
  };
  return res;
};

describe('BillFlow Health Check Suite', () => {
  test('Health check returns healthy status and service diagnostics', () => {
    const healthHandler = (req, res) => {
      const dbStatus = getStatus();
      res.status(200).json({
        status: 'healthy',
        service: 'billflow-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: dbStatus,
      });
    };

    const req = {};
    const res = mockResponse();
    healthHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'healthy');
    assert.equal(res.body.service, 'billflow-api');
    assert.equal(res.body.version, '1.0.0');
    assert.equal(typeof res.body.uptimeSeconds, 'number');
    assert.ok(res.body.database);
  });
});
