import { Router } from 'express';
import { auditLogController } from '../controllers/auditLog.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';

const router = Router();

router.use(authenticate);

router.get('/', authorize('audit_log', 'view'), auditLogController.list);

export default router;
