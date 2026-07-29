import pool from '../config/database';
import { AuditLog } from '../types';

export const auditLogRepository = {
  async create(data: {
    user_id: number | null;
    username: string;
    accion: string;
    entidad: string;
    entidad_id?: number | null;
    detalle?: string | null;
    ip_address?: string | null;
  }): Promise<AuditLog> {
    const result = await pool.query(
      `INSERT INTO audit_log (user_id, username, accion, entidad, entidad_id, detalle, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.user_id, data.username, data.accion, data.entidad, data.entidad_id ?? null, data.detalle ?? null, data.ip_address ?? null]
    );
    return result.rows[0];
  },

  async findAll(filters: {
    limit?: number;
    offset?: number;
    entidad?: string;
    accion?: string;
    user_id?: number;
    desde?: string;
    hasta?: string;
  }): Promise<{ rows: AuditLog[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filters.entidad) {
      conditions.push(`entidad = $${idx++}`);
      values.push(filters.entidad);
    }
    if (filters.accion) {
      conditions.push(`accion = $${idx++}`);
      values.push(filters.accion);
    }
    if (filters.user_id) {
      conditions.push(`user_id = $${idx++}`);
      values.push(filters.user_id);
    }
    if (filters.desde) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(filters.desde);
    }
    if (filters.hasta) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(filters.hasta);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_log ${where}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    return { rows: result.rows, total };
  },
};
