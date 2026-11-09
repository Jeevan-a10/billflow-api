/**
 * Proration calculation engine for mid-cycle plan upgrades and seat changes.
 */

const calculateProration = ({
  oldUnitPriceCents,
  newUnitPriceCents,
  periodStart,
  periodEnd,
  changeDate = new Date(),
  oldSeats = 1,
  newSeats = 1,
}) => {
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const changeMs = new Date(changeDate).getTime();

  if (endMs <= startMs) {
    throw new Error('periodEnd must be strictly after periodStart');
  }

  const totalDuration = endMs - startMs;
  const clampedChange = Math.min(Math.max(changeMs, startMs), endMs);
  const remainingDuration = endMs - clampedChange;
  const fractionRemaining = remainingDuration / totalDuration;

  const oldTotalCostCents = oldUnitPriceCents * oldSeats;
  const newTotalCostCents = newUnitPriceCents * newSeats;

  // Unused portion of previous plan/seat count to credit back
  const unusedCreditCents = Math.round(oldTotalCostCents * fractionRemaining);

  // New portion to charge for remainder of billing cycle
  const newChargeCents = Math.round(newTotalCostCents * fractionRemaining);

  // Net difference (positive = customer pays diff; negative = credit applied)
  const netAdjustmentCents = newChargeCents - unusedCreditCents;

  return {
    totalDurationDays: Number((totalDuration / (1000 * 60 * 60 * 24)).toFixed(2)),
    remainingDays: Number((remainingDuration / (1000 * 60 * 60 * 24)).toFixed(2)),
    fractionRemaining: Number(fractionRemaining.toFixed(4)),
    unusedCreditCents,
    newChargeCents,
    netAdjustmentCents,
  };
};

module.exports = { calculateProration };
