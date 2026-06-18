import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import { validateRequired, validateEmail } from '../middleware/validate.js';

const router = Router();

router.post('/login', validateRequired(['email', 'password']), AuthController.login);
router.post('/register', validateRequired(['name', 'email', 'password']), validateEmail(), AuthController.register);
router.post('/logout', AuthController.logout);

export default router;
