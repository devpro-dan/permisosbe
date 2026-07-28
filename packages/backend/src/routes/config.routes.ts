import { Router } from 'express';
import { configController } from '../controllers/config.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorize('configuracion', 'view'), configController.list);
router.get('/:clave', authorize('configuracion', 'view'), configController.getByClave);
router.post('/', authorize('configuracion', 'edit'), configController.set);
router.post('/test-email', authorize('configuracion', 'edit'), configController.testEmail);

export default router;
