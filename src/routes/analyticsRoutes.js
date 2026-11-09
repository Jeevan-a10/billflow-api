const express = require('express');
const { getBillingAnalytics } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/overview', getBillingAnalytics);

module.exports = router;
