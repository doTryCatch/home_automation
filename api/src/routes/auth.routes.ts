import { Router } from 'express';
import { AuthController } from '../controllers';
import { validateBody } from '../middleware';
import { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema, refreshTokenSchema } from '../validators';
import { authMiddleware } from '../middleware';

const router = Router();

router.post(
  '/register',
  validateBody(registerSchema),
  AuthController.register
);

router.post(
  '/login',
  validateBody(loginSchema),
  AuthController.login
);

router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  AuthController.refreshToken
);

router.get(
  '/profile',
  authMiddleware,
  AuthController.getProfile
);

router.put(
  '/profile',
  authMiddleware,
  validateBody(updateProfileSchema),
  AuthController.updateProfile
);

router.put(
  '/change-password',
  authMiddleware,
  validateBody(changePasswordSchema),
  AuthController.changePassword
);

router.delete(
  '/account',
  authMiddleware,
  AuthController.deleteAccount
);

export default router;
