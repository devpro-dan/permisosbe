import pool from '../config/database';
import { Role, RolePermission } from '../types';

export const roleRepository = {
  async findAll(): Promise<Role[]> {
    const result = await pool.query('SELECT * FROM roles ORDER BY nombre ASC');
    return result.rows;
  },

  async findById(id: number): Promise<Role | null> {
    const result = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create(nombre: string, descripcion?: string): Promise<Role> {
    const result = await pool.query(
      'INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre, descripcion]
    );
    return result.rows[0];
  },

  async update(id: number, nombre: string, descripcion?: string): Promise<Role | null> {
    const result = await pool.query(
      'UPDATE roles SET nombre = $1, descripcion = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [nombre, descripcion, id]
    );
    return result.rows[0] || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await pool.query('DELETE FROM roles WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  },

  async getPermissions(rolId: number): Promise<RolePermission[]> {
    const result = await pool.query(
      'SELECT * FROM role_permissions WHERE rol_id = $1',
      [rolId]
    );
    return result.rows;
  },

  async setPermission(rolId: number, seccion: string, perms: Partial<RolePermission>): Promise<RolePermission> {
    const result = await pool.query(
      `INSERT INTO role_permissions (rol_id, seccion, can_view, can_create, can_edit, can_delete)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (rol_id, seccion) 
       DO UPDATE SET can_view = COALESCE($3, role_permissions.can_view),
                     can_create = COALESCE($4, role_permissions.can_create),
                     can_edit = COALESCE($5, role_permissions.can_edit),
                     can_delete = COALESCE($6, role_permissions.can_delete)
       RETURNING *`,
      [rolId, seccion, perms.can_view, perms.can_create, perms.can_edit, perms.can_delete]
    );
    return result.rows[0];
  },

  async removePermission(rolId: number, seccion: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM role_permissions WHERE rol_id = $1 AND seccion = $2',
      [rolId, seccion]
    );
    return result.rowCount !== null && result.rowCount > 0;
  },
};
