import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorize('usuarios', 'view'), userController.list);
router.get('/:id', authorize('usuarios', 'view'), userController.getById);
router.post('/', authorize('usuarios', 'create'), userController.create);
router.put('/:id', authorize('usuarios', 'edit'), userController.update);
router.patch('/:id/suspend', authorize('usuarios', 'edit'), userController.suspend);
router.delete('/:id', authorize('usuarios', 'delete'), userController.remove);

export default router;
