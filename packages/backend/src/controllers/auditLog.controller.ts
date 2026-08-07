import { Request, Response } from 'express';
import { auditLogService } from '../services/auditLog.service';

export const auditLogController = {
  async list(req: Request, res: Response) {
    try {
      const { limit, offset, entidad, accion, user_id, desde, hasta } = req.body;
      const result = await auditLogService.list({
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        entidad: entidad as string | undefined,
        accion: accion as string | undefined,
        user_id: user_id ? parseInt(user_id as string, 10) : undefined,
        desde: desde as string | undefined,
        hasta: hasta as string | undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener logs de auditoría' });
    }
  },
};
