import { Request } from 'express';
import { auditLogRepository } from '../repositories/auditLog.repository';
import { logger } from '../utils/logger';

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getUsername(req: Request): string {
  return (req as any).user?.username || 'sistema';
}

function getUserId(req: Request): number | null {
  return (req as any).user?.userId || null;
}

export const auditLogService = {
  async register(req: Request, accion: string, entidad: string, entidad_id?: number | null, detalle?: string | null) {
    const log = await auditLogRepository.create({
      user_id: getUserId(req),
      username: getUsername(req),
      accion,
      entidad,
      entidad_id,
      detalle,
      ip_address: getIp(req),
    });
    logger.info('AUDIT', `${accion} ${entidad}${entidad_id ? ` #${entidad_id}` : ''}`, detalle);
    return log;
  },

  async registerDirect(data: {
    user_id: number | null;
    username: string;
    accion: string;
    entidad: string;
    entidad_id?: number | null;
    detalle?: string | null;
    ip_address?: string | null;
  }) {
    const log = await auditLogRepository.create(data);
    logger.info('AUDIT', `${data.accion} ${data.entidad}${data.entidad_id ? ` #${data.entidad_id}` : ''}`, data.detalle);
    return log;
  },

  async list(filters: {
    limit?: number;
    offset?: number;
    entidad?: string;
    accion?: string;
    user_id?: number;
    desde?: string;
    hasta?: string;
  }) {
    return auditLogRepository.findAll(filters);
  },
};
