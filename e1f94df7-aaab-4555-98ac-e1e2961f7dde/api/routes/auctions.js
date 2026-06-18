import { Router } from 'express';
import AuctionController from '../controllers/AuctionController.js';
import { auth, authorize } from '../middleware/auth.js';
import { validateRequired, validateEnum, AUCTION_TYPE_ENUM, AUCTION_STATUS_ENUM } from '../middleware/validate.js';

const router = Router();

router.get('/', auth, AuctionController.index);
router.post(
  '/',
  auth,
  authorize('operator', 'admin'),
  validateRequired(['name']),
  validateEnum('type', AUCTION_TYPE_ENUM, '拍卖会类型'),
  AuctionController.store
);
router.get('/:id', auth, AuctionController.show);
router.get('/:id/lots', auth, AuctionController.getLots);
router.post(
  '/:id/bid',
  auth,
  authorize('bidder', 'admin'),
  validateRequired(['lot_id', 'amount']),
  AuctionController.placeBid
);
router.post(
  '/:id/hammer',
  auth,
  authorize('auctioneer', 'admin'),
  validateRequired(['lot_id', 'result']),
  AuctionController.hammer
);

export default router;
