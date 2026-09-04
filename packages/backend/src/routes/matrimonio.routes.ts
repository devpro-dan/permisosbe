import { Router } from 'express';
import { matrimonioController } from '../controllers/matrimonio.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();
router.use(authenticate);

router.get('/info', matrimonioController.info);
router.get('/mis-permisos', matrimonioController.misPermisos);
router.post('/solicitar', matrimonioController.solicitar);
router.post('/registrar-para-usuario', authorize('permisos_administrativos', 'create'), matrimonioController.solicitarParaUsuario);
router.get('/', authorize('permisos_administrativos', 'view'), matrimonioController.listarTodos);
router.get('/usuario/:userId', authorize('permisos_administrativos', 'view'), matrimonioController.getByUserId);
router.put('/:id', authorize('permisos_administrativos', 'edit'), matrimonioController.update);
router.delete('/:id', authorize('permisos_administrativos', 'delete'), matrimonioController.remove);
router.post('/:id/aprobar', authorize('permisos_administrativos', 'edit'), matrimonioController.aprobar);
router.post('/:id/rechazar', authorize('permisos_administrativos', 'edit'), matrimonioController.rechazar);
router.post('/:id/comprobante', authorize('permisos_administrativos', 'edit'), matrimonioController.subirComprobante);
router.get('/:id/comprobante', authenticate, matrimonioController.descargarComprobante);

export default router;
