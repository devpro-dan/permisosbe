import { Router } from 'express';
import { feriadoController } from '../controllers/feriado.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/', feriadoController.list);
router.post('/', authorize('feriados', 'create'), feriadoController.create);
router.put('/:id', authorize('feriados', 'edit'), feriadoController.update);
router.delete('/:id', authorize('feriados', 'delete'), feriadoController.remove);

export default router;
