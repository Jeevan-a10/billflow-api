const express = require('express');
const {
  handleIncomingWebhook,
  getWebhookEvents,
  simulateWebhookPayload,
} = require('../controllers/webhookController');

const router = express.Router();

router.post('/receive', handleIncomingWebhook);
router.get('/events', getWebhookEvents);
router.post('/simulate', simulateWebhookPayload);

module.exports = router;
