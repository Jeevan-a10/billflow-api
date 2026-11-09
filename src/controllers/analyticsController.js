const { computeAnalytics } = require('../services/analyticsService');
const { getAllSubscriptionsInternal } = require('./subscriptionController');
const { getAllCustomersInternal } = require('./customerController');

const getBillingAnalytics = async (req, res, next) => {
  try {
    const subscriptions = getAllSubscriptionsInternal();
    const customers = getAllCustomersInternal();

    const metrics = computeAnalytics({ subscriptions, customers });

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBillingAnalytics,
};
