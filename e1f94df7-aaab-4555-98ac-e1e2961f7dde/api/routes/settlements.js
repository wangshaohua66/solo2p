import { Router } from 'express';
import SettlementController from '../controllers/SettlementController.js';
import { auth, authorize } from '../middleware/auth.js';
import { validateRequired } from '../middleware/validate.js';

const router = Router();

router.get('/', auth, SettlementController.index);
router.get('/:id', auth, SettlementController.show);
router.post(
  '/deposit',
  auth,
  authorize('operator', 'admin'),
  validateRequired(['bidder_id', 'auction_id', 'amount']),
  SettlementController.payDeposit
);
router.post(
  '/deposit/:id/refund',
  auth,
  authorize('operator', 'admin'),
  SettlementController.refundDeposit
);
router.put(
  '/:id/buyer-pay',
  auth,
  authorize('operator', 'admin'),
  SettlementController.buyerPay
);
router.put(
  '/:id/seller-settle',
  auth,
  authorize('operator', 'admin'),
  SettlementController.sellerSettle
);

export default router;
