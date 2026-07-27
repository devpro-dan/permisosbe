import { Router } from 'express';
import { sessionController } from '../controllers/session.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorize('sesiones', 'view'), sessionController.list);
router.delete('/', authorize('sesiones', 'delete'), sessionController.removeAll);
router.delete('/:id', authorize('sesiones', 'delete'), sessionController.remove);

export default router;
