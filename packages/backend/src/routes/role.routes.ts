import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorize('roles', 'view'), roleController.list);
router.get('/:id', authorize('roles', 'view'), roleController.getById);
router.post('/', authorize('roles', 'create'), roleController.create);
router.put('/:id', authorize('roles', 'edit'), roleController.update);
router.delete('/:id', authorize('roles', 'delete'), roleController.remove);
router.get('/:id/permissions', authorize('roles', 'view'), roleController.getPermissions);
router.post('/:id/permissions', authorize('roles', 'edit'), roleController.setPermission);

export default router;
