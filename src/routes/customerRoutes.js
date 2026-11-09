const express = require('express');
const {
  getCustomers,
  getCustomerById,
  createCustomer,
  adjustCustomerBalance,
} = require('../controllers/customerController');
const { validateCustomer } = require('../middleware/validate');

const router = express.Router();

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', validateCustomer, createCustomer);
router.post('/:id/balance', adjustCustomerBalance);

module.exports = router;
