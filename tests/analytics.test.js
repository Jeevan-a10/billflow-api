const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { computeAnalytics } = require('../src/services/analyticsService');

describe('SaaS Metrics & Analytics Suite', () => {
  test('computeAnalytics: accurately calculates MRR, ARR, ARPU, and Churn', () => {
    const subscriptions = [
      // Active Monthly Pro: $99 * 2 seats = $198/mo
      { status: 'active', billingInterval: 'monthly', unitPriceCents: 9900, seats: 2, planCode: 'pro' },
      // Active Monthly Starter: $29 * 1 seat = $29/mo
      { status: 'active', billingInterval: 'monthly', unitPriceCents: 2900, seats: 1, planCode: 'starter' },
      // Active Yearly Enterprise: $2990/yr * 1 seat = $249.17/mo normalized
      { status: 'active', billingInterval: 'yearly', unitPriceCents: 299000, seats: 1, planCode: 'enterprise' },
      // Canceled Subscription
      { status: 'canceled', billingInterval: 'monthly', unitPriceCents: 2900, seats: 1, planCode: 'starter' },
      // Trialing Subscription
      { status: 'trialing', billingInterval: 'monthly', unitPriceCents: 9900, seats: 1, planCode: 'pro' },
    ];

    const customers = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];

    const result = computeAnalytics({ subscriptions, customers });

    // Expected MRR:
    // Sub 1: 19800
    // Sub 2: 2900
    // Sub 3: round(299000 / 12) = 24917
    // Total MRR: 19800 + 2900 + 24917 = 47617 cents ($476.17)
    assert.equal(result.mrrCents, 47617);
    assert.equal(result.mrrUsd, 476.17);
    assert.equal(result.arrCents, 47617 * 12);
    assert.equal(result.arrUsd, 5714.04);

    // Active count = 3
    assert.equal(result.subscriptions.active, 3);
    assert.equal(result.subscriptions.trialing, 1);
    assert.equal(result.subscriptions.canceled, 1);

    // ARPU = 47617 / 3 = 15872 cents ($158.72)
    assert.equal(result.arpuCents, 15872);
    assert.equal(result.arpuUsd, 158.72);

    // Churn rate = 1 / (3 + 1) = 25%
    assert.equal(result.churnRatePercent, 25.0);

    // Breakdown check
    assert.equal(result.planBreakdown.pro.count, 1);
    assert.equal(result.planBreakdown.starter.count, 1);
    assert.equal(result.planBreakdown.enterprise.count, 1);
  });
});
