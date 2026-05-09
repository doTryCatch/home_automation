import { Router } from 'express';
import { DeviceController } from '../controllers';
import { validateBody } from '../middleware';
import {
  registerEspSchema,
  updateEspSchema,
  createDeviceSchema,
  updateDeviceSchema,
  controlDeviceSchema,
  createDeviceTypeSchema,
} from '../validators';
import { authMiddleware } from '../middleware';

const router = Router();

router.use(authMiddleware);

router.post(
  '/esp/register',
  validateBody(registerEspSchema),
  DeviceController.registerEsp
);

router.get(
  '/esp',
  DeviceController.getAllEspDevices
);

router.get(
  '/esp/:id',
  DeviceController.getEspById
);

router.put(
  '/esp/:id',
  validateBody(updateEspSchema),
  DeviceController.updateEsp
);

router.delete(
  '/esp/:id',
  DeviceController.deleteEsp
);

router.post(
  '/types',
  validateBody(createDeviceTypeSchema),
  DeviceController.createDeviceType
);

router.get(
  '/types',
  DeviceController.getAllDeviceTypes
);

router.delete(
  '/types/:id',
  DeviceController.deleteDeviceType
);

router.post(
  '/',
  validateBody(createDeviceSchema),
  DeviceController.createDevice
);

router.get(
  '/',
  DeviceController.getAllDevices
);

router.get(
  '/:id',
  DeviceController.getDeviceById
);

router.put(
  '/:id',
  validateBody(updateDeviceSchema),
  DeviceController.updateDevice
);

router.post(
  '/:id/control',
  validateBody(controlDeviceSchema),
  DeviceController.controlDevice
);

router.delete(
  '/:id',
  DeviceController.deleteDevice
);

export default router;
