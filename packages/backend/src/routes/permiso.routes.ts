import { Router } from 'express';
import { permisoController } from '../controllers/permiso.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/mis-permisos', permisoController.misPermisos);
router.post('/solicitar', permisoController.solicitar);
router.get('/reporte/pdf', permisoController.reportePDF);
router.get('/reporte/excel', permisoController.reporteExcel);

router.get('/', authorize('permisos_administrativos', 'view'), permisoController.listarTodos);
router.get('/usuario/:userId', authorize('permisos_administrativos', 'view'), permisoController.getByUserId);
router.put('/:id', authorize('permisos_administrativos', 'edit'), permisoController.update);
router.delete('/:id', authorize('permisos_administrativos', 'delete'), permisoController.remove);
router.post('/:id/aprobar', authorize('permisos_administrativos', 'edit'), permisoController.aprobar);
router.post('/:id/rechazar', authorize('permisos_administrativos', 'edit'), permisoController.rechazar);
router.get('/:id/certificado', authenticate, permisoController.certificado);

export default router;
