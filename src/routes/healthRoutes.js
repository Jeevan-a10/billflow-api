const express = require('express');
const { getStatus } = require('../config/db');

const router = express.Router();

router.get('/', (req, res) => {
  const dbStatus = getStatus();
  res.status(200).json({
    status: 'healthy',
    service: 'billflow-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
  });
});

module.exports = router;
