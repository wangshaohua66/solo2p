import { Router } from 'express';
import CatalogController from '../controllers/CatalogController.js';
import { auth, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/:auction_id', auth, CatalogController.generate);
router.put('/:auction_id/sort', auth, authorize('editor', 'admin'), CatalogController.updateSort);

export default router;
