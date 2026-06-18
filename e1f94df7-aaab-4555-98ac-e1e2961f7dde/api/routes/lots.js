import { Router } from 'express';
import LotController from '../controllers/LotController.js';
import { auth, authorize } from '../middleware/auth.js';
import { validateRequired, validateEnum, CATEGORY_ENUM, LOT_STATUS_ENUM } from '../middleware/validate.js';

const router = Router();

router.get('/', auth, LotController.index);
router.post(
  '/',
  auth,
  authorize('operator', 'admin'),
  validateRequired(['name', 'category']),
  validateEnum('category', CATEGORY_ENUM, '分类'),
  LotController.store
);
router.get('/:id', auth, LotController.show);
router.put(
  '/:id/status',
  auth,
  authorize('operator', 'admin'),
  validateRequired(['status']),
  validateEnum('status', LOT_STATUS_ENUM, '状态'),
  LotController.updateStatus
);
router.post(
  '/:id/appraisal',
  auth,
  authorize('appraiser', 'admin'),
  validateRequired(['estimated_price']),
  LotController.addAppraisal
);
router.get('/:id/consensus', auth, LotController.getConsensus);

export default router;
