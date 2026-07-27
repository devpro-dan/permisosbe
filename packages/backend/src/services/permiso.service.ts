import pool from '../config/database';
import { systemConfigRepository } from '../repositories/systemConfig.repository';
import { PermisoAdministrativo } from '../types';

export const permisoService = {
  async getAvailablePermisos(userId: number) {
    const config = await systemConfigRepository.findByClave('permisos_por_anio');
    const maxPermisos = parseInt(config?.valor || '6', 10);

    const currentYear = new Date().getFullYear();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM permisos_administrativos 
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_solicitud) = $2`,
      [userId, currentYear]
    );

    const used = parseInt(result.rows[0].count, 10);
    return { max: maxPermisos, used, available: maxPermisos - used };
  },

  async findByUser(userId: number) {
    const result = await pool.query(
      'SELECT * FROM permisos_administrativos WHERE user_id = $1 ORDER BY fecha_solicitud DESC',
      [userId]
    );
    return result.rows;
  },

  async findAll() {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.fecha_solicitud DESC`
    );
    return result.rows;
  },

  async findByUserId(userId: number) {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1
       ORDER BY p.fecha_solicitud DESC`,
      [userId]
    );
    return result.rows;
  },

  async checkOverlap(userId: number, fechaInicio: string, fechaFin?: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT id FROM permisos_administrativos
       WHERE user_id = $1 AND estado != 'rechazado'
         AND fecha_inicio <= $3 AND COALESCE(fecha_fin, fecha_inicio) >= $2
       LIMIT 1`,
      [userId, fechaInicio, fechaFin || fechaInicio]
    );
    return result.rows.length > 0;
  },

  async create(data: {
    user_id: number;
    fecha_inicio: string;
    fecha_fin?: string;
    tipo_jornada: 'completa' | 'media';
    motivo: string;
  }): Promise<PermisoAdministrativo> {
    const result = await pool.query(
      `INSERT INTO permisos_administrativos (user_id, fecha_inicio, fecha_fin, tipo_jornada, estado, motivo)
       VALUES ($1, $2, $3, $4, 'en_revision', $5) RETURNING *`,
      [data.user_id, data.fecha_inicio, data.fecha_fin || null, data.tipo_jornada, data.motivo]
    );
    return result.rows[0];
  },

  async updateEstado(id: number, estado: string, motivoRechazo?: string) {
    const result = await pool.query(
      `UPDATE permisos_administrativos SET estado = $1, motivo_rechazo = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [estado, motivoRechazo || null, id]
    );
    return result.rows[0] || null;
  },

  async update(id: number, data: Partial<PermisoAdministrativo>) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at' && key !== 'fecha_solicitud' && key !== 'user_id' && key !== 'estado') {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await pool.query(
      `UPDATE permisos_administrativos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  async delete(id: number) {
    const result = await pool.query('DELETE FROM permisos_administrativos WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  },

  async findById(id: number) {
    const result = await pool.query(
      `SELECT p.*, u.nombres, u.apellido_paterno, u.apellido_materno, u.rut, u.dv, u.cargo, u.email
       FROM permisos_administrativos p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async getYearlyPermisos(userId: number, year: number) {
    const result = await pool.query(
      `SELECT * FROM permisos_administrativos 
       WHERE user_id = $1 AND EXTRACT(YEAR FROM fecha_solicitud) = $2
       ORDER BY fecha_solicitud DESC`,
      [userId, year]
    );
    return result.rows;
  },
};
