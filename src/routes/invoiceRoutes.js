const express = require('express');
const {
  getInvoices,
  getInvoiceById,
  createManualInvoice,
  payInvoice,
  voidInvoice,
} = require('../controllers/invoiceController');

const router = express.Router();

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createManualInvoice);
router.post('/:id/pay', payInvoice);
router.post('/:id/void', voidInvoice);

module.exports = router;
