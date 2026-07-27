import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

const actionColumnMap: Record<PermissionAction, string> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
};

export const authorize = (seccion: string, action: PermissionAction) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'No autenticado' });
        return;
      }

      const column = actionColumnMap[action];
      const result = await pool.query(
        `SELECT ${column} FROM role_permissions WHERE rol_id = $1 AND seccion = $2`,
        [req.user.rolId, seccion]
      );

      if (result.rows.length === 0 || !result.rows[0][column]) {
        res.status(403).json({ message: 'No tienes permisos para utilizar esta función' });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Error al verificar permisos' });
    }
  };
};
