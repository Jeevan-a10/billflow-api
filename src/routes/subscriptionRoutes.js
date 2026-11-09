const express = require('express');
const {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
} = require('../controllers/subscriptionController');
const { validateSubscription } = require('../middleware/validate');

const router = express.Router();

router.get('/', getSubscriptions);
router.get('/:id', getSubscriptionById);
router.post('/', validateSubscription, createSubscription);
router.post('/:id/upgrade', upgradeSubscription);
router.post('/:id/cancel', cancelSubscription);

module.exports = router;
