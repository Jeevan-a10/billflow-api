const express = require('express');
const { recordUsage, getCustomerUsageSummary } = require('../controllers/usageController');
const { validateUsageRecord } = require('../middleware/validate');

const router = express.Router();

router.post('/', validateUsageRecord, recordUsage);
router.get('/customer/:customerId', getCustomerUsageSummary);

module.exports = router;
