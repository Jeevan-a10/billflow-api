/**
 * SaaS Revenue, Churn & Cohort Metrics Analytics Service
 */

const computeAnalytics = ({ subscriptions = [], customers = [] }) => {
  let mrrCents = 0;
  let activeCount = 0;
  let trialingCount = 0;
  let pastDueCount = 0;
  let canceledCount = 0;

  const planBreakdown = {};
  const intervalBreakdown = { monthly: 0, yearly: 0 };

  for (const sub of subscriptions) {
    const seats = sub.seats || 1;

    if (sub.status === 'active') {
      activeCount += 1;

      // Normalize MRR: monthly subscriptions contribute their full amount; yearly subscriptions contribute 1/12th
      let subMonthlyCents = 0;
      if (sub.billingInterval === 'yearly') {
        subMonthlyCents = Math.round((sub.unitPriceCents * seats) / 12);
        intervalBreakdown.yearly += 1;
      } else {
        subMonthlyCents = sub.unitPriceCents * seats;
        intervalBreakdown.monthly += 1;
      }

      mrrCents += subMonthlyCents;

      // Group by plan
      const code = sub.planCode || 'unknown';
      if (!planBreakdown[code]) {
        planBreakdown[code] = { count: 0, mrrCents: 0 };
      }
      planBreakdown[code].count += 1;
      planBreakdown[code].mrrCents += subMonthlyCents;
    } else if (sub.status === 'trialing') {
      trialingCount += 1;
    } else if (sub.status === 'past_due') {
      pastDueCount += 1;
    } else if (sub.status === 'canceled') {
      canceledCount += 1;
    }
  }

  const arrCents = mrrCents * 12;

  // ARPU = MRR / Active Subscribers (or 0 if none)
  const arpuCents = activeCount > 0 ? Math.round(mrrCents / activeCount) : 0;

  // Churn rate calculation: canceled / (active + canceled)
  const totalSubscribersEver = activeCount + canceledCount;
  const churnRatePercent = totalSubscribersEver > 0
    ? Number(((canceledCount / totalSubscribersEver) * 100).toFixed(2))
    : 0;

  // LTV = ARPU / (Churn rate as a fraction). Default to ARPU * 24 if 0 churn.
  let ltvCents = 0;
  if (churnRatePercent > 0) {
    ltvCents = Math.round(arpuCents / (churnRatePercent / 100));
  } else {
    ltvCents = arpuCents * 24; // 24-month lifetime heuristic for zero churn
  }

  return {
    mrrCents,
    mrrUsd: Number((mrrCents / 100).toFixed(2)),
    arrCents,
    arrUsd: Number((arrCents / 100).toFixed(2)),
    arpuCents,
    arpuUsd: Number((arpuCents / 100).toFixed(2)),
    churnRatePercent,
    ltvCents,
    ltvUsd: Number((ltvCents / 100).toFixed(2)),
    subscriptions: {
      total: subscriptions.length,
      active: activeCount,
      trialing: trialingCount,
      pastDue: pastDueCount,
      canceled: canceledCount,
    },
    totalCustomers: customers.length,
    planBreakdown,
    intervalBreakdown,
  };
};

module.exports = { computeAnalytics };
