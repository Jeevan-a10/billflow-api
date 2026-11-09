const crypto = require('crypto');
const { findCustomerInternal } = require('./customerController');
const { getAllSubscriptionsInternal } = require('./subscriptionController');
const { findPlanInternal } = require('./planController');

let inMemoryUsage = [];
const seenIdempotencyKeys = new Set();

const recordUsage = async (req, res, next) => {
  try {
    const { customerId, metricName, quantity, timestamp, idempotencyKey } = req.body;

    const customer = findCustomerInternal(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${customerId} not found` });
    }

    if (idempotencyKey) {
      if (seenIdempotencyKeys.has(idempotencyKey)) {
        const existing = inMemoryUsage.find((u) => u.idempotencyKey === idempotencyKey);
        return res.status(200).json({
          success: true,
          idempotentReplay: true,
          message: 'Usage record previously processed (idempotent replay)',
          data: existing,
        });
      }
      seenIdempotencyKeys.add(idempotencyKey);
    }

    const recordId = `usg_${crypto.randomBytes(8).toString('hex')}`;
    const newRecord = {
      recordId,
      customerId,
      metricName: metricName.trim().toLowerCase(),
      quantity: Number(quantity),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      idempotencyKey: idempotencyKey || null,
      billed: false,
    };

    inMemoryUsage.unshift(newRecord);

    res.status(201).json({
      success: true,
      message: 'Usage record registered',
      data: newRecord,
    });
  } catch (err) {
    next(err);
  }
};

const getCustomerUsageSummary = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const customer = findCustomerInternal(customerId);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'CustomerNotFound', message: `Customer ${customerId} not found` });
    }

    // Find active subscription for plan limit comparison
    const allSubs = getAllSubscriptionsInternal();
    const activeSub = allSubs.find((s) => s.customerId === customerId && s.status === 'active');
    const plan = activeSub ? findPlanInternal(activeSub.planCode) : null;

    // Aggregate usage
    const customerRecords = inMemoryUsage.filter((u) => u.customerId === customerId);
    const aggregation = {};

    for (const rec of customerRecords) {
      if (!aggregation[rec.metricName]) {
        aggregation[rec.metricName] = {
          metricName: rec.metricName,
          totalUnits: 0,
          recordCount: 0,
        };
      }
      aggregation[rec.metricName].totalUnits += rec.quantity;
      aggregation[rec.metricName].recordCount += 1;
    }

    // Evaluate overages against plan
    const metricsWithOverage = Object.values(aggregation).map((agg) => {
      const included = plan?.includedUnits?.[agg.metricName] || 0;
      const overageRate = plan?.overageRateCents?.[agg.metricName] || 0;
      const overageUnits = Math.max(0, agg.totalUnits - included);
      const overageCents = overageUnits * overageRate;

      return {
        ...agg,
        includedUnits: included,
        overageUnits,
        overageRateCents: overageRate,
        overageCents,
        overageUsd: Number((overageCents / 100).toFixed(2)),
      };
    });

    const totalOverageCents = metricsWithOverage.reduce((sum, m) => sum + m.overageCents, 0);

    res.status(200).json({
      success: true,
      customerId,
      subscriptionId: activeSub?.subscriptionId || null,
      planCode: plan?.code || null,
      metrics: metricsWithOverage,
      totalOverageCents,
      totalOverageUsd: Number((totalOverageCents / 100).toFixed(2)),
    });
  } catch (err) {
    next(err);
  }
};

const resetInMemoryUsage = () => {
  inMemoryUsage = [];
  seenIdempotencyKeys.clear();
};

module.exports = {
  recordUsage,
  getCustomerUsageSummary,
  resetInMemoryUsage,
};
