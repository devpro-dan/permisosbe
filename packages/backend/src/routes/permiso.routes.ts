import { Router } from 'express';
import { permisoController } from '../controllers/permiso.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/mis-permisos', permisoController.misPermisos);
router.post('/solicitar', permisoController.solicitar);
router.post('/registrar-para-usuario', authorize('permisos_administrativos', 'create'), permisoController.solicitarParaUsuario);
router.post('/reporte/pdf', permisoController.reportePDF);
router.post('/reporte/excel', permisoController.reporteExcel);
router.post('/reporte/consulta', authorize('reportes', 'view'), permisoController.reporteConsulta);
router.post('/reporte/general/pdf', authorize('reportes', 'view'), permisoController.reporteGeneralPDF);
router.post('/reporte/general/excel', authorize('reportes', 'view'), permisoController.reporteGeneralExcel);
router.post('/reporte/trabajadores', authorize('reportes', 'view'), permisoController.reporteResumenTrabajadores);
router.post('/reporte/trabajadores/pdf', authorize('reportes', 'view'), permisoController.reporteResumenTrabajadoresPDF);
router.post('/reporte/trabajadores/excel', authorize('reportes', 'view'), permisoController.reporteResumenTrabajadoresExcel);

router.get('/', authorize('permisos_administrativos', 'view'), permisoController.listarTodos);
router.get('/usuario/:userId', authorize('permisos_administrativos', 'view'), permisoController.getByUserId);
router.put('/:id', authorize('permisos_administrativos', 'edit'), permisoController.update);
router.delete('/:id', authorize('permisos_administrativos', 'delete'), permisoController.remove);
router.post('/:id/aprobar', authorize('permisos_administrativos', 'edit'), permisoController.aprobar);
router.post('/:id/rechazar', authorize('permisos_administrativos', 'edit'), permisoController.rechazar);
router.get('/:id/certificado', authenticate, permisoController.certificado);
router.post('/:id/comprobante', authorize('permisos_administrativos', 'edit'), permisoController.subirComprobante);
router.get('/:id/comprobante', authenticate, permisoController.descargarComprobante);

export default router;
