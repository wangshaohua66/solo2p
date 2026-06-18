import { Router } from 'express';
import DashboardController from '../controllers/DashboardController.js';
import { auth, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/stats', auth, DashboardController.stats);
router.get('/kpi', auth, DashboardController.kpi);
router.get('/sold-rate-trend', auth, DashboardController.soldRateTrend);
router.get('/category-distribution', auth, DashboardController.categoryDistribution);
router.get('/price-comparison', auth, DashboardController.priceComparison);
router.get('/price-diff', auth, DashboardController.priceDiff);
router.get('/commission', auth, DashboardController.commission);
router.get('/commission-summary', auth, DashboardController.commissionSummary);

export default router;
