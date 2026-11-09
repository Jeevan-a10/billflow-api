const Plan = require('../models/Plan');
const { getStatus } = require('../config/db');

// Default initial plans
const DEFAULT_PLANS = [
  {
    code: 'starter',
    name: 'Starter Plan',
    description: 'Perfect for early stage startups and solo builders',
    monthlyPriceCents: 2900, // $29.00
    yearlyPriceCents: 29000, // $290.00
    includedUnits: { api_calls: 10000, storage_gb: 5, seats: 1 },
    overageRateCents: { api_calls: 1, storage_gb: 15 },
    features: ['Up to 10k API calls/mo', '1 team member', 'Email support', 'Basic analytics'],
    isActive: true,
  },
  {
    code: 'pro',
    name: 'Professional Plan',
    description: 'For growing teams requiring scale, higher limits and priority routing',
    monthlyPriceCents: 9900, // $99.00
    yearlyPriceCents: 99000, // $990.00
    includedUnits: { api_calls: 100000, storage_gb: 50, seats: 5 },
    overageRateCents: { api_calls: 1, storage_gb: 10 },
    features: ['100k API calls/mo', '5 seats included', 'Priority SLA', 'Advanced analytics & export'],
    isActive: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise Plan',
    description: 'Dedicated infrastructure, custom SLAs, audit logs and unlimited seats',
    monthlyPriceCents: 29900, // $299.00
    yearlyPriceCents: 299000, // $2990.00
    includedUnits: { api_calls: 1000000, storage_gb: 500, seats: 25 },
    overageRateCents: { api_calls: 1, storage_gb: 5 },
    features: ['1M+ API calls/mo', '25 seats included', 'Dedicated account manager', '99.99% uptime SLA'],
    isActive: true,
  },
];

let inMemoryPlans = [...DEFAULT_PLANS];

const getPlans = async (req, res, next) => {
  try {
    const { mode } = getStatus();
    if (mode === 'mongodb') {
      const plans = await Plan.find({ isActive: true });
      return res.status(200).json({ success: true, count: plans.length, data: plans });
    }

    const activePlans = inMemoryPlans.filter((p) => p.isActive);
    res.status(200).json({ success: true, count: activePlans.length, data: activePlans });
  } catch (err) {
    next(err);
  }
};

const getPlanByCode = async (req, res, next) => {
  try {
    const code = req.params.code.toLowerCase();
    const { mode } = getStatus();

    if (mode === 'mongodb') {
      const plan = await Plan.findOne({ code });
      if (!plan) {
        return res.status(404).json({ success: false, error: 'PlanNotFound', message: `Plan ${code} not found` });
      }
      return res.status(200).json({ success: true, data: plan });
    }

    const plan = inMemoryPlans.find((p) => p.code.toLowerCase() === code);
    if (!plan) {
      return res.status(404).json({ success: false, error: 'PlanNotFound', message: `Plan ${code} not found` });
    }
    res.status(200).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};

const createPlan = async (req, res, next) => {
  try {
    const { code, name, description, monthlyPriceCents, yearlyPriceCents, includedUnits, overageRateCents, features } = req.body;
    const cleanCode = code.toLowerCase().trim();
    const { mode } = getStatus();

    if (mode === 'mongodb') {
      const existing = await Plan.findOne({ code: cleanCode });
      if (existing) {
        return res.status(409).json({ success: false, error: 'DuplicatePlan', message: `Plan code ${cleanCode} already exists` });
      }
      const newPlan = await Plan.create({
        code: cleanCode,
        name: name.trim(),
        description: description || '',
        monthlyPriceCents,
        yearlyPriceCents: yearlyPriceCents || monthlyPriceCents * 10,
        includedUnits: includedUnits || { api_calls: 10000, storage_gb: 5, seats: 1 },
        overageRateCents: overageRateCents || { api_calls: 1, storage_gb: 15 },
        features: features || [],
        isActive: true,
      });
      return res.status(201).json({ success: true, data: newPlan });
    }

    if (inMemoryPlans.some((p) => p.code.toLowerCase() === cleanCode)) {
      return res.status(409).json({ success: false, error: 'DuplicatePlan', message: `Plan code ${cleanCode} already exists` });
    }

    const newPlan = {
      code: cleanCode,
      name: name.trim(),
      description: description || '',
      monthlyPriceCents,
      yearlyPriceCents: yearlyPriceCents || monthlyPriceCents * 10,
      includedUnits: includedUnits || { api_calls: 10000, storage_gb: 5, seats: 1 },
      overageRateCents: overageRateCents || { api_calls: 1, storage_gb: 15 },
      features: features || [],
      isActive: true,
      createdAt: new Date(),
    };

    inMemoryPlans.push(newPlan);
    res.status(201).json({ success: true, data: newPlan });
  } catch (err) {
    next(err);
  }
};

const resetInMemoryPlans = () => {
  inMemoryPlans = [...DEFAULT_PLANS];
};

const findPlanInternal = (code) => {
  return inMemoryPlans.find((p) => p.code.toLowerCase() === code.toLowerCase()) || null;
};

module.exports = {
  getPlans,
  getPlanByCode,
  createPlan,
  resetInMemoryPlans,
  findPlanInternal,
};
