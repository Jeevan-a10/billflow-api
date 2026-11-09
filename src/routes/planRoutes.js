const express = require('express');
const { getPlans, getPlanByCode, createPlan } = require('../controllers/planController');
const { validatePlan } = require('../middleware/validate');

const router = express.Router();

router.get('/', getPlans);
router.get('/:code', getPlanByCode);
router.post('/', validatePlan, createPlan);

module.exports = router;
